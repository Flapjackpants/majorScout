"""Flask API for MajorScout."""

from __future__ import annotations

import json
import os
from functools import wraps

from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, session
from flask_cors import CORS
import stripe

from ai import generate_essay_guidance, generate_followup_questions
from data_loader import load_programs
from db import QuizAttempt, User, get_session, init_db
from matching import Matcher, build_student_profile

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
}

CORS(
    app,
    supports_credentials=True,
    origins=[FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

PROGRAMS = load_programs()
MATCHER = Matcher(PROGRAMS)

with open(os.path.join(os.path.dirname(__file__), "questions.json")) as f:
    QUESTION_BANK = json.load(f)

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTION_BANK["questions"]}

init_db()

oauth = OAuth(app)
google = oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    db = get_session()
    try:
        user = db.get(User, user_id)
        if user is None:
            return None
        # Keep attribute access after the session closes.
        db.expunge(user)
        return user
    finally:
        db.close()


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        return fn(user, *args, **kwargs)

    return wrapper


def premium_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        if not user.is_premium:
            return jsonify({"error": "Premium subscription required.", "upgrade": True}), 403
        return fn(user, *args, **kwargs)

    return wrapper


def public_question(q: dict) -> dict:
    out = {
        "id": q["id"],
        "section": q["section"],
        "text": q["text"],
        "type": q.get("type", "single"),
    }
    if q.get("type") == "number":
        meta = dict(q.get("input") or {})
        meta.pop("strength_map", None)
        out["input"] = meta
    elif q.get("type") == "text":
        out["placeholder"] = q.get("placeholder", "")
    else:
        out["options"] = [{"id": o["id"], "label": o["label"]} for o in q.get("options", [])]
    return out


def gate_results(results: list, is_premium: bool) -> list:
    """Free users see ranks #2–#8; #1 and #9+ are locked."""
    gated = []
    for i, program in enumerate(results):
        rank = i + 1
        locked = (not is_premium) and (rank == 1 or rank >= 9)
        if locked:
            gated.append(
                {
                    "id": program.get("id"),
                    "rank": rank,
                    "locked": True,
                    "match_percent": program.get("match_percent"),
                    "university": "Premium match",
                    "major": "Unlock to see this program",
                    "description": "",
                    "acceptance_display": "—",
                    "ranking": None,
                    "college": None,
                    "why": [],
                }
            )
        else:
            gated.append({**program, "rank": rank, "locked": False})
    return gated


def persist_attempt(user: User | None, answers: dict, profile: dict, results: list):
    if user is None:
        return None
    db = get_session()
    try:
        # Re-fetch attached to this session
        u = db.get(User, user.id)
        attempt = QuizAttempt(user_id=u.id)
        attempt.answers = answers
        attempt.profile = profile
        attempt.results = results
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt.id
    finally:
        db.close()


@app.get("/api/stats")
def stats():
    universities = {p["university"] for p in PROGRAMS}
    majors = {p["major"].lower() for p in PROGRAMS}
    return jsonify(
        {
            "programs": len(PROGRAMS),
            "universities": len(universities),
            "majors": len(majors),
            "questions": len(QUESTION_BANK["questions"]),
        }
    )


@app.get("/api/questions")
def questions():
    public = {
        "sections": QUESTION_BANK["sections"],
        "questions": [public_question(q) for q in QUESTION_BANK["questions"]],
    }
    return jsonify(public)


@app.post("/api/match")
def match():
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers")
    if not isinstance(answers, dict) or not answers:
        return jsonify({"error": "Request body must include an 'answers' object."}), 400

    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    if not profile["interest"]:
        return jsonify({"error": "Not enough interest answers to build a match."}), 400

    user = current_user()
    is_premium = bool(user and user.is_premium)
    raw = MATCHER.match(profile, top_n=15)
    results = gate_results(raw, is_premium)
    attempt_id = persist_attempt(user, answers, profile, raw)

    return jsonify(
        {
            "results": results,
            "is_premium": is_premium,
            "attempt_id": attempt_id,
            "profile_summary": {
                "strength": profile["strength"],
                "top_interests": sorted(
                    profile["interest"].items(), key=lambda x: x[1], reverse=True
                )[:5],
            },
        }
    )


# ── Auth ─────────────────────────────────────────────────────────────────────


@app.get("/api/auth/google")
def auth_google():
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        return jsonify({"error": "Google OAuth is not configured."}), 503
    # Use the Vite/frontend origin so the session cookie is set on the SPA host.
    redirect_uri = f"{FRONTEND_URL}/api/auth/callback"
    return google.authorize_redirect(redirect_uri)


@app.get("/api/auth/callback")
def auth_callback():
    token = google.authorize_access_token()
    info = token.get("userinfo") or google.parse_id_token(token)
    if not info:
        return redirect(f"{FRONTEND_URL}/?auth=error")

    google_id = info["sub"]
    email = (info.get("email") or "").lower()
    name = info.get("name")
    picture = info.get("picture")

    db = get_session()
    try:
        user = db.query(User).filter_by(google_id=google_id).one_or_none()
        if user is None:
            user = db.query(User).filter_by(email=email).one_or_none()
        if user is None:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                picture=picture,
                is_admin=email in ADMIN_EMAILS,
            )
            db.add(user)
        else:
            user.google_id = google_id
            user.name = name or user.name
            user.picture = picture or user.picture
            if email in ADMIN_EMAILS:
                user.is_admin = True
        db.commit()
        db.refresh(user)
        session["user_id"] = user.id
        session.permanent = True
    finally:
        db.close()

    return redirect(f"{FRONTEND_URL}/?auth=success")


