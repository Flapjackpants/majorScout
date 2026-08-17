"""Flask API for MajorScout."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from functools import wraps

from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
import stripe

from ai import generate_essay_guidance, generate_followup_questions
from data_loader import load_programs
from db import QuizAttempt, User, get_session, init_db
from matching import Matcher, build_student_profile

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
FRONTEND_DIST = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=FRONTEND_URL.startswith("https://"),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)
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


def attempt_access_unlocked(user: User, attempt: QuizAttempt) -> bool:
    if user.is_admin:
        return True
    return bool(attempt.unlocked)


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


def gate_results(results: list, unlocked: bool) -> list:
    """Locked attempts see ranks #2–#8; #1 and #9+ are locked until paid unlock."""
    gated = []
    for i, program in enumerate(results):
        rank = i + 1
        locked = (not unlocked) and (rank == 1 or rank >= 9)
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


def attempt_summary(attempt: QuizAttempt, unlocked: bool) -> dict:
    raw = attempt.results or []
    summary = {
        "id": attempt.id,
        "created_at": attempt.created_at.isoformat() if attempt.created_at else None,
        "unlocked": unlocked,
        "top_university": None,
        "top_major": None,
        "match_percent": None,
    }
    if unlocked and raw:
        top = raw[0]
        summary["top_university"] = top.get("university")
        summary["top_major"] = top.get("major")
        summary["match_percent"] = top.get("match_percent")
    elif raw:
        # Free mid-range peek for list cards
        mid = raw[1] if len(raw) > 1 else None
        if mid:
            summary["top_university"] = mid.get("university")
            summary["top_major"] = mid.get("major")
            summary["match_percent"] = mid.get("match_percent")
    return summary


def persist_attempt(
    user: User | None,
    answers: dict,
    profile: dict,
    results: list,
    *,
    unlocked: bool = False,
):
    if user is None:
        return None
    db = get_session()
    try:
        u = db.get(User, user.id)
        attempt = QuizAttempt(user_id=u.id, unlocked=unlocked)
        if unlocked:
            attempt.unlocked_at = datetime.now(timezone.utc)
        attempt.answers = answers
        attempt.profile = profile
        attempt.results = results
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt.id
    finally:
        db.close()


