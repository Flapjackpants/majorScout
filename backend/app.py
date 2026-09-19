"""Flask API for MajorScout."""

from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from functools import wraps

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from flask import Flask, jsonify, make_response, redirect, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
import stripe
from sqlalchemy import desc, func, or_

from ai import (
    ACTIVITIES_QUESTION,
    ESSAY_PROMPT_MAX,
    ESSAY_RESPONSE_MAX,
    generate_essay_guidance,
    generate_followup_questions,
    grade_essay,
)
from data_loader import load_programs
from db import (
    ADMISSION_DECISIONS,
    ADMISSION_ROUNDS,
    AdmissionResult,
    AnalyticsEvent,
    AnalyticsSession,
    Essay,
    QuizAttempt,
    User,
    get_session,
    init_db,
)
from matching import Matcher, build_student_profile

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-change-me")
_CONFIGURED_FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
FRONTEND_DIST = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=_CONFIGURED_FRONTEND_URL.startswith("https://"),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)
ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
}
ADMIN_EMAILS.update({e.replace("@@", "@") for e in list(ADMIN_EMAILS)})

_CORS_ORIGINS = {
    _CONFIGURED_FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://majorscout.com",
    "https://www.majorscout.com",
    "http://majorscout.com",
    "http://www.majorscout.com",
}

CORS(
    app,
    supports_credentials=True,
    origins=sorted(_CORS_ORIGINS),
)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")


def _stripe_to_dict(obj) -> dict:
    """Return a plain dict for a Stripe API object.

    stripe-python >= 15 removed ``dict`` inheritance from ``StripeObject`` so
    ``.get()`` raises. ``to_dict()`` recursively converts to native types on
    every supported version; plain dicts and ``None`` pass through unchanged.
    """
    if obj is None:
        return {}
    to_dict = getattr(obj, "to_dict", None)
    if callable(to_dict):
        try:
            converted = to_dict()
            if isinstance(converted, dict):
                return converted
        except Exception:
            pass
    if isinstance(obj, dict):
        return dict(obj)
    return {}


def _stripe_id(value):
    """Stripe fields may be a bare id string or an expanded object; return the id."""
    if isinstance(value, str):
        return value
    if value is None:
        return None
    return _stripe_to_dict(value).get("id")


PROGRAMS = load_programs()
MATCHER = Matcher(PROGRAMS)

with open(os.path.join(os.path.dirname(__file__), "questions.json")) as f:
    QUESTION_BANK = json.load(f)

QUESTIONS_BY_ID = {q["id"]: q for q in QUESTION_BANK["questions"]}

init_db()


def _site_url() -> str:
    """Public origin for OAuth redirects — must match the browser tab (scheme + host)."""
    if request:
        return f"{request.scheme}://{request.host}".rstrip("/")
    return _CONFIGURED_FRONTEND_URL


@app.before_request
def _sync_session_cookie_security():
    # HTTPS browsers require Secure session cookies; ProxyFix makes request.scheme reliable.
    if request.scheme == "https":
        app.config["SESSION_COOKIE_SECURE"] = True
    # Share the OAuth session cookie across apex and www so Google's callback host matches.
    host = (request.host or "").split(":")[0].lower()
    if host == "majorscout.com" or host.endswith(".majorscout.com"):
        app.config["SESSION_COOKIE_DOMAIN"] = ".majorscout.com"
    else:
        app.config["SESSION_COOKIE_DOMAIN"] = None


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
        has_unlocked = (
            db.query(QuizAttempt.id)
            .filter(QuizAttempt.user_id == user_id, QuizAttempt.unlocked == True)
            .first()
            is not None
        )
        user._has_unlocked = has_unlocked
        if (has_unlocked or user.is_admin) and user.subscription_status not in ("pro", "pro_plus", "active"):
            user.subscription_status = "pro"
            db.commit()
        if user.email and (
            user.email.lower() in ADMIN_EMAILS
            or user.email.lower().replace("@@", "@") in ADMIN_EMAILS
        ):
            if not user.is_admin:
                user.is_admin = True
                db.commit()
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


def admin_required(fn):
    """Requires an authenticated user who has admin privileges."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        if not user.is_admin:
            return jsonify({"error": "Admin privileges required."}), 403
        return fn(user, *args, **kwargs)

    return wrapper


def pro_required(fn):
    """Sign-in AND account-level PRO+ (any unlocked attempt / admin)."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        if not user.is_pro:
            return (
                jsonify({"error": "PRO+ is required for this feature.", "upgrade": True}),
                403,
            )
        return fn(user, *args, **kwargs)

    return wrapper


def attempt_access_unlocked(user: User, attempt: QuizAttempt) -> bool:
    if user.is_admin or user.is_pro:
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
    site = _site_url()
    redirect_uri = f"{site}/api/auth/callback"
    kwargs = {}
    if request.args.get("prompt") == "select_account":
        kwargs["prompt"] = "select_account"
    return google.authorize_redirect(redirect_uri, **kwargs)


def _oauth_userinfo(token):
    info = token.get("userinfo") if token else None
    if info:
        return info
    resp = google.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        token=token,
    )
    return resp.json()


@app.get("/api/auth/callback")
def auth_callback():
    site = _site_url()
    try:
        token = google.authorize_access_token()
        info = _oauth_userinfo(token)
    except OAuthError:
        return redirect(f"{site}/?auth=error")
    except Exception:
        return redirect(f"{site}/?auth=error")

    if not info:
        return redirect(f"{site}/?auth=error")

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

    return redirect(f"{site}/?auth=success")


@app.get("/api/auth/me")
def auth_me():
    user = current_user()
    if user is None:
        return jsonify({"user": None})
    return jsonify({"user": user.to_public()})


@app.post("/api/auth/logout")
def auth_logout():
    cookie_domain = app.config.get("SESSION_COOKIE_DOMAIN")
    cookie_secure = bool(app.config.get("SESSION_COOKIE_SECURE"))
    session.clear()
    resp = make_response(jsonify({"ok": True}))
    # Cloud: SESSION_COOKIE_DOMAIN may have changed over time. Browsers can keep a
    # host-only "session" cookie alongside a Domain=.majorscout.com one; Flask's
    # session.clear() only expires the configured Domain cookie. Clear both.
    name = app.config.get("SESSION_COOKIE_NAME", "session")
    cookie_kw = {
        "path": "/",
        "secure": cookie_secure,
        "httponly": True,
        "samesite": app.config.get("SESSION_COOKIE_SAMESITE") or "Lax",
    }
    resp.delete_cookie(name, **cookie_kw)
    if cookie_domain:
        resp.delete_cookie(name, domain=cookie_domain, **cookie_kw)
        bare = str(cookie_domain).lstrip(".")
        if bare and bare != cookie_domain:
            resp.delete_cookie(name, domain=bare, **cookie_kw)
    return resp


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

    db = get_session()
    try:
        u = db.get(User, user.id)
        attempt = None
        if attempt_id:
            attempt = db.get(QuizAttempt, int(attempt_id))
            if attempt is None or attempt.user_id != u.id:
                return jsonify({"error": "Attempt not found."}), 404
        else:
            attempt = (
                db.query(QuizAttempt)
                .filter_by(user_id=u.id)
                .order_by(QuizAttempt.created_at.desc())
                .first()
            )

        if attempt and (attempt.unlocked or u.is_admin):
            return jsonify({"error": "This attempt is already unlocked with PRO+."}), 400

        if not u.stripe_customer_id:
            customer = stripe.Customer.create(email=u.email, name=u.name or u.email)
            u.stripe_customer_id = customer["id"]
            db.commit()
        customer_id = u.stripe_customer_id
        aid = attempt.id if attempt else None
    finally:
        db.close()

    metadata = {"user_id": str(user.id)}
    if aid:
        metadata["attempt_id"] = str(aid)

    attempt_param = f"&attempt_id={aid}" if aid else ""
    checkout = stripe.checkout.Session.create(
        mode="payment",
        customer=customer_id,
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=f"{_site_url()}/?billing=success&session_id={{CHECKOUT_SESSION_ID}}{attempt_param}",
        cancel_url=f"{_site_url()}/?billing=cancel{attempt_param}",
        client_reference_id=str(user.id),
        metadata=metadata,
    )
    return jsonify({"url": checkout.url})


