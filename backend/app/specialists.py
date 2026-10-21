"""Specialist directory and caregiver education helpers (localized for en, es, zh-CN)."""
from __future__ import annotations

from typing import Any

from . import llm, safety
from .config import get_persona

SPECIALISTS: list[dict[str, Any]] = [
    {
        "id": "sp-maya-lin",
        "name": "Dr. Maya Lin",
        "verified": True,
        "credentials": "PhD · Pediatric & Family Communication Specialist",
        "specialty": "Stress & Emotional Well-Being",
        "supportedAges": ["kids", "teens", "adults"],
        "supportedAgeRange": "6–12, 13–17, 18+",
        "languages": ["English", "简体中文"],
        "formats": ["Video", "In person"],
        "price": 95,
        "accent": "sage",
        "summary": "Helps children, teens, and adults put big feelings into calm, everyday words before important conversations.",
        "about": "Uses collaborative, non-diagnostic coaching to help individuals and families prepare questions, express stress clearly, and agree on practical next steps.",
        "nextAvailable": "Tuesday · 10:00 AM",
        "availableSlots": [
            {"startsAt": "2026-10-27T10:00:00Z", "label": "Tuesday · 10:00 AM"},
            {"startsAt": "2026-10-28T15:30:00Z", "label": "Wednesday · 3:30 PM"},
            {"startsAt": "2026-10-30T11:00:00Z", "label": "Friday · 11:00 AM"},
        ],
    },
    {
        "id": "sp-carlos-rivera",
        "name": "Dr. Carlos Rivera",
        "verified": True,
        "credentials": "LCSW · Adolescent & Family Support Specialist",
        "specialty": "Teen Stress & Parent-Child Listening",
        "supportedAges": ["kids", "teens", "adults"],
        "supportedAgeRange": "6–12, 13–17, 18+ (Parenting)",
        "languages": ["English", "Español"],
        "formats": ["Video", "Phone"],
        "price": 85,
        "accent": "lavender",
        "summary": "Supports teens who feel overwhelmed and parents practising how to listen without lecturing or rushing to fix.",
        "about": "Focuses on building trust between young people and trusted adults so everyone's voice stays in the room.",
        "nextAvailable": "Wednesday · 2:00 PM",
        "availableSlots": [
            {"startsAt": "2026-10-28T14:00:00Z", "label": "Wednesday · 2:00 PM"},
            {"startsAt": "2026-10-29T16:30:00Z", "label": "Thursday · 4:30 PM"},
            {"startsAt": "2026-10-30T09:30:00Z", "label": "Friday · 9:30 AM"},
        ],
    },
    {
        "id": "sp-elena-rostova",
        "name": "Dr. Hannah Okafor",
        "verified": True,
        "credentials": "MD · Primary Care & Appointment Navigation",
        "specialty": "Preparing for a Doctor's Appointment",
        "supportedAges": ["teens", "adults"],
        "supportedAgeRange": "13–17, 18+",
        "languages": ["English", "Español"],
        "formats": ["Video", "In person", "Phone"],
        "price": 115,
        "accent": "sand",
        "summary": "Helps patients and caregivers organize timelines, everyday impact, and clear questions before a clinic visit.",
        "about": "Specializes in helping adults and older relatives feel unhurried and heard during short medical appointments.",
        "nextAvailable": "Tuesday · 1:30 PM",
        "availableSlots": [
            {"startsAt": "2026-10-27T13:30:00Z", "label": "Tuesday · 1:30 PM"},
            {"startsAt": "2026-10-29T10:00:00Z", "label": "Thursday · 10:00 AM"},
            {"startsAt": "2026-10-30T14:00:00Z", "label": "Friday · 2:00 PM"},
        ],
    },
    {
        "id": "sp-mei-chen",
        "name": "Mei-Ling Chen, MEd",
        "verified": True,
        "credentials": "MEd · Child Emotional Literacy Educator",
        "specialty": "Child Feelings & Asking for Help",
        "supportedAges": ["kids", "adults"],
        "supportedAgeRange": "6–12 & Caregivers",
        "languages": ["English", "简体中文", "Español"],
        "formats": ["Video", "In person"],
        "price": 75,
        "accent": "sage",
        "summary": "Playful, visual support helping children aged 6–12 name feelings and tell a trusted grown-up what they need.",
        "about": "Works with children and caregivers using visual stories and simple sentence builders.",
        "nextAvailable": "Wednesday · 11:00 AM",
        "availableSlots": [
            {"startsAt": "2026-10-28T11:00:00Z", "label": "Wednesday · 11:00 AM"},
            {"startsAt": "2026-10-30T13:00:00Z", "label": "Friday · 1:00 PM"},
        ],
    },
    {
        "id": "sp-claire-bennett",
        "name": "Dr. Claire Bennett",
        "verified": True,
        "credentials": "RN, MSc · Midlife & Menopause Communication Specialist",
        "specialty": "Understanding Menopause & Family Support",
        "supportedAges": ["adults"],
        "supportedAgeRange": "18+",
        "languages": ["English"],
        "formats": ["Video", "Phone"],
        "price": 105,
        "accent": "lavender",
        "summary": "Helps adults prepare for menopause appointments or practise supportive conversations with a partner or parent.",
        "about": "Offers practical, warm preparation for talking through sleep, mood, and daily energy changes with clinicians and family.",
        "nextAvailable": "Friday · 10:30 AM",
        "availableSlots": [
            {"startsAt": "2026-10-30T10:30:00Z", "label": "Friday · 10:30 AM"},
            {"startsAt": "2026-11-02T14:00:00Z", "label": "Monday · 2:00 PM"},
        ],
    },
]


