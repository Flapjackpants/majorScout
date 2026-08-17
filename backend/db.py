"""Turso (libSQL) models and session helpers for MajorScout."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL", "").strip()
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "").strip()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    google_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    picture: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Legacy column retained for existing Turso schemas; no longer used for access.
    subscription_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    attempts: Mapped[list[QuizAttempt]] = relationship(back_populates="user")

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "picture": self.picture,
            "is_admin": self.is_admin,
        }


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    answers_json: Mapped[str] = mapped_column(Text, default="{}")
    profile_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    results_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped[User] = relationship(back_populates="attempts")

    @property
    def answers(self) -> dict:
        return json.loads(self.answers_json or "{}")

    @answers.setter
    def answers(self, value: dict) -> None:
        self.answers_json = json.dumps(value)

    @property
    def profile(self) -> dict | None:
        if not self.profile_json:
            return None
        return json.loads(self.profile_json)

    @profile.setter
    def profile(self, value: dict | None) -> None:
        self.profile_json = json.dumps(value) if value is not None else None

    @property
    def results(self) -> list | None:
        if not self.results_json:
            return None
        return json.loads(self.results_json)

    @results.setter
    def results(self, value: list | None) -> None:
        self.results_json = json.dumps(value) if value is not None else None


def _build_engine():
    if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
        raise RuntimeError(
            "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set. "
            "Create a Turso database and add both values to backend/.env."
        )
    # TURSO_DATABASE_URL is typically libsql://….turso.io
    db_url = f"sqlite+{TURSO_DATABASE_URL}?secure=true"
    return create_engine(
        db_url,
        connect_args={"auth_token": TURSO_AUTH_TOKEN, "check_same_thread": False},
    )


engine = _build_engine()
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


def _ensure_attempt_unlock_columns() -> None:
    """Add unlock columns if upgrading an older Turso/SQLite schema."""
    from sqlalchemy import text

    with engine.begin() as conn:
        cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(quiz_attempts)")).fetchall()
        }
        if "unlocked" not in cols:
            conn.execute(
                text("ALTER TABLE quiz_attempts ADD COLUMN unlocked BOOLEAN DEFAULT 0")
            )
        if "unlocked_at" not in cols:
            conn.execute(
                text("ALTER TABLE quiz_attempts ADD COLUMN unlocked_at DATETIME")
            )
        if "stripe_checkout_session_id" not in cols:
            conn.execute(
                text(
                    "ALTER TABLE quiz_attempts ADD COLUMN stripe_checkout_session_id VARCHAR(255)"
                )
            )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    try:
        _ensure_attempt_unlock_columns()
    except Exception:
        # Fresh DBs / drivers that reject PRAGMA — create_all already applied schema.
        pass


def get_session():
    return SessionLocal()
