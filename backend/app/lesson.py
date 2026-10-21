"""Adaptive lesson engine. The concepts come from the session's topic file."""
from __future__ import annotations

import time

from .errors import ApiError
from .resolver import DEPTHS, resolve_config
from .store import LessonState
from .topics import get_topic

DEDUPE_SECONDS = 1.0  # a repeat call this soon (React StrictMode, double click) re-serves the same screen


def _concepts(session) -> list[dict]:
    if not session.topic:
        raise ApiError(400, "onboarding_needed", "Choose a topic first.")
    data = get_topic(session.topic)
    if data is None:
        raise ApiError(503, "content_unavailable", "Lesson content is not available yet.")
    concepts = data.get("concepts")
    if not isinstance(concepts, list) or not concepts:
        raise ApiError(503, "content_unavailable", "Lesson content is not available yet.")
    return concepts


def _find(session, concept_id: str) -> dict | None:
    for c in _concepts(session):
        if c.get("id") == concept_id:
            return c
    return None


def _init(session) -> None:
    st = session.lesson_state
    if st.initialised:
        return
    cfg = resolve_config(session)
    learner = cfg["learner"]
    concepts = _concepts(session)
    n = learner["cardsPerLesson"]
    if n < 7:
        core = [c for c in concepts if c.get("core")]
        rest = [c for c in concepts if not c.get("core")]
        chosen = (core + rest)[:n]
    else:
        chosen = concepts[:n]
    st.concept_ids = [c["id"] for c in chosen]
    st.depth = learner["depth"]
    st.right_streak = 0
    st.screen_start = None
    st.initialised = True


def reset(session) -> None:
    session.lesson_state = LessonState()


def _variant(concept: dict, depth: str) -> dict:
    variants = concept.get("variants", {})
    if depth in variants:
        return variants[depth]
    # fall back to the nearest available depth
    idx = DEPTHS.index(depth)
    for d in sorted(DEPTHS, key=lambda x: abs(DEPTHS.index(x) - idx)):
        if d in variants:
            return variants[d]
    return {"title": concept.get("id", ""), "body": ""}


def _render_card(session, concept: dict, depth: str) -> dict:
    v = _variant(concept, depth)
    body = v.get("body", "")
    if session.intent == "someone-else" and v.get("body_someone_else"):
        body = v["body_someone_else"]
    card = {"conceptId": concept["id"], "depth": depth, "title": v.get("title", ""), "body": body}
    chk = concept.get("check")
    if chk:
        card["check"] = {"question": chk.get("question", ""), "options": list(chk.get("options", []))}
    return card


def _screen(session, start: int, depth: str) -> dict:
    st = session.lesson_state
    per_screen = resolve_config(session)["learner"]["cardsPerScreen"]
    total = len(st.concept_ids)
    if start >= total:
        return {"cards": [], "index": total, "total": total, "done": True}
    cards = []
    for cid in st.concept_ids[start : start + per_screen]:
        concept = _find(session, cid)
        if concept:
            cards.append(_render_card(session, concept, depth))
    return {"cards": cards, "index": start, "total": total, "done": False}


def ensure_topic(session, topic: str) -> None:
    """The URL names a topic; it has to be the one the session is on."""
    if session.topic != topic:
        raise ApiError(409, "topic_mismatch", "That lesson doesn't match the topic you chose.")


def next_step(session) -> dict:
    _init(session)
    st = session.lesson_state
    now = time.time()
    per_screen = resolve_config(session)["learner"]["cardsPerScreen"]
    if st.screen_start is None:
        st.screen_start = 0
    elif now - st.served_at >= DEDUPE_SECONDS:
        st.screen_start += per_screen
    st.served_at = now
    return _screen(session, st.screen_start, st.depth)


def simpler(session) -> dict:
    _init(session)
    st = session.lesson_state
    if st.screen_start is None:
        st.screen_start = 0
    st.served_at = time.time()
    st.depth = DEPTHS[max(0, DEPTHS.index(st.depth) - 1)]
    st.right_streak = 0
    return _screen(session, st.screen_start, st.depth)


def check(session, concept_id: str, answer_index: int) -> dict:
    _init(session)
    st = session.lesson_state
    concept = _find(session, concept_id)
    chk = concept.get("check") if concept else None
    if not chk:
        raise ApiError(400, "unknown_concept", "That question doesn't exist.")
    correct = answer_index == chk.get("answer")
    if correct:
        st.right_streak += 1
        if st.right_streak >= 2:
            st.depth = DEPTHS[min(len(DEPTHS) - 1, DEPTHS.index(st.depth) + 1)]
            st.right_streak = 0
    else:
        st.depth = DEPTHS[max(0, DEPTHS.index(st.depth) - 1)]
        st.right_streak = 0
    return {"correct": correct, "explanation": chk.get("explain", ""), "nextDepth": st.depth}