@app.post("/api/billing/verify-session")
def billing_verify_session():
    if not stripe.api_key:
        return jsonify({"error": "Stripe is not configured."}), 503

    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id")
    attempt_id = payload.get("attempt_id")

    # Guard against literal un-interpolated template string
    if session_id in ("{CHECKOUT_SESSION_ID}", ""):
        session_id = None

    if not session_id and not attempt_id:
        return jsonify({"error": "session_id or attempt_id is required."}), 400

    user = current_user()
    db = get_session()
    try:
        session_obj = None
        if session_id:
            try:
                session_obj = _stripe_to_dict(
                    stripe.checkout.Session.retrieve(
                        session_id, expand=["payment_intent"]
                    )
                )
            except Exception as e:
                return jsonify({
                    "success": False,
                    "status": "error",
                    "error": str(e),
                    "message": f"Could not verify session with Stripe: {str(e)}",
                }), 400

        user_id = user.id if user else None
        if not user_id and session_obj:
            meta = session_obj.get("metadata") or {}
            raw_uid = meta.get("user_id") or session_obj.get("client_reference_id")
            if raw_uid:
                try:
                    user_id = int(raw_uid)
                except (ValueError, TypeError):
                    user_id = None

        if not user_id:
            return jsonify({"error": "Authentication required."}), 401

        u = db.get(User, user_id)
        if not u:
            return jsonify({"error": "User not found."}), 404

        # Enforce session ownership before establishing login session
        if session_obj:
            meta = session_obj.get("metadata") or {}
            session_uid = meta.get("user_id") or session_obj.get("client_reference_id")
            if session_uid and str(session_uid) != str(u.id):
                return jsonify({
                    "success": False,
                    "status": "forbidden",
                    "error": "This checkout session belongs to a different account.",
                    "message": "Checkout session does not match your account.",
                }), 403

            customer_id = _stripe_id(session_obj.get("customer"))
            if customer_id and u.stripe_customer_id and customer_id != u.stripe_customer_id:
                return jsonify({
                    "success": False,
                    "status": "forbidden",
                    "error": "This checkout session belongs to a different customer.",
                    "message": "Checkout session does not match your account.",
                }), 403

        # Maintain session login for the returning user
        session["user_id"] = u.id

        if session_obj:
            meta = session_obj.get("metadata") or {}
            target_attempt_id = meta.get("attempt_id") or attempt_id
            session_status = session_obj.get("status")
            customer_id = _stripe_id(session_obj.get("customer"))

            is_paid = session_obj.get("payment_status") == "paid"

            if is_paid:
                target_attempt = None
                if target_attempt_id:
                    try:
                        target_attempt = db.get(QuizAttempt, int(target_attempt_id))
                    except (ValueError, TypeError):
                        target_attempt = None
                    if target_attempt and target_attempt.user_id != u.id:
                        target_attempt = None

                if not target_attempt:
                    target_attempt = (
                        db.query(QuizAttempt)
                        .filter(QuizAttempt.user_id == u.id)
                        .order_by(QuizAttempt.created_at.desc())
                        .first()
                    )

                if target_attempt and target_attempt.user_id == u.id:
                    target_attempt.unlocked = True
                    if not target_attempt.unlocked_at:
                        target_attempt.unlocked_at = datetime.now(timezone.utc)
                    target_attempt.stripe_checkout_session_id = session_obj.get("id")

                u.subscription_status = "pro"
                if customer_id and not u.stripe_customer_id:
                    u.stripe_customer_id = customer_id
                db.commit()

                u._has_unlocked = True
                return jsonify({
                    "success": True,
                    "status": "paid",
                    "message": "Payment successful! PRO+ features are now unlocked.",
                    "attempt_id": target_attempt.id if target_attempt else None,
                    "attempt": serialize_attempt_payload(u, target_attempt) if target_attempt else None,
                    "user": u.to_public(),
                })

            payment_intent = session_obj.get("payment_intent")
            last_err = None
            pi_status = None
            if isinstance(payment_intent, dict):
                pi_status = payment_intent.get("status")
                last_err = payment_intent.get("last_payment_error")
            if last_err is not None and not isinstance(last_err, dict):
                last_err = _stripe_to_dict(last_err)

            if session_status == "expired":
                return jsonify({
                    "success": False,
                    "status": "expired",
                    "error": "The payment session expired.",
                    "message": "The checkout session timed out before payment was completed.",
                    "attempt_id": target_attempt_id,
                })

            if pi_status == "processing" or (session_status == "complete" and not is_paid):
                return jsonify({
                    "success": False,
                    "status": "processing",
                    "message": "Your payment is currently processing by Stripe/Link. It should complete shortly.",
                    "attempt_id": target_attempt_id,
                })

            if last_err:
                err_msg = last_err.get("message") or "Payment authorization failed."
                decline_code = last_err.get("decline_code")
                full_msg = f"{err_msg} ({decline_code})" if decline_code else err_msg
                return jsonify({
                    "success": False,
                    "status": "failed",
                    "error": full_msg,
                    "message": f"Payment failed: {full_msg}",
                    "attempt_id": target_attempt_id,
                })

            return jsonify({
                "success": False,
                "status": "incomplete",
                "error": "Payment was not completed.",
                "message": "Payment was cancelled or not completed.",
                "attempt_id": target_attempt_id,
            })

        if attempt_id:
            try:
                att = db.get(QuizAttempt, int(attempt_id))
            except (ValueError, TypeError):
                att = None
            if att and att.user_id == u.id and (att.unlocked or u.is_pro):
                return jsonify({
                    "success": True,
                    "status": "paid",
                    "message": "Attempt is unlocked with PRO+.",
                    "attempt_id": att.id,
                    "attempt": serialize_attempt_payload(u, att),
                    "user": u.to_public(),
                })

        return jsonify({
            "success": False,
            "status": "not_found",
            "error": "Payment session not found.",
            "message": "Could not locate that checkout session.",
        }), 404
    except Exception as exc:
        return jsonify({
            "success": False,
            "status": "error",
            "error": str(exc),
            "message": f"Server error verifying session: {str(exc)}",
        }), 500
    finally:
        db.close()


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
    data = _stripe_to_dict(event["data"]["object"])

    HANDLED_EVENTS = (
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    )
    if etype not in HANDLED_EVENTS:
        return jsonify({"ok": True})

    db = get_session()
    try:
        meta = data.get("metadata") or {}
        attempt_id = meta.get("attempt_id")
        user_id = meta.get("user_id") or data.get("client_reference_id")
        customer_id = _stripe_id(data.get("customer"))
        session_id = data.get("id")
        payment_status = data.get("payment_status")

        # 1. Success events: completed with payment, or async payment succeeded
        if (
            (etype == "checkout.session.completed" and payment_status in ("paid", "no_payment_required"))
            or etype == "checkout.session.async_payment_succeeded"
        ):
            target_attempt = None
            if attempt_id:
                try:
                    target_attempt = db.get(QuizAttempt, int(attempt_id))
                except (ValueError, TypeError):
                    target_attempt = None

            parsed_uid = None
            if user_id:
                try:
                    parsed_uid = int(user_id)
                except (ValueError, TypeError):
                    parsed_uid = None

            if target_attempt and (not parsed_uid or target_attempt.user_id == parsed_uid):
                target_attempt.unlocked = True
                if not target_attempt.unlocked_at:
                    target_attempt.unlocked_at = datetime.now(timezone.utc)
                target_attempt.stripe_checkout_session_id = session_id
                u = db.get(User, target_attempt.user_id)
                if u:
                    u.subscription_status = "pro"
                    if customer_id and not u.stripe_customer_id:
                        u.stripe_customer_id = customer_id
                db.commit()
            elif parsed_uid:
                u = db.get(User, parsed_uid)
                if u:
                    latest = (
                        db.query(QuizAttempt)
                        .filter(QuizAttempt.user_id == u.id)
                        .order_by(QuizAttempt.created_at.desc())
                        .first()
                    )
                    if latest:
                        latest.unlocked = True
                        if not latest.unlocked_at:
                            latest.unlocked_at = datetime.now(timezone.utc)
                        latest.stripe_checkout_session_id = session_id

                    u.subscription_status = "pro"
                    if customer_id and not u.stripe_customer_id:
                        u.stripe_customer_id = customer_id
                    db.commit()

        # 2. Failure/expired events: async payment failed or checkout session timed out
        elif etype in ("checkout.session.async_payment_failed", "checkout.session.expired"):
            attempts_to_relock = []
            if session_id:
                matched = (
                    db.query(QuizAttempt)
                    .filter(QuizAttempt.stripe_checkout_session_id == session_id)
                    .all()
                )
                attempts_to_relock.extend(matched)

            if attempt_id:
                try:
                    att = db.get(QuizAttempt, int(attempt_id))
                    if att and att not in attempts_to_relock:
                        if att.stripe_checkout_session_id == session_id or not att.stripe_checkout_session_id:
                            attempts_to_relock.append(att)
                except (ValueError, TypeError):
                    pass

            affected_user_ids = set()
            for att in attempts_to_relock:
                att.unlocked = False
                att.unlocked_at = None
                att.stripe_checkout_session_id = None
                affected_user_ids.add(att.user_id)

            if user_id:
                try:
                    affected_user_ids.add(int(user_id))
                except (ValueError, TypeError):
                    pass

            for uid in affected_user_ids:
                u = db.get(User, uid)
                if not u or u.is_admin:
                    continue
                has_other_unlocked = (
                    db.query(QuizAttempt.id)
                    .filter(QuizAttempt.user_id == uid, QuizAttempt.unlocked == True)
                    .first()
                    is not None
                )
                if not has_other_unlocked:
                    u.subscription_status = None
            db.commit()
    finally:
        db.close()

    return jsonify({"ok": True})


