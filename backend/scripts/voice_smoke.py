"""Live smoke test of the Inworld Realtime upstream, set up exactly as the voice relay does.
Sends session.update (create_response false), a text item and response.create, and confirms audio
deltas arrive. Prints event types and counts only."""
import asyncio
import base64
import json
import sys
import uuid
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.practice_voice import connect_inworld, session_update_message  # noqa: E402


async def main() -> int:
    up = await connect_inworld(
        session_update_message("You are Sam, a warm listener in a role-play rehearsal. Reply in one short sentence.", "Ashley")
    )
    types: Counter[str] = Counter()
    audio_bytes = 0
    try:
        await up.send(json.dumps({
            "type": "conversation.item.create",
            "item": {"type": "message", "role": "user",
                     "content": [{"type": "input_text", "text": "Hi, I have been feeling stressed lately."}]},
        }))
        await up.send(json.dumps({"type": "response.create"}))
        async with asyncio.timeout(20):
            async for raw in up:
                msg = json.loads(raw)
                t = msg.get("type", "?")
                types[t] += 1
                if t == "response.output_audio.delta":
                    audio_bytes += len(base64.b64decode(msg["delta"]))
                if t == "error":
                    print("error event keys:", sorted(msg.get("error", {}).keys()) if isinstance(msg.get("error"), dict) else msg.keys())
                if t == "response.done":
                    r = msg.get("response", {})
                    print("response.done keys:", sorted(r.keys()), "status:", r.get("status"))
                    break
    finally:
        await up.close()
    print("event types:", dict(types))
    print("audio bytes:", audio_bytes)
    ok = types["response.output_audio.delta"] > 0 and audio_bytes > 0
    print("RESULT:", "OK" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
