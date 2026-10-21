"""HTTP API (spec section 5 + full adaptive core, Pause & Coach, journals, caregiver invites, specialists).
All routes live under /api."""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, WebSocket

from . import db, feedback as feedback_mod
from . import kid, lesson, practice_text, specialists, topics
from .auth import auth_router, require_user
from .errors import ApiError
from .practice_voice import voice_endpoint
from .resolver import capabilities, resolve_config
from .store import COOKIE_NAME, LessonState, Session, set_cookie, store

router = APIRouter(prefix="/api")  # public: health, /auth/*, caregiver-portal/*, voice socket
guarded = APIRouter(dependencies=[Depends(require_user)])  # every other route: valid vw_token first
router.include_router(auth_router)

SUPPORTED_LANGUAGES = {"en", "es", "zh-CN"}
UNSUPPORTED_COUNTRIES = {"AQ", "KP", "SY", "CU", "IR"}

REASON_TEXT = {
    "not-permitted": "This feature is turned off in your permissions.",
    "needs-grown-up": "A grown-up needs to turn this on for you.",
    "consent-pending": "We're still waiting for a grown-up to say yes.",
    "under-18": "Tone feedback is only available for adults.",
}


# ---------------------------------------------------------------- guards

async def current_session(request: Request, refresh: bool = True) -> Session:
    store.sweep()
    user = require_user(request)
    s = store.get_for_user(request.cookies.get(COOKIE_NAME), user.id)  # another account's session is "missing"
    if s is None:
        raise ApiError(401, "no_session", "Please complete the age check first.")
    if refresh:
        await kid.refresh_permissions(s)  # lenient: on failure permissions fail closed, lessons stay
    return s


def require_cap(session: Session, name: str) -> None:
    cap = capabilities(session)[name]
    if not cap["on"]:
        reason = cap.get("reason") or "not-permitted"
        raise ApiError(403, "not_permitted", REASON_TEXT.get(reason, REASON_TEXT["not-permitted"]))


async def practice_session(request: Request, capability: str, first_turn: bool = False) -> Session:
    """Session guard for practice routes: k-ID unreachable fails closed with 503."""
    s = await current_session(request, refresh=False)
    p = s.practice
    await kid.refresh_permissions(s, force=first_turn and not p.turns and p.persona_turn_count == 0, strict=True)
    if not s.perms_ok:
        raise ApiError(503, "kid_unavailable", "We couldn't check your permissions right now.")
    require_cap(s, capability)
    return s


def _config(s: Session) -> dict:
    return resolve_config(s)


async def _json_body(request: Request) -> dict:
    try:
        body: Any = await request.json()
    except ValueError:
        body = None
    if not isinstance(body, dict):
        raise ApiError(400, "bad_request", "That request wasn't in the right shape.")
    return body


# ---------------------------------------------------------------- routes

@router.get("/health")
async def health() -> dict:
    return {"ok": True}


@guarded.post("/kid/claim")
async def kid_claim(request: Request, response: Response) -> dict:
    user = require_user(request)
    body = await _json_body(request)
    token, age = body.get("claimToken"), body.get("age")
    country = body.get("country")
    language = body.get("language")
    if not isinstance(token, str) or not token:
        raise ApiError(400, "bad_request", "A claim token is required.")
    if isinstance(age, bool) or not isinstance(age, int) or not 0 <= age <= 120:
        raise ApiError(400, "bad_request", "A valid age is required.")
    if isinstance(country, str) and country.upper()[:2] in UNSUPPORTED_COUNTRIES:
        raise ApiError(400, "unsupported_country", "Voicewell is not yet supported in this jurisdiction.")

    result = await kid.claim(token)
    if result["status"] == "fail":
        raise ApiError(403, "not_permitted", "Voicewell isn't available for this age check result.")
    perms, jurisdiction = result["permissions"], result["jurisdiction"]
    if result["kid_session_id"] and perms is None:
        try:
            data = await kid.read_session(result["kid_session_id"])
            perms, jurisdiction = data["permissions"], data["jurisdiction"] or jurisdiction
        except ApiError:
            perms = None
    status = result["status"]
    if result["kid_session_id"] is None:
        status = "pending"  # nothing to re-read: never unlock anything without a k-ID session

    saved_locale = db.get_user_settings(user.id)
    lang = language if isinstance(language, str) and language in SUPPORTED_LANGUAGES else saved_locale["language"]
    ctry = country.upper() if isinstance(country, str) and country.strip() else (
        jurisdiction[:2] if isinstance(jurisdiction, str) and len(jurisdiction) >= 2 else (saved_locale["country"] or "US")
    )
    jur = jurisdiction or (country.upper() if isinstance(country, str) and country.strip() else saved_locale["jurisdiction"])
    db.save_user_settings(user.id, country=ctry, jurisdiction=jur, language=lang)

    sid = request.cookies.get(COOKIE_NAME)
    s = store.get_for_user(sid, user.id)  # someone else's session is never upgraded
    if s is None:
        sid, s = store.create()
    s.user_id = user.id
    s.kid_session_id = result["kid_session_id"]
    s.status = status
    s.permissions = perms or {}
    s.perms_ok = True
    s.perms_fetched_at = time.time()
    s.jurisdiction = jur or s.jurisdiction
    s.country = ctry
    s.language = lang
    s.age = age
    set_cookie(response, sid)
    return {"status": s.status, "config": _config(s)}


