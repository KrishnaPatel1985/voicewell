"""Demo accounts for reviewers: fixed logins that skip the k-ID age check and start with AI chat and voice on.
Only active when DEMO_ACCOUNTS=1. These are fake, adult-owned test accounts; real sign-ups still go through k-ID."""
from __future__ import annotations

import logging
import os
import time

from . import db
from .store import set_cookie, store

log = logging.getLogger("voicewell.demo")

DEMO_PASSWORD = "test123456"
# email -> (display name, age)
DEMO_ACCOUNTS = {
    "kid@gmail.com": ("Kid Demo", 9),
    "teen@gmail.com": ("Teen Demo", 15),
    "adult@gmail.com": ("Adult Demo", 35),
}


def enabled() -> bool:
    return os.environ.get("DEMO_ACCOUNTS", "") == "1"


def seed() -> None:
    """Create the demo users if they are missing (the free-tier database resets on every deploy)."""
    if not enabled():
        return
    from .auth import hash_password

    for email, (name, _age) in DEMO_ACCOUNTS.items():
        if db.get_user_by_email(email) is None:
            db.create_user(email, hash_password(DEMO_PASSWORD), name)
    log.info("demo accounts ready")


def start_session(request, response, user: dict) -> bool:
    """Give a demo user a ready session. Returns True if this was a demo account."""
    demo = DEMO_ACCOUNTS.get(user["email"]) if enabled() else None
    if demo is None:
        return False
    sid, s = store.create()
    s.user_id = user["id"]
    s.status = "pass"
    s.permissions = {
        "ai-chat": {"enabled": True, "managedBy": "PLAYER"},
        "ai-voice-mode": {"enabled": True, "managedBy": "PLAYER"},
    }
    s.perms_ok = True
    s.perms_fetched_at = time.time() + 10 * 365 * 24 * 3600  # no k-ID session to re-read
    s.country, s.jurisdiction, s.language = "US", "US", "en"
    s.age = demo[1]
    s.intent, s.topic = "myself", "hard-day"
    set_cookie(response, sid)
    return True
