"""Topic files: every backend/app/content/*.json that has a `concepts` list is a topic. Loaded lazily."""
from __future__ import annotations

import logging
import re
from pathlib import Path

from .config import settings, try_load_content

log = logging.getLogger("voicewell.topics")

INTENTS = ["myself", "someone-else"]
DEFAULT_ICON = "book"
ID_RE = re.compile(r"[A-Za-z0-9_-]{1,64}")
ICONS = {"calendar", "heart", "book", "spark"}


def _is_topic(data: object) -> bool:
    return isinstance(data, dict) and isinstance(data.get("concepts"), list)


def _order(data: dict) -> float:
    o = data.get("order")
    return o if isinstance(o, (int, float)) and not isinstance(o, bool) else 999


def all_topics() -> dict[str, dict]:
    """id (file stem) -> topic data, sorted by `order`. Files that do not parse are skipped and logged by name."""
    found: dict[str, dict] = {}
    for path in sorted(Path(settings.content_dir).glob("*.json")):
        data = try_load_content(path.stem)
        if data is None:
            log.warning("skipping content file that could not be read: %s", path.name)
        elif _is_topic(data):
            found[path.stem] = data
    return dict(sorted(found.items(), key=lambda kv: (_order(kv[1]), kv[0])))


def get_topic(topic_id: str | None) -> dict | None:
    """One topic by id, or None. Does not scan the folder."""
    if not isinstance(topic_id, str) or not ID_RE.fullmatch(topic_id):
        return None  # also keeps path characters out of the content file name
    data = try_load_content(topic_id)
    return data if _is_topic(data) else None


def topic_title(topic_id: str | None) -> str | None:
    data = get_topic(topic_id)
    if not data:
        return None
    title = data.get("title")
    return title if isinstance(title, str) and title else topic_id


def list_topics() -> list[dict]:
    """The `GET /api/topics` payload rows."""
    rows = []
    for tid, data in all_topics().items():
        icon = data.get("icon")
        rows.append({
            "id": tid,
            "title": data.get("title") if isinstance(data.get("title"), str) else tid,
            "summary": data.get("summary") if isinstance(data.get("summary"), str) else "",
            "icon": icon if icon in ICONS else DEFAULT_ICON,
            "intents": list(INTENTS),
        })
    return rows


def practice_goal(topic: dict | None, intent: str | None) -> str:
    goal = ((topic or {}).get("practice_goal") or {}).get(intent or "")
    return goal.strip() if isinstance(goal, str) else ""


def key_questions(topic: dict | None, intent: str | None) -> list[str]:
    qs = ((topic or {}).get("key_questions") or {}).get(intent or "")
    return [q for q in qs if isinstance(q, str) and q.strip()] if isinstance(qs, list) else []


def persona_from_rules(topic: dict | None, intent: str | None, age: int) -> str | None:
    """First rule whose optional minAge/maxAge (inclusive) match wins. None if the topic has no rules for this intent."""
    rules = ((topic or {}).get("persona_rules") or {}).get(intent or "")
    if not isinstance(rules, list):
        return None
    for rule in rules:
        if not isinstance(rule, dict) or not isinstance(rule.get("persona"), str):
            continue
        lo, hi = rule.get("minAge"), rule.get("maxAge")
        if isinstance(lo, (int, float)) and age < lo:
            continue
        if isinstance(hi, (int, float)) and age > hi:
            continue
        return rule["persona"]
    return None
