import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import auth, db, lesson, llm
from app.config import settings
from app.main import app
from app.store import COOKIE_NAME, store

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _env(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "content_dir", FIXTURES)
    monkeypatch.setattr(settings, "db_path", tmp_path / "test.db")
    monkeypatch.setattr(settings, "jwt_secret", "test-secret-test-secret-test-secret-0123")
    monkeypatch.setattr(settings, "feedback_model", "test/feedback-model")
    monkeypatch.setattr(auth, "BCRYPT_ROUNDS", 4)
    monkeypatch.setattr(lesson, "DEDUPE_SECONDS", 0)

    async def no_network(*a, **k):
        raise llm.LLMError("network disabled in tests")

    monkeypatch.setattr(llm, "chat", no_network)
    store.clear()
    yield
    store.clear()


def perms(chat=True, voice=True, managed_by=None):
    return {
        "ai-chat": {"enabled": chat, "managedBy": managed_by},
        "ai-voice-mode": {"enabled": voice, "managedBy": managed_by},
    }


def make_session(age=45, status="pass", permissions=None, intent="myself", kid_sid=None, user_id=None, topic="stress"):
    """Create a session directly in the store (bypassing k-ID). Returns (sid, session)."""
    sid, s = store.create()
    s.age = age
    s.status = status
    s.permissions = permissions if permissions is not None else perms()
    s.intent = intent
    s.topic = topic if intent else None
    s.user_id = user_id
    s.kid_session_id = kid_sid
    s.perms_fetched_at = time.time()
    return sid, s


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def set_cookie(client, name, value):
    """Set a cookie the way the server would (same domain), so a later Set-Cookie replaces it."""
    client.cookies.set(name, value, domain="testserver.local", path="/")


def sign_in(client, email="a@example.com", name="Alex"):
    """Create an account row and put its token cookie on the client. Returns the AuthUser."""
    row = db.create_user(email, auth.hash_password("password-1"), name)
    set_cookie(client, auth.TOKEN_COOKIE, auth.create_token(row["id"], email, name))
    return auth.AuthUser(id=row["id"], email=email, name=name)


def authed(client, user=None, **kw):
    """Signed-in client with an in-memory session owned by that user."""
    user = user or sign_in(client)
    sid, s = make_session(user_id=user.id, **kw)
    set_cookie(client, COOKIE_NAME, sid)
    return s
