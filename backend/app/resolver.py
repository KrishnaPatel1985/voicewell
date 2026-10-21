"""resolve_config: pure function from a Session to the SessionConfig the frontend renders."""
from __future__ import annotations

from typing import Any

from .config import get_persona
from .topics import get_topic, persona_from_rules, topic_title

DEPTHS = ["simple", "standard", "deep"]
PACES = ["self", "guided", "slow"]  # fastest to slowest

# band -> (depth, cardsPerLesson, cardsPerScreen, pace, starters default, textSize)
PRESETS: dict[str, tuple[str, int, int, str, bool, str]] = {
    "under-15": ("simple", 5, 1, "guided", True, "normal"),
    "15-24": ("standard", 6, 1, "guided", True, "normal"),
    "25-64": ("deep", 7, 2, "self", False, "normal"),
    "65-plus": ("standard", 4, 1, "slow", False, "large"),
}

HELP_LABELS = {
    "kids": "Help me understand",
    "teens": "Explain this",
    "adults": "Pause & Coach",
    "unsupported": "Help me understand",
}


def age_band(age: int) -> str:
    if age < 15:
        return "under-15"
    if age < 25:
        return "15-24"
    if age < 65:
        return "25-64"
    return "65-plus"


def age_group(age: int) -> str:
    """Teaching preset from age (not a legal category): kids (6-12), teens (13-17), adults (18+); <6 unsupported."""
    if age < 6:
        return "unsupported"
    if age <= 12:
        return "kids"
    if age <= 17:
        return "teens"
    return "adults"


def _perm_state(session, name: str) -> tuple[bool, str | None]:
    """(enabled, reason-if-off). Deny by default: a missing permission or failed re-read is off."""
    if session.status != "pass":
        return False, "consent-pending"
    perms = session.permissions if session.perms_ok else {}
    p = perms.get(name)
    if p and p.get("enabled") is True:
        return True, None
    if p and p.get("managedBy") == "GUARDIAN":
        return False, "needs-grown-up"
    if p and p.get("managedBy") == "PLAYER":
        return False, "off-in-settings"
    return False, "not-permitted"


def capabilities(session) -> dict[str, dict[str, Any]]:
    lessons_on = session.status in ("pass", "pending")
    chat_on, chat_reason = _perm_state(session, "ai-chat")
    voice_perm_on, voice_reason = _perm_state(session, "ai-voice-mode")
    voice_on = chat_on and voice_perm_on
    voice_off_reason = chat_reason if not chat_on else voice_reason
    adult = session.age >= 18

    def cap(on: bool, reason: str | None) -> dict[str, Any]:
        return {"on": True} if on else {"on": False, "reason": reason}

    if voice_on and adult:
        tone = cap(True, None)
    elif not voice_on:
        tone = cap(False, voice_off_reason)
    else:
        tone = cap(False, "under-18")
    return {
        "lessons": cap(lessons_on, "not-permitted"),
        "textPractice": cap(chat_on, chat_reason),
        "voicePractice": cap(voice_on, voice_off_reason),
        "toneFeedback": tone,
    }


def persona_id_for(session) -> str | None:
    """The topic's persona_rules decide; a topic without rules keeps the v1 stress mapping."""
    if session.intent not in ("myself", "someone-else"):
        return None
    if session.intent == "someone-else" and getattr(session, "support_target", None) in ("partner", "friend"):
        return "trusted-adult"
    pid = persona_from_rules(get_topic(session.topic), session.intent, session.age)
    if pid:
        return pid
    if session.intent == "myself":
        return "doctor" if session.age >= 65 else "trusted-adult"
    return "guarded-teen"


def resolve_config(session, personas: dict[str, dict] | None = None) -> dict[str, Any]:
    band = age_band(session.age)
    group = age_group(session.age)
    depth, per_lesson, per_screen, pace, starters_default, text_size = PRESETS[band]
    prefs = session.preferences or {}
    if prefs.get("slowerPace") and pace != "slow":
        pace = PACES[PACES.index(pace) + 1]
    if prefs.get("largeText"):
        text_size = "large"
    starters = prefs.get("starters")
    if not isinstance(starters, bool):
        starters = starters_default

    pid = persona_id_for(session)
    persona = None
    if pid:
        raw = personas.get(pid) if personas is not None else get_persona(pid)
        persona = {
            "id": pid,
            "name": (raw or {}).get("name", pid),
            "description": (raw or {}).get("description", ""),
        }

    jur = getattr(session, "jurisdiction", None)
    country = getattr(session, "country", None) or (jur[:2] if isinstance(jur, str) and len(jur) >= 2 else "US")
    lang = getattr(session, "language", None) or "en"

    return {
        "status": session.status,
        "age": session.age,
        "ageGroup": group,
        "helpLabel": HELP_LABELS[group],
        "country": country,
        "jurisdiction": jur or country,
        "language": lang,
        "mode": getattr(session, "mode", "practice") or "practice",
        "supportTarget": getattr(session, "support_target", None),
        "supportAge": getattr(session, "support_age", None),
        "customGoal": getattr(session, "custom_goal", None),
        "rawPermissions": dict(session.permissions) if session.perms_ok else {},
        "capabilities": capabilities(session),
        "learner": {
            "ageBand": band,
            "ageGroup": group,
            "adult": session.age >= 18,
            "depth": depth,
            "cardsPerLesson": per_lesson,
            "cardsPerScreen": per_screen,
            "pace": pace,
        },
        "preferences": {
            "captions": bool(prefs.get("captions", True)),
            "slowerPace": bool(prefs.get("slowerPace", False)),
            "moreVisuals": bool(prefs.get("moreVisuals", False)),
            "largeText": bool(prefs.get("largeText", False)),
            "starters": starters,
        },
        "intent": session.intent,
        "topic": session.topic,
        "topicTitle": topic_title(session.topic),
        "persona": persona,
        "textSize": text_size,
    }