def serialize_attempt_payload(user: User, attempt: QuizAttempt) -> dict:
    unlocked = attempt_access_unlocked(user, attempt)
    raw = attempt.results or []
    return {
        "attempt_id": attempt.id,
        "unlocked": unlocked,
        "results": gate_results(raw, unlocked),
        "answers": attempt.answers,
        "profile_summary": {
            "strength": (attempt.profile or {}).get("strength"),
            "top_interests": sorted(
                ((attempt.profile or {}).get("interest") or {}).items(),
                key=lambda x: x[1],
                reverse=True,
            )[:5],
        },
    }


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
    # New attempts start locked; admins see full results immediately.
    unlocked = bool(user and user.is_admin)
    raw = MATCHER.match(profile, top_n=15)
    results = gate_results(raw, unlocked)
    attempt_id = persist_attempt(user, answers, profile, raw, unlocked=unlocked)

    return jsonify(
        {
            "results": results,
            "unlocked": unlocked,
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
    """Persist a quiz from answers; always recompute ungated results server-side."""
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers")
    if not isinstance(answers, dict):
        return jsonify({"error": "answers required"}), 400
    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    if not profile["interest"]:
        return jsonify({"error": "Not enough interest answers to build a match."}), 400
    raw = MATCHER.match(profile, top_n=15)
    unlocked = bool(user.is_admin)
    attempt_id = persist_attempt(user, answers, profile, raw, unlocked=unlocked)
    return jsonify(
        {
            "attempt_id": attempt_id,
            "unlocked": unlocked,
            "results": gate_results(raw, unlocked),
            "profile_summary": {
                "strength": profile["strength"],
                "top_interests": sorted(
                    profile["interest"].items(), key=lambda x: x[1], reverse=True
                )[:5],
            },
        }
    )


@app.get("/api/quiz/attempts")
@login_required
def quiz_attempts_list(user):
    db = get_session()
    try:
        rows = (
            db.query(QuizAttempt)
            .filter_by(user_id=user.id)
            .order_by(QuizAttempt.created_at.desc())
            .all()
        )
        return jsonify(
            {
                "attempts": [
                    attempt_summary(a, attempt_access_unlocked(user, a)) for a in rows
                ]
            }
        )
    finally:
        db.close()


@app.get("/api/quiz/attempts/<int:attempt_id>")
@login_required
def quiz_attempt_detail(user, attempt_id: int):
    db = get_session()
    try:
        attempt = db.get(QuizAttempt, attempt_id)
        if attempt is None or attempt.user_id != user.id:
            return jsonify({"error": "Attempt not found."}), 404
        return jsonify(serialize_attempt_payload(user, attempt))
    finally:
        db.close()


# ── Billing ──────────────────────────────────────────────────────────────────


@app.post("/api/billing/checkout")
@login_required
def billing_checkout(user):
    if not stripe.api_key or not STRIPE_PRICE_ID:
        return jsonify({"error": "Stripe is not configured."}), 503

    payload = request.get_json(silent=True) or {}
    attempt_id = payload.get("attempt_id")
    if not attempt_id:
        return jsonify({"error": "attempt_id is required to unlock results."}), 400

    db = get_session()
    try:
        u = db.get(User, user.id)
        attempt = db.get(QuizAttempt, int(attempt_id))
        if attempt is None or attempt.user_id != u.id:
            return jsonify({"error": "Attempt not found."}), 404
        if attempt.unlocked or u.is_admin:
            return jsonify({"error": "This attempt is already unlocked."}), 400

        if not u.stripe_customer_id:
            customer = stripe.Customer.create(email=u.email, name=u.name or u.email)
            u.stripe_customer_id = customer["id"]
            db.commit()
        customer_id = u.stripe_customer_id
        aid = attempt.id
    finally:
        db.close()

    checkout = stripe.checkout.Session.create(
        mode="payment",
        customer=customer_id,
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/?billing=success&attempt_id={aid}",
        cancel_url=f"{FRONTEND_URL}/?billing=cancel&attempt_id={aid}",
        client_reference_id=str(user.id),
        metadata={"user_id": str(user.id), "attempt_id": str(aid)},
    )
    return jsonify({"url": checkout.url})


@app.post("/api/billing/portal")
@login_required
def billing_portal(user):
    return jsonify({"error": "Billing portal is not available for one-time unlocks."}), 410


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

    if etype != "checkout.session.completed":
        return jsonify({"ok": True})

    db = get_session()
    try:
        meta = data.get("metadata") or {}
        attempt_id = meta.get("attempt_id")
        user_id = meta.get("user_id") or data.get("client_reference_id")
        customer_id = data.get("customer")
        session_id = data.get("id")

        if attempt_id:
            attempt = db.get(QuizAttempt, int(attempt_id))
            if attempt and (not user_id or attempt.user_id == int(user_id)):
                attempt.unlocked = True
                attempt.unlocked_at = datetime.now(timezone.utc)
                attempt.stripe_checkout_session_id = session_id
                if customer_id:
                    u = db.get(User, attempt.user_id)
                    if u and not u.stripe_customer_id:
                        u.stripe_customer_id = customer_id
                db.commit()
        elif user_id and customer_id:
            u = db.get(User, int(user_id))
            if u:
                u.stripe_customer_id = customer_id
                db.commit()
    finally:
        db.close()

    return jsonify({"ok": True})


# ── Account AI ───────────────────────────────────────────────────────────────


@app.post("/api/premium/followup")
@login_required
def premium_followup(user):
    """AI follow-ups require a signed-in account (not a paid unlock)."""
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers") or {}
    profile = build_student_profile(answers, QUESTIONS_BY_ID)
    questions_payload = generate_followup_questions(profile, answers)
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
@login_required
def premium_essay(user):
    payload = request.get_json(silent=True) or {}
    attempt_id = payload.get("attempt_id")
    if not attempt_id:
        return jsonify({"error": "attempt_id is required."}), 400

    db = get_session()
    try:
        attempt = db.get(QuizAttempt, int(attempt_id))
        if attempt is None or attempt.user_id != user.id:
            return jsonify({"error": "Attempt not found."}), 404
        if not attempt_access_unlocked(user, attempt):
            return jsonify({"error": "Unlock this result set to view essay guidance.", "upgrade": True}), 403
        answers = attempt.answers
        profile = attempt.profile or build_student_profile(answers, QUESTIONS_BY_ID)
        unlocked_results = attempt.results or []
    finally:
        db.close()

    if len(unlocked_results) < 3:
        unlocked_results = MATCHER.match(profile, top_n=15)
    guidance = generate_essay_guidance(profile, unlocked_results)
    return jsonify({"guidance": guidance})


@app.get("/", defaults={"path": ""})
@app.get("/<path:path>")
def serve_spa(path: str):
    """Serve the Vite build when present (Railway/Docker). Dev still uses Vite."""
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    if path and os.path.isfile(os.path.join(FRONTEND_DIST, path)):
        return send_from_directory(FRONTEND_DIST, path)
    index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(index):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"error": "Frontend is not built."}), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=True)

