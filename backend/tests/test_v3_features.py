"""Tests for Voicewell adaptive core, country/language settings, Pause & Coach, journals, caregiver invites, and appointments."""
from __future__ import annotations

from app import auth, llm
from .conftest import authed, set_cookie, sign_in


def fake_llm(monkeypatch, reply="I hear you. Tell me more."):
    async def chat(messages, **kw):
        sys = messages[0]["content"]
        if sys.startswith("You are a safety classifier"):
            return '{"self_harm": false, "diagnosis_request": false}'
        if "Pause & Coach" in sys:
            return 'Explanation: Take a breath and share one feeling.\nTry saying: "I feel overwhelmed right now."'
        return reply

    monkeypatch.setattr(llm, "chat", chat)


def test_age_groups_and_help_labels(client):
    u = sign_in(client)
    authed(client, user=u, age=9)
    r_kid = client.get("/api/session").json()
    assert r_kid["ageGroup"] == "kids" and r_kid["helpLabel"] == "Help me understand"

    authed(client, user=u, age=15)
    r_teen = client.get("/api/session").json()
    assert r_teen["ageGroup"] == "teens" and r_teen["helpLabel"] == "Explain this"

    authed(client, user=u, age=32)
    r_adult = client.get("/api/session").json()
    assert r_adult["ageGroup"] == "adults" and r_adult["helpLabel"] == "Pause & Coach"


def test_language_switch_preserves_progress_and_country_switch_flags_recheck(client, monkeypatch):
    fake_llm(monkeypatch)
    s = authed(client, age=16)
    s.jurisdiction = "US"
    s.country = "US"
    client.post("/api/practice/text", json={"text": "Hello Sam"})
    assert len(s.practice.turns) == 2

    # Switch language to Español: preserves turns and does not require a new k-ID check
    r_lang = client.post("/api/settings/locale", json={"language": "es"}).json()
    assert r_lang["locale"]["language"] == "es"
    assert r_lang["requiresKidCheck"] is False
    assert len(s.practice.turns) == 2

    # Switch country to Australia (AU): flags requiresKidCheck=True
    r_ctry = client.post("/api/settings/locale", json={"country": "AU", "jurisdiction": "AU"}).json()
    assert r_ctry["locale"]["country"] == "AU"
    assert r_ctry["requiresKidCheck"] is True

    # Unsupported country and language are rejected honestly
    assert client.post("/api/settings/locale", json={"country": "KP"}).status_code == 400
    assert client.post("/api/settings/locale", json={"language": "fr"}).status_code == 400


def test_kid_pending_session_allows_non_ai_only(client):
    sign_in(client)
    assert client.post("/api/kid/pending", json={"age": 4, "country": "US"}).status_code == 400
    r = client.post("/api/kid/pending", json={"age": 10, "country": "US", "language": "es"})
    assert r.status_code == 200
    cfg = r.json()["config"]
    assert cfg["status"] == "pending"
    assert cfg["ageGroup"] == "kids"
    assert cfg["language"] == "es"
    assert cfg["capabilities"]["lessons"]["on"] is True
    assert cfg["capabilities"]["textPractice"] == {"on": False, "reason": "consent-pending"}
    assert cfg["capabilities"]["voicePractice"] == {"on": False, "reason": "consent-pending"}


def test_confusion_triggers_coach_prompt_and_pause_coach_flow(client, monkeypatch):
    fake_llm(monkeypatch)
    # Simulate Australia 15yo teen: textPractice ON, voicePractice OFF (managedBy GUARDIAN)
    s = authed(
        client,
        age=15,
        permissions={
            "ai-chat": {"enabled": True, "managedBy": "PLAYER"},
            "ai-voice-mode": {"enabled": False, "managedBy": "GUARDIAN"},
        },
    )
    s.jurisdiction = "AU"
    r1 = client.post("/api/practice/text", json={"text": "I'm confused and I don't know what to say"}).json()
    assert r1["turn"] == 1
    assert r1["coachPrompt"] == "Would you like to pause and have me talk you through it?"

    # Audio coaching is blocked because voicePractice is off for this teen in AU
    r_audio = client.post("/api/practice/coach", json={"action": "explain", "format": "audio"})
    assert r_audio.status_code == 403

    # Text coaching ("Read it instead") is permitted and pauses without adding to practice turns
    r_text = client.post("/api/practice/coach", json={"action": "explain", "format": "text"}).json()
    assert r_text["paused"] is True
    assert r_text["explanation"] and r_text["examplePhrase"]
    assert s.practice.persona_turn_count == 1
    assert len(s.practice.turns) == 2
    assert len(s.practice.coach_turns) == 1

    # "Try that moment again" rewinds the last turn pair
    r_retry = client.post("/api/practice/coach", json={"action": "retry_moment", "format": "text"}).json()
    assert r_retry["paused"] is False
    assert r_retry["turn"] == 0
    assert len(s.practice.turns) == 0


