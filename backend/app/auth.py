"""Accounts: bcrypt passwords, HS256 JWT in an httpOnly cookie, and the /api/auth routes.
Never log or return emails, passwords, tokens or hashes beyond what a route's contract says."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import re
import time
from dataclasses import dataclass
from typing import Any

import bcrypt
import jwt
from fastapi import APIRouter, Request, Response, WebSocket

from . import db
from .config import settings
from .errors import ApiError
from .store import COOKIE_NAME, store

TOKEN_COOKIE = "vw_token"
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
BCRYPT_ROUNDS = 12
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

auth_router = APIRouter(prefix="/auth")

_dummy_hash: bytes | None = None


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str
    name: str

    def public(self) -> dict:
        return {"id": self.id, "email": self.email, "displayName": self.name}


# ---------------------------------------------------------------- passwords

def _prehash(password: str) -> bytes:
    """bcrypt only reads 72 bytes; hash first so a 128 character password counts in full."""
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("ascii")


def verify_password(password: str, password_hash: str | bytes | None) -> bool:
    """Always does one bcrypt check, even for an unknown account, so timing does not reveal emails."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password("not-a-real-password").encode("ascii")
    stored = password_hash.encode("ascii") if isinstance(password_hash, str) else (password_hash or _dummy_hash)
    try:
        ok = bcrypt.checkpw(_prehash(password), stored)
    except ValueError:
        return False
    return ok and password_hash is not None


# ---------------------------------------------------------------- tokens

def create_token(user_id: str, email: str, name: str) -> str:
    if not settings.jwt_secret:
        raise ApiError(503, "auth_unavailable", "Sign in is not available right now.")
    now = int(time.time())
    claims = {"sub": user_id, "email": email, "name": name, "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def user_from_token(token: str | None) -> AuthUser | None:
    """Decode and verify a token. None for anything missing, expired, forged or malformed."""
    if not token or not settings.jwt_secret:
        return None
    try:
        c: dict[str, Any] = jwt.decode(
            token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["sub", "exp"]}
        )
    except jwt.PyJWTError:
        return None
    if not all(isinstance(c.get(k), str) for k in ("sub", "email", "name")):
        return None
    return AuthUser(id=c["sub"], email=c["email"], name=c["name"])


def not_authenticated() -> ApiError:
    return ApiError(401, "not_authenticated", "Please sign in first.")


def require_user(request: Request) -> AuthUser:
    """Guard dependency: the signed-in user or 401 not_authenticated. Runs before any session check."""
    user = getattr(request.state, "user", None)
    if user is None:
        user = user_from_token(request.cookies.get(TOKEN_COOKIE))
        if user is None:
            raise not_authenticated()
        request.state.user = user
    return user


def user_from_websocket(ws: WebSocket) -> AuthUser | None:
    return user_from_token(ws.cookies.get(TOKEN_COOKIE))


def _set_token_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        TOKEN_COOKIE, token, max_age=TOKEN_TTL_SECONDS, httponly=True, samesite="lax", path="/",
        secure=settings.frontend_origin.startswith("https://"),
    )


# ---------------------------------------------------------------- validation

def _bad(message: str) -> ApiError:
    return ApiError(400, "invalid_input", message)


def clean_email(value: Any) -> str:
    email = value.strip().lower() if isinstance(value, str) else ""
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise _bad("Enter a valid email address.")
    return email


def clean_password(value: Any) -> str:
    if not isinstance(value, str) or not 8 <= len(value) <= 128:
        raise _bad("Password must be 8 to 128 characters.")
    return value


def clean_display_name(value: Any, email: str) -> str:
    if value is None or (isinstance(value, str) and not value.strip()):
        return email.split("@", 1)[0][:40]
    name = value.strip() if isinstance(value, str) else ""
    if not 1 <= len(name) <= 40:
        raise _bad("Display name must be 1 to 40 characters.")
    return name


async def _body(request: Request) -> dict:
    try:
        body: Any = await request.json()
    except ValueError:
        body = None
    if not isinstance(body, dict):
        raise _bad("That request wasn't in the right shape.")
    return body


# ---------------------------------------------------------------- routes

def _drop_foreign_session(request: Request, user_id: str) -> None:
    """Signing in as someone else must not leave the previous person's practice session reachable."""
    sid = request.cookies.get(COOKIE_NAME)
    if sid and store.get_for_user(sid, user_id) is None:
        store.delete(sid)


def _sign_in(request: Request, response: Response, user: dict) -> dict:
    _drop_foreign_session(request, user["id"])
    _set_token_cookie(response, create_token(user["id"], user["email"], user["display_name"]))
    return {"user": {"id": user["id"], "email": user["email"], "displayName": user["display_name"]}}


@auth_router.post("/signup", status_code=201)
async def signup(request: Request, response: Response) -> dict:
    body = await _body(request)
    email = clean_email(body.get("email"))
    password = clean_password(body.get("password"))
    name = clean_display_name(body.get("displayName"), email)
    if db.get_user_by_email(email):
        raise ApiError(409, "email_taken", "An account with that email already exists.")
    pw_hash = await asyncio.to_thread(hash_password, password)
    try:
        user = db.create_user(email, pw_hash, name)
    except db.EmailTaken:
        raise ApiError(409, "email_taken", "An account with that email already exists.") from None
    return _sign_in(request, response, user)


@auth_router.post("/login")
async def login(request: Request, response: Response) -> dict:
    try:
        body = await _body(request)
    except ApiError:
        body = {}  # a malformed login body is just a failed login
    email, password = body.get("email"), body.get("password")
    user = None
    if isinstance(email, str) and isinstance(password, str) and 0 < len(password) <= 128:
        user = db.get_user_by_email(email.strip().lower())
    ok = await asyncio.to_thread(
        verify_password, password if isinstance(password, str) else "", user["password_hash"] if user else None
    )
    if not user or not ok:
        raise ApiError(401, "invalid_credentials", "That email and password don't match.")
    return _sign_in(request, response, user)


@auth_router.post("/logout")
async def logout(request: Request, response: Response) -> dict:
    store.delete(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(TOKEN_COOKIE, path="/")
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@auth_router.get("/me")
async def me(request: Request) -> dict:
    user = user_from_token(request.cookies.get(TOKEN_COOKIE))
    row = db.get_user_by_id(user.id) if user else None
    if not row:
        raise not_authenticated()
    return {"user": {"id": row["id"], "email": row["email"], "displayName": row["display_name"]}}
