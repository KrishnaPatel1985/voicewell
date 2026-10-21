import time

import jwt
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app import auth, db, kid
from app.config import settings
from app.main import app
from app.store import COOKIE_NAME, store

from .conftest import authed, make_session, set_cookie

GUARDED = [
    ("get", "/api/session"),
    ("post", "/api/onboarding"),
    ("get", "/api/topics"),
    ("get", "/api/lesson/stress/next"),
    ("get", "/api/lesson/stress/simpler"),
    ("post", "/api/lesson/check"),
    ("get", "/api/practice/starters"),
    ("post", "/api/practice/text"),
    ("post", "/api/practice/reset"),
    ("post", "/api/practice/feedback"),
    ("post", "/api/kid/claim"),
]

SIGNUP = {"email": "Alex@Example.com ", "password": "correct horse", "displayName": " Alex "}


def signup(client, **over):
    return client.post("/api/auth/signup", json={**SIGNUP, **over})


# ---------------------------------------------------------------- the flow

def test_signup_me_logout_me(client):
    r = signup(client)
    assert r.status_code == 201
    user = r.json()["user"]
    assert set(user) == {"id", "email", "displayName"}
    assert user["email"] == "alex@example.com" and user["displayName"] == "Alex"
    cookie = r.headers["set-cookie"].lower()
    assert "vw_token=" in cookie and "httponly" in cookie and "samesite=lax" in cookie
    assert "max-age=604800" in cookie and "path=/" in cookie and "secure" not in cookie

    me = client.get("/api/auth/me")
    assert me.status_code == 200 and me.json() == {"user": user}

    out = client.post("/api/auth/logout")
    assert out.status_code == 200 and out.json() == {"ok": True}
    again = client.get("/api/auth/me")
    assert again.status_code == 401 and again.json()["error"] == "not_authenticated"


def test_token_claims(client):
    user = signup(client).json()["user"]
    claims = jwt.decode(client.cookies.get(auth.TOKEN_COOKIE), settings.jwt_secret, algorithms=["HS256"])
    assert claims["sub"] == user["id"] and claims["email"] == "alex@example.com" and claims["name"] == "Alex"
    assert claims["exp"] - claims["iat"] == 7 * 24 * 60 * 60


def test_login_after_signup(client):
    signup(client)
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "ALEX@example.com", "password": "correct horse"})
    assert r.status_code == 200 and r.json()["user"]["displayName"] == "Alex"
    assert client.get("/api/auth/me").status_code == 200


def test_logout_deletes_the_in_memory_session_and_clears_both_cookies(client):
    signup(client)
    user_id = client.get("/api/auth/me").json()["user"]["id"]
    sid, s = make_session(user_id=user_id)
    set_cookie(client, COOKIE_NAME, sid)
    r = client.post("/api/auth/logout")
    assert store.get(sid) is None
    set_cookies = " ".join(r.headers.get_list("set-cookie"))
    assert "vw_token=" in set_cookies and "vw_sid=" in set_cookies
    assert COOKIE_NAME not in client.cookies and auth.TOKEN_COOKIE not in client.cookies


# ---------------------------------------------------------------- errors

def test_duplicate_email_is_409(client):
    assert signup(client).status_code == 201
    r = signup(client, email="alex@EXAMPLE.com")
    assert r.status_code == 409 and r.json()["error"] == "email_taken" and r.json()["message"]


