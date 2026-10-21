import pytest
from starlette.websockets import WebSocketDisconnect

from app import kid, llm, practice_text
from app.store import COOKIE_NAME

from .conftest import authed, perms, sign_in

GUARDED = [
    ("get", "/api/session"),
    ("post", "/api/onboarding"),
    ("get", "/api/lesson/stress/next"),
    ("get", "/api/lesson/stress/simpler"),
    ("post", "/api/lesson/check"),
    ("get", "/api/practice/starters"),
    ("post", "/api/practice/text"),
    ("post", "/api/practice/reset"),
    ("post", "/api/practice/feedback"),
]


def test_health_needs_no_session(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"ok": True}


@pytest.mark.parametrize("method,path", GUARDED)
def test_guarded_routes_return_401_without_session_cookie(client, method, path):
    sign_in(client)  # signed in, but no age check yet
    r = getattr(client, method)(path, **({"json": {}} if method == "post" else {}))
    assert r.status_code == 401
    assert r.json()["error"] == "no_session" and r.json()["message"]


def test_unknown_cookie_is_401(client):
    sign_in(client)
    client.cookies.set(COOKIE_NAME, "not-a-session")
    assert client.get("/api/session").status_code == 401


def test_voice_socket_without_session_cookie_is_refused(client):
    sign_in(client)
    with client.websocket_connect("/api/practice/voice") as ws:
        assert ws.receive_json()["code"] == "no_session"
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4401


def test_voice_socket_not_permitted(client):
    authed(client, permissions=perms(True, False))
    with client.websocket_connect("/api/practice/voice") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error" and msg["code"] == "not_permitted" and msg["reason"] == "not-permitted"
        with pytest.raises(WebSocketDisconnect) as e:
            ws.receive_json()
        assert e.value.code == 4403


def test_session_returns_config(client):
    authed(client, age=14)
    r = client.get("/api/session")
    assert r.status_code == 200
    body = r.json()
    assert body["learner"]["depth"] == "simple" and body["capabilities"]["voicePractice"]["on"] is True


def test_onboarding_validates_and_sets_persona(client):
    authed(client, age=45, intent=None)
    assert client.post("/api/onboarding", json={"intent": "x", "topic": "stress"}).status_code == 400
    bad_topic = client.post("/api/onboarding", json={"intent": "myself", "topic": "sleep"})
    assert bad_topic.status_code == 400 and bad_topic.json()["error"] == "invalid_input"
    assert client.post("/api/onboarding", content="not json").status_code == 400
    r = client.post("/api/onboarding", json={
        "intent": "someone-else", "topic": "stress", "preferences": {"largeText": True, "starters": True, "junk": 1}})
    assert r.status_code == 200
    body = r.json()
    assert body["persona"]["id"] == "guarded-teen" and body["textSize"] == "large"
    assert body["preferences"]["starters"] is True and body["intent"] == "someone-else"


def test_lesson_flow_over_http(client):
    authed(client, age=65)
    step = client.get("/api/lesson/stress/next").json()
    assert step["total"] == 4 and step["cards"][0]["conceptId"] == "c1"
    r = client.post("/api/lesson/check", json={"conceptId": "c1", "answerIndex": 1}).json()
    assert r["correct"] is True
    assert client.post("/api/lesson/check", json={"conceptId": "nope", "answerIndex": 1}).status_code == 400
    assert client.get("/api/lesson/stress/simpler").json()["cards"][0]["depth"] == "simple"


def test_lessons_work_for_pending_but_practice_does_not(client):
    authed(client, status="pending", permissions={})
    assert client.get("/api/lesson/stress/next").status_code == 200
    r = client.post("/api/practice/text", json={"text": "hi"})
    assert r.status_code == 403
    assert r.json()["error"] == "not_permitted" and "waiting" in r.json()["message"]
    assert client.get("/api/practice/starters").status_code == 403


def test_text_practice_forbidden_when_ai_chat_off(client):
    authed(client, permissions=perms(False, False))
    assert client.post("/api/practice/text", json={"text": "hi"}).status_code == 403


def test_starters(client):
    authed(client)
    assert client.get("/api/practice/starters").json() == {"starters": ["s1", "s2", "s3", "s4"]}