def test_private_journals_are_scoped_per_account(client):
    alice = sign_in(client, email="alice@example.com")
    r = client.post(
        "/api/journals",
        json={
            "topic": "Stress and emotions",
            "reflection": "I practised naming my main worry first.",
            "usefulPhrase": "I feel overwhelmed because of school.",
            "nextStep": "Talk to Sam after dinner.",
            "notes": "Keep it simple.",
        },
    )
    assert r.status_code == 200
    card_id = r.json()["card"]["id"]
    assert len(client.get("/api/journals").json()["cards"]) == 1

    # Update card
    r_up = client.put(f"/api/journals/{card_id}", json={"notes": "Updated note"})
    assert r_up.status_code == 200 and r_up.json()["card"]["notes"] == "Updated note"

    # Another user cannot see, edit, or delete Alice's journal card
    sign_in(client, email="bob@example.com")
    assert client.get("/api/journals").json()["cards"] == []
    assert client.put(f"/api/journals/{card_id}", json={"notes": "Hack"}).status_code == 404
    assert client.delete(f"/api/journals/{card_id}").status_code == 404

    # Alice can delete her own card
    set_cookie(client, auth.TOKEN_COOKIE, auth.create_token(alice.id, alice.email, alice.name))
    assert client.delete(f"/api/journals/{card_id}").status_code == 200
    assert client.get("/api/journals").json()["cards"] == []


def test_caregiver_invitation_lifecycle_and_revocation(client, monkeypatch):
    fake_llm(monkeypatch)
    s = authed(client, age=11)
    r = client.post(
        "/api/caregiver-invites",
        json={
            "ageGroup": "kids",
            "topic": "Stress and emotions",
            "caregiverRole": "Mum",
            "whatToUnderstand": "School feels really loud and busy right now.",
            "whatSupportHelps": "Listen for a few minutes without asking about grades.",
            "usefulPhrase": "I feel overwhelmed and need some quiet time.",
            "language": "en",
        },
    )
    assert r.status_code == 200
    code = r.json()["invite"]["code"]
    assert r.json()["invite"]["status"] == "pending"

    # Caregiver opens portal -> status becomes acknowledged
    portal = client.get(f"/api/caregiver-portal/{code}").json()
    assert portal["status"] == "acknowledged"
    assert portal["invite"]["whatToUnderstand"] == "School feels really loud and busy right now."
    assert portal["lesson"]["phrasesToTry"]

    # Caregiver does isolated practice -> child's practice turns are untouched
    prac = client.post(
        f"/api/caregiver-portal/{code}/practice",
        json={"text": "Thank you for sharing your card with me. I'm here to listen."},
    ).json()
    assert prac["reply"] and prac["coachTip"]
    assert s.practice.turns == []

    # Caregiver commits to one concrete support action -> status becomes completed
    done = client.post(
        f"/api/caregiver-portal/{code}/action",
        json={"supportAction": "Check in for 10 quiet minutes this evening just to listen."},
    ).json()
    assert done["invite"]["status"] == "completed"

    # Child revokes future access -> status becomes revoked and portal no longer returns the card
    rev = client.post(f"/api/caregiver-invites/{code}/revoke").json()
    assert rev["invite"]["status"] == "revoked"
    assert "cannot be taken back" in rev["notice"]
    portal_after = client.get(f"/api/caregiver-portal/{code}").json()
    assert portal_after["status"] == "revoked" and portal_after["invite"] is None


def test_specialists_and_appointment_agreement_versioning(client):
    sign_in(client)
    specs = client.get("/api/specialists").json()["specialists"]
    assert len(specs) >= 4 and all(sp["verified"] for sp in specs)

    # 1. Adult self-booking request -> accurately labeled REQUEST_SUBMITTED, providerConfirmed=False
    r_self = client.post(
        "/api/appointments",
        json={
            "bookingType": "adult_self",
            "specialistId": specs[0]["id"],
            "specialistName": specs[0]["name"],
            "specialty": specs[0]["specialty"],
            "proposedAt": specs[0]["availableSlots"][0]["startsAt"],
            "format": "Video",
            "price": specs[0]["price"],
            "purposeLabel": "Preparing for a conversation about stress.",
        },
    ).json()["request"]
    assert r_self["status"] == "REQUEST_SUBMITTED"
    assert r_self["providerConfirmed"] is False

    # 2. Adult involving a child -> starts PENDING_CHILD_RESPONSE, version 1
    r_child = client.post(
        "/api/appointments",
        json={
            "bookingType": "adult_child_invite",
            "appointmentType": "joint",
            "specialistId": specs[0]["id"],
            "specialistName": specs[0]["name"],
            "specialty": specs[0]["specialty"],
            "proposedAt": specs[0]["availableSlots"][0]["startsAt"],
            "format": "Video",
            "price": specs[0]["price"],
            "purposeLabel": "Support for school stress.",
            "informationScope": "Specialist, time, attendees, and general purpose",
        },
    ).json()["request"]
    req_id = r_child["id"]
    assert r_child["status"] == "PENDING_CHILD_RESPONSE" and r_child["agreementVersion"] == 1

    # Child agrees ("Yes")
    r_yes = client.post(f"/api/appointments/{req_id}/respond", json={"response": "accept"}).json()["request"]
    assert r_yes["status"] == "PARTICIPANT_AGREED"

    # Parent changes sharing scope -> bumps agreementVersion to 2 and resets to PENDING_CHILD_RESPONSE
    r_scope = client.post(
        f"/api/appointments/{req_id}/scope",
        json={"informationScope": "Specialist, time, attendees, general purpose, and parent notes"},
    ).json()["request"]
    assert r_scope["agreementVersion"] == 2
    assert r_scope["status"] == "PENDING_CHILD_RESPONSE"
    assert r_scope["participantResponse"] == "pending"

