"""Typed practice, Talk-it-through guidance, and Pause & Coach helpers."""
from __future__ import annotations

import asyncio
import re

from . import llm, safety
from .config import get_persona
from .errors import ApiError
from .resolver import age_band, age_group, persona_id_for
from .topics import get_topic, practice_goal

MAX_PERSONA_TURNS = 8
MAX_TEXT_CHARS = 1000

CONFUSION_PATTERNS = [
    r"\bi['’]?m confused\b",
    r"\bim confused\b",
    r"\bwhat does that mean\b",
    r"\bi don['’]?t know what to say\b",
    r"\bi dont know what to say\b",
    r"\bno s[eé] qu[eé] decir\b",
    r"\bestoy confundid[oa]\b",
    r"\bqu[eé] significa eso\b",
    r"我不知道该说什么",
    r"我不明白",
    r"那是什么意思",
    r"我很困惑",
]

COACH_PROMPTS = {
    "en": "Would you like to pause and have me talk you through it?",
    "es": "¿Te gustaría hacer una pausa para que te lo explique paso a paso?",
    "zh-CN": "你想暂停一下，让我慢慢帮你理一理吗？",
}

LANG_INSTRUCTIONS = {
    "es": "Respond entirely in Spanish (Español). Keep the same warm, plain, non-diagnostic tone.",
    "zh-CN": "Respond entirely in Simplified Chinese (简体中文). Keep the same warm, plain, non-diagnostic tone.",
}

COACH_FALLBACKS = {
    "en": {
        "kids": {
            "explanation": "It is okay to get stuck! In this moment, you only need to share one feeling and one thing that would help.",
            "examplePhrase": "I feel worried because things feel busy, and I need a little quiet time.",
        },
        "teens": {
            "explanation": "When a conversation feels awkward, you do not have to explain everything at once. Start by naming that it is hard to bring up.",
            "examplePhrase": "There is something on my mind, and I just want you to listen for a minute before giving advice.",
        },
        "adults": {
            "explanation": "Let's pause the role-play. A clear way through this moment is to lead with the main change you noticed, then ask one open question.",
            "examplePhrase": "The main thing I've noticed lately is how much this affects my daily energy. What options should we look at first?",
        },
    },
    "es": {
        "kids": {
            "explanation": "¡Está bien no saber qué decir! Solo necesitas compartir cómo te sientes y una cosa que te ayudaría.",
            "examplePhrase": "Me siento preocupado porque hay muchas cosas pasando, y necesito que me escuches un momento.",
        },
        "teens": {
            "explanation": "No tienes que explicarlo todo de golpe. Puedes empezar diciendo que te cuesta hablar del tema.",
            "examplePhrase": "Tengo algo en mente y me ayudaría mucho que solo me escuches unos minutos sin juzgar.",
        },
        "adults": {
            "explanation": "Hagamos una pausa. Una forma clara de avanzar es mencionar el cambio principal que has notado y terminar con una pregunta concreta.",
            "examplePhrase": "El cambio principal que he notado es cómo esto afecta mi rutina diaria. ¿Qué paso me recomienda dar primero?",
        },
    },
    "zh-CN": {
        "kids": {
            "explanation": "卡住了也没关系！现在你只需要说出一种感受，以及一件能帮到你的小事。",
            "examplePhrase": "我感到有点担心，因为最近事情太多了，我需要大人安静地听我说说话。",
        },
        "teens": {
            "explanation": "感到难以开口时，不需要一次把所有事都说清楚。可以先告诉对方你需要被倾听。",
            "examplePhrase": "我心里有些事想跟你说，你能不能先听我说完，暂时不要急着给建议？",
        },
        "adults": {
            "explanation": "我们先暂停练习。此时最清晰的表达方式是先说出你注意到的主要变化，再提出一个具体问题。",
            "examplePhrase": "我最近注意到的主要变化是这件事影响到了我的日常精力。您建议我们先从哪里开始？",
        },
    },
}


def detect_confusion(text: str) -> bool:
    for pat in CONFUSION_PATTERNS:
        if re.search(pat, text, re.IGNORECASE):
            return True
    return False


def coach_offer_prompt(lang: str) -> str:
    return COACH_PROMPTS.get(lang, COACH_PROMPTS["en"])


