import json
from pathlib import Path

from app import feedback
from app.feedback import SKILL_NAMES, clean, parse_feedback, tone_line

from .conftest import make_session, perms

FALLBACK = json.loads((Path(__file__).parent / "fixtures" / "safety.json").read_text(encoding="utf-8"))[
    "fallback_feedback"
]

USER_LINE = "I have been waking up at night and I do not know how to bring it up."
GOOD = {
    "summary": "You opened gently and kept the conversation going.",
    "skills": [
        {"name": "Opening", "level": "Strong", "note": "You started calmly."},
        {"name": "Listening", "level": "Growing", "note": "You heard Sam out."},
        {"name": "Clarity", "level": "Growing", "note": "Say what you need."},
        {"name": "Questions", "level": "Try next", "note": "Ask one open question."},
    ],
    "strengths": [{"point": "You described what you noticed.", "quote": "waking up at night"}],
    "improvements": [{"point": "Ask one open question.", "quote": "I do not know how to bring it up"}],
    "missingQuestions": ["How long has this been going on?"],
    "suggestedPhrases": [{"instead": "I do not know how to bring it up", "try": "I'd like to talk about my sleep."}],
}


def with_turns(s, n=2):
    for _ in range(n):
        s.practice.turns += [
            {"role": "user", "content": USER_LINE},
            {"role": "assistant", "content": "hi, tell me more"},
        ]
    return s


def patch_llm(monkeypatch, replies):
    calls = []

    async def fake(messages, **kw):
        calls.append({"messages": messages, **kw})
        r = replies[min(len(calls) - 1, len(replies) - 1)]
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr(feedback.llm, "chat", fake)
    return calls


def fb_from(obj, texts=(USER_LINE,)):
    return clean(obj, list(texts), FALLBACK)


# ---------------------------------------------------------------- parsing

def test_parse_strips_code_fences():
    out = parse_feedback("```json\n" + json.dumps(GOOD) + "\n```")
    assert out and out["summary"] == GOOD["summary"]


def test_parse_rejects_bad_shapes():
    assert parse_feedback("nope") is None
    assert parse_feedback(json.dumps({**GOOD, "summary": ""})) is None
    assert parse_feedback(json.dumps({"summary": "x", "strengths": [], "improvements": []})) is None
    assert parse_feedback("[1, 2]") is None


# ---------------------------------------------------------------- cleaning

def test_quote_not_in_transcript_is_dropped_but_point_stays():
    obj = {**GOOD, "strengths": [{"point": "You spoke up.", "quote": "something you never said"},
                                 {"point": "You were clear.", "quote": "WAKING   up at\nnight"}]}
    out = fb_from(obj)
    assert out["strengths"] == [{"point": "You spoke up."}, {"point": "You were clear.", "quote": "WAKING   up at\nnight"}]


def test_line_praised_as_strength_is_not_offered_for_rewrite():
    obj = {**GOOD, "strengths": [{"point": "You named the change.", "quote": "waking up at night"}],
           "suggestedPhrases": [{"instead": "waking up at night", "try": "I keep waking up."},
                                {"instead": "Bring it up", "try": "Name the topic."}]}
    out = fb_from(obj)
    assert out["suggestedPhrases"] == [{"instead": "Bring it up", "try": "Name the topic."}]


def test_instead_must_be_verbatim():
    obj = {**GOOD, "suggestedPhrases": [{"instead": "made up words", "try": "Say it plainly."},
                                        {"instead": "Bring it up", "try": "Name the topic."}]}
    out = fb_from(obj)
    assert out["suggestedPhrases"] == [{"try": "Say it plainly."}, {"instead": "Bring it up", "try": "Name the topic."}]


def test_condition_and_medicine_words_drop_the_item():
    obj = {
        **GOOD,
        "summary": "This sounds like depression.",
        "strengths": [{"point": "You described your anxiety disorder clearly"}, {"point": "You spoke clearly"}],
        "improvements": [{"point": "Mention the sertraline", "quote": "waking up"}],
        "missingQuestions": ["Is 20 mg enough?", "How long has this been going on?"],
        "suggestedPhrases": [{"try": "I have ptsd"}],
    }
    out = fb_from(obj)
    assert out["strengths"] == [{"point": "You spoke clearly"}]
    assert out["summary"] == FALLBACK["summary"]  # unsafe summary replaced by the fixed one
    assert out["improvements"] == FALLBACK["improvements"][:1]  # emptied list refilled with one fixed tip
    assert out["missingQuestions"] == ["How long has this been going on?"]
    assert out["suggestedPhrases"] == FALLBACK["suggestedPhrases"][:1]
    assert "depression" not in json.dumps(out) and "sertraline" not in json.dumps(out)


