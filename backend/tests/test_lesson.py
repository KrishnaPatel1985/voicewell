from app import lesson

from .conftest import make_session


def test_core_first_when_short_lesson():
    _, s = make_session(age=14)  # 5 cards
    lesson.next_step(s)
    assert s.lesson_state.concept_ids == ["c1", "c2", "c3", "c4", "c5"]
    _, s = make_session(age=65)  # 4 cards: the core ones
    lesson.next_step(s)
    assert s.lesson_state.concept_ids == ["c1", "c2", "c3", "c4"]


def test_walks_through_and_finishes():
    _, s = make_session(age=65)
    seen = []
    for _ in range(10):
        step = lesson.next_step(s)
        if step["done"]:
            break
        seen += [c["conceptId"] for c in step["cards"]]
        assert step["total"] == 4
    assert seen == ["c1", "c2", "c3", "c4"] and step["done"] and step["cards"] == []


def test_two_cards_per_screen_for_adults_and_check_hides_answer():
    _, s = make_session(age=45)
    step = lesson.next_step(s)
    assert [c["conceptId"] for c in step["cards"]] == ["c1", "c2"]
    assert step["cards"][0]["depth"] == "deep"
    assert "answer" not in step["cards"][0]["check"] and "explain" not in step["cards"][0]["check"]
    assert step["index"] == 0 and step["total"] == 7


def test_repeat_call_within_dedupe_window_reserves_same_screen(monkeypatch):
    monkeypatch.setattr(lesson, "DEDUPE_SECONDS", 5)
    _, s = make_session(age=65)
    a, b = lesson.next_step(s), lesson.next_step(s)
    assert a["index"] == b["index"] == 0


def test_someone_else_text():
    _, s = make_session(age=45, intent="someone-else")
    assert "helper body" in lesson.next_step(s)["cards"][0]["body"]
    _, s = make_session(age=45, intent="myself")
    assert "helper" not in lesson.next_step(s)["cards"][0]["body"]


def test_wrong_answer_goes_simpler():
    _, s = make_session(age=45)  # starts deep
    lesson.next_step(s)
    r = lesson.check(s, "c1", 0)
    assert r["correct"] is False and r["nextDepth"] == "standard"
    assert r["explanation"] == "Because b 1."
    assert lesson.check(s, "c2", 2)["nextDepth"] == "simple"
    assert lesson.check(s, "c2", 2)["nextDepth"] == "simple"  # floor


def test_two_right_goes_deeper_and_resets_streak():
    _, s = make_session(age=14)  # starts simple
    lesson.next_step(s)
    assert lesson.check(s, "c1", 1) == {"correct": True, "explanation": "Because b 1.", "nextDepth": "simple"}
    assert lesson.check(s, "c2", 1)["nextDepth"] == "standard"
    assert lesson.check(s, "c3", 1)["nextDepth"] == "standard"
    assert lesson.check(s, "c4", 1)["nextDepth"] == "deep"
    lesson.check(s, "c1", 1)
    assert lesson.check(s, "c2", 1)["nextDepth"] == "deep"  # ceiling


def test_wrong_resets_streak():
    _, s = make_session(age=14)
    lesson.next_step(s)
    lesson.check(s, "c1", 1)
    lesson.check(s, "c2", 0)
    assert s.lesson_state.right_streak == 0


def test_new_depth_applies_to_next_screen_and_simpler_rerenders():
    _, s = make_session(age=14)
    lesson.next_step(s)
    lesson.check(s, "c1", 1)
    lesson.check(s, "c1", 1)  # standard now
    step = lesson.next_step(s)
    assert step["index"] == 1 and step["cards"][0]["depth"] == "standard"
    simpler = lesson.simpler(s)
    assert simpler["index"] == 1 and simpler["cards"][0]["depth"] == "simple"
    assert s.lesson_state.depth == "simple"
