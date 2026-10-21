import asyncio
import base64
import json

import numpy as np
import pytest

from app import practice_voice, safety
from app.practice_voice import VoiceRelay, downsample_24k_to_16k, session_update_message

from .conftest import make_session

PERSONA = {
    "id": "trusted-adult", "name": "Sam", "voice": "Ashley", "redirect_line": "Ask a doctor.",
    "scripted_fallbacks": ["f1", "f2"], "opening_line": "Hi",
}


class FakeUp:
    def __init__(self):
        self.sent = []
        self.q = asyncio.Queue()
        self.closed = False

    async def send(self, raw):
        self.sent.append(json.loads(raw))

    def push(self, msg):
        self.q.put_nowait(json.dumps(msg))

    def __aiter__(self):
        return self

    async def __anext__(self):
        item = await self.q.get()
        if item is None:
            raise StopAsyncIteration
        return item

    async def close(self):
        self.closed = True
        self.q.put_nowait(None)

    def types(self):
        return [m["type"] for m in self.sent]


class FakeWS:
    def __init__(self):
        self.out = []
        self.inq = asyncio.Queue()
        self.closed_code = None

    async def send_text(self, t):
        self.out.append(json.loads(t))

    async def send_bytes(self, b):
        self.out.append(b)

    async def receive(self):
        return await self.inq.get()

    async def close(self, code=1000):
        self.closed_code = code

    def msgs(self, type_):
        return [m for m in self.out if isinstance(m, dict) and m["type"] == type_]


@pytest.fixture
def no_flags(monkeypatch):
    async def classify(text):
        return {"self_harm": False, "diagnosis_request": False}

    monkeypatch.setattr(safety, "classify", classify)


def relay(age=45, **kw):
    _, s = make_session(age=age, **kw)
    r = VoiceRelay(FakeWS(), s, PERSONA, False)
    r.up = FakeUp()
    return r


async def reply(r, rid, text, audio=b"\x00\x01" * 10):
    await r.on_upstream({"type": "response.created", "response": {"id": rid}})
    await r.on_upstream({"type": "response.output_audio.delta", "response_id": rid, "delta": base64.b64encode(audio).decode()})
    await r.on_upstream({"type": "response.output_audio_transcript.delta", "response_id": rid, "delta": text})
    await r.on_upstream({"type": "response.done", "response": {"id": rid, "status": "completed"}})


def test_session_update_shape_matches_spec():
    m = session_update_message("PROMPT", "Nate")
    ses = m["session"]
    assert m["type"] == "session.update" and ses["instructions"] == "PROMPT"
    td = ses["audio"]["input"]["turn_detection"]
    assert td == {"type": "semantic_vad", "eagerness": "medium", "create_response": False, "interrupt_response": True}
    assert ses["audio"]["output"] == {"model": "inworld-tts-2-flash", "voice": "Nate"}
    assert ses["audio"]["input"]["transcription"] == {"model": "inworld/inworld-stt-1"}


def test_downsample_length_and_dc():
    pcm = (np.full(960, 1000, dtype="<i2")).tobytes()
    out = np.frombuffer(downsample_24k_to_16k(pcm), dtype="<i2")
    assert len(out) == 640 and (out == 1000).all()
    ramp = np.arange(0, 960, dtype="<i2").tobytes()
    o = np.frombuffer(downsample_24k_to_16k(ramp), dtype="<i2")
    assert o[0] == 0 and abs(int(o[1]) - 1.5) <= 1
    assert downsample_24k_to_16k(b"") == b""


async def test_normal_turn_forwards_audio_and_counts(no_flags):
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.delta", "delta": "hel"})
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "hello there"})
    assert r.up.types() == ["response.create"]
    await reply(r, "r1", "Tell me more.")
    ws = r.ws
    assert ws.msgs("user_transcript") == [
        {"type": "user_transcript", "text": "hel", "final": False},
        {"type": "user_transcript", "text": "hello there", "final": True},
    ]
    assert [b for b in ws.out if isinstance(b, bytes)] == [b"\x00\x01" * 10]
    assert ws.msgs("assistant_transcript")[-1] == {"type": "assistant_transcript", "text": "Tell me more.", "final": True}
    assert r.session.practice.persona_turn_count == 1
    assert r.session.practice.turns == [
        {"role": "user", "content": "hello there"}, {"role": "assistant", "content": "Tell me more."}]
    r.watchdog.cancel()