@guarded.post("/kid/pending")
async def kid_pending(request: Request, response: Response) -> dict:
    """Create or update a pending session when a child is waiting for parental consent in k-ID,
    allowing access to non-AI lessons and activities while AI chat and voice remain locked."""
    user = require_user(request)
    body = await _json_body(request)
    age = body.get("age")
    country = body.get("country")
    language = body.get("language")
    if isinstance(age, bool) or not isinstance(age, int) or not 6 <= age <= 120:
        raise ApiError(400, "bad_request", "A valid age (6 or older) is required.")
    if isinstance(country, str) and country.upper()[:2] in UNSUPPORTED_COUNTRIES:
        raise ApiError(400, "unsupported_country", "Voicewell is not yet supported in this jurisdiction.")

    saved_locale = db.get_user_settings(user.id)
    lang = language if isinstance(language, str) and language in SUPPORTED_LANGUAGES else saved_locale["language"]
    ctry = country.upper()[:2] if isinstance(country, str) and country.strip() else (saved_locale["country"] or "US")
    jur = country.upper() if isinstance(country, str) and country.strip() else (saved_locale["jurisdiction"] or ctry)
    db.save_user_settings(user.id, country=ctry, jurisdiction=jur, language=lang)

    sid = request.cookies.get(COOKIE_NAME)
    s = store.get_for_user(sid, user.id)
    if s is None:
        sid, s = store.create()
    s.user_id = user.id
    s.status = "pending"
    s.permissions = {}
    s.perms_ok = True
    s.perms_fetched_at = time.time()
    s.jurisdiction = jur
    s.country = ctry
    s.language = lang
    s.age = age
    s.intent = s.intent or "myself"
    s.topic = s.topic or "stress"
    set_cookie(response, sid)
    return {"status": s.status, "config": _config(s)}


@guarded.get("/session")
async def get_session(request: Request, fresh: bool = False) -> dict:
    """`fresh=1` re-reads k-ID now, so a change made in Permissions shows up on the next screen."""
    s = await current_session(request, refresh=not fresh)
    if fresh:
        await kid.refresh_permissions(s, force=True)
    return _config(s)


@guarded.get("/settings/locale")
async def get_locale_settings(request: Request) -> dict:
    user = require_user(request)
    return db.get_user_settings(user.id)


@guarded.post("/settings/locale")
async def update_locale_settings(request: Request) -> dict:
    """Update language and/or country. Changing language preserves progress; changing country flags
    that permission checks must be re-run for the new jurisdiction."""
    user = require_user(request)
    body = await _json_body(request)
    language = body.get("language")
    country = body.get("country")
    jurisdiction = body.get("jurisdiction")

    if language is not None and (not isinstance(language, str) or language not in SUPPORTED_LANGUAGES):
        raise ApiError(400, "unsupported_language", "That language is not yet enabled end to end.")
    if isinstance(country, str) and country.upper()[:2] in UNSUPPORTED_COUNTRIES:
        raise ApiError(400, "unsupported_country", "Voicewell is not yet supported in this jurisdiction.")

    current = db.get_user_settings(user.id)
    next_ctry = country.upper()[:2] if isinstance(country, str) and country.strip() else current["country"]
    next_jur = (
        jurisdiction.upper()
        if isinstance(jurisdiction, str) and jurisdiction.strip()
        else (country.upper() if isinstance(country, str) and country.strip() else current["jurisdiction"])
    )
    next_lang = language if isinstance(language, str) else current["language"]
    country_changed = bool(next_jur and next_jur != current["jurisdiction"])

    saved = db.save_user_settings(user.id, country=next_ctry, jurisdiction=next_jur, language=next_lang)

    sid = request.cookies.get(COOKIE_NAME)
    s = store.get_for_user(sid, user.id)
    if s is not None:
        s.language = next_lang
        if next_ctry:
            s.country = next_ctry
        if next_jur:
            s.jurisdiction = next_jur
        # Note: changing language preserves s.lesson_state and s.practice!
    return {
        "locale": saved,
        "requiresKidCheck": country_changed,
        "config": _config(s) if s is not None else None,
    }


