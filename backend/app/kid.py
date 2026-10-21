"""k-ID server API: claim a one-time token and re-read the session's permissions."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from .config import settings
from .errors import ApiError
from .store import Session

log = logging.getLogger("voicewell.kid")
TIMEOUT = 8.0
REFRESH_AFTER = 60.0
_logged_claim_keys = False


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.kid_secret_key}"}


def _norm_permissions(raw: Any) -> dict[str, dict[str, Any]] | None:
    """[{name, enabled, managedBy?}] -> {name: {enabled, managedBy}}. None if not a list."""
    if not isinstance(raw, list):
        return None
    out: dict[str, dict[str, Any]] = {}
    for p in raw:
        if isinstance(p, dict) and isinstance(p.get("name"), str):
            out[p["name"]] = {"enabled": p.get("enabled") is True, "managedBy": p.get("managedBy")}
    return out


def parse_claim(data: Any) -> dict:
    """Defensive parse of the claim response (shape unknown). Returns
    {kid_session_id, status ('pass'|'pending'|'fail'), permissions (dict|None), jurisdiction}."""
    d = data if isinstance(data, dict) else {}
    result = d.get("result") if isinstance(d.get("result"), dict) else {}
    sess = None
    for cand in (d.get("session"), result.get("session")):
        if isinstance(cand, dict):
            sess = cand
            break

    sid = None
    for cand in (sess.get("sessionId") if sess else None, d.get("sessionId"), result.get("sessionId")):
        if isinstance(cand, str) and cand:
            sid = cand
            break

    perms = None
    for cand in (sess.get("permissions") if sess else None, d.get("permissions"), result.get("permissions")):
        perms = _norm_permissions(cand)
        if perms is not None:
            break

    jurisdiction = None
    for cand in (sess.get("jurisdiction") if sess else None, d.get("jurisdiction")):
        if isinstance(cand, str) and cand:
            jurisdiction = cand
            break

    raw_status = d.get("status") or result.get("status")
    has_challenge = isinstance(d.get("challenge"), dict) or isinstance(result.get("challenge"), dict)
    up = raw_status.upper() if isinstance(raw_status, str) else ""
    if up == "PASS":
        status = "pass"
    elif up in ("FAIL", "PROHIBITED", "DENIED"):
        status = "fail"
    elif up in ("CHALLENGE", "PENDING", "IN_PROGRESS"):
        status = "pending"
    elif has_challenge or not perms:
        status = "pending"
    else:
        status = "pass"
    if status == "pass" and has_challenge:
        status = "pending"
    return {"kid_session_id": sid, "status": status, "permissions": perms, "jurisdiction": jurisdiction}


async def claim(token: str) -> dict:
    """POST /client/claim. Raises ApiError (400 claim_invalid, 503 kid_unavailable)."""
    global _logged_claim_keys
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                f"{settings.kid_api_base}/client/claim", headers=_headers(), json={"claimToken": token}
            )
    except httpx.HTTPError:
        raise ApiError(503, "kid_unavailable", "We couldn't reach the age check. Please try again.")
    if r.status_code == 400:
        raise ApiError(400, "claim_invalid", "That age check has expired. Please try again.")
    if r.status_code >= 300:
        log.warning("claim failed status=%s", r.status_code)
        raise ApiError(503, "kid_unavailable", "We couldn't reach the age check. Please try again.")
    try:
        data = r.json()
    except ValueError:
        data = {}
    if not _logged_claim_keys:
        _logged_claim_keys = True
        if isinstance(data, dict):
            log.info("claim response top-level keys: %s", sorted(data.keys()))
        else:
            log.info("claim response is %s", type(data).__name__)
    return parse_claim(data)


async def read_session(kid_session_id: str) -> dict:
    """GET /session/get. Returns {permissions: {name: {enabled, managedBy}}, jurisdiction}.
    Raises ApiError 503 on any failure."""
    unavailable = ApiError(503, "kid_unavailable", "We couldn't check your permissions right now.")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(
                f"{settings.kid_api_base}/session/get",
                headers=_headers(),
                params={"sessionId": kid_session_id},
            )
    except httpx.HTTPError:
        raise unavailable
    if r.status_code != 200:
        raise unavailable
    try:
        data = r.json()
    except ValueError:
        raise unavailable
    if not isinstance(data, dict):
        raise unavailable
    perms = _norm_permissions(data.get("permissions"))
    if perms is None:
        raise unavailable
    j = data.get("jurisdiction") if isinstance(data.get("jurisdiction"), str) else None
    return {"permissions": perms, "jurisdiction": j}


async def refresh_permissions(session: Session, force: bool = False, strict: bool = False) -> None:
    """Re-read permissions if the cache is older than 60 s (or force). On failure the session is
    marked perms_ok=False (deny all); with strict=True a 503 is raised so practice fails closed."""
    if not session.kid_session_id:
        return
    now = time.time()
    if not force and session.perms_ok and now - session.perms_fetched_at < REFRESH_AFTER:
        return
    if not force and not session.perms_ok and now - session.perms_fetched_at < 5:
        # k-ID just failed; do not hammer it on every request. Practice still fails closed.
        if strict:
            raise ApiError(503, "kid_unavailable", "We couldn't check your permissions right now.")
        return
    try:
        data = await read_session(session.kid_session_id)
    except ApiError:
        session.perms_ok = False
        session.perms_fetched_at = now
        if strict:
            raise
        return
    session.permissions = data["permissions"]
    if data["jurisdiction"]:
        session.jurisdiction = data["jurisdiction"]
    session.perms_ok = True
    session.perms_fetched_at = now
