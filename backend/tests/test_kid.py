import httpx
import pytest

from app import kid
from app.errors import ApiError
from app.store import Session

PERMS = [
    {"name": "ai-chat", "enabled": True, "managedBy": "PLAYER"},
    {"name": "ai-voice-mode", "enabled": False, "managedBy": "GUARDIAN"},
]


def test_parse_claim_shapes():
    for data in (
        {"session": {"sessionId": "s1", "permissions": PERMS}},
        {"sessionId": "s1", "permissions": PERMS},
        {"result": {"session": {"sessionId": "s1", "permissions": PERMS}}},
    ):
        r = kid.parse_claim(data)
        assert r["kid_session_id"] == "s1" and r["status"] == "pass"
        assert r["permissions"]["ai-chat"]["enabled"] is True
        assert r["permissions"]["ai-voice-mode"] == {"enabled": False, "managedBy": "GUARDIAN"}


def test_parse_claim_status():
    assert kid.parse_claim({"status": "PASS", "sessionId": "s", "permissions": PERMS})["status"] == "pass"
    assert kid.parse_claim({"status": "CHALLENGE", "sessionId": "s", "permissions": PERMS})["status"] == "pending"
    assert kid.parse_claim({"status": "FAIL"})["status"] == "fail"
    assert kid.parse_claim({"sessionId": "s", "permissions": PERMS, "challenge": {"challengeId": "c"}})["status"] == "pending"
    assert kid.parse_claim({"sessionId": "s"})["status"] == "pending"  # no permissions -> pending
    pending = kid.parse_claim({"challenge": {"challengeId": "c"}})
    assert pending["kid_session_id"] is None and pending["status"] == "pending"
    assert kid.parse_claim("garbage")["status"] == "pending"


class FakeClient:
    def __init__(self, responder):
        self.responder = responder

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, **kw):
        return self.responder(url, kw)

    async def post(self, url, **kw):
        return self.responder(url, kw)


def patch_http(monkeypatch, responder):
    monkeypatch.setattr(kid.httpx, "AsyncClient", lambda **kw: FakeClient(responder))


async def test_claim_bad_token_and_network_failure(monkeypatch):
    patch_http(monkeypatch, lambda u, kw: httpx.Response(400, json={"error": "CLAIM_TOKEN_INVALID"}))
    with pytest.raises(ApiError) as e:
        await kid.claim("tok")
    assert e.value.status == 400 and e.value.code == "claim_invalid"

    def boom(u, kw):
        raise httpx.ConnectError("down")

    patch_http(monkeypatch, boom)
    with pytest.raises(ApiError) as e:
        await kid.claim("tok")
    assert e.value.status == 503 and e.value.code == "kid_unavailable"


async def test_claim_sends_bearer_and_body(monkeypatch):
    seen = {}

    def responder(url, kw):
        seen.update(url=url, **kw)
        return httpx.Response(200, json={"session": {"sessionId": "s1", "permissions": PERMS}})

    patch_http(monkeypatch, responder)
    r = await kid.claim("tok")
    assert r["kid_session_id"] == "s1"
    assert seen["url"].endswith("/client/claim") and seen["json"] == {"claimToken": "tok"}
    assert seen["headers"]["Authorization"].startswith("Bearer ")


async def test_refresh_updates_then_fails_closed(monkeypatch):
    s = Session(kid_session_id="s1", status="pass")
    patch_http(monkeypatch, lambda u, kw: httpx.Response(200, json={"sessionId": "s1", "permissions": PERMS, "jurisdiction": "US"}))
    await kid.refresh_permissions(s, force=True)
    assert s.perms_ok and s.permissions["ai-chat"]["enabled"] and s.jurisdiction == "US"

    patch_http(monkeypatch, lambda u, kw: httpx.Response(400, json={"error": "NOT_FOUND"}))
    await kid.refresh_permissions(s, force=True)  # lenient: marks deny-all
    assert s.perms_ok is False
    with pytest.raises(ApiError) as e:
        await kid.refresh_permissions(s, force=True, strict=True)
    assert e.value.status == 503


async def test_refresh_skipped_when_fresh(monkeypatch):
    import time

    s = Session(kid_session_id="s1", perms_fetched_at=time.time())

    def never(u, kw):
        raise AssertionError("should not call k-ID")

    patch_http(monkeypatch, never)
    await kid.refresh_permissions(s)