@guarded.post("/onboarding")
async def onboarding(request: Request) -> dict:
    s = await current_session(request)
    body = await _json_body(request)
    intent, topic, prefs = body.get("intent"), body.get("topic"), body.get("preferences") or {}
    if intent not in ("myself", "someone-else"):
        raise ApiError(400, "bad_request", "Choose 'myself' or 'someone else'.")
    if not isinstance(topic, str) or topic not in topics.all_topics():
        raise ApiError(400, "invalid_input", "That topic isn't available.")
    if not isinstance(prefs, dict):
        raise ApiError(400, "bad_request", "Preferences were not in the right shape.")
    clean = {k: prefs[k] for k in ("captions", "slowerPace", "moreVisuals", "largeText", "starters")
             if isinstance(prefs.get(k), bool)}
    topic_changed = s.topic != topic or s.intent != intent
    s.intent, s.topic, s.preferences = intent, topic, clean
    mode = body.get("mode")
    if mode in ("talk", "practice"):
        s.mode = mode
    support_target = body.get("supportTarget")
    if support_target in ("child", "partner", "friend", "other", None):
        s.support_target = support_target
    support_age = body.get("supportAge")
    if isinstance(support_age, int) and not isinstance(support_age, bool) and 1 <= support_age <= 120:
        s.support_age = support_age
    custom_goal = body.get("customGoal")
    if isinstance(custom_goal, str):
        s.custom_goal = custom_goal.strip()[:300] or None
    language = body.get("language")
    if isinstance(language, str) and language in SUPPORTED_LANGUAGES:
        s.language = language
    if topic_changed:
        s.lesson_state = LessonState()
        s.practice.reset()
    return _config(s)


@guarded.get("/topics")
async def get_topics() -> dict:
    return {"topics": topics.list_topics()}


@guarded.get("/lesson/{topic}/next")
async def lesson_next(topic: str, request: Request) -> dict:
    s = await current_session(request)
    lesson.ensure_topic(s, topic)
    return lesson.next_step(s)


@guarded.get("/lesson/{topic}/simpler")
async def lesson_simpler(topic: str, request: Request) -> dict:
    s = await current_session(request)
    lesson.ensure_topic(s, topic)
    return lesson.simpler(s)


@guarded.post("/lesson/check")
async def lesson_check(request: Request) -> dict:
    s = await current_session(request)
    body = await _json_body(request)
    cid, idx = body.get("conceptId"), body.get("answerIndex")
    if not isinstance(cid, str) or isinstance(idx, bool) or not isinstance(idx, int):
        raise ApiError(400, "bad_request", "That answer wasn't in the right shape.")
    return lesson.check(s, cid, idx)


@guarded.get("/practice/starters")
async def practice_starters(request: Request) -> dict:
    s = await practice_session(request, "textPractice")
    persona = practice_text.persona_for(s)
    return {"starters": list(persona.get("starters", []))}


@guarded.post("/practice/mode")
async def set_practice_mode(request: Request) -> dict:
    s = await current_session(request, refresh=False)
    body = await _json_body(request)
    mode = body.get("mode")
    if mode not in ("talk", "practice"):
        raise ApiError(400, "bad_request", "Mode must be 'talk' or 'practice'.")
    s.mode = mode
    return _config(s)


@guarded.post("/practice/text")
async def practice_text_turn(request: Request) -> dict:
    s = await practice_session(request, "textPractice", first_turn=True)
    body = await _json_body(request)
    text = body.get("text")
    if not isinstance(text, str):
        raise ApiError(400, "bad_request", "Please type something first.")
    mode = body.get("mode")
    if mode in ("talk", "practice"):
        s.mode = mode
    return await practice_text.handle_turn(s, text)