def test_quote_that_names_a_condition_drops_item():
    obj = {**GOOD, "strengths": [{"point": "You were open", "quote": "my depression"}]}
    out = fb_from(obj, ["I told her about my depression"])
    assert out["strengths"] == FALLBACK["strengths"][:1]


def test_skills_always_four_in_order():
    messy = {**GOOD, "skills": [
        {"name": "questions", "level": "strong", "note": "Good ones."},
        {"name": "Opening", "level": "Excellent", "note": ""},
        {"name": "Mystery", "level": "Strong", "note": "x"},
        "junk",
    ]}
    out = fb_from(messy)
    assert [s["name"] for s in out["skills"]] == list(SKILL_NAMES)
    by = {s["name"]: s for s in out["skills"]}
    assert by["Questions"] == {"name": "Questions", "level": "Strong", "note": "Good ones."}
    assert by["Opening"]["level"] == "Growing" and by["Opening"]["note"] == feedback.GENERIC_NOTE
    assert by["Listening"]["level"] == "Growing" and by["Clarity"]["level"] == "Growing"
    assert [s["name"] for s in fb_from({"summary": "x", "strengths": ["a"]})["skills"]] == list(SKILL_NAMES)


def test_lists_are_clamped_to_three():
    many = {**GOOD, "strengths": [{"point": f"s{i}"} for i in range(6)], "missingQuestions": [f"q{i}" for i in range(6)]}
    out = fb_from(many)
    assert len(out["strengths"]) == 3 and len(out["missingQuestions"]) == 3


def test_plain_string_items_are_accepted():
    out = fb_from({**GOOD, "strengths": ["You spoke up."], "suggestedPhrases": ["Try this."]})
    assert out["strengths"] == [{"point": "You spoke up."}] and out["suggestedPhrases"] == [{"try": "Try this."}]


def test_fixed_fallback_has_the_v2_shape():
    out = clean(FALLBACK, [], FALLBACK)
    assert isinstance(out["summary"], str) and out["summary"]
    assert [s["name"] for s in out["skills"]] == list(SKILL_NAMES)
    assert all(s["level"] in feedback.LEVELS and s["note"] for s in out["skills"])
    for k in ("strengths", "improvements"):
        assert out[k] and all(set(i) <= {"point", "quote"} and i["point"] for i in out[k])
    assert out["missingQuestions"] and all(isinstance(q, str) for q in out["missingQuestions"])
    assert out["suggestedPhrases"] and all(i["try"] for i in out["suggestedPhrases"])


def test_v1_shaped_fixed_tips_are_upgraded_to_v2():
    v1 = {"strengths": ["You spoke up."], "improvements": ["Ask more."], "missingQuestions": ["Why?"], "suggestedPhrases": ["Hi."]}
    out = clean(v1, [], v1)
    assert out["strengths"] == [{"point": "You spoke up."}] and out["summary"] == feedback.DEFAULT_SUMMARY
    assert [s["name"] for s in out["skills"]] == list(SKILL_NAMES)


# ---------------------------------------------------------------- generation

async def test_good_reply_gives_v2_feedback_without_a_score(monkeypatch):
    calls = patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session()
    fb = await feedback.get_feedback(with_turns(s))
    assert set(fb) == {"summary", "skills", "strengths", "improvements", "missingQuestions", "suggestedPhrases", "turnsPracticed"}
    assert fb["summary"] == GOOD["summary"] and fb["turnsPracticed"] == 2
    assert fb["strengths"][0]["quote"] == "waking up at night"
    assert "score" not in json.dumps(fb).lower()
    assert len(calls) == 1 and calls[0]["model"] == "test/feedback-model"
    assert calls[0]["max_tokens"] == 900 and calls[0]["temperature"] == 0.3 and calls[0]["timeout"] == 15.0