# ── Account AI ───────────────────────────────────────────────────────────────


def _load_own_attempt(db, user: User, attempt_id) -> QuizAttempt | None:
    try:
        attempt = db.get(QuizAttempt, int(attempt_id))
    except (TypeError, ValueError):
        return None
    if attempt is None or attempt.user_id != user.id:
        return None
    return attempt


@app.post("/api/premium/followup")
@pro_required
def premium_followup(user):
    """AI follow-up questions (PRO+ only).

    Accepts either raw ``answers`` (during the quiz) or an ``attempt_id`` (from
    the Essay Help profile step) and always appends the structured
    extracurriculars question.
    """
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers") or {}
    attempt_id = payload.get("attempt_id")
    if attempt_id and not answers:
        db = get_session()
        try:
            attempt = _load_own_attempt(db, user, attempt_id)
            if attempt is None:
                return jsonify({"error": "Attempt not found."}), 404
            answers = attempt.answers
        finally:
            db.close()
    if not isinstance(answers, dict):
        return jsonify({"error": "answers must be an object."}), 400
    # Do not feed prior AI answers back in as "prior answers" for generation.
    base_answers = {k: v for k, v in answers.items() if not str(k).startswith("ai_")}
    profile = build_student_profile(base_answers, QUESTIONS_BY_ID)
    questions_payload = generate_followup_questions(profile, base_answers)
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
    return jsonify({"questions": mcq + written + [dict(ACTIVITIES_QUESTION)]})


@app.post("/api/premium/profile")
@pro_required
def premium_profile(user):
    """Merge AI follow-up answers (ai_* keys, incl. ai_activities) into an attempt."""
    payload = request.get_json(silent=True) or {}
    attempt_id = payload.get("attempt_id")
    incoming = payload.get("answers")
    if not attempt_id:
        return jsonify({"error": "attempt_id is required."}), 400
    if not isinstance(incoming, dict):
        return jsonify({"error": "answers must be an object."}), 400

    ai_answers = {}
    for k, v in incoming.items():
        key = str(k)
        if not key.startswith("ai_"):
            continue
        if isinstance(v, str):
            v = v.strip()[:4000]
            if not v:
                continue
        elif isinstance(v, dict):
            # Structured activities payload — cap sizes defensively.
            v = {
                "activities": [a for a in (v.get("activities") or []) if isinstance(a, dict)][:40],
                "awards": [a for a in (v.get("awards") or []) if isinstance(a, dict)][:40],
            }
        elif v is None:
            continue
        ai_answers[key] = v

    db = get_session()
    try:
        attempt = _load_own_attempt(db, user, attempt_id)
        if attempt is None:
            return jsonify({"error": "Attempt not found."}), 404
        merged = attempt.answers
        merged.update(ai_answers)
        attempt.answers = merged
        attempt.profile = build_student_profile(merged, QUESTIONS_BY_ID)
        db.commit()
        db.refresh(attempt)
        return jsonify(serialize_attempt_payload(user, attempt))
    finally:
        db.close()