@guarded.post("/practice/coach")
async def practice_coach(request: Request) -> dict:
    """Pause & Coach: pauses the role-play and explains via permitted audio or text without counting against feedback."""
    body = await _json_body(request)
    fmt = body.get("format") or "text"
    action = body.get("action") or "explain"
    question = body.get("question") if isinstance(body.get("question"), str) else ""
    if fmt not in ("text", "audio"):
        raise ApiError(400, "bad_request", "Format must be 'text' or 'audio'.")
    if action not in ("explain", "more_help", "retry_moment"):
        raise ApiError(400, "bad_request", "Invalid coach action.")
    required_cap = "voicePractice" if fmt == "audio" else "textPractice"
    s = await practice_session(request, required_cap)
    return await practice_text.handle_coach(s, action=action, fmt=fmt, question=question)


@guarded.post("/practice/resume")
async def practice_resume(request: Request) -> dict:
    s = await current_session(request, refresh=False)
    s.practice.paused = False
    return {"ok": True, "paused": False, "turn": s.practice.persona_turn_count}


@guarded.post("/practice/reset")
async def practice_reset(request: Request) -> dict:
    s = await current_session(request, refresh=False)
    s.practice.reset()
    return {"ok": True}


@guarded.post("/practice/feedback")
async def practice_feedback(request: Request) -> dict:
    s = await current_session(request)
    return await feedback_mod.get_feedback(s)


# ---------------------------------------------------------------- journals (private per-account)

@guarded.get("/journals")
async def get_journals(request: Request) -> dict:
    user = require_user(request)
    return {"cards": db.list_journal_cards(user.id)}


@guarded.post("/journals")
async def create_journal(request: Request) -> dict:
    user = require_user(request)
    body = await _json_body(request)
    reflection = body.get("reflection")
    if not isinstance(reflection, str) or not reflection.strip():
        raise ApiError(400, "invalid_input", "Please include a short reflection before saving.")
    card = db.create_journal_card(user.id, body)
    return {"card": card}


@guarded.put("/journals/{card_id}")
async def update_journal(card_id: str, request: Request) -> dict:
    user = require_user(request)
    body = await _json_body(request)
    card = db.update_journal_card(user.id, card_id, body)
    if card is None:
        raise ApiError(404, "not_found", "Journal card not found.")
    return {"card": card}


@guarded.delete("/journals/{card_id}")
async def delete_journal(card_id: str, request: Request) -> dict:
    user = require_user(request)
    if not db.delete_journal_card(user.id, card_id):
        raise ApiError(404, "not_found", "Journal card not found.")
    return {"ok": True}


# ---------------------------------------------------------------- caregiver invitations & portal

@guarded.get("/caregiver-invites")
async def get_caregiver_invites(request: Request) -> dict:
    user = require_user(request)
    return {"invites": db.list_caregiver_invites(user.id)}


@guarded.post("/caregiver-invites")
async def create_caregiver_invite_route(request: Request) -> dict:
    user = require_user(request)
    body = await _json_body(request)
    understand = body.get("whatToUnderstand")
    support = body.get("whatSupportHelps")
    if not isinstance(understand, str) or not understand.strip():
        raise ApiError(400, "invalid_input", "Please share what you would like them to understand.")
    if not isinstance(support, str) or not support.strip():
        raise ApiError(400, "invalid_input", "Please share what kind of support would help.")
    invite = db.create_caregiver_invite(user.id, body)
    return {"invite": invite}


@guarded.post("/caregiver-invites/{code}/revoke")
async def revoke_caregiver_invite_route(code: str, request: Request) -> dict:
    user = require_user(request)
    invite = db.revoke_caregiver_invite(user.id, code)
    if invite is None:
        raise ApiError(404, "not_found", "Invitation not found.")
    return {
        "invite": invite,
        "notice": (
            "Future access to this invitation link has been revoked. "
            "Please note that if your caregiver already viewed the card, information they already saw cannot be taken back."
        ),
    }


@router.get("/caregiver-portal/{code}")
async def view_caregiver_portal(code: str, lang: str | None = None) -> dict:
    invite = db.open_caregiver_invite_by_code(code)
    if invite is None:
        raise ApiError(404, "not_found", "This invitation code was not found.")
    if invite["status"] == "revoked":
        return {"status": "revoked", "invite": None, "lesson": None}
    if invite["status"] == "expired":
        return {"status": "expired", "invite": None, "lesson": None}
    use_lang = lang if lang in SUPPORTED_LANGUAGES else invite.get("language", "en")
    return {
        "status": invite["status"],
        "invite": invite,
        "lesson": specialists.get_caregiver_lesson(use_lang),
    }