def persona_for(session) -> dict:
    pid = persona_id_for(session)
    if pid is None:
        raise ApiError(400, "onboarding_needed", "Choose who you're practising with first.")
    persona = get_persona(pid)
    if persona is None:
        raise ApiError(503, "content_unavailable", "Practice content is not available yet.")
    return persona


def system_prompt(persona: dict, age: int, scenario: str = "") -> str:
    """Persona prompt + "Scenario: <topic practice_goal>" + "Style: <band style>". Our text only, never user text."""
    parts = [persona.get("system_prompt", "")]
    if scenario:
        parts.append(f"Scenario: {scenario}")
    style = (persona.get("band_style") or {}).get(age_band(age), "")
    if style:
        parts.append(f"Style: {style}")
    return "\n\n".join(p for p in parts if p).strip()


def session_prompt(session, persona: dict) -> str:
    """The system prompt for this session's topic, mode, and language (used by typed and voice practice)."""
    scenario = practice_goal(get_topic(session.topic), session.intent)
    base = system_prompt(persona, session.age, scenario)
    extra = []
    if getattr(session, "mode", "practice") == "talk":
        extra.append(
            "Mode: Talk it through. Instead of role-playing the other person, act as a warm Voicewell communication "
            "guide. Help the learner understand their feelings, organize what they want to say, and suggest one clear "
            "phrase they could try when they are ready to practise."
        )
    lang = getattr(session, "language", "en") or "en"
    if lang in LANG_INSTRUCTIONS:
        extra.append(LANG_INSTRUCTIONS[lang])
    if extra:
        return base + "\n\n" + "\n\n".join(extra)
    return base


def _fallback_line(persona: dict, n: int) -> str:
    lines = persona.get("scripted_fallbacks") or [persona.get("redirect_line", "Tell me more.")]
    return lines[n % len(lines)]


def _safety_result(session, turn: int) -> dict:
    session.practice.safety_stopped = True
    return {
        "reply": "",
        "turn": turn,
        "done": True,
        "safety": {"message": safety.support_message(session.jurisdiction)},
    }


def _record(session, user_text: str, reply: str, confused: bool = False) -> dict:
    p = session.practice
    p.turns.append({"role": "user", "content": user_text})
    p.turns.append({"role": "assistant", "content": reply})
    p.persona_turn_count += 1
    out = {
        "reply": reply,
        "turn": p.persona_turn_count,
        "done": p.persona_turn_count >= MAX_PERSONA_TURNS,
    }
    if confused:
        lang = getattr(session, "language", "en") or "en"
        out["coachPrompt"] = coach_offer_prompt(lang)
    return out