@app.post("/api/premium/essay-guidance")
@login_required
def premium_essay(user):
    payload = request.get_json(silent=True) or {}
    attempt_id = payload.get("attempt_id")
    if not attempt_id:
        return jsonify({"error": "attempt_id is required."}), 400

    db = get_session()
    try:
        attempt = _load_own_attempt(db, user, attempt_id)
        if attempt is None:
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
    guidance = generate_essay_guidance(profile, unlocked_results, answers)
    return jsonify({"guidance": guidance})


# ── Essays ───────────────────────────────────────────────────────────────────


@app.post("/api/essays/grade")
@login_required
def essays_grade(user):
    payload = request.get_json(silent=True) or {}
    attempt_id = payload.get("attempt_id")
    prompt = str(payload.get("prompt") or "").strip()
    response_text = str(payload.get("response") or "").strip()
    university = str(payload.get("university") or "").strip()[:255] or None
    major = str(payload.get("major") or "").strip()[:255] or None
    essay_id = payload.get("essay_id")

    if not attempt_id:
        return jsonify({"error": "attempt_id is required."}), 400
    if not prompt:
        return jsonify({"error": "Paste the essay prompt first."}), 400
    if len(response_text.split()) < 20:
        return jsonify({"error": "Write at least 20 words before grading."}), 400
    if len(prompt) > ESSAY_PROMPT_MAX:
        return jsonify({"error": f"Prompt is too long (max {ESSAY_PROMPT_MAX} characters)."}), 400
    if len(response_text) > ESSAY_RESPONSE_MAX:
        return jsonify({"error": f"Essay is too long (max {ESSAY_RESPONSE_MAX} characters)."}), 400

    db = get_session()
    try:
        attempt = _load_own_attempt(db, user, attempt_id)
        if attempt is None:
            return jsonify({"error": "Attempt not found."}), 404
        if not attempt_access_unlocked(user, attempt):
            return jsonify({"error": "PRO+ is required for essay grading.", "upgrade": True}), 403
        answers = attempt.answers
        profile = attempt.profile or build_student_profile(answers, QUESTIONS_BY_ID)
        program = None
        for p in attempt.results or []:
            if university and p.get("university") == university and (not major or p.get("major") == major):
                program = p
                break
        if program is None:
            program = {"university": university, "major": major}
    finally:
        db.close()

    feedback = grade_essay(profile, answers, program, prompt, response_text)

    db = get_session()
    try:
        essay = None
        if essay_id:
            try:
                essay = db.get(Essay, int(essay_id))
            except (TypeError, ValueError):
                essay = None
            if essay is not None and essay.user_id != user.id:
                essay = None
        if essay is None:
            essay = Essay(user_id=user.id, attempt_id=int(attempt_id))
            db.add(essay)
        essay.university = university
        essay.major = major
        essay.prompt = prompt
        essay.response = response_text
        essay.feedback = feedback
        db.commit()
        db.refresh(essay)
        return jsonify({"essay_id": essay.id, "feedback": feedback, "essay": essay.to_public()})
    finally:
        db.close()


@app.get("/api/essays")
@login_required
def essays_list(user):
    attempt_id = request.args.get("attempt_id")
    db = get_session()
    try:
        q = db.query(Essay).filter(Essay.user_id == user.id)
        if attempt_id:
            try:
                q = q.filter(Essay.attempt_id == int(attempt_id))
            except (TypeError, ValueError):
                return jsonify({"error": "attempt_id must be an integer."}), 400
        rows = q.order_by(Essay.updated_at.desc()).limit(100).all()
        return jsonify({"essays": [e.to_public() for e in rows]})
    finally:
        db.close()


@app.delete("/api/essays/<int:essay_id>")
@login_required
def essays_delete(user, essay_id: int):
    db = get_session()
    try:
        essay = db.get(Essay, essay_id)
        if essay is None or essay.user_id != user.id:
            return jsonify({"error": "Essay not found."}), 404
        db.delete(essay)
        db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()


# ── College lookup (Hipolabs proxy + local catalog) ──────────────────────────

HIPOLABS_URL = "http://universities.hipolabs.com/search"
_COLLEGE_CACHE: dict[str, tuple[float, list, bool]] = {}
_COLLEGE_CACHE_LOCK = threading.Lock()
_COLLEGE_CACHE_TTL = 60 * 60 * 6
_COLLEGE_CACHE_MAX = 512
LOCAL_UNIVERSITIES = sorted({p["university"] for p in PROGRAMS if p.get("university")})


