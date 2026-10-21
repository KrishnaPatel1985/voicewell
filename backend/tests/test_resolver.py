from app.resolver import resolve_config

from .conftest import make_session, perms


def cfg(**kw):
    return resolve_config(make_session(**kw)[1])


def test_presets_differ_by_age():
    c14, c45, c65 = cfg(age=14), cfg(age=45), cfg(age=65)
    assert (c14["learner"]["depth"], c14["learner"]["cardsPerLesson"], c14["learner"]["pace"]) == ("simple", 5, "guided")
    assert (c45["learner"]["depth"], c45["learner"]["cardsPerLesson"], c45["learner"]["pace"]) == ("deep", 7, "self")
    assert (c65["learner"]["depth"], c65["learner"]["cardsPerLesson"], c65["learner"]["pace"]) == ("standard", 4, "slow")
    assert c45["learner"]["cardsPerScreen"] == 2 and c14["learner"]["cardsPerScreen"] == 1
    assert c65["textSize"] == "large" and c14["textSize"] == "normal"
    assert c14["preferences"]["starters"] is True and c45["preferences"]["starters"] is False
    assert c14["learner"]["adult"] is False and c45["learner"]["adult"] is True


def test_band_edges():
    assert cfg(age=15)["learner"]["ageBand"] == "15-24"
    assert cfg(age=24)["learner"]["ageBand"] == "15-24"
    assert cfg(age=25)["learner"]["ageBand"] == "25-64"
    assert cfg(age=64)["learner"]["ageBand"] == "25-64"


def test_overrides():
    _, s = make_session(age=45)
    s.preferences = {"slowerPace": True, "largeText": True, "starters": True}
    c = resolve_config(s)
    assert c["learner"]["pace"] == "guided" and c["textSize"] == "large" and c["preferences"]["starters"] is True
    _, s = make_session(age=14)
    s.preferences = {"slowerPace": True, "starters": False}
    c = resolve_config(s)
    assert c["learner"]["pace"] == "slow" and c["preferences"]["starters"] is False
    _, s = make_session(age=65)
    s.preferences = {"slowerPace": True}
    assert resolve_config(s)["learner"]["pace"] == "slow"


def test_all_capabilities_on():
    caps = cfg(age=45)["capabilities"]
    assert all(v["on"] for v in caps.values())


def test_deny_by_default():
    caps = cfg(permissions={})["capabilities"]
    assert caps["lessons"]["on"]
    for name in ("textPractice", "voicePractice", "toneFeedback"):
        assert caps[name] == {"on": False, "reason": "not-permitted"}


def test_missing_voice_permission_only_turns_voice_off():
    caps = cfg(permissions={"ai-chat": {"enabled": True}})["capabilities"]
    assert caps["textPractice"]["on"] is True
    assert caps["voicePractice"] == {"on": False, "reason": "not-permitted"}


def test_guardian_managed_and_pending_reasons():
    caps = cfg(permissions=perms(False, False, "GUARDIAN"))["capabilities"]
    assert caps["textPractice"]["reason"] == "needs-grown-up"
    assert caps["voicePractice"]["reason"] == "needs-grown-up"
    caps = cfg(status="pending")["capabilities"]
    assert caps["lessons"]["on"] is True
    assert caps["textPractice"] == {"on": False, "reason": "consent-pending"}
    assert caps["voicePractice"]["reason"] == "consent-pending"


def test_player_managed_off_points_to_settings():
    # What k-ID returns for a 14-year-old in the US: off, but the player can switch it on.
    caps = cfg(age=14, permissions=perms(False, False, "PLAYER"))["capabilities"]
    assert caps["textPractice"] == {"on": False, "reason": "off-in-settings"}
    assert caps["voicePractice"]["reason"] == "off-in-settings"
    assert caps["lessons"]["on"] is True


def test_tone_feedback_needs_adult_and_voice():
    assert cfg(age=17)["capabilities"]["toneFeedback"] == {"on": False, "reason": "under-18"}
    assert cfg(age=18)["capabilities"]["toneFeedback"]["on"] is True
    off = cfg(age=45, permissions=perms(True, False))["capabilities"]["toneFeedback"]
    assert off == {"on": False, "reason": "not-permitted"}


def test_failed_kid_reread_denies_all_practice():
    _, s = make_session()
    s.perms_ok = False
    caps = resolve_config(s)["capabilities"]
    assert caps["lessons"]["on"] and not caps["textPractice"]["on"] and not caps["voicePractice"]["on"]


def test_persona_selection():
    assert cfg(age=45, intent="myself")["persona"]["id"] == "trusted-adult"
    assert cfg(age=65, intent="myself")["persona"]["id"] == "doctor"
    assert cfg(age=14, intent="someone-else")["persona"]["id"] == "guarded-teen"
    assert cfg(intent=None)["persona"] is None
    p = cfg(age=45)["persona"]
    assert p["name"] == "Sam" and p["description"]