def fake_llm(monkeypatch, reply="That sounds hard. What happened?", classifier=None):
    async def chat(messages, **kw):
        if messages[0]["content"].startswith("You are a safety classifier"):
            return classifier or '{"self_harm": false, "diagnosis_request": false}'
        return reply

    monkeypatch.setattr(llm, "chat", chat)


def test_text_practice_eight_turns_then_done(client, monkeypatch):
    fake_llm(monkeypatch)
    authed(client)
    for n in range(1, 9):
        r = client.post("/api/practice/text", json={"text": f"message {n}"}).json()
        assert r["reply"] and r["turn"] == n and r["done"] is (n == 8)
    assert client.post("/api/practice/text", json={"text": "more"}).json()["done"] is True
    assert client.post("/api/practice/reset").json() == {"ok": True}
    assert client.post("/api/practice/text", json={"text": "again"}).json()["turn"] == 1


def test_persona_prompt_never_contains_user_text(client, monkeypatch):
    seen = []

    async def chat(messages, **kw):
        seen.append(messages)
        return '{"self_harm": false, "diagnosis_request": false}' if "safety classifier" in messages[0]["content"] else "ok"

    monkeypatch.setattr(llm, "chat", chat)
    authed(client, age=14)
    client.post("/api/practice/text", json={"text": "secret words"})
    persona_call = [m for m in seen if "safety classifier" not in m[0]["content"]][0]
    assert persona_call[0]["role"] == "system" and "secret words" not in persona_call[0]["content"]
    assert "Use simple words." in persona_call[0]["content"]  # band style
    assert persona_call[-1] == {"role": "user", "content": "secret words"}


def test_text_self_harm_keyword_stops(client, monkeypatch):
    fake_llm(monkeypatch)
    s = authed(client)
    r = client.post("/api/practice/text", json={"text": "I want to kill myself"}).json()
    assert r["safety"]["message"] and r["reply"] == "" and r["done"] is True
    assert s.practice.safety_stopped
    assert "safety" in client.post("/api/practice/text", json={"text": "hello"}).json()


def test_text_self_harm_from_classifier(client, monkeypatch):
    fake_llm(monkeypatch, classifier='{"self_harm": true, "diagnosis_request": false}')
    authed(client)
    assert "safety" in client.post("/api/practice/text", json={"text": "nothing matters any more"}).json()


def test_text_diagnosis_redirects(client, monkeypatch):
    fake_llm(monkeypatch)
    authed(client)
    r = client.post("/api/practice/text", json={"text": "Do I have depression?"}).json()
    assert r["reply"] == "That is a question for a doctor or a trusted adult."


def test_condition_in_model_reply_is_replaced(client, monkeypatch):
    fake_llm(monkeypatch, reply="That sounds like depression.")
    authed(client)
    r = client.post("/api/practice/text", json={"text": "I feel flat"}).json()
    assert "depression" not in r["reply"] and "doctor" in r["reply"]


def test_llm_failure_uses_scripted_fallback(client, monkeypatch):
    async def chat(messages, **kw):
        if "safety classifier" in messages[0]["content"]:
            return '{"self_harm": false, "diagnosis_request": false}'
        raise llm.LLMError("timeout")

    monkeypatch.setattr(llm, "chat", chat)
    authed(client)
    assert client.post("/api/practice/text", json={"text": "hi"}).json()["reply"] == "f1"
    assert client.post("/api/practice/text", json={"text": "hi"}).json()["reply"] == "f2"


def test_practice_fails_closed_when_kid_unreachable(client, monkeypatch):
    fake_llm(monkeypatch)
    s = authed(client, kid_sid="kid-1")
    s.perms_fetched_at = 0  # stale -> re-read

    async def down(_):
        raise kid.ApiError(503, "kid_unavailable", "down")

    monkeypatch.setattr(kid, "read_session", down)
    r = client.post("/api/practice/text", json={"text": "hi"})
    assert r.status_code == 503 and r.json()["error"] == "kid_unavailable"
    # lessons stay available, but the session config shows practice off
    cfg = client.get("/api/session").json()
    assert cfg["capabilities"]["lessons"]["on"] and not cfg["capabilities"]["textPractice"]["on"]
    assert client.get("/api/lesson/stress/next").status_code == 200


