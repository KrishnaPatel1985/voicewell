import json
import logging
import shutil

from app import llm, practice_text, topics
from app.config import settings
from app.resolver import persona_id_for, resolve_config

from .conftest import FIXTURES, authed, make_session, sign_in


def copy_fixtures(tmp_path):
    for f in FIXTURES.glob("*.json"):
        shutil.copy(f, tmp_path / f.name)
    return tmp_path


# ---------------------------------------------------------------- GET /api/topics

def test_topics_list_shape_and_order(client):
    sign_in(client)  # auth only: no k-ID session needed
    r = client.get("/api/topics")
    assert r.status_code == 200
    rows = r.json()["topics"]
    assert [t["id"] for t in rows] == ["stress", "menopause"]
    assert rows[1] == {"id": "menopause", "title": "Understanding menopause", "summary": "Talk about menopause.",
                       "icon": "heart", "intents": ["myself", "someone-else"]}


def test_topics_skips_files_that_do_not_parse_and_logs_the_name(client, monkeypatch, tmp_path, caplog):
    monkeypatch.setattr(settings, "content_dir", copy_fixtures(tmp_path))
    (tmp_path / "broken.json").write_text("{not json", encoding="utf-8")
    sign_in(client)
    with caplog.at_level(logging.WARNING, logger="voicewell.topics"):
        r = client.get("/api/topics")
    assert r.status_code == 200 and [t["id"] for t in r.json()["topics"]] == ["stress", "menopause"]
    assert "broken.json" in caplog.text


def test_topics_picks_up_files_added_or_changed_at_runtime(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "content_dir", copy_fixtures(tmp_path))
    sign_in(client)
    assert len(client.get("/api/topics").json()["topics"]) == 2
    extra = json.loads((FIXTURES / "stress.json").read_text(encoding="utf-8"))
    extra.update({"topic": "appointment", "title": "Preparing", "order": 3, "icon": "nonsense"})
    (tmp_path / "appointment.json").write_text(json.dumps(extra), encoding="utf-8")
    rows = client.get("/api/topics").json()["topics"]
    assert [t["id"] for t in rows] == ["stress", "menopause", "appointment"]
    assert rows[2]["icon"] == "book" and rows[2]["summary"] == "Talk about stress."  # unknown icon -> default
    (tmp_path / "appointment.json").unlink()
    assert len(client.get("/api/topics").json()["topics"]) == 2


def test_topics_with_no_content_is_empty_not_an_error(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "content_dir", tmp_path)
    sign_in(client)
    assert client.get("/api/topics").json() == {"topics": []}


# ---------------------------------------------------------------- onboarding and lessons

def test_onboarding_accepts_any_listed_topic(client):
    authed(client, intent=None)
    r = client.post("/api/onboarding", json={"intent": "myself", "topic": "menopause"})
    assert r.status_code == 200
    body = r.json()
    assert body["topic"] == "menopause" and body["topicTitle"] == "Understanding menopause"
    assert body["persona"]["id"] == "doctor"
    for bad in ("sleep", None, 3, "../safety", "personas", ""):
        r = client.post("/api/onboarding", json={"intent": "myself", "topic": bad})
        assert r.status_code == 400 and r.json()["error"] == "invalid_input", bad


def test_changing_topic_resets_lesson_and_practice(client):
    s = authed(client, age=45)
    client.get("/api/lesson/stress/next")
    s.practice.turns.append({"role": "user", "content": "x"})
    s.practice.persona_turn_count = 3
    assert s.lesson_state.initialised
    r = client.post("/api/onboarding", json={"intent": "myself", "topic": "menopause"})
    assert r.status_code == 200
    assert not s.lesson_state.initialised and s.practice.turns == [] and s.practice.persona_turn_count == 0


def test_lesson_routes_follow_the_session_topic(client):
    authed(client, age=65, topic="menopause")
    step = client.get("/api/lesson/menopause/next").json()
    assert step["cards"][0]["conceptId"] == "m1" and step["total"] == 4
    assert client.get("/api/lesson/menopause/simpler").json()["cards"][0]["depth"] == "simple"
    r = client.post("/api/lesson/check", json={"conceptId": "m1", "answerIndex": 1})
    assert r.status_code == 200 and r.json()["correct"] is True
    assert client.post("/api/lesson/check", json={"conceptId": "c1", "answerIndex": 1}).status_code == 400