async def handle_turn(session, text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ApiError(400, "empty_text", "Please type something first.")
    text = text[:MAX_TEXT_CHARS]
    persona = persona_for(session)
    p = session.practice
    if p.safety_stopped:
        return _safety_result(session, p.persona_turn_count)
    if p.persona_turn_count >= MAX_PERSONA_TURNS:
        return {"reply": "", "turn": p.persona_turn_count, "done": True}
    p.last_feedback = None  # a new practice is under way
    p.paused = False

    confused = detect_confusion(text)
    kw = safety.keyword_check(text)
    if kw == "self_harm":
        return _safety_result(session, p.persona_turn_count)
    if kw == "diagnosis":
        return _record(session, text, persona.get("redirect_line", ""), confused=confused)

    messages = (
        [{"role": "system", "content": session_prompt(session, persona)}]
        + list(p.turns)
        + [{"role": "user", "content": text}]
    )

    async def persona_reply() -> str | None:
        try:
            return await llm.chat(messages, max_tokens=120, temperature=0.7, timeout=8.0)
        except Exception:  # noqa: BLE001 - timeout or router error -> scripted line
            return None

    flags, reply = await asyncio.gather(safety.classify(text), persona_reply())
    if flags["self_harm"]:
        return _safety_result(session, p.persona_turn_count)
    if flags["diagnosis_request"]:
        return _record(session, text, persona.get("redirect_line", ""), confused=confused)
    if not reply:
        reply = _fallback_line(persona, p.persona_turn_count)
    if safety.scan_output(reply):
        reply = persona.get("redirect_line", "")
    return _record(session, text, reply, confused=confused)


async def handle_coach(session, action: str = "explain", fmt: str = "text", question: str = "") -> dict:
    """Pause the role-play and give a short age-appropriate coaching explanation + example phrase with captions.
    Coaching is stored in session.practice.coach_turns and never counts against practice feedback."""
    p = session.practice
    p.paused = True
    grp = age_group(session.age)
    if grp == "unsupported":
        grp = "kids"
    lang = getattr(session, "language", "en") or "en"
    fb_lang = COACH_FALLBACKS.get(lang, COACH_FALLBACKS["en"])
    fallback = fb_lang.get(grp, fb_lang["adults"])

    if action == "retry_moment":
        # Pop the last user + assistant turn pair so the learner can try that moment again without penalty.
        if len(p.turns) >= 2 and p.turns[-1]["role"] == "assistant" and p.turns[-2]["role"] == "user":
            p.turns.pop()
            p.turns.pop()
            p.persona_turn_count = max(0, p.persona_turn_count - 1)
        p.paused = False
        return {
            "paused": False,
            "action": "retry_moment",
            "format": fmt,
            "explanation": fallback["explanation"],
            "examplePhrase": fallback["examplePhrase"],
            "caption": f"{fallback['explanation']} Try: \"{fallback['examplePhrase']}\"",
            "turn": p.persona_turn_count,
        }

    persona = get_persona(persona_id_for(session) or "") or {"name": "Sam"}
    recent = p.turns[-4:] if p.turns else []
    transcript_snippet = "\n".join(
        f"{'Learner' if t['role'] == 'user' else persona.get('name', 'Partner')}: {t['content']}"
        for t in recent
    ) or "The conversation is just starting."

    level_hint = {
        "kids": "Explain for a child aged 6-12 in 1-2 very simple, encouraging sentences, plus 1 short sentence they can say.",
        "teens": "Explain for a teenager aged 13-17 in 2 respectful, practical sentences, plus 1 natural phrase they can say.",
        "adults": "Explain for an adult in 2 concise, practical coaching sentences, plus 1 clear phrase they can say.",
    }[grp]
    more_hint = "Give an even simpler alternative angle and a second phrase option." if action == "more_help" else ""
    lang_hint = LANG_INSTRUCTIONS.get(lang, "Respond in English.")

    sys_msg = (
        "You are Voicewell's Pause & Coach assistant. The role-play with "
        f"{persona.get('name', 'the practice partner')} is paused. "
        f"{level_hint} {more_hint} {lang_hint} "
        "Never diagnose, never name a medical condition or medicine. "
        'Reply in plain text with two lines:\nExplanation: <your explanation>\nTry saying: "<phrase>"'
    )
    user_msg = f"Recent exchange:\n{transcript_snippet}"
    if question.strip():
        user_msg += f"\nLearner's question: {question.strip()[:300]}"

    explanation = fallback["explanation"]
    example_phrase = fallback["examplePhrase"]
    try:
        raw = await llm.chat(
            [{"role": "system", "content": sys_msg}, {"role": "user", "content": user_msg}],
            max_tokens=160,
            temperature=0.5,
            timeout=6.0,
        )
        if raw and not safety.scan_output(raw):
            lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
            for ln in lines:
                if ln.lower().startswith(("explanation:", "explicación:", "解释：", "解释:")):
                    explanation = ln.split(":", 1)[-1].lstrip("：").strip() or explanation
                elif ln.lower().startswith(("try saying:", "intenta decir:", "试试这样说：", "试试这样说:")):
                    example_phrase = ln.split(":", 1)[-1].lstrip("：").strip().strip('"“”') or example_phrase
            if explanation == fallback["explanation"] and lines:
                explanation = lines[0]
    except Exception:  # noqa: BLE001
        pass

    entry = {
        "action": action,
        "format": fmt,
        "explanation": explanation,
        "examplePhrase": example_phrase,
    }
    p.coach_turns.append(entry)
    return {
        "paused": True,
        "action": action,
        "format": fmt,
        "explanation": explanation,
        "examplePhrase": example_phrase,
        "caption": f"{explanation} — \"{example_phrase}\"",
        "turn": p.persona_turn_count,
    }
