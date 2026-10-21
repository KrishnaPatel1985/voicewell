"""Env loading and lazy content loading. Secrets are only read here; never logged."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from .errors import ApiError

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


@dataclass
class Settings:
    kid_secret_key: str = ""
    kid_api_base: str = "https://kai-api.test.k-id.com/api/v1"
    inworld_realtime_key: str = ""
    inworld_standard_key: str = ""
    modulate_api_key: str = ""
    llm_model: str = "google-ai-studio/gemini-2.5-flash-lite"
    feedback_model: str = ""  # empty -> use llm_model
    jwt_secret: str = ""
    db_path: Path = field(default_factory=lambda: BACKEND_DIR / "data" / "voicewell.db")
    frontend_origin: str = "http://localhost:5173"
    content_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent / "content")
    inworld_router_url: str = "https://api.inworld.ai/v1/chat/completions"
    inworld_realtime_url: str = "wss://api.inworld.ai/api/v1/realtime/session"
    modulate_url: str = "wss://platform.modulate.ai/api/velma-2-stt-streaming"


def load_settings() -> Settings:
    e = os.environ.get
    s = Settings()
    s.kid_secret_key = e("KID_SECRET_KEY", "")
    s.kid_api_base = (e("KID_API_BASE") or s.kid_api_base).rstrip("/")
    s.inworld_realtime_key = e("INWORLD_REALTIME_KEY", "")
    s.inworld_standard_key = e("INWORLD_STANDARD_KEY", "")
    s.modulate_api_key = e("MODULATE_API_KEY", "")
    s.llm_model = e("LLM_MODEL") or s.llm_model
    s.feedback_model = e("FEEDBACK_MODEL") or ""
    s.jwt_secret = e("JWT_SECRET", "")
    s.frontend_origin = e("FRONTEND_ORIGIN") or s.frontend_origin
    return s


settings = load_settings()

# name -> (mtime_ns, data). Content is loaded on first use and reloaded if the file changes.
_content_cache: dict[str, tuple[int, Any]] = {}


def load_content(name: str) -> Any:
    """Load backend/app/content/<name>.json lazily. Raises ApiError 503 if it is not there yet."""
    path = Path(settings.content_dir) / f"{name}.json"
    try:
        mtime = path.stat().st_mtime_ns
    except OSError:
        raise ApiError(503, "content_unavailable", "Lesson content is not available yet.")
    key = str(path)
    cached = _content_cache.get(key)
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise ApiError(503, "content_unavailable", "Lesson content could not be read.")
    _content_cache[key] = (mtime, data)
    return data


def try_load_content(name: str) -> Any | None:
    try:
        return load_content(name)
    except ApiError:
        return None


def get_persona(persona_id: str) -> dict | None:
    data = try_load_content("personas")
    if not isinstance(data, list):
        return None
    for p in data:
        if p.get("id") == persona_id:
            return p
    return None