@app.get("/api/auth/me")
def auth_me():
    user = current_user()
    if user is None:
        return jsonify({"user": None})
    return jsonify({"user": user.to_public()})


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


@app.post("/api/quiz/save")
@login_required
def quiz_save(user):
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers")
    if not isinstance(answers, dict):
        return jsonify({"error": "answers required"}), 400
    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    results = payload.get("results")
    attempt_id = persist_attempt(user, answers, profile, results if isinstance(results, list) else [])
    return jsonify({"attempt_id": attempt_id})


# ── Billing ──────────────────────────────────────────────────────────────────


@app.post("/api/billing/checkout")
@login_required
def billing_checkout(user):
    if not stripe.api_key or not STRIPE_PRICE_ID:
        return jsonify({"error": "Stripe is not configured."}), 503

    db = get_session()
    try:
        u = db.get(User, user.id)
        if not u.stripe_customer_id:
            customer = stripe.Customer.create(email=u.email, name=u.name or u.email)
            u.stripe_customer_id = customer["id"]
            db.commit()
        customer_id = u.stripe_customer_id
    finally:
        db.close()

    checkout = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/?billing=success",
        cancel_url=f"{FRONTEND_URL}/?billing=cancel",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id)},
    )
    return jsonify({"url": checkout.url})


@app.post("/api/billing/portal")
@login_required
def billing_portal(user):
    if not stripe.api_key:
        return jsonify({"error": "Stripe is not configured."}), 503
    if not user.stripe_customer_id:
        return jsonify({"error": "No billing customer on file."}), 400
    portal = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=FRONTEND_URL,
    )
    return jsonify({"url": portal.url})


@app.post("/api/billing/webhook")
def billing_webhook():
    payload = request.data
    sig = request.headers.get("Stripe-Signature", "")
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        else:
            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    etype = event["type"]
    data = event["data"]["object"]

    db = get_session()
    try:
        if etype == "checkout.session.completed":
            user_id = (data.get("metadata") or {}).get("user_id") or data.get(
                "client_reference_id"
            )
            customer_id = data.get("customer")
            if user_id:
                u = db.get(User, int(user_id))
                if u:
                    if customer_id:
                        u.stripe_customer_id = customer_id
                    u.subscription_status = "active"
                    db.commit()
        elif etype in {
            "customer.subscription.updated",
            "customer.subscription.deleted",
            "customer.subscription.created",
        }:
            customer_id = data.get("customer")
            status = data.get("status")
            if etype == "customer.subscription.deleted":
                status = "canceled"
            u = db.query(User).filter_by(stripe_customer_id=customer_id).one_or_none()
            if u:
                u.subscription_status = status
                db.commit()
    finally:
        db.close()

    return jsonify({"ok": True})


# ── Premium AI ───────────────────────────────────────────────────────────────


@app.post("/api/premium/followup")
@premium_required
def premium_followup(user):
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers") or {}
    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    questions_payload = generate_followup_questions(profile, answers)
    # Normalize for the client
    mcq = []
    for q in questions_payload.get("mcq") or []:
        mcq.append(
            {
                "id": q["id"],
                "section": "premium",
                "type": "single",
                "text": q["text"],
                "options": [
                    {"id": o["id"], "label": o["label"]} for o in q.get("options", [])
                ],
            }
        )
    written = []
    for q in questions_payload.get("written") or []:
        written.append(
            {
                "id": q["id"],
                "section": "premium",
                "type": "text",
                "text": q["text"],
                "placeholder": q.get("placeholder", "Write a short answer…"),
            }
        )
    return jsonify({"questions": mcq + written})


@app.post("/api/premium/essay-guidance")
@premium_required
def premium_essay(user):
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers") or {}
    results = payload.get("results") or []
    # Prefer unlocked full results if client only sent gated ones
    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    unlocked = [r for r in results if not r.get("locked")]
    if len(unlocked) < 3:
        unlocked = MATCHER.match(profile, top_n=15)
    guidance = generate_essay_guidance(profile, unlocked)
    return jsonify({"guidance": guidance})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
