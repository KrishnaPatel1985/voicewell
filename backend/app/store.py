"""In-memory session store (30 minute sliding expiry) and cookie helpers."""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
from dataclasses import dataclass, field
from typing import Any

from .config import settings

COOKIE_NAME = "vw_sid"
TTL_SECONDS = 30 * 60


@dataclass
class Practice:
    turns: list[dict] = field(default_factory=list)  # {"role": "user"|"assistant", "content": str}
    persona_turn_count: int = 0
    emotions: list[str] = field(default_factory=list)
    safety_stopped: bool = False
    last_feedback: dict | None = None
    paused: bool = False
    coach_turns: list[dict] = field(default_factory=list)  # coaching explanations never count against feedback
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def reset(self) -> None:
        self.turns.clear()
        self.persona_turn_count = 0
        self.emotions.clear()
        self.safety_stopped = False
        self.last_feedback = None
        self.paused = False
        self.coach_turns.clear()


@dataclass
class LessonState:
    concept_ids: list[str] = field(default_factory=list)
    screen_start: int | None = None  # index of the first card of the screen last served
    served_at: float = 0.0
    depth: str = "standard"
    right_streak: int = 0
    initialised: bool = False


@dataclass
class Session:
    kid_session_id: str | None = None
    status: str = "pending"  # "pass" | "pending"
    # name -> {"enabled": bool, "managedBy": str | None}
    permissions: dict[str, dict[str, Any]] = field(default_factory=dict)
    perms_fetched_at: float = 0.0
    perms_ok: bool = True  # False when the last k-ID re-read failed: treated as deny-all
    jurisdiction: str | None = None
    country: str | None = None
    language: str = "en"
    user_id: str | None = None  # the account that claimed this session
    age: int = 0
    intent: str | None = None
    topic: str | None = None
    mode: str = "practice"  # "talk" | "practice"
    support_target: str | None = None  # "child" | "partner" | "friend" | "other"
    support_age: int | None = None
    custom_goal: str | None = None
    preferences: dict[str, Any] = field(default_factory=dict)
    lesson_state: LessonState = field(default_factory=LessonState)
    practice: Practice = field(default_factory=Practice)
    created_at: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)


class Store:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self) -> tuple[str, Session]:
        sid = secrets.token_urlsafe(24)
        s = Session()
        self._sessions[sid] = s
        return sid, s

    def get(self, sid: str | None) -> Session | None:
        if not sid:
            return None
        s = self._sessions.get(sid)
        if s is None:
            return None
        now = time.time()
        if now - s.last_seen > TTL_SECONDS:
            self._sessions.pop(sid, None)
            return None
        s.last_seen = now
        return s

    def get_for_user(self, sid: str | None, user_id: str | None) -> Session | None:
        """The session, but only if it belongs to this account. Another account's session counts as missing."""
        owner = self._sessions.get(sid) if sid else None
        if owner is None or user_id is None or owner.user_id != user_id:
            return None
        return self.get(sid)

    def delete(self, sid: str | None) -> None:
        if sid:
            self._sessions.pop(sid, None)

    def sweep(self) -> None:
        now = time.time()
        for sid in [k for k, v in self._sessions.items() if now - v.last_seen > TTL_SECONDS]:
            self._sessions.pop(sid, None)

    def clear(self) -> None:
        self._sessions.clear()


store = Store()


def hash_sid(sid: str | None) -> str:
    """Short hash for logs. Never log the raw session id."""
    if not sid:
        return "-"
    return hashlib.sha256(sid.encode()).hexdigest()[:8]


def set_cookie(response, sid: str) -> None:
    response.set_cookie(
        COOKIE_NAME, sid, max_age=TTL_SECONDS, httponly=True, samesite="lax", path="/",
        secure=settings.frontend_origin.startswith("https://"),
    )