def test_lesson_topic_mismatch_is_409(client):
    user = sign_in(client)
    authed(client, user=user, topic="menopause")
    for path in ("/api/lesson/stress/next", "/api/lesson/stress/simpler", "/api/lesson/unknown/next"):
        r = client.get(path)
        assert r.status_code == 409 and r.json()["error"] == "topic_mismatch", path
    authed(client, user=user, intent=None)  # no topic chosen yet
    assert client.get("/api/lesson/stress/next").json()["error"] == "topic_mismatch"


def test_session_config_has_topic_title(client):
    user = sign_in(client)
    authed(client, user=user, topic="menopause")
    body = client.get("/api/session").json()
    assert body["topic"] == "menopause" and body["topicTitle"] == "Understanding menopause"
    authed(client, user=user, intent=None)
    body = client.get("/api/session").json()
    assert body["topic"] is None and body["topicTitle"] is None


# ---------------------------------------------------------------- persona rules

def test_persona_rules_by_topic_intent_and_age():
    def pid(**kw):
        return persona_id_for(make_session(**kw)[1])

    assert pid(topic="stress", age=64) == "trusted-adult"
    assert pid(topic="stress", age=65) == "doctor"            # minAge is inclusive
    assert pid(topic="stress", intent="someone-else") == "guarded-teen"
    assert pid(topic="menopause", age=30) == "doctor"
    assert pid(topic="menopause", intent="someone-else") == "relative"
    assert pid(intent=None) is None


def test_rules_first_match_wins_and_bounds_are_inclusive():
    topic = {"persona_rules": {"myself": [{"maxAge": 17, "persona": "a"}, {"minAge": 18, "maxAge": 64, "persona": "b"},
                                          {"persona": "c"}]}}
    pick = lambda age: topics.persona_from_rules(topic, "myself", age)  # noqa: E731
    assert [pick(17), pick(18), pick(64), pick(65)] == ["a", "b", "b", "c"]
    assert topics.persona_from_rules(topic, "someone-else", 30) is None
    assert topics.persona_from_rules({}, "myself", 30) is None


def test_topic_without_persona_rules_keeps_v1_mapping(monkeypatch, tmp_path):
    copy_fixtures(tmp_path)
    old = json.loads((tmp_path / "stress.json").read_text(encoding="utf-8"))
    for k in ("persona_rules", "practice_goal", "key_questions"):
        old.pop(k)
    (tmp_path / "stress.json").write_text(json.dumps(old), encoding="utf-8")
    monkeypatch.setattr(settings, "content_dir", tmp_path)
    assert persona_id_for(make_session(age=70)[1]) == "doctor"
    assert persona_id_for(make_session(age=30)[1]) == "trusted-adult"
    assert persona_id_for(make_session(age=30, intent="someone-else")[1]) == "guarded-teen"
    assert resolve_config(make_session(age=30)[1])["persona"]["id"] == "trusted-adult"


# ---------------------------------------------------------------- scenario prompt

def test_system_prompt_order_scenario_then_style():
    persona = {"system_prompt": "You are Sam.", "band_style": {"25-64": "Be direct."}}
    assert practice_text.system_prompt(persona, 45, "Do the thing.") == "You are Sam.\n\nScenario: Do the thing.\n\nStyle: Be direct."
    assert practice_text.system_prompt(persona, 45) == "You are Sam.\n\nStyle: Be direct."
    assert practice_text.system_prompt(persona, 14, "Do the thing.") == "You are Sam.\n\nScenario: Do the thing."


def test_text_practice_sends_scenario_from_the_topic(client, monkeypatch):
    seen = []

    async def chat(messages, **kw):
        seen.append(messages)
        return '{"self_harm": false, "diagnosis_request": false}' if "safety classifier" in messages[0]["content"] else "ok"

    monkeypatch.setattr(llm, "chat", chat)
    authed(client, topic="menopause", intent="someone-else", age=45)
    assert client.post("/api/practice/text", json={"text": "hello mum"}).status_code == 200
    system = next(m[0]["content"] for m in seen if "safety classifier" not in m[0]["content"])
    assert system.startswith("You are Linda")
    assert "\n\nScenario: You are Linda, the learner's mum" in system
    assert system.endswith("\n\nStyle: Be direct.")
    assert "hello mum" not in system
    assert client.get("/api/practice/starters").json() == {"starters": ["r1", "r2", "r3", "r4"]}


def test_voice_instructions_use_the_same_prompt():
    persona = {"system_prompt": "You are Sam.", "band_style": {"25-64": "Be direct."}}
    _, s = make_session(topic="stress", age=45)
    assert practice_text.session_prompt(s, persona) == (
        "You are Sam.\n\nScenario: You are Sam; the learner wants to talk about stress with you.\n\nStyle: Be direct.")