CAREGIVER_LESSONS: dict[str, dict[str, Any]] = {
    "en": {
        "lessonTitle": "How to listen so they feel safe talking",
        "lessonSummary": "When a young person shares a card with you, they are taking a brave first step. You do not need to solve everything in the first five minutes.",
        "steps": [
            "Thank them for telling you before asking lots of questions.",
            "Repeat back what you heard in calm, simple words so they know you understood.",
            "Ask what kind of help they want right now: just listening, quiet time, or brainstorming together.",
        ],
        "phrasesToTry": [
            "Thank you for sharing this with me. I'm really glad you told me.",
            "I'm here to listen first — we don't have to fix everything right this second.",
            "Would it help more if I just listened right now, or if we thought of one small step together?",
        ],
        "phrasesToAvoid": [
            "You shouldn't feel stressed about that — it's not a big deal.",
            "Why didn't you tell me sooner? Here is what you need to do right now.",
            "Other kids handle this fine, you just need to try harder.",
        ],
        "supportActions": [
            "Check in for 10 quiet minutes this evening just to listen, with no advice.",
            "Give them a calm break after school/activities before asking about homework.",
            "Ask together if they would like to talk with a school counselor, doctor, or specialist.",
        ],
    },
    "es": {
        "lessonTitle": "Cómo escuchar para que se sientan seguros al hablar",
        "lessonSummary": "Cuando un niño o adolescente comparte esta tarjeta contigo, está dando un paso valiente. No necesitas resolverlo todo en los primeros cinco minutos.",
        "steps": [
            "Agradécele por contártelo antes de hacer muchas preguntas.",
            "Repite con calma lo que entendiste para demostrar que lo escuchaste.",
            "Pregunta qué tipo de apoyo prefiere ahora: solo escuchar, un momento tranquilo o pensar juntos.",
        ],
        "phrasesToTry": [
            "Gracias por compartir esto conmigo. Me alegra mucho que me lo hayas contado.",
            "Estoy aquí para escucharte primero; no tenemos que resolverlo todo ahora mismo.",
            "¿Qué te ayudaría más ahora: que solo te escuche o que pensemos en un pequeño paso juntos?",
        ],
        "phrasesToAvoid": [
            "No deberías estresarte por eso, no es para tanto.",
            "¿Por qué no me lo dijiste antes? Esto es lo que tienes que hacer ya.",
            "A otros chicos no les cuesta tanto, solo tienes que esforzarte más.",
        ],
        "supportActions": [
            "Dedicar 10 minutos tranquilos hoy para escuchar sin dar sermones ni consejos.",
            "Dar un descanso tranquilo después de clases antes de hablar de tareas o deberes.",
            "Preguntar juntos si le gustaría hablar con un orientador, médico o especialista.",
        ],
    },
    "zh-CN": {
        "lessonTitle": "如何倾听，让孩子感到安全并愿意敞开心扉",
        "lessonSummary": "当孩子或青少年向您分享这张卡片时，他们迈出了勇敢的第一步。您不需要在最初的五分钟内解决所有问题。",
        "steps": [
            "在追问细节之前，先感谢他们愿意告诉您。",
            "用温和、简单的语言复述您听到的感受，让他们知道自己被理解了。",
            "询问他们现在需要什么样的支持：只是安静倾听、休息一下，还是一起想个小办法。",
        ],
        "phrasesToTry": [
            "谢谢你愿意把这些告诉我，我很高兴你没有一个人扛着。",
            "我先听你说，我们不需要马上把所有事情都解决掉。",
            "现在是让我安静听你说比较有帮助，还是我们一起想一个小步骤？",
        ],
        "phrasesToAvoid": [
            "这点小事有什么好紧张的，别想太多了。",
            "你为什么不早点告诉我？你现在必须马上照我说的做。",
            "别的孩子都能应付，你只要再努力一点就行了。",
        ],
        "supportActions": [
            "今晚留出10分钟安静倾听的时间，不讲大道理、不急着给建议。",
            "放学回家后先给他们一段放松休息的时间，再谈作业或任务。",
            "温和地询问他们是否愿意一起找学校老师、医生或专业顾问聊聊。",
        ],
    },
}


