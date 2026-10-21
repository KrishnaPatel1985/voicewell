"""WebSocket relay: browser <-> Inworld Realtime (persona voice) with optional Modulate emotion STT.

Three concurrent asyncio tasks run per call: the upstream (Inworld) reader, the client (browser) reader and
the Modulate reader. Whatever closes first, every task is cancelled and every socket is closed.
Nothing the user says is logged; only event types and codes are.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from typing import Any

import numpy as np
from fastapi import WebSocket
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from . import kid, safety
from .auth import user_from_websocket
from .config import settings
from .errors import ApiError
from .practice_text import MAX_PERSONA_TURNS, persona_for, session_prompt, _fallback_line
from .resolver import capabilities
from .store import COOKIE_NAME, store

log = logging.getLogger("voicewell.voice")

WATCHDOG_SECONDS = 8.0
CONNECT_SECONDS = 10.0


# ---------------------------------------------------------------- upstream helpers

def session_update_message(instructions: str, voice: str) -> dict:
    """Spec 6.3. `instructions` is the persona prompt only, never user text."""
    return {
        "type": "session.update",
        "session": {
            "instructions": instructions,
            "model": settings.llm_model,
            "audio": {
                "input": {
                    "transcription": {"model": "inworld/inworld-stt-1"},
                    "turn_detection": {
                        "type": "semantic_vad",
                        "eagerness": "medium",
                        "create_response": False,
                        "interrupt_response": True,
                    },
                },
                "output": {"model": "inworld-tts-2-flash", "voice": voice},
            },
        },
    }


async def _wait_for(conn, wanted: str) -> dict:
    async for raw in conn:
        msg = json.loads(raw)
        t = msg.get("type")
        if t == wanted:
            return msg
        if t == "error":
            err = msg.get("error")
            code = err.get("code") if isinstance(err, dict) else None
            raise RuntimeError(f"inworld error during setup: {code}")
    raise RuntimeError(f"inworld closed before {wanted}")


async def connect_inworld(update_msg: dict):
    """Open the Realtime socket: session.created -> session.update -> session.updated."""
    url = f"{settings.inworld_realtime_url}?key={uuid.uuid4().hex}&protocol=realtime"
    conn = await connect(
        url,
        additional_headers={"Authorization": f"Basic {settings.inworld_realtime_key}"},
        max_size=8 * 1024 * 1024,
        open_timeout=CONNECT_SECONDS,
    )
    try:
        async with asyncio.timeout(CONNECT_SECONDS):
            await _wait_for(conn, "session.created")
            await conn.send(json.dumps(update_msg))
            await _wait_for(conn, "session.updated")
    except BaseException:
        await conn.close()
        raise
    return conn


async def connect_modulate():
    """Best effort. Returns a connection or None."""
    url = (
        f"{settings.modulate_url}?api_key={settings.modulate_api_key}"
        "&audio_format=s16le&sample_rate=16000&num_channels=1&emotion_signal=true"
    )
    try:
        return await connect(url, open_timeout=5, max_size=4 * 1024 * 1024)
    except Exception as exc:  # noqa: BLE001
        log.info("modulate unavailable: %s", type(exc).__name__)
        return None


def downsample_24k_to_16k(pcm: bytes) -> bytes:
    """PCM16 mono 24 kHz -> 16 kHz by linear interpolation."""
    n = len(pcm) // 2
    if n < 2:
        return b""
    x = np.frombuffer(pcm[: n * 2], dtype="<i2").astype(np.float32)
    m = int(n * 2 / 3)
    pos = np.arange(m, dtype=np.float32) * 1.5
    y = np.interp(pos, np.arange(n, dtype=np.float32), x)
    return np.clip(np.rint(y), -32768, 32767).astype("<i2").tobytes()


# ---------------------------------------------------------------- relay

class VoiceRelay:
    def __init__(self, ws: WebSocket, session, persona: dict, tone_on: bool):
        self.ws = ws
        self.session = session
        self.persona = persona
        self.tone_on = tone_on
        self.up = None
        self.mod = None
        self.closing = False
        self.close_code = 1000
        self.client_gone = False
        self.finished = asyncio.Event()
        self.send_lock = asyncio.Lock()
        self.bg: set[asyncio.Task] = set()
        # reply bookkeeping
        self.reply_active = False
        self.current_resp_id: str | None = None
        self.ignored_ids: set[str] = set()
        self.drop_audio = False
        self.assistant_text = ""
        self.last_speak_text = ""
        self.output_flagged = False
        self.expect_opening = False
        self.create_seq = 0
        self.audio_after_create = True
        self.watchdog: asyncio.Task | None = None
        self.fallback_n = 0

    # ---- client side
    async def send_json(self, obj: dict) -> None:
        if self.client_gone:
            return
        async with self.send_lock:
            try:
                await self.ws.send_text(json.dumps(obj))
            except Exception:  # noqa: BLE001 - client went away
                self.client_gone = True

    async def send_audio(self, data: bytes) -> None:
        if self.client_gone:
            return
        async with self.send_lock:
            try:
                await self.ws.send_bytes(data)
            except Exception:  # noqa: BLE001
                self.client_gone = True

    # ---- upstream side
    async def up_send(self, obj: dict) -> None:
        if self.up is None or self.closing:
            return
        try:
            await self.up.send(json.dumps(obj))
        except ConnectionClosed:
            pass  # the upstream reader will notice and report it

    def finish(self, code: int = 1000) -> None:
        if not self.closing:
            self.closing = True
            self.close_code = code
            self.finished.set()

    def spawn(self, coro) -> asyncio.Task:
        t = asyncio.create_task(coro)
        self.bg.add(t)
        t.add_done_callback(self.bg.discard)
        return t

    async def cancel_reply(self) -> None:
        if self.reply_active:
            self.ignore_current()
            await self.up_send({"type": "response.cancel"})
            self.reply_active = False
            await self.send_json({"type": "cancelled"})

    def ignore_current(self) -> None:
        if self.current_resp_id:
            self.ignored_ids.add(self.current_resp_id)
        self.drop_audio = True

    async def speak(self, text: str) -> None:
        self.last_speak_text = text
        self.assistant_text = ""
        self.output_flagged = False
        await self.up_send({"type": "response.speak", "text": text})

    async def safety_stop(self) -> None:
        self.session.practice.safety_stopped = True
        await self.cancel_reply()
        await self.send_json(
            {"type": "safety_stop", "message": safety.support_message(self.session.jurisdiction)}
        )
        self.finish(1000)

    async def create_response(self) -> None:
        self.create_seq += 1
        self.audio_after_create = False
        self.output_flagged = False
        self.assistant_text = ""
        await self.up_send({"type": "response.create"})
        if self.watchdog:
            self.watchdog.cancel()
        self.watchdog = self.spawn(self.watchdog_task(self.create_seq))

    async def watchdog_task(self, seq: int) -> None:
        await asyncio.sleep(WATCHDOG_SECONDS)
        if self.closing or seq != self.create_seq or self.audio_after_create:
            return
        await self.up_send({"type": "response.cancel"})
        line = _fallback_line(self.persona, self.fallback_n)
        self.fallback_n += 1
        self.ignore_current()
        await self.speak(line)

    # ---- upstream events
    async def upstream_reader(self) -> None:
        try:
            async for raw in self.up:
                if self.closing:
                    break
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                await self.on_upstream(msg)
        except ConnectionClosed:
            pass
        if not self.closing:
            await self.send_json({"type": "error", "code": "upstream_closed", "fallback": "text"})
            self.finish(1011)

    async def on_upstream(self, msg: dict) -> None:
        t = msg.get("type")
        p = self.session.practice
        if t == "input_audio_buffer.speech_started":
            await self.send_json({"type": "user_speech_started"})
            if self.reply_active:
                self.ignore_current()
                self.reply_active = False
                await self.send_json({"type": "cancelled"})
        elif t == "conversation.item.input_audio_transcription.delta":
            text = msg.get("delta") or msg.get("transcript") or ""
            if text:
                await self.send_json({"type": "user_transcript", "text": text, "final": False})
        elif t == "conversation.item.input_audio_transcription.completed":
            await self.on_user_final((msg.get("transcript") or "").strip())
        elif t == "response.created":
            resp = msg.get("response") or {}
            self.current_resp_id = resp.get("id")
            self.reply_active = True
            self.drop_audio = False
            self.assistant_text = ""
            self.output_flagged = False
        elif t == "response.output_audio.delta":
            if self._ignored(msg):
                return
            self.reply_active = True
            self.audio_after_create = True
            if self.watchdog:
                self.watchdog.cancel()
            try:
                await self.send_audio(base64.b64decode(msg.get("delta") or ""))
            except ValueError:
                pass
        elif t == "response.output_audio_transcript.delta":
            if self._ignored(msg):
                return
            self.assistant_text += msg.get("delta") or ""
            await self.send_json({"type": "assistant_transcript", "text": msg.get("delta") or "", "final": False})
            if not self.output_flagged and safety.scan_output(self.assistant_text):
                self.output_flagged = True
                await self.cancel_reply()
                await self.speak(self.persona.get("redirect_line", ""))
        elif t == "response.done":
            await self.on_response_done(msg)
        elif t == "error":
            err = msg.get("error")
            code = err.get("code") if isinstance(err, dict) else None
            log.warning("inworld error event code=%s", code)
            await self.send_json({"type": "error", "code": "upstream_error", "fallback": "text"})
            self.finish(1011)

    def _ignored(self, msg: dict) -> bool:
        rid = msg.get("response_id")
        if rid is not None:
            return rid in self.ignored_ids
        return self.drop_audio

    async def on_user_final(self, text: str) -> None:
        if not text or self.closing:
            return
        p = self.session.practice
        await self.send_json({"type": "user_transcript", "text": text, "final": True})
        p.turns.append({"role": "user", "content": text})
        p.last_feedback = None
        kw = safety.keyword_check(text)
        if kw == "self_harm":
            await self.safety_stop()
            return
        if kw == "diagnosis":
            await self.cancel_reply()
            await self.speak(self.persona.get("redirect_line", ""))
            return
        await self.create_response()
        self.spawn(self.classify_task(text))

    async def classify_task(self, text: str) -> None:
        flags = await safety.classify(text)
        if self.closing:
            return
        if flags["self_harm"]:
            await self.safety_stop()
        elif flags["diagnosis_request"]:
            await self.cancel_reply()
            await self.speak(self.persona.get("redirect_line", ""))

    async def on_response_done(self, msg: dict) -> None:
        resp = msg.get("response") or {}
        rid = resp.get("id") or self.current_resp_id
        status = resp.get("status")
        was_ignored = (rid in self.ignored_ids) if rid else False
        text = self.assistant_text.strip()
        if not text:
            for item in resp.get("output") or []:
                for part in (item.get("content") or []) if isinstance(item, dict) else []:
                    if isinstance(part, dict) and part.get("transcript"):
                        text += part["transcript"]
            text = text.strip() or self.last_speak_text.strip()
        self.assistant_text = ""
        self.reply_active = False
        if was_ignored or (status is not None and status != "completed"):
            return  # a cut reply: never counted as a persona turn
        if self.watchdog:
            self.watchdog.cancel()
        p = self.session.practice
        await self.send_json({"type": "assistant_transcript", "text": text, "final": True})
        if text:
            p.turns.append({"role": "assistant", "content": text})
        if self.expect_opening:
            self.expect_opening = False  # the opening line does not count as a persona turn
            return
        p.persona_turn_count += 1
        if p.persona_turn_count >= MAX_PERSONA_TURNS:
            await self.send_json({"type": "done"})
            self.finish(1000)

    # ---- client events
    async def client_reader(self) -> None:
        while True:
            m = await self.ws.receive()
            if m["type"] == "websocket.disconnect":
                self.client_gone = True
                return
            data = m.get("bytes")
            if data:
                await self.on_audio(data)
                continue
            text = m.get("text")
            if text:
                try:
                    obj = json.loads(text)
                except ValueError:
                    continue
                if isinstance(obj, dict) and obj.get("type") == "end":
                    return

    async def on_audio(self, data: bytes) -> None:
        if len(data) < 2 or self.up is None:
            return
        await self.up_send({"type": "input_audio_buffer.append", "audio": base64.b64encode(data).decode()})
        if self.mod is not None:
            try:
                await self.mod.send(downsample_24k_to_16k(data))
            except Exception:  # noqa: BLE001 - Modulate is best effort
                await self._drop_modulate()

    async def _drop_modulate(self) -> None:
        mod, self.mod = self.mod, None
        if mod is not None:
            try:
                await mod.close()
            except Exception:  # noqa: BLE001
                pass

    async def modulate_reader(self) -> None:
        try:
            async for raw in self.mod:
                try:
                    msg = json.loads(raw)
                except (ValueError, TypeError):
                    continue
                if isinstance(msg, dict) and msg.get("type") == "utterance":
                    u = msg.get("utterance")
                    emo = u.get("emotion") if isinstance(u, dict) else None
                    if isinstance(emo, str) and emo:
                        self.session.practice.emotions.append(emo)
        except (WebSocketException, OSError):
            pass
        self.mod = None  # stop sending; the conversation continues without a tone line

    # ---- lifecycle
    async def run(self) -> None:
        readers = [asyncio.create_task(self.upstream_reader()), asyncio.create_task(self.client_reader())]
        mod_task = asyncio.create_task(self.modulate_reader()) if self.mod is not None else None
        waiter = asyncio.create_task(self.finished.wait())
        everything = [*readers, waiter] + ([mod_task] if mod_task else [])
        try:
            done, _ = await asyncio.wait([*readers, waiter], return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                if t is not waiter and not t.cancelled() and t.exception():
                    log.warning("voice reader failed: %s", type(t.exception()).__name__)
                    if not self.closing:
                        await self.send_json({"type": "error", "code": "relay_error", "fallback": "text"})
                        self.close_code = 1011
        finally:
            self.closing = True
            for t in [*everything, *self.bg]:
                t.cancel()
            await asyncio.gather(*everything, *self.bg, return_exceptions=True)
            for conn in (self.up, self.mod):
                if conn is not None:
                    try:
                        await conn.close()
                    except Exception:  # noqa: BLE001
                        pass
            if not self.client_gone:
                try:
                    await self.ws.close(code=self.close_code)
                except Exception:  # noqa: BLE001
                    pass


async def voice_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    user = user_from_websocket(ws)
    if user is None:
        await ws.send_text(json.dumps({"type": "error", "code": "not_authenticated"}))
        await ws.close(code=4401)
        return
    session = store.get_for_user(ws.cookies.get(COOKIE_NAME), user.id)
    if session is None:
        await ws.send_text(json.dumps({"type": "error", "code": "no_session", "fallback": "text"}))
        await ws.close(code=4401)
        return
    try:
        await kid.refresh_permissions(session, force=True, strict=True)
    except ApiError:
        await ws.send_text(json.dumps({"type": "error", "code": "kid_unavailable", "fallback": "text"}))
        await ws.close(code=4503)
        return
    caps = capabilities(session)
    if not caps["voicePractice"]["on"]:
        await ws.send_text(
            json.dumps(
                {"type": "error", "code": "not_permitted", "reason": caps["voicePractice"].get("reason"),
                 "fallback": "text"}
            )
        )
        await ws.close(code=4403)
        return
    p = session.practice
    if p.safety_stopped:
        await ws.send_text(
            json.dumps({"type": "safety_stop", "message": safety.support_message(session.jurisdiction)})
        )
        await ws.close(code=1000)
        return
    if p.persona_turn_count >= MAX_PERSONA_TURNS:
        await ws.send_text(json.dumps({"type": "done"}))
        await ws.close(code=1000)
        return
    try:
        persona = persona_for(session)
    except ApiError as exc:
        await ws.send_text(json.dumps({"type": "error", "code": exc.code, "fallback": "text"}))
        await ws.close(code=1011)
        return

    relay = VoiceRelay(ws, session, persona, caps["toneFeedback"]["on"])
    try:
        relay.up = await connect_inworld(
            session_update_message(session_prompt(session, persona), persona.get("voice", "Ashley"))
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("inworld connect failed: %s", type(exc).__name__)
        await ws.send_text(json.dumps({"type": "error", "code": "upstream_unavailable", "fallback": "text"}))
        await ws.close(code=1011)
        return
    if relay.tone_on:
        relay.mod = await connect_modulate()
    try:
        if not p.turns:
            relay.expect_opening = True
            await relay.speak(persona.get("opening_line", ""))
        await relay.send_json({"type": "ready"})
    except Exception:  # noqa: BLE001
        relay.finish(1011)
    await relay.run()
