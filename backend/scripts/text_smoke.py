"""Live smoke test of typed practice + v2 feedback against the real Inworld Router (FEEDBACK_MODEL).
Usage: uv run python scripts/text_smoke.py [topic] [intent]     (default: appointment myself)
Creates an in-memory session directly (bypassing k-ID and login) with ai-chat enabled. Uses
backend/app/content if the files are there, otherwise the test fixtures. Runs 3 typed turns that this
script writes itself, then prints the feedback JSON shape, the summary and the skills."""
import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import feedback, practice_text, topics  # noqa: E402
from app.config import settings  # noqa: E402
from app.store import store  # noqa: E402

USER_TURNS = [
    "Hi, thank you for seeing me. I have been getting tired in the afternoons and I want to explain it properly.",
    "It started about three weeks ago and it happens most days. Resting a little helps, but it is hard to focus at work.",
    "Could you explain that in simpler words? And what should I ask before I leave today?",
]


def shape(value):
    """Type skeleton of the feedback JSON: lists show their length, strings show nothing of their text."""
    if isinstance(value, dict):
        return {k: shape(v) for k, v in value.items()}
    if isinstance(value, list):
        return [shape(value[0])] * 1 + [f"... {len(value)} items"] if value else []
    return type(value).__name__


async def main(topic: str, intent: str) -> int:
    needed = ["personas", "safety", topic]
    if not all((settings.content_dir / f"{n}.json").exists() for n in needed):
        settings.content_dir = ROOT / "tests" / "fixtures"
        topic = topic if (settings.content_dir / f"{topic}.json").exists() else "stress"
        print("content: using test fixtures")
    else:
        print("content: using backend/app/content")
    print(
        "models: feedback =", settings.feedback_model or "(unset -> llm model)", "| llm =", settings.llm_model,
        "| standard key set:", bool(settings.inworld_standard_key),
    )

    _, s = store.create()
    s.age, s.status, s.intent, s.topic = 45, "pass", intent, topic
    s.permissions = {"ai-chat": {"enabled": True, "managedBy": "PLAYER"}}
    s.perms_fetched_at = time.time()
    persona = practice_text.persona_for(s)
    print(f"topic: {topic} | intent: {intent} | persona: {persona['id']} ({persona.get('name')})")
    print("scenario prompt has Scenario/Style:", "Scenario:" in practice_text.session_prompt(s, persona),
          "/", "Style:" in practice_text.session_prompt(s, persona))

    ok = True
    for i, text in enumerate(USER_TURNS, 1):
        t0 = time.perf_counter()
        r = await practice_text.handle_turn(s, text)
        dt = time.perf_counter() - t0
        info = {k: (len(v) if isinstance(v, str) else v) for k, v in r.items() if k != "safety"}
        print(f"turn {i}: {dt:.2f}s reply_len/shape={info} safety={'safety' in r}")
        ok &= bool(r["reply"]) and r["turn"] == i and "safety" not in r

    t0 = time.perf_counter()
    fb = await feedback.get_feedback(s)
    print(f"feedback: {time.perf_counter() - t0:.2f}s")
    print("shape:", json.dumps(shape(fb), ensure_ascii=False))
    print("summary:", fb["summary"])
    for sk in fb["skills"]:
        print(f"  skill {sk['name']}: {sk['level']} - {sk['note']}")
    print("  skills in order:", [x["name"] for x in fb["skills"]] == list(feedback.SKILL_NAMES))
    for k in ("strengths", "improvements"):
        quotes = sum(1 for it in fb[k] if "quote" in it)
        print(f"  {k}: {len(fb[k])} items, {quotes} with a quote")
        ok &= 1 <= len(fb[k]) <= 3
    for k in ("missingQuestions", "suggestedPhrases"):
        print(f"  {k}: {len(fb[k])} items")
        ok &= 1 <= len(fb[k]) <= 3
    swaps = sum(1 for it in fb["suggestedPhrases"] if "instead" in it)
    fixed = feedback.clean(
        {}, [], feedback.load_content("safety").get("fallback_feedback", {})
    )
    print(f"  suggestedPhrases with 'instead': {swaps} | turnsPracticed: {fb['turnsPracticed']}")
    print("  tone present:", "tone" in fb, "| turns cleared:", s.practice.turns == [])
    print("  is the fixed fallback:", fb["summary"] == fixed["summary"])
    ok &= fb["turnsPracticed"] == len(USER_TURNS) and "score" not in json.dumps(fb).lower()
    print("topics found:", [t["id"] for t in topics.list_topics()])
    print("RESULT:", "OK" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(asyncio.run(main(args[0] if args else "appointment", args[1] if len(args) > 1 else "myself")))