@router.post("/caregiver-portal/{code}/action")
async def choose_caregiver_support_action(code: str, request: Request) -> dict:
    body = await _json_body(request)
    action = body.get("supportAction")
    if not isinstance(action, str) or not action.strip():
        raise ApiError(400, "invalid_input", "Please select or enter a concrete support action.")
    invite = db.complete_caregiver_invite(code, action)
    if invite is None:
        raise ApiError(404, "not_found", "Invitation not found.")
    if invite["status"] in ("revoked", "expired"):
        raise ApiError(403, "invite_inactive", f"This invitation is {invite['status']}.")
    return {"invite": invite}


@router.post("/caregiver-portal/{code}/practice")
async def caregiver_portal_practice(code: str, request: Request) -> dict:
    """Isolated caregiver practice. Transcripts are never stored or shared with the child."""
    invite = db.open_caregiver_invite_by_code(code)
    if invite is None or invite["status"] in ("revoked", "expired"):
        raise ApiError(403, "invite_inactive", "This invitation is no longer active.")
    body = await _json_body(request)
    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ApiError(400, "bad_request", "Please enter what you would say.")
    lang = body.get("language") if body.get("language") in SUPPORTED_LANGUAGES else invite.get("language", "en")
    return await specialists.caregiver_practice_turn(
        text.strip(),
        invite["whatToUnderstand"],
        invite["whatSupportHelps"],
        lang=lang,
    )


# ---------------------------------------------------------------- specialists & appointments

@guarded.get("/specialists")
async def get_specialists() -> dict:
    return {"specialists": specialists.list_specialists()}


@guarded.get("/appointments")
async def get_appointments(request: Request) -> dict:
    user = require_user(request)
    return {"requests": db.list_appointment_requests(user.id)}


@guarded.post("/appointments")
async def create_appointment(request: Request) -> dict:
    user = require_user(request)
    body = await _json_body(request)
    booking_type = body.get("bookingType")
    if booking_type not in ("adult_self", "adult_child_invite", "child_guardian_request"):
        raise ApiError(400, "invalid_input", "Invalid booking type.")
    if booking_type == "adult_child_invite":
        purpose = body.get("purposeLabel")
        if not isinstance(purpose, str) or not purpose.strip():
            raise ApiError(400, "invalid_input", "Please describe the purpose of the appointment for your child.")
    req = db.create_appointment_request(user.id, body)
    return {"request": req}


@guarded.get("/appointments/{req_id}")
async def get_single_appointment(req_id: str) -> dict:
    req = db.get_appointment_request(req_id)
    if req is None:
        raise ApiError(404, "not_found", "Appointment request not found.")
    return {"request": req}


@guarded.post("/appointments/{req_id}/respond")
async def respond_appointment(req_id: str, request: Request) -> dict:
    body = await _json_body(request)
    resp = body.get("response")
    if resp not in ("accept", "more_information", "decline"):
        raise ApiError(400, "invalid_input", "Choose Yes, I have questions, or Not right now.")
    question = body.get("question") if isinstance(body.get("question"), str) else None
    updated = db.respond_to_appointment(req_id, resp, question=question)
    if updated is None:
        raise ApiError(404, "not_found", "Appointment request not found.")
    return {"request": updated}


@guarded.post("/appointments/{req_id}/scope")
async def change_appointment_scope(req_id: str, request: Request) -> dict:
    user = require_user(request)
    body = await _json_body(request)
    scope = body.get("informationScope")
    if not isinstance(scope, str) or not scope.strip():
        raise ApiError(400, "invalid_input", "Information sharing scope is required.")
    proposed_at = body.get("proposedAt") if isinstance(body.get("proposedAt"), str) else None
    appointment_type = body.get("appointmentType") if isinstance(body.get("appointmentType"), str) else None
    updated = db.update_appointment_scope(
        user.id, req_id, scope, proposed_at=proposed_at, appointment_type=appointment_type
    )
    if updated is None:
        raise ApiError(404, "not_found", "Appointment request not found.")
    return {
        "request": updated,
        "message": "Details changed. Agreement version updated and child agreement has been reset to pending.",
    }


@guarded.post("/appointments/{req_id}/guardian")
async def guardian_authorize_appointment(req_id: str, request: Request) -> dict:
    body = await _json_body(request)
    action = body.get("action")
    if action not in ("approve", "decline"):
        raise ApiError(400, "invalid_input", "Action must be 'approve' or 'decline'.")
    updated = db.authorize_child_appointment_by_guardian(req_id, action)
    if updated is None:
        raise ApiError(404, "not_found", "Appointment request not found.")
    return {"request": updated}


@router.websocket("/practice/voice")
async def practice_voice(ws: WebSocket) -> None:
    await voice_endpoint(ws)


router.include_router(guarded)