def _hipolabs_search(query: str) -> tuple[list[dict], bool]:
    """Return ([{name, country, domain}], upstream_ok)."""
    url = f"{HIPOLABS_URL}?{urllib.parse.urlencode({'name': query})}"
    req = urllib.request.Request(url, headers={"User-Agent": "MajorScout/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return [], False
    out = []
    for item in data if isinstance(data, list) else []:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        domains = item.get("domains") or []
        out.append(
            {
                "name": name,
                "country": (item.get("country") or "").strip() or None,
                "domain": domains[0] if domains else None,
                "source": "hipolabs",
            }
        )
    return out, True


@app.get("/api/colleges/search")
def colleges_search():
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        return jsonify({"results": [], "upstream_ok": True})
    q = q[:80]
    key = q.lower()
    now = time.time()
    with _COLLEGE_CACHE_LOCK:
        cached = _COLLEGE_CACHE.get(key)
    if cached and now - cached[0] < _COLLEGE_CACHE_TTL:
        return jsonify({"results": cached[1], "upstream_ok": cached[2], "cached": True})

    remote, upstream_ok = _hipolabs_search(q)
    local = [
        {"name": u, "country": "United States", "domain": None, "source": "majorscout"}
        for u in LOCAL_UNIVERSITIES
        if key in u.lower()
    ]

    merged: list[dict] = []
    seen = set()
    # Local catalog first so schools we have program data for float to the top.
    for item in local + remote:
        norm = item["name"].lower()
        if norm in seen:
            continue
        seen.add(norm)
        merged.append(item)

    def _rank(item):
        n = item["name"].lower()
        return (0 if n.startswith(key) else 1, 0 if item["source"] == "majorscout" else 1, len(n))

    merged.sort(key=_rank)
    results = merged[:15]

    if upstream_ok:
        with _COLLEGE_CACHE_LOCK:
            if len(_COLLEGE_CACHE) >= _COLLEGE_CACHE_MAX:
                oldest = min(_COLLEGE_CACHE.items(), key=lambda kv: kv[1][0])[0]
                _COLLEGE_CACHE.pop(oldest, None)
            _COLLEGE_CACHE[key] = (now, results, upstream_ok)
    return jsonify({"results": results, "upstream_ok": upstream_ok})


# ── Admissions tracker ───────────────────────────────────────────────────────


@app.get("/api/admissions")
@login_required
def admissions_list(user):
    db = get_session()
    try:
        rows = (
            db.query(AdmissionResult)
            .filter(AdmissionResult.user_id == user.id)
            .order_by(AdmissionResult.created_at.desc())
            .all()
        )
        return jsonify({"results": [r.to_public() for r in rows]})
    finally:
        db.close()


@app.post("/api/admissions")
@login_required
def admissions_create(user):
    payload = request.get_json(silent=True) or {}
    college_name = str(payload.get("college_name") or "").strip()[:255]
    round_ = str(payload.get("round") or "").strip().upper()
    decision = str(payload.get("decision") or "").strip().lower()
    if not college_name:
        return jsonify({"error": "college_name is required."}), 400
    if round_ not in ADMISSION_ROUNDS:
        return jsonify({"error": f"round must be one of {', '.join(ADMISSION_ROUNDS)}."}), 400
    if decision not in ADMISSION_DECISIONS:
        return jsonify({"error": f"decision must be one of {', '.join(ADMISSION_DECISIONS)}."}), 400

    year = payload.get("application_year")
    if year in ("", None):
        year = None
    else:
        try:
            year = int(year)
        except (TypeError, ValueError):
            return jsonify({"error": "application_year must be a year."}), 400
        if year < 2000 or year > 2100:
            return jsonify({"error": "application_year is out of range."}), 400

    row = AdmissionResult(
        user_id=user.id,
        college_name=college_name,
        college_country=(str(payload.get("college_country") or "").strip()[:128] or None),
        college_domain=(str(payload.get("college_domain") or "").strip()[:255] or None),
        college_verified=bool(payload.get("college_verified")),
        round=round_,
        decision=decision,
        intended_major=(str(payload.get("intended_major") or "").strip()[:255] or None),
        application_year=year,
    )
    db = get_session()
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
        return jsonify({"result": row.to_public()}), 201
    finally:
        db.close()


@app.delete("/api/admissions/<int:result_id>")
@login_required
def admissions_delete(user, result_id: int):
    db = get_session()
    try:
        row = db.get(AdmissionResult, result_id)
        if row is None or row.user_id != user.id:
            return jsonify({"error": "Result not found."}), 404
        db.delete(row)
        db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()


# ── Analytics & Admin Dashboard ──────────────────────────────────────────────


def _parse_user_agent(ua_str: str) -> tuple[str, str, str]:
    """Parse User-Agent string into (device_type, browser, os)."""
    if not ua_str:
        return ("desktop", "Unknown", "Unknown")
    ua = ua_str.lower()

    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        device = "tablet"
    elif "mobile" in ua or "iphone" in ua or "ipod" in ua or "android" in ua:
        device = "mobile"
    else:
        device = "desktop"

    if "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "windows" in ua:
        os_name = "Windows"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua or "ios" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"
    elif "cros" in ua:
        os_name = "Chrome OS"
    else:
        os_name = "Other"

    if "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "opera" in ua or "opr" in ua:
        browser = "Opera"
    else:
        browser = "Other"

    return (device, browser, os_name)


def _to_naive_utc(dt):
    """Normalize aware or naive datetimes or ISO strings to naive UTC for safe comparison."""
    if dt is None:
        return None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@app.post("/api/analytics/track")
def analytics_track():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id") or "").strip()
    if not session_id:
        return jsonify({"error": "session_id is required."}), 400

    visitor_id = str(payload.get("visitor_id") or session_id).strip()
    event_type = str(payload.get("event_type") or "page_view").strip()
    page = str(payload.get("page") or "").strip()[:128]
    properties = payload.get("properties") or {}
    if not isinstance(properties, dict):
        properties = {}

    ua_str = request.headers.get("User-Agent", "")
    device, browser, os_name = _parse_user_agent(ua_str)

    user = current_user()
    user_id = user.id if user else None
    now = datetime.now(timezone.utc)

    db = get_session()
    try:
        session_row = (
            db.query(AnalyticsSession).filter_by(session_id=session_id).one_or_none()
        )
        if session_row is None:
            session_row = AnalyticsSession(
                session_id=session_id,
                visitor_id=visitor_id,
                user_id=user_id,
                device_type=device,
                browser=browser,
                os=os_name,
                entry_page=page or "/",
                started_at=now,
                last_active_at=now,
                duration_seconds=0,
                max_quiz_step=0,
                quiz_completed=False,
                is_account_created=False,
                created_at=now,
            )
            db.add(session_row)
        else:
            session_row.last_active_at = now
            if user_id and not session_row.user_id:
                session_row.user_id = user_id

        if event_type == "account_created":
            session_row.is_account_created = True
        elif event_type == "quiz_start":
            if session_row.max_quiz_step < 1:
                session_row.max_quiz_step = 1
        elif event_type == "quiz_step":
            step = properties.get("step") or properties.get("step_index")
            try:
                if step is not None:
                    step_num = int(step)
                    if step_num > session_row.max_quiz_step:
                        session_row.max_quiz_step = step_num
            except (ValueError, TypeError):
                pass
        elif event_type == "quiz_complete":
            session_row.quiz_completed = True
            step = properties.get("total_questions") or properties.get("step")
            try:
                if step is not None:
                    step_num = int(step)
                    if step_num > session_row.max_quiz_step:
                        session_row.max_quiz_step = step_num
            except (ValueError, TypeError):
                pass

        event_row = AnalyticsEvent(
            session_id=session_id,
            user_id=user_id,
            event_type=event_type,
            page=page,
            properties=properties,
            created_at=now,
        )
        db.add(event_row)
        db.commit()
        return jsonify({"ok": True})
    finally:
        db.close()


@app.post("/api/analytics/heartbeat")
def analytics_heartbeat():
    payload = request.get_json(silent=True) or {}
    session_id = str(payload.get("session_id") or "").strip()
    if not session_id:
        return jsonify({"error": "session_id is required."}), 400

    visitor_id = str(payload.get("visitor_id") or session_id).strip()
    delta = payload.get("delta_seconds", 20)
    try:
        delta_val = int(delta)
        delta_val = max(1, min(delta_val, 60))
    except (ValueError, TypeError):
        delta_val = 20

    page = str(payload.get("page") or "").strip()[:128]
    max_quiz_step = payload.get("max_quiz_step")
    quiz_completed = payload.get("quiz_completed")

    ua_str = request.headers.get("User-Agent", "")
    device, browser, os_name = _parse_user_agent(ua_str)

    user = current_user()
    user_id = user.id if user else None
    now = datetime.now(timezone.utc)

    db = get_session()
    try:
        session_row = (
            db.query(AnalyticsSession).filter_by(session_id=session_id).one_or_none()
        )
        if session_row is None:
            session_row = AnalyticsSession(
                session_id=session_id,
                visitor_id=visitor_id,
                user_id=user_id,
                device_type=device,
                browser=browser,
                os=os_name,
                entry_page=page or "/",
                started_at=now,
                last_active_at=now,
                duration_seconds=delta_val,
                max_quiz_step=0,
                quiz_completed=False,
                is_account_created=False,
                created_at=now,
            )
            db.add(session_row)
        else:
            session_row.last_active_at = now
            session_row.duration_seconds += delta_val
            if user_id and not session_row.user_id:
                session_row.user_id = user_id

        if max_quiz_step is not None:
            try:
                ms = int(max_quiz_step)
                if ms > session_row.max_quiz_step:
                    session_row.max_quiz_step = ms
            except (ValueError, TypeError):
                pass
        if quiz_completed:
            session_row.quiz_completed = True

        db.commit()
        return jsonify({"ok": True, "duration_seconds": session_row.duration_seconds})
    finally:
        db.close()


@app.get("/api/admin/metrics")
@admin_required
def admin_metrics(user):
    range_param = request.args.get("range", "7d").lower()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if range_param == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = start_time - timedelta(days=1)
        prev_end = start_time
        num_intervals = 24
        interval_type = "hour"
    elif range_param == "30d":
        start_time = now - timedelta(days=30)
        prev_start = start_time - timedelta(days=30)
        prev_end = start_time
        num_intervals = 30
        interval_type = "day"
    elif range_param == "all":
        start_time = datetime(2020, 1, 1)
        prev_start = datetime(2020, 1, 1)
        prev_end = start_time
        num_intervals = 14
        interval_type = "day"
    else:  # default 7d
        range_param = "7d"
        start_time = now - timedelta(days=7)
        prev_start = start_time - timedelta(days=7)
        prev_end = start_time
        num_intervals = 7
        interval_type = "day"

    db = get_session()
    try:
        # Current window sessions
        curr_sessions = (
            db.query(AnalyticsSession)
            .filter(AnalyticsSession.started_at >= start_time)
            .all()
        )
        # Previous window sessions (for delta comparison)
        prev_sessions = (
            db.query(AnalyticsSession)
            .filter(
                AnalyticsSession.started_at >= prev_start,
                AnalyticsSession.started_at < prev_end,
            )
            .all()
        )

        total_sessions = len(curr_sessions)
        unique_visitors = len({s.visitor_id for s in curr_sessions})
        accounts_created = sum(1 for s in curr_sessions if s.is_account_created)
        total_duration = sum(s.duration_seconds for s in curr_sessions)
        avg_duration = round(total_duration / max(total_sessions, 1), 1)

        quiz_starts = sum(1 for s in curr_sessions if s.max_quiz_step >= 1)
        quiz_completes = sum(1 for s in curr_sessions if s.quiz_completed)
        quiz_completion_rate = round(
            (quiz_completes / max(quiz_starts, 1)) * 100, 1
        )

        active_threshold = now - timedelta(minutes=15)
        active_now = sum(
            1 for s in curr_sessions
            if _to_naive_utc(s.last_active_at) and _to_naive_utc(s.last_active_at) >= active_threshold
        )

        # Previous period comparisons
        prev_total = len(prev_sessions)
        prev_visitors = len({s.visitor_id for s in prev_sessions})
        prev_accounts = sum(1 for s in prev_sessions if s.is_account_created)
        prev_avg_dur = (
            sum(s.duration_seconds for s in prev_sessions) / max(prev_total, 1)
        )

        def pct_diff(curr, prev):
            if prev <= 0:
                return 100.0 if curr > 0 else 0.0
            return round(((curr - prev) / prev) * 100, 1)

        sessions_change = pct_diff(total_sessions, prev_total)
        visitors_change = pct_diff(unique_visitors, prev_visitors)
        accounts_change = pct_diff(accounts_created, prev_accounts)
        duration_change = pct_diff(avg_duration, prev_avg_dur)

        # Device distribution
        device_counts = {"desktop": 0, "mobile": 0, "tablet": 0}
        for s in curr_sessions:
            dev = (s.device_type or "desktop").lower()
            if dev in device_counts:
                device_counts[dev] += 1
            else:
                device_counts["desktop"] += 1

        device_breakdown = {
            k: {
                "count": v,
                "percent": round((v / max(total_sessions, 1)) * 100, 1),
            }
            for k, v in device_counts.items()
        }

        # Timeline generation (daily or hourly buckets)
        timeline = []
        if interval_type == "hour":
            for h in range(24):
                slot_start = start_time + timedelta(hours=h)
                slot_end = slot_start + timedelta(hours=1)
                slot_sessions = [
                    s for s in curr_sessions
                    if _to_naive_utc(s.started_at) and slot_start <= _to_naive_utc(s.started_at) < slot_end
                ]
                timeline.append({
                    "label": f"{h:02d}:00",
                    "date": slot_start.strftime("%Y-%m-%d %H:00"),
                    "sessions": len(slot_sessions),
                    "visitors": len({s.visitor_id for s in slot_sessions}),
                    "quiz_starts": sum(1 for s in slot_sessions if s.max_quiz_step >= 1),
                    "quiz_completes": sum(1 for s in slot_sessions if s.quiz_completed),
                    "accounts": sum(1 for s in slot_sessions if s.is_account_created),
                    "avg_duration": round(
                        sum(s.duration_seconds for s in slot_sessions)
                        / max(len(slot_sessions), 1),
                        1,
                    ),
                })
        else:
            days_count = 30 if range_param == "30d" else (14 if range_param == "all" else 7)
            for d in range(days_count):
                day_date = (now - timedelta(days=days_count - 1 - d)).date()
                slot_sessions = [
                    s for s in curr_sessions
                    if _to_naive_utc(s.started_at) and _to_naive_utc(s.started_at).date() == day_date
                ]
                timeline.append({
                    "label": day_date.strftime("%a"),
                    "date": day_date.strftime("%Y-%m-%d"),
                    "sessions": len(slot_sessions),
                    "visitors": len({s.visitor_id for s in slot_sessions}),
                    "quiz_starts": sum(1 for s in slot_sessions if s.max_quiz_step >= 1),
                    "quiz_completes": sum(1 for s in slot_sessions if s.quiz_completed),
                    "accounts": sum(1 for s in slot_sessions if s.is_account_created),
                    "avg_duration": round(
                        sum(s.duration_seconds for s in slot_sessions)
                        / max(len(slot_sessions), 1),
                        1,
                    ),
                })

        # Area chart data (multi-layered gradient waves matching mockup)
        area_chart = []
        for item in timeline:
            area_chart.append({
                "label": item["label"],
                "active_sessions": item["sessions"],
                "quiz_activity": item["quiz_starts"],
                "quiz_completed": item["quiz_completes"],
                "accounts": item["accounts"],
            })

        # Donut chart: User types
        all_users = db.query(User).all()
        pro_users_count = sum(1 for u in all_users if u.is_pro)
        reg_users_count = len(all_users) - pro_users_count
        guest_sessions_count = sum(1 for s in curr_sessions if s.user_id is None)

        user_distribution = {
            "total_users": len(all_users),
            "pro_users": pro_users_count,
            "registered_free": reg_users_count,
            "guest_sessions": guest_sessions_count,
        }

        # Radar chart dimensions (normalized 0 to 100)
        # 1. Quiz Completion
        r_quiz = min(100.0, quiz_completion_rate)
        # 2. Time Depth (scaled to target ~300s / 5 mins)
        r_time = min(100.0, round((avg_duration / 300.0) * 100, 1))
        # 3. Account Conversion
        r_account = min(100.0, round((accounts_created / max(unique_visitors, 1)) * 300, 1))
        # 4. User Retention (repeat visitors)
        visitor_session_counts = {}
        for s in curr_sessions:
            visitor_session_counts[s.visitor_id] = visitor_session_counts.get(s.visitor_id, 0) + 1
        repeat_visitors = sum(1 for cnt in visitor_session_counts.values() if cnt > 1)
        r_retention = min(100.0, round((repeat_visitors / max(unique_visitors, 1)) * 100, 1))
        # 5. Pro Interest
        r_pro = min(100.0, round((pro_users_count / max(len(all_users), 1)) * 100, 1) if all_users else 20.0)
        # 6. Exploration (sessions with >= 2 pages or max_step >= 5)
        engaged = sum(1 for s in curr_sessions if s.max_quiz_step >= 5 or s.duration_seconds >= 90)
        r_explore = min(100.0, round((engaged / max(total_sessions, 1)) * 100, 1))

        radar_data = [
            {"dimension": "Quiz Progress", "value": r_quiz, "target": 75},
            {"dimension": "Time Depth", "value": r_time, "target": 70},
            {"dimension": "Signups", "value": r_account, "target": 60},
            {"dimension": "Return Rate", "value": r_retention, "target": 50},
            {"dimension": "PRO+ Rate", "value": r_pro, "target": 40},
            {"dimension": "Exploration", "value": r_explore, "target": 80},
        ]

        # Sparklines arrays
        sparklines = {
            "visitors": {
                "value": unique_visitors,
                "change": visitors_change,
                "trend": [t["visitors"] for t in timeline],
            },
            "duration": {
                "value": f"{int(avg_duration // 60)}m {int(avg_duration % 60)}s",
                "seconds": avg_duration,
                "change": duration_change,
                "trend": [round(t["avg_duration"], 0) for t in timeline],
            },
            "completion": {
                "value": f"{quiz_completion_rate}%",
                "change": pct_diff(quiz_completes, sum(1 for s in prev_sessions if s.quiz_completed)),
                "trend": [
                    round((t["quiz_completes"] / max(t["quiz_starts"], 1)) * 100, 0)
                    for t in timeline
                ],
            },
        }

        return jsonify({
            "range": range_param,
            "kpi": {
                "total_visitors": unique_visitors,
                "visitors_change": visitors_change,
                "total_sessions": total_sessions,
                "sessions_change": sessions_change,
                "accounts_created": accounts_created,
                "accounts_change": accounts_change,
                "avg_duration_seconds": avg_duration,
                "avg_duration_formatted": f"{int(avg_duration // 60)}m {int(avg_duration % 60)}s",
                "duration_change": duration_change,
                "quiz_starts": quiz_starts,
                "quiz_completes": quiz_completes,
                "quiz_completion_rate": quiz_completion_rate,
                "active_now": active_now,
            },
            "timeline": timeline,
            "area_chart": area_chart,
            "device_breakdown": device_breakdown,
            "user_distribution": user_distribution,
            "radar_data": radar_data,
            "sparklines": sparklines,
        })
    finally:
        db.close()


@app.get("/api/admin/funnel")
@admin_required
def admin_funnel(user):
    range_param = request.args.get("range", "7d").lower()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if range_param == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_param == "30d":
        start_time = now - timedelta(days=30)
    elif range_param == "all":
        start_time = datetime(2020, 1, 1)
    else:
        start_time = now - timedelta(days=7)

    db = get_session()
    try:
        sessions = (
            db.query(AnalyticsSession)
            .filter(AnalyticsSession.started_at >= start_time)
            .all()
        )
        total_sessions = len(sessions)

        # Milestone steps
        started_quiz = [s for s in sessions if s.max_quiz_step >= 1]
        step_q3 = [s for s in sessions if s.max_quiz_step >= 3]
        step_q6 = [s for s in sessions if s.max_quiz_step >= 6]
        step_q9 = [s for s in sessions if s.max_quiz_step >= 9]
        step_q12 = [s for s in sessions if s.max_quiz_step >= 12]
        step_q15 = [s for s in sessions if s.max_quiz_step >= 15]
        completed = [s for s in sessions if s.quiz_completed or s.max_quiz_step >= 16]
        registered = [s for s in completed if s.user_id is not None or s.is_account_created]

        milestones = [
            {"id": "visit", "label": "Site Visitors", "count": total_sessions},
            {"id": "start", "label": "Started Quiz (Q1)", "count": len(started_quiz)},
            {"id": "q3", "label": "Early Academics (Q3)", "count": len(step_q3)},
            {"id": "q6", "label": "Interests & Majors (Q6)", "count": len(step_q6)},
            {"id": "q9", "label": "Campus & Location (Q9)", "count": len(step_q9)},
            {"id": "q12", "label": "Priorities & Size (Q12)", "count": len(step_q12)},
            {"id": "q15", "label": "Extracurriculars (Q15)", "count": len(step_q15)},
            {"id": "complete", "label": "Quiz Completed", "count": len(completed)},
            {"id": "account", "label": "Saved / Account Created", "count": len(registered)},
        ]

        # Calculate conversion and drop-off percentages
        base_count = max(total_sessions, 1)
        prev_count = base_count
        for i, m in enumerate(milestones):
            cnt = m["count"]
            m["overall_conversion"] = round((cnt / base_count) * 100, 1)
            if i == 0:
                m["step_conversion"] = 100.0
                m["drop_off_count"] = 0
                m["drop_off_rate"] = 0.0
            else:
                m["step_conversion"] = round((cnt / max(prev_count, 1)) * 100, 1)
                drop = max(0, prev_count - cnt)
                m["drop_off_count"] = drop
                m["drop_off_rate"] = round((drop / max(prev_count, 1)) * 100, 1)
            prev_count = cnt

        # Average duration for completed vs incomplete quiz sessions
        completed_durations = [s.duration_seconds for s in completed]
        incomplete_durations = [
            s.duration_seconds for s in started_quiz if not s.quiz_completed
        ]

        avg_completed_duration = (
            round(sum(completed_durations) / max(len(completed_durations), 1), 1)
            if completed_durations
            else 0
        )
        avg_incomplete_duration = (
            round(sum(incomplete_durations) / max(len(incomplete_durations), 1), 1)
            if incomplete_durations
            else 0
        )

        return jsonify({
            "milestones": milestones,
            "summary": {
                "total_started": len(started_quiz),
                "total_completed": len(completed),
                "completion_rate": round(
                    (len(completed) / max(len(started_quiz), 1)) * 100, 1
                ),
                "avg_completed_duration_seconds": avg_completed_duration,
                "avg_incomplete_duration_seconds": avg_incomplete_duration,
            },
        })
    finally:
        db.close()


@app.get("/api/admin/sessions")
@admin_required
def admin_sessions(user):
    page = max(1, int(request.args.get("page", 1)))
    limit = max(5, min(100, int(request.args.get("limit", 25))))
    search = str(request.args.get("search") or "").strip().lower()
    device = str(request.args.get("device") or "").strip().lower()
    range_param = request.args.get("range", "7d").lower()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if range_param == "today":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_param == "30d":
        start_time = now - timedelta(days=30)
    elif range_param == "all":
        start_time = datetime(2020, 1, 1)
    else:
        start_time = now - timedelta(days=7)

    db = get_session()
    try:
        q = db.query(AnalyticsSession, User).outerjoin(
            User, AnalyticsSession.user_id == User.id
        )

        q = q.filter(AnalyticsSession.started_at >= start_time)

        if device in ("desktop", "mobile", "tablet"):
            q = q.filter(AnalyticsSession.device_type == device)

        if search:
            q = q.filter(
                or_(
                    AnalyticsSession.session_id.ilike(f"%{search}%"),
                    AnalyticsSession.visitor_id.ilike(f"%{search}%"),
                    AnalyticsSession.browser.ilike(f"%{search}%"),
                    AnalyticsSession.os.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                    User.name.ilike(f"%{search}%"),
                )
            )

        total = q.count()
        rows = (
            q.order_by(AnalyticsSession.last_active_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        results = []
        for sess, u in rows:
            data = sess.to_dict()
            data["user_email"] = u.email if u else None
            data["user_name"] = u.name if u else None
            data["is_pro"] = u.is_pro if u else False
            results.append(data)

        return jsonify({
            "sessions": results,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit,
        })
    finally:
        db.close()


@app.get("/api/admin/events")
@admin_required
def admin_events(user):
    limit = max(10, min(200, int(request.args.get("limit", 50))))
    event_type = request.args.get("event_type")

    db = get_session()
    try:
        q = db.query(AnalyticsEvent, User).outerjoin(
            User, AnalyticsEvent.user_id == User.id
        )
        if event_type:
            q = q.filter(AnalyticsEvent.event_type == event_type)

        rows = q.order_by(AnalyticsEvent.created_at.desc()).limit(limit).all()
        results = []
        for ev, u in rows:
            data = ev.to_dict()
            data["user_email"] = u.email if u else None
            data["user_name"] = u.name if u else None
            results.append(data)

        return jsonify({"events": results})
    finally:
        db.close()


@app.post("/api/admin/seed-demo")
@admin_required
def admin_seed_demo(user):
    """Seed realistic telemetry activity across past 14 days for previewing dashboard."""
    import random
    import uuid

    db = get_session()
    try:
        now = datetime.now(timezone.utc)
        browsers = ["Chrome", "Safari", "Edge", "Firefox"]
        devices = ["desktop"] * 6 + ["mobile"] * 3 + ["tablet"] * 1
        pages = ["/", "/quiz", "/results", "/hub", "/admissions", "/essayHelp"]

        created_sessions = 0
        for day_offset in range(13, -1, -1):
            day_base = now - timedelta(days=day_offset)
            # Create between 6 and 14 sessions per day
            daily_count = random.randint(7, 13) + (3 if day_offset % 3 == 0 else 0)

            for _ in range(daily_count):
                sess_uuid = f"demo_{uuid.uuid4().hex[:12]}"
                visitor_uuid = f"vis_{uuid.uuid4().hex[:10]}"
                device = random.choice(devices)
                os_choice = (
                    "iOS" if device == "mobile" else "macOS" if random.random() > 0.4 else "Windows"
                )
                browser = random.choice(browsers)

                hour = random.randint(0, 23)
                minute = random.randint(0, 59)
                start_dt = day_base.replace(hour=hour, minute=minute, second=random.randint(0, 59))

                # Realistic quiz progression
                reached_quiz = random.random() > 0.15
                max_step = random.randint(1, 15) if reached_quiz else 0
                completed = max_step >= 15 and random.random() > 0.25
                if completed:
                    max_step = 16

                # Duration correlated with quiz depth
                duration = random.randint(25, 90)
                if max_step > 5:
                    duration += random.randint(80, 240)
                if completed:
                    duration += random.randint(100, 360)

                last_active = start_dt + timedelta(seconds=duration)
                account_created = completed and random.random() > 0.55

                sess = AnalyticsSession(
                    session_id=sess_uuid,
                    visitor_id=visitor_uuid,
                    user_id=user.id if account_created and random.random() > 0.5 else None,
                    device_type=device,
                    browser=browser,
                    os=os_choice,
                    entry_page="/",
                    started_at=start_dt,
                    last_active_at=last_active,
                    duration_seconds=duration,
                    max_quiz_step=max_step,
                    quiz_completed=completed,
                    is_account_created=account_created,
                    created_at=start_dt,
                )
                db.add(sess)

                # Add sample events
                db.add(
                    AnalyticsEvent(
                        session_id=sess_uuid,
                        user_id=sess.user_id,
                        event_type="page_view",
                        page="/",
                        properties={"title": "Landing"},
                        created_at=start_dt,
                    )
                )
                if reached_quiz:
                    db.add(
                        AnalyticsEvent(
                            session_id=sess_uuid,
                            user_id=sess.user_id,
                            event_type="quiz_start",
                            page="/quiz",
                            properties={"total_questions": 15},
                            created_at=start_dt + timedelta(seconds=15),
                        )
                    )
                    db.add(
                        AnalyticsEvent(
                            session_id=sess_uuid,
                            user_id=sess.user_id,
                            event_type="quiz_step",
                            page="/quiz",
                            properties={"step": max_step, "section": "interests"},
                            created_at=start_dt + timedelta(seconds=duration // 2),
                        )
                    )
                if completed:
                    db.add(
                        AnalyticsEvent(
                            session_id=sess_uuid,
                            user_id=sess.user_id,
                            event_type="quiz_complete",
                            page="/quiz",
                            properties={"total_questions": 15},
                            created_at=last_active - timedelta(seconds=20),
                        )
                    )
                if account_created:
                    db.add(
                        AnalyticsEvent(
                            session_id=sess_uuid,
                            user_id=sess.user_id,
                            event_type="account_created",
                            page="/results",
                            properties={"method": "google"},
                            created_at=last_active,
                        )
                    )
                created_sessions += 1

        db.commit()
        return jsonify({"ok": True, "created_sessions": created_sessions})
    finally:
        db.close()


@app.delete("/api/admin/demo-data")
@admin_required
def admin_delete_demo_data(user):
    """Clean up demo seeded data."""
    db = get_session()
    try:
        demo_sessions = (
            db.query(AnalyticsSession)
            .filter(AnalyticsSession.session_id.like("demo_%"))
            .all()
        )
        demo_session_ids = [s.session_id for s in demo_sessions]

        if demo_session_ids:
            db.query(AnalyticsEvent).filter(
                AnalyticsEvent.session_id.in_(demo_session_ids)
            ).delete(synchronize_session=False)

            for s in demo_sessions:
                db.delete(s)

        db.commit()
        return jsonify({"ok": True, "deleted_sessions": len(demo_sessions)})
    finally:
        db.close()


@app.errorhandler(404)
def handle_404(err):
    if request.path.startswith("/api/"):
        return jsonify({"error": "API route not found.", "status": 404}), 404
    # SPA fallback for frontend routes when served by Flask
    index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(index):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def handle_405(err):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Method not allowed.", "status": 405}), 405
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def handle_500(err):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Internal server error.", "status": 500}), 500
    return "Internal server error", 500


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