async def test_failed_call_falls_back_to_llm_model_once(monkeypatch):
    from app.config import settings

    calls = patch_llm(monkeypatch, [RuntimeError("down"), json.dumps(GOOD)])
    _, s = make_session()
    fb = await feedback.get_feedback(with_turns(s))
    assert [c["model"] for c in calls] == ["test/feedback-model", settings.llm_model]
    assert fb["summary"] == GOOD["summary"]


async def test_bad_json_retries_once_then_uses_fixed_feedback(monkeypatch):
    calls = patch_llm(monkeypatch, ["garbage", "still garbage"])
    _, s = make_session()
    fb = await feedback.get_feedback(with_turns(s))
    assert len(calls) == 2
    assert fb["summary"] == FALLBACK["summary"] and fb["strengths"] == FALLBACK["strengths"][:3]
    assert [x["name"] for x in fb["skills"]] == list(SKILL_NAMES)


async def test_prompt_has_context_and_transcript_is_a_user_message(monkeypatch):
    calls = patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session(age=45)
    await feedback.get_feedback(with_turns(s))
    system, user = calls[0]["messages"]
    text = system["content"]
    assert system["role"] == "system" and USER_LINE not in text
    assert "Stress and emotional well-being" in text            # topic title
    assert "for themselves" in text                              # intent
    assert "Sam" in text and "Sam description" in text           # persona name + description
    assert "Scenario: You are Sam" in text                       # practice_goal
    assert "How long has this been going on?" in text            # key_questions[intent]
    assert "Write for an adult" in text                          # reading level
    assert '"partner"' in text and "never as" in text            # naming rule is present
    assert "copied exactly" in text and "diagnosis" in text
    assert user["role"] == "user"
    assert f"You: {USER_LINE}" in user["content"] and "Sam: hi, tell me more" in user["content"]


async def test_prompt_uses_second_topic_context(monkeypatch):
    calls = patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session(topic="menopause", intent="someone-else")
    await feedback.get_feedback(with_turns(s))
    text = calls[0]["messages"][0]["content"]
    assert "Understanding menopause" in text and "support someone else" in text
    assert "Linda" in text and "How can I help?" in text and "How have you been sleeping?" in text


async def test_short_practice_still_returns_feedback(monkeypatch):
    patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session()
    fb = await feedback.get_feedback(with_turns(s, n=1))
    assert fb["turnsPracticed"] == 1 and "longer practice gives richer feedback" in fb["summary"]
    assert fb["summary"].startswith(GOOD["summary"])


async def test_no_turns_skips_model_and_uses_fixed_feedback(monkeypatch):
    calls = patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session()
    fb = await feedback.get_feedback(s)
    assert calls == [] and fb["turnsPracticed"] == 0
    assert "longer practice gives richer feedback" in fb["summary"]
    assert [x["name"] for x in fb["skills"]] == list(SKILL_NAMES)


async def test_clears_turns_and_returns_cached_on_repeat(monkeypatch):
    calls = patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session()
    with_turns(s)
    s.practice.emotions += ["Calm"]
    first = await feedback.get_feedback(s)
    assert s.practice.turns == [] and s.practice.emotions == []
    assert await feedback.get_feedback(s) == first
    assert len(calls) == 1


async def test_tone_line_only_with_tone_feedback(monkeypatch):
    patch_llm(monkeypatch, [json.dumps(GOOD)])
    _, s = make_session(age=45)
    with_turns(s).practice.emotions += ["Anxious", "Anxious", "Calm"]
    fb = await feedback.get_feedback(s)
    assert fb["tone"] == "Your tone mostly sounded a little tense — slowing down can help."
    assert "Anxious" not in fb["tone"]

    _, kid = make_session(age=14)
    with_turns(kid).practice.emotions += ["Calm"]
    assert "tone" not in await feedback.get_feedback(kid)

    _, nov = make_session(age=45, permissions=perms(True, False))
    with_turns(nov).practice.emotions += ["Calm"]
    assert "tone" not in await feedback.get_feedback(nov)


def test_tone_mapping():
    assert tone_line(["Neutral", "Calm", "Happy"]) == "Your tone mostly sounded steady and calm."
    assert "softening your opening" in tone_line(["Angry", "Frustrated", "Calm"])
    assert tone_line(["Surprised"]) is None
    assert tone_line([]) is None