async def test_opening_line_does_not_count():
    r = relay()
    r.expect_opening = True
    await r.speak("Hi")
    assert r.up.sent == [{"type": "response.speak", "text": "Hi"}]
    await reply(r, "r0", "Hi")
    assert r.session.practice.persona_turn_count == 0
    assert r.session.practice.turns == [{"role": "assistant", "content": "Hi"}]


async def test_eighth_persona_turn_sends_done_and_finishes(no_flags):
    r = relay()
    for n in range(8):
        await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": f"turn {n}"})
        await reply(r, f"r{n}", "ok")
    assert r.ws.msgs("done") == [{"type": "done"}]
    assert r.finished.is_set() and r.close_code == 1000
    if r.watchdog:
        r.watchdog.cancel()


async def test_self_harm_keyword_stops_everything():
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "I want to kill myself"})
    stop = r.ws.msgs("safety_stop")
    assert len(stop) == 1 and stop[0]["message"]
    assert r.session.practice.safety_stopped and r.finished.is_set()
    assert "response.create" not in r.up.types()


async def test_self_harm_mid_reply_cancels_first(no_flags):
    r = relay()
    await r.on_upstream({"type": "response.created", "response": {"id": "r1"}})
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "I want to end my life"})
    assert r.up.types() == ["response.cancel"]
    assert r.ws.msgs("cancelled") and r.ws.msgs("safety_stop")


async def test_classifier_self_harm_after_create(monkeypatch):
    async def classify(text):
        return {"self_harm": True, "diagnosis_request": False}

    monkeypatch.setattr(safety, "classify", classify)
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "nothing matters"})
    await r.on_upstream({"type": "response.created", "response": {"id": "r1"}})
    r.watchdog.cancel()
    await asyncio.gather(*r.bg, return_exceptions=True)
    assert r.up.types() == ["response.create", "response.cancel"]
    assert r.ws.msgs("cancelled") and r.ws.msgs("safety_stop") and r.finished.is_set()


async def test_diagnosis_keyword_speaks_redirect():
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "Do I have depression?"})
    assert r.up.sent == [{"type": "response.speak", "text": "Ask a doctor."}]


async def test_classifier_diagnosis_cancels_and_redirects(monkeypatch):
    async def classify(text):
        return {"self_harm": False, "diagnosis_request": True}

    monkeypatch.setattr(safety, "classify", classify)
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "what is wrong with me"})
    await r.on_upstream({"type": "response.created", "response": {"id": "r1"}})
    r.watchdog.cancel()
    await asyncio.gather(*r.bg, return_exceptions=True)
    assert r.up.types()[-2:] == ["response.cancel", "response.speak"]
    assert r.up.sent[-1]["text"] == "Ask a doctor."


async def test_flagged_output_is_cut_and_replaced():
    r = relay()
    await r.on_upstream({"type": "response.created", "response": {"id": "r1"}})
    await r.on_upstream({"type": "response.output_audio_transcript.delta", "response_id": "r1", "delta": "That sounds like depress"})
    assert r.up.sent == []
    await r.on_upstream({"type": "response.output_audio_transcript.delta", "response_id": "r1", "delta": "ion to me"})
    assert r.up.types() == ["response.cancel", "response.speak"]
    assert r.ws.msgs("cancelled")
    # late audio from the cut reply is dropped; the cancelled done is not a persona turn
    await r.on_upstream({"type": "response.output_audio.delta", "response_id": "r1", "delta": "AAAA"})
    await r.on_upstream({"type": "response.done", "response": {"id": "r1", "status": "cancelled"}})
    assert not [b for b in r.ws.out if isinstance(b, bytes)]
    assert r.session.practice.persona_turn_count == 0


