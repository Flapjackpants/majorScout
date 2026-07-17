"""SQLite models and session helpers for MajorScout."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

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

DB_PATH = os.path.join(os.path.dirname(__file__), "majorscout.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")


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
    subscription_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    attempts: Mapped[list[QuizAttempt]] = relationship(back_populates="user")

    @property
    def is_premium(self) -> bool:
        if self.is_admin:
            return True
        return self.subscription_status in {"active", "trialing"}

    def to_public(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "picture": self.picture,
            "is_admin": self.is_admin,
            "is_premium": self.is_premium,
            "subscription_status": self.subscription_status,
        }


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    answers_json: Mapped[str] = mapped_column(Text, default="{}")
    profile_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    results_json: Mapped[str | None] = mapped_column(Text, nullable=True)
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


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_session():
    return SessionLocal()
