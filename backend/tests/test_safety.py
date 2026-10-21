import pytest

from app import safety


@pytest.mark.parametrize("text", [
    "I want to kill myself", "sometimes I think about suicide", "I want to end my life",
    "I keep wanting to hurt myself", "I don't want to be alive", "dont want to be here anymore",
    "self-harm", "KILL MYSELF",
])
def test_self_harm_positive(text):
    assert safety.keyword_check(text) == "self_harm"


@pytest.mark.parametrize("text", [
    "I'm so stressed about exams", "I was killing it at work today", "I'm dying to know what you think",
    "My boss is killing me with deadlines", "I feel overwhelmed and tired",
])
def test_self_harm_negative(text):
    assert safety.keyword_check(text) is None


@pytest.mark.parametrize("text", [
    "Do I have depression?", "can you diagnose me", "What condition is this?", "Should I take something for it",
    "how much should I take",
])
def test_diagnosis_positive(text):
    assert safety.keyword_check(text) == "diagnosis"


def test_scan_output():
    assert safety.scan_output("It sounds like depression to me")
    assert safety.scan_output("Try 20 mg at night")
    assert safety.scan_output("an SSRI might help")
    assert not safety.scan_output("It sounds like a lot of pressure at work.")


def test_support_message_by_jurisdiction():
    assert "988" in safety.support_message("US")
    assert "988" in safety.support_message("us-ca")
    assert "988" not in safety.support_message("GB")
    assert "988" not in safety.support_message(None)


async def test_classifier_parses_and_fails_open(monkeypatch):
    async def ok(*a, **k):
        return '```json\n{"self_harm": true, "diagnosis_request": false}\n```'

    monkeypatch.setattr(safety.llm, "chat", ok)
    assert await safety.classify("x") == {"self_harm": True, "diagnosis_request": False}

    async def boom(*a, **k):
        raise RuntimeError("timeout")

    monkeypatch.setattr(safety.llm, "chat", boom)
    assert await safety.classify("x") == {"self_harm": False, "diagnosis_request": False}

    async def junk(*a, **k):
        return "not json"

    monkeypatch.setattr(safety.llm, "chat", junk)
    assert await safety.classify("x") == {"self_harm": False, "diagnosis_request": False}