async def test_user_barge_in_cancels_playback():
    r = relay()
    await r.on_upstream({"type": "response.created", "response": {"id": "r1"}})
    await r.on_upstream({"type": "input_audio_buffer.speech_started"})
    assert [m["type"] for m in r.ws.out] == ["user_speech_started", "cancelled"]
    await r.on_upstream({"type": "response.output_audio.delta", "response_id": "r1", "delta": "AAAA"})
    await r.on_upstream({"type": "response.done", "response": {"id": "r1", "status": "cancelled"}})
    assert r.session.practice.persona_turn_count == 0 and not [b for b in r.ws.out if isinstance(b, bytes)]
    # a new reply plays normally
    r.session.practice.turns.append({"role": "user", "content": "x"})
    await reply(r, "r2", "Go on.")
    assert [b for b in r.ws.out if isinstance(b, bytes)]
    assert r.session.practice.persona_turn_count == 1


async def test_watchdog_falls_back_to_scripted_line(monkeypatch, no_flags):
    monkeypatch.setattr(practice_voice, "WATCHDOG_SECONDS", 0.05)
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "hello"})
    await asyncio.sleep(0.2)
    assert r.up.types() == ["response.create", "response.cancel", "response.speak"]
    assert r.up.sent[-1]["text"] == "f1"


async def test_watchdog_cancelled_by_audio(monkeypatch, no_flags):
    monkeypatch.setattr(practice_voice, "WATCHDOG_SECONDS", 0.1)
    r = relay()
    await r.on_upstream({"type": "conversation.item.input_audio_transcription.completed", "transcript": "hello"})
    await r.on_upstream({"type": "response.created", "response": {"id": "r1"}})
    await r.on_upstream({"type": "response.output_audio.delta", "response_id": "r1", "delta": "AAAA"})
    await asyncio.sleep(0.25)
    assert r.up.types() == ["response.create"]


async def test_run_forwards_audio_then_end_closes_everything(no_flags):
    r = relay()
    mod = FakeUp()
    r.mod = mod
    frame = np.arange(960, dtype="<i2").tobytes()
    r.ws.inq.put_nowait({"type": "websocket.receive", "bytes": frame})
    r.ws.inq.put_nowait({"type": "websocket.receive", "text": json.dumps({"type": "end"})})
    await asyncio.wait_for(r.run(), 3)
    append = r.up.sent[0]
    assert append["type"] == "input_audio_buffer.append" and base64.b64decode(append["audio"]) == frame
    assert r.up.closed and mod.closed and r.ws.closed_code == 1000


async def test_run_modulate_emotions_collected_never_forwarded(no_flags):
    r = relay()
    mod = FakeUp()
    r.mod = mod
    mod.push({"type": "utterance", "utterance": {"text": "secret", "emotion": "Anxious"}})
    mod.push({"type": "utterance", "utterance": {"text": "partial", "emotion": None}})
    task = asyncio.create_task(r.run())
    await asyncio.sleep(0.1)
    r.ws.inq.put_nowait({"type": "websocket.disconnect"})
    await asyncio.wait_for(task, 3)
    assert r.session.practice.emotions == ["Anxious"]
    assert not r.ws.out


async def test_run_modulate_failure_does_not_end_conversation(no_flags):
    r = relay()
    mod = FakeUp()
    r.mod = mod
    task = asyncio.create_task(r.run())
    await asyncio.sleep(0.05)
    mod.q.put_nowait(None)  # modulate socket drops
    await asyncio.sleep(0.05)
    assert not task.done() and r.mod is None
    r.ws.inq.put_nowait({"type": "websocket.receive", "text": json.dumps({"type": "end"})})
    await asyncio.wait_for(task, 3)


async def test_run_upstream_failure_reports_text_fallback():
    r = relay()
    task = asyncio.create_task(r.run())
    await asyncio.sleep(0.05)
    await r.up.close()
    await asyncio.wait_for(task, 3)
    assert r.ws.msgs("error") == [{"type": "error", "code": "upstream_closed", "fallback": "text"}]
    assert r.ws.closed_code == 1011
