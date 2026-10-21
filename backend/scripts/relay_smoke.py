"""Optional live check of the whole relay through the real FastAPI websocket route (in-process).
Creates an in-memory session with voice on, connects, waits for ready, receives the persona's opening
line audio, sends 1 s of silence, then ends. Prints event types and counts only."""
import json
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.store import COOKIE_NAME, store  # noqa: E402

sid, s = store.create()
s.age, s.status, s.intent, s.topic = 45, "pass", "myself", "stress"
s.permissions = {
    "ai-chat": {"enabled": True, "managedBy": "PLAYER"},
    "ai-voice-mode": {"enabled": True, "managedBy": "PLAYER"},
}
s.perms_fetched_at = time.time()

counts: Counter[str] = Counter()
audio = 0
with TestClient(app) as c:
    c.cookies.set(COOKIE_NAME, sid)
    with c.websocket_connect("/api/practice/voice") as ws:
        first = ws.receive_json()
        print("first message:", first["type"])
        deadline = time.time() + 15
        while time.time() < deadline:
            m = ws.receive()
            if m.get("bytes"):
                audio += len(m["bytes"])
                counts["audio"] += 1
            elif m.get("text"):
                t = json.loads(m["text"])["type"]
                counts[t] += 1
                if t == "assistant_transcript" and json.loads(m["text"]).get("final"):
                    break
        for _ in range(25):  # 1 s of silence in 40 ms frames
            ws.send_bytes(b"\x00\x00" * 960)
        ws.send_text(json.dumps({"type": "end"}))
print("counts:", dict(counts), "audio bytes:", audio)
print("persona turns counted (opening must not count):", s.practice.persona_turn_count)
print("RESULT:", "OK" if audio > 0 and counts["assistant_transcript"] > 0 else "FAIL")