def test_wrong_password_and_unknown_email_look_the_same(client):
    signup(client)
    client.cookies.clear()
    wrong = client.post("/api/auth/login", json={"email": "alex@example.com", "password": "not the one"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "not the one"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"] == "invalid_credentials"
    assert auth.TOKEN_COOKIE not in client.cookies
    for body in ({}, {"email": 1, "password": None}, {"email": "alex@example.com"}):
        assert client.post("/api/auth/login", json=body).status_code == 401
    assert client.post("/api/auth/login", content="not json").status_code == 401


@pytest.mark.parametrize("over,field", [
    ({"password": "short"}, "assword"),
    ({"password": "x" * 129}, "assword"),
    ({"password": 12345678}, "assword"),
    ({"email": "no-at-sign"}, "mail"),
    ({"email": "a@b"}, "mail"),
    ({"email": None}, "mail"),
    ({"displayName": "n" * 41}, "isplay name"),
    ({"displayName": 5}, "isplay name"),
])
def test_signup_validation_400(client, over, field):
    r = signup(client, **over)
    assert r.status_code == 400 and r.json()["error"] == "invalid_input"
    assert field in r.json()["message"]
    assert auth.TOKEN_COOKIE not in client.cookies


def test_signup_bad_body_is_400(client):
    r = client.post("/api/auth/signup", content="not json")
    assert r.status_code == 400 and r.json()["error"] == "invalid_input"


def test_display_name_defaults_to_email_local_part(client):
    r = client.post("/api/auth/signup", json={"email": "Sam.Jones@example.com", "password": "12345678"})
    assert r.json()["user"]["displayName"] == "sam.jones"


def test_password_length_limits_are_in_characters(client):
    assert signup(client, password="12345678").status_code == 201
    assert signup(client, email="b@example.com", password="é" * 128).status_code == 201
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": "b@example.com", "password": "é" * 128}).status_code == 200
    # the whole password counts, not just the first 72 bytes
    assert client.post("/api/auth/login", json={"email": "b@example.com", "password": "é" * 127 + "x"}).status_code == 401


# ---------------------------------------------------------------- storage

def test_password_is_stored_as_a_bcrypt_hash(client):
    signup(client, password="plain text pw")
    row = db.get_user_by_email("alex@example.com")
    assert row["password_hash"].startswith("$2") and "plain text pw" not in row["password_hash"]
    assert auth.verify_password("plain text pw", row["password_hash"])
    assert not auth.verify_password("other", row["password_hash"])
    assert "plain text pw".encode() not in settings.db_path.read_bytes()
    assert set(row) == {"id", "email", "password_hash", "display_name", "created_at"}


# ---------------------------------------------------------------- guard

@pytest.mark.parametrize("method,path", GUARDED)
def test_guarded_routes_need_a_token_before_a_session(client, method, path):
    sid, _ = make_session(user_id="someone")
    set_cookie(client, COOKIE_NAME, sid)  # a valid session cookie does not help without a token
    r = getattr(client, method)(path, **({"json": {}} if method == "post" else {}))
    assert r.status_code == 401
    assert r.json()["error"] == "not_authenticated" and r.json()["message"]


def test_public_routes_need_no_token(client):
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/logout").status_code == 200


def test_bad_tokens_are_refused(client):
    sid, _ = make_session()
    now = int(time.time())
    base = {"sub": "u1", "email": "a@example.com", "name": "A", "iat": now, "exp": now + 60}
    bad = {
        "garbage": "not.a.jwt",
        "wrong secret": jwt.encode(base, "x" * 40, algorithm="HS256"),
        "expired": jwt.encode({**base, "iat": now - 120, "exp": now - 60}, settings.jwt_secret, algorithm="HS256"),
        "no sub": jwt.encode({k: v for k, v in base.items() if k != "sub"}, settings.jwt_secret, algorithm="HS256"),
        "alg none": jwt.encode(base, None, algorithm="none"),
    }
    for label, token in bad.items():
        client.cookies.clear()
        set_cookie(client, auth.TOKEN_COOKIE, token)
        r = client.get("/api/session")
        assert r.status_code == 401 and r.json()["error"] == "not_authenticated", label


def test_voice_socket_without_token_is_refused(client):
    sid, _ = make_session(user_id="someone")
    set_cookie(client, COOKIE_NAME, sid)
    with client.websocket_connect("/api/practice/voice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error" and msg["code"] == "not_authenticated"
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4401


def test_voice_socket_with_another_users_session_is_no_session(client):
    authed(client)
    other = make_session(user_id="somebody-else")[0]
    set_cookie(client, COOKIE_NAME, other)
    with client.websocket_connect("/api/practice/voice") as ws:
        assert ws.receive_json()["code"] == "no_session"
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4401


# ---------------------------------------------------------------- session binding

def test_session_of_user_a_is_not_reachable_with_user_b_token(client):
    a = authed(client, age=45)
    sid_a = client.cookies.get(COOKIE_NAME)
    a.practice.turns.append({"role": "user", "content": "private words"})
    assert client.get("/api/session").status_code == 200

    with TestClient(app) as b:
        assert b.post("/api/auth/signup", json={"email": "b@example.com", "password": "password-b"}).status_code == 201
        set_cookie(b, COOKIE_NAME, sid_a)  # B presents A's session cookie
        for method, path in [("get", "/api/session"), ("get", "/api/lesson/stress/next"),
                             ("post", "/api/practice/feedback"), ("post", "/api/practice/reset")]:
            r = getattr(b, method)(path)
            assert r.status_code == 401 and r.json()["error"] == "no_session", path
        with b.websocket_connect("/api/practice/voice") as ws:
            assert ws.receive_json()["code"] == "no_session"
    # A's session and its turns were not touched
    assert store.get(sid_a) is a and a.practice.turns == [{"role": "user", "content": "private words"}]


def test_claim_never_upgrades_another_users_session(client, monkeypatch):
    a = authed(client)
    sid_a = client.cookies.get(COOKIE_NAME)
    client.cookies.delete(auth.TOKEN_COOKIE)
    signup(client, email="b@example.com")  # now signed in as B but still holding A's sid cookie

    async def claim(token):
        return {"kid_session_id": "kid-b", "status": "pass", "jurisdiction": None,
                "permissions": {"ai-chat": {"enabled": True, "managedBy": "PLAYER"}}}

    monkeypatch.setattr(kid, "claim", claim)
    r = client.post("/api/kid/claim", json={"claimToken": "t", "age": 30})
    assert r.status_code == 200
    sid_b = client.cookies.get(COOKIE_NAME)
    assert sid_b != sid_a
    assert a.kid_session_id is None and a.user_id != store.get(sid_b).user_id


def test_claim_binds_the_session_to_the_user(client, monkeypatch):
    user_id = signup(client).json()["user"]["id"]

    async def claim(token):
        return {"kid_session_id": "kid-1", "status": "pass", "jurisdiction": None, "permissions": {}}

    monkeypatch.setattr(kid, "claim", claim)
    client.post("/api/kid/claim", json={"claimToken": "t", "age": 30})
    assert store.get(client.cookies.get(COOKIE_NAME)).user_id == user_id


def test_logging_in_as_someone_else_drops_the_previous_session(client):
    authed(client)
    sid = client.cookies.get(COOKIE_NAME)
    with TestClient(app) as other:
        other.post("/api/auth/signup", json={"email": "b@example.com", "password": "password-b"})
    client.cookies.delete(auth.TOKEN_COOKIE)
    r = client.post("/api/auth/login", json={"email": "b@example.com", "password": "password-b"})
    assert r.status_code == 200
    assert store.get(sid) is None
    assert client.get("/api/session").json()["error"] == "no_session"


def test_login_as_the_same_user_keeps_the_session(client):
    signup(client)
    user_id = client.get("/api/auth/me").json()["user"]["id"]
    sid, _ = make_session(user_id=user_id)
    set_cookie(client, COOKIE_NAME, sid)
    client.post("/api/auth/login", json={"email": "alex@example.com", "password": "correct horse"})
    assert store.get(sid) is not None


def test_missing_jwt_secret_means_no_sign_in(client, monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", "")
    r = signup(client)
    assert r.status_code == 503 and r.json()["error"] == "auth_unavailable"
    assert client.get("/api/session").status_code == 401