def test_permission_change_picked_up_on_first_turn(client, monkeypatch):
    fake_llm(monkeypatch)
    s = authed(client, kid_sid="kid-1")  # cache is fresh and says chat is on

    async def read(_):
        return {"permissions": perms(False, False), "jurisdiction": None}

    monkeypatch.setattr(kid, "read_session", read)
    assert client.post("/api/practice/text", json={"text": "hi"}).status_code == 403


def test_fresh_session_read_sees_a_permission_changed_in_settings(client, monkeypatch):
    authed(client, kid_sid="kid-1", permissions=perms(False, False, "PLAYER"))  # cache is fresh and says off

    async def read(_):  # the player has since switched both on in Permissions
        return {"permissions": perms(True, True, "PLAYER"), "jurisdiction": None}

    monkeypatch.setattr(kid, "read_session", read)
    stale = client.get("/api/session").json()["capabilities"]
    assert not stale["voicePractice"]["on"]  # a plain read trusts the cache (under 60 s old)
    fresh = client.get("/api/session?fresh=1").json()["capabilities"]
    assert fresh["textPractice"]["on"] and fresh["voicePractice"]["on"]


def test_claim_sets_cookie_and_resolves(client, monkeypatch):
    sign_in(client)
    async def claim(token):
        assert token == "tok"
        return {"kid_session_id": "kid-1", "status": "pass", "jurisdiction": "US",
                "permissions": {"ai-chat": {"enabled": True, "managedBy": "PLAYER"}}}

    monkeypatch.setattr(kid, "claim", claim)
    r = client.post("/api/kid/claim", json={"claimToken": "tok", "age": 30})
    assert r.status_code == 200
    assert r.json()["status"] == "pass"
    assert "httponly" in r.headers["set-cookie"].lower() and "samesite=lax" in r.headers["set-cookie"].lower()
    cfg = r.json()["config"]
    assert cfg["capabilities"]["textPractice"]["on"] and not cfg["capabilities"]["voicePractice"]["on"]
    assert client.get("/api/session").status_code == 200


def test_claim_pending_then_upgrade_keeps_session(client, monkeypatch):
    sign_in(client)
    async def pending(token):
        return {"kid_session_id": None, "status": "pending", "jurisdiction": None, "permissions": None}

    monkeypatch.setattr(kid, "claim", pending)
    r = client.post("/api/kid/claim", json={"claimToken": "t1", "age": 12})
    assert r.json()["status"] == "pending"
    assert not r.json()["config"]["capabilities"]["textPractice"]["on"]
    assert r.json()["config"]["capabilities"]["lessons"]["on"]

    async def passed(token):
        return {"kid_session_id": "kid-1", "status": "pass", "jurisdiction": None,
                "permissions": {"ai-chat": {"enabled": True}, "ai-voice-mode": {"enabled": True}}}

    monkeypatch.setattr(kid, "claim", passed)
    r = client.post("/api/kid/claim", json={"claimToken": "t2", "age": 12})
    assert r.json()["status"] == "pass" and r.json()["config"]["capabilities"]["voicePractice"]["on"]


def test_claim_validation_and_errors(client, monkeypatch):
    sign_in(client)
    assert client.post("/api/kid/claim", json={"claimToken": "", "age": 30}).status_code == 400
    assert client.post("/api/kid/claim", json={"claimToken": "x", "age": "30"}).status_code == 400
    assert client.post("/api/kid/claim", json={"claimToken": "x", "age": 300}).status_code == 400

    async def bad(token):
        raise kid.ApiError(400, "claim_invalid", "expired")

    monkeypatch.setattr(kid, "claim", bad)
    r = client.post("/api/kid/claim", json={"claimToken": "x", "age": 30})
    assert r.status_code == 400 and r.json()["error"] == "claim_invalid"
    assert COOKIE_NAME not in client.cookies


def test_missing_content_gives_503_not_crash(client, monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.setattr(settings, "content_dir", tmp_path)
    authed(client)
    r = client.get("/api/lesson/stress/next")
    assert r.status_code == 503 and r.json()["error"] == "content_unavailable"
    assert client.get("/api/session").status_code == 200  # server still serves, persona falls back


def test_session_expires_after_30_minutes(client):
    s = authed(client)
    s.last_seen -= 31 * 60
    assert client.get("/api/session").status_code == 401


def test_unused_import_guard():
    assert practice_text.MAX_PERSONA_TURNS == 8