def list_specialists() -> list[dict[str, Any]]:
    return list(SPECIALISTS)


def get_caregiver_lesson(lang: str = "en") -> dict[str, Any]:
    return CAREGIVER_LESSONS.get(lang, CAREGIVER_LESSONS["en"])


async def caregiver_practice_turn(text: str, what_to_understand: str, what_support_helps: str, lang: str = "en") -> dict[str, str]:
    """Isolated 1-on-1 practice for a caregiver opening an invitation link.
    Never stored on the child's session or shared with the child."""
    persona = get_persona("guarded-teen") or {}
    lang_line = {
        "es": "Respond in Spanish (Español).",
        "zh-CN": "Respond in Simplified Chinese (简体中文).",
    }.get(lang, "Respond in English.")
    sys_prompt = (
        f"{persona.get('system_prompt', '')}\n\n"
        f"Context from the child's shared card: They want the caregiver to understand: '{what_to_understand}'. "
        f"The support that helps them is: '{what_support_helps}'. "
        f"Respond naturally as a hesitant young person who warms up when the caregiver listens without lecturing. "
        f"Also provide a 1-sentence coaching tip for the caregiver.\n{lang_line}\n"
        "Format your reply as two lines:\nChild: <in-role reply>\nCoach tip: <1 short tip on their response>"
    )
    fallback_reply = "Thanks for reading my card... I was a little nervous to send it, so I'm glad you're not mad."
    fallback_tip = "Naming that you read their card and are glad they shared it helps lower their guard."
    if lang == "es":
        fallback_reply = "Gracias por leer mi tarjeta... Estaba un poco nervioso al enviarla, me alegra que me escuches."
        fallback_tip = "Agradecer que hayan compartido la tarjeta sin juzgar ayuda a que se sientan seguros."
    elif lang == "zh-CN":
        fallback_reply = "谢谢你看了我的卡片……发给你的时候我有点紧张，很高兴你愿意听我说。"
        fallback_tip = "温和地回应他们的卡片、不急于评判，能帮助孩子放下防备。"

    if safety.keyword_check(text):
        return {"reply": persona.get("redirect_line", fallback_reply), "coachTip": fallback_tip}

    try:
        raw = await llm.chat(
            [{"role": "system", "content": sys_prompt}, {"role": "user", "content": text[:600]}],
            max_tokens=160,
            temperature=0.6,
            timeout=7.0,
        )
        if raw and not safety.scan_output(raw):
            reply_line = fallback_reply
            tip_line = fallback_tip
            for ln in raw.splitlines():
                s = ln.strip()
                if s.lower().startswith(("child:", "niño:", "joven:", "孩子：", "孩子:")):
                    reply_line = s.split(":", 1)[-1].lstrip("：").strip() or reply_line
                elif s.lower().startswith(("coach tip:", "consejo:", "提示：", "提示:")):
                    tip_line = s.split(":", 1)[-1].lstrip("：").strip() or tip_line
            if reply_line == fallback_reply and raw.strip():
                reply_line = raw.splitlines()[0].strip()
            return {"reply": reply_line, "coachTip": tip_line}
    except Exception:  # noqa: BLE001
        pass
    return {"reply": fallback_reply, "coachTip": fallback_tip}

