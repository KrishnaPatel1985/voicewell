"""SQLite helpers for accounts, user locale settings, private journals, caregiver invitations, and appointment requests.
Raw practice transcripts and audio are never written here."""
from __future__ import annotations

import secrets
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY,
    country TEXT,
    jurisdiction TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    practiced_at TEXT NOT NULL,
    reflection TEXT NOT NULL,
    useful_phrase TEXT NOT NULL,
    next_step TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT 'self',
    language TEXT NOT NULL DEFAULT 'en',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caregiver_invitations (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    child_user_id TEXT NOT NULL,
    age_group TEXT NOT NULL,
    topic TEXT NOT NULL,
    caregiver_role TEXT NOT NULL,
    what_to_understand TEXT NOT NULL,
    what_support_helps TEXT NOT NULL,
    useful_phrase TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'pending',
    support_action_chosen TEXT,
    viewed_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointment_requests (
    id TEXT PRIMARY KEY,
    request_code TEXT UNIQUE NOT NULL,
    creator_user_id TEXT NOT NULL,
    creator_role TEXT NOT NULL,
    specialist_id TEXT NOT NULL,
    specialist_name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    proposed_at TEXT NOT NULL,
    format TEXT NOT NULL,
    price INTEGER NOT NULL,
    booking_type TEXT NOT NULL,
    appointment_type TEXT NOT NULL DEFAULT 'self',
    purpose_label TEXT NOT NULL,
    information_scope TEXT NOT NULL,
    status TEXT NOT NULL,
    participant_response TEXT NOT NULL DEFAULT 'pending',
    participant_question TEXT,
    guardian_authorized INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'not_started',
    provider_confirmed INTEGER NOT NULL DEFAULT 0,
    agreement_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""

_ready: set[str] = set()


class EmailTaken(Exception):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect() -> sqlite3.Connection:
    """Open the database, creating the folder and tables on first use."""
    path = Path(settings.db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    key = str(path)
    if key not in _ready:
        conn.executescript(SCHEMA)
        conn.commit()
        _ready.add(key)
    return conn


def init_db() -> None:
    """Called on startup so a bad path fails early."""
    with closing(connect()):
        pass


def create_user(email: str, password_hash: str, display_name: str) -> dict:
    """Insert a user. Raises EmailTaken when the (already normalised) email exists."""
    user = {
        "id": uuid.uuid4().hex,
        "email": email,
        "display_name": display_name,
        "created_at": _now_iso(),
    }
    try:
        with closing(connect()) as conn, conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
                (user["id"], email, password_hash, display_name, user["created_at"]),
            )
    except sqlite3.IntegrityError:
        raise EmailTaken() from None
    return user


def _row(sql: str, arg: str) -> dict | None:
    with closing(connect()) as conn:
        row = conn.execute(sql, (arg,)).fetchone()
    return dict(row) if row else None


def get_user_by_email(email: str) -> dict | None:
    return _row("SELECT * FROM users WHERE email = ?", email)


def get_user_by_id(user_id: str) -> dict | None:
    return _row("SELECT * FROM users WHERE id = ?", user_id)


# ---------------------------------------------------------------- user_settings

def get_user_settings(user_id: str) -> dict[str, Any]:
    row = _row("SELECT * FROM user_settings WHERE user_id = ?", user_id)
    if not row:
        return {"country": None, "jurisdiction": None, "language": "en"}
    return {
        "country": row.get("country"),
        "jurisdiction": row.get("jurisdiction"),
        "language": row.get("language") or "en",
    }


def save_user_settings(
    user_id: str,
    country: str | None = None,
    jurisdiction: str | None = None,
    language: str | None = None,
) -> dict[str, Any]:
    current = get_user_settings(user_id)
    next_country = country if country is not None else current["country"]
    next_jur = jurisdiction if jurisdiction is not None else current["jurisdiction"]
    next_lang = language if language is not None else current["language"]
    now = _now_iso()
    with closing(connect()) as conn, conn:
        conn.execute(
            """
            INSERT INTO user_settings (user_id, country, jurisdiction, language, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                country = excluded.country,
                jurisdiction = excluded.jurisdiction,
                language = excluded.language,
                updated_at = excluded.updated_at
            """,
            (user_id, next_country, next_jur, next_lang, now),
        )
    return {"country": next_country, "jurisdiction": next_jur, "language": next_lang}


# ---------------------------------------------------------------- journal_cards

def _format_journal(row: dict) -> dict[str, Any]:
    return {
        "id": row["id"],
        "topic": row["topic"],
        "practicedAt": row["practiced_at"],
        "reflection": row["reflection"],
        "usefulPhrase": row["useful_phrase"],
        "nextStep": row["next_step"],
        "notes": row["notes"],
        "audience": row["audience"],
        "language": row["language"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_journal_cards(user_id: str) -> list[dict[str, Any]]:
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT * FROM journal_cards WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [_format_journal(dict(r)) for r in rows]


def create_journal_card(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = _now_iso()
    cid = uuid.uuid4().hex
    practiced_at = str(data.get("practicedAt") or now)[:64]
    topic = str(data.get("topic") or "Stress and emotions").strip()[:120]
    reflection = str(data.get("reflection") or "").strip()[:1000]
    useful_phrase = str(data.get("usefulPhrase") or "").strip()[:500]
    next_step = str(data.get("nextStep") or "").strip()[:500]
    notes = str(data.get("notes") or "").strip()[:2000]
    audience = str(data.get("audience") or "self")[:40]
    language = str(data.get("language") or "en")[:16]
    with closing(connect()) as conn, conn:
        conn.execute(
            """
            INSERT INTO journal_cards
            (id, user_id, topic, practiced_at, reflection, useful_phrase, next_step, notes, audience, language, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (cid, user_id, topic, practiced_at, reflection, useful_phrase, next_step, notes, audience, language, now, now),
        )
        row = conn.execute("SELECT * FROM journal_cards WHERE id = ?", (cid,)).fetchone()
    return _format_journal(dict(row))


def update_journal_card(user_id: str, card_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    now = _now_iso()
    with closing(connect()) as conn, conn:
        existing = conn.execute(
            "SELECT * FROM journal_cards WHERE id = ? AND user_id = ?",
            (card_id, user_id),
        ).fetchone()
        if not existing:
            return None
        cur = dict(existing)
        topic = str(data.get("topic", cur["topic"])).strip()[:120] or cur["topic"]
        practiced_at = str(data.get("practicedAt", cur["practiced_at"]))[:64]
        reflection = str(data.get("reflection", cur["reflection"])).strip()[:1000]
        useful_phrase = str(data.get("usefulPhrase", cur["useful_phrase"])).strip()[:500]
        next_step = str(data.get("nextStep", cur["next_step"])).strip()[:500]
        notes = str(data.get("notes", cur["notes"])).strip()[:2000]
        audience = str(data.get("audience", cur["audience"]))[:40]
        conn.execute(
            """
            UPDATE journal_cards
            SET topic = ?, practiced_at = ?, reflection = ?, useful_phrase = ?, next_step = ?, notes = ?, audience = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (topic, practiced_at, reflection, useful_phrase, next_step, notes, audience, now, card_id, user_id),
        )
        row = conn.execute("SELECT * FROM journal_cards WHERE id = ?", (card_id,)).fetchone()
    return _format_journal(dict(row))


def delete_journal_card(user_id: str, card_id: str) -> bool:
    with closing(connect()) as conn, conn:
        cur = conn.execute(
            "DELETE FROM journal_cards WHERE id = ? AND user_id = ?",
            (card_id, user_id),
        )
    return cur.rowcount > 0


# ---------------------------------------------------------------- caregiver_invitations

def _check_invite_expiry(row: dict) -> dict:
    if row["status"] in ("pending", "acknowledged"):
        try:
            exp = datetime.fromisoformat(row["expires_at"])
            if datetime.now(timezone.utc) > exp:
                row["status"] = "expired"
                with closing(connect()) as conn, conn:
                    conn.execute(
                        "UPDATE caregiver_invitations SET status = 'expired', updated_at = ? WHERE id = ?",
                        (_now_iso(), row["id"]),
                    )
        except ValueError:
            pass
    return row


def _format_invite(row: dict) -> dict[str, Any]:
    row = _check_invite_expiry(row)
    return {
        "id": row["id"],
        "code": row["code"],
        "ageGroup": row["age_group"],
        "topic": row["topic"],
        "caregiverRole": row["caregiver_role"],
        "whatToUnderstand": row["what_to_understand"],
        "whatSupportHelps": row["what_support_helps"],
        "usefulPhrase": row["useful_phrase"],
        "language": row["language"],
        "status": row["status"],
        "supportActionChosen": row["support_action_chosen"],
        "alreadyViewed": row["viewed_count"] > 0,
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "expiresAt": row["expires_at"],
    }


def create_caregiver_invite(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    expires = (now_dt + timedelta(days=7)).isoformat()
    iid = uuid.uuid4().hex
    code = "CG-" + secrets.token_hex(4).upper()
    age_group = str(data.get("ageGroup") or "kids")[:20]
    topic = str(data.get("topic") or "Stress and emotions").strip()[:120]
    caregiver_role = str(data.get("caregiverRole") or "Parent / Guardian").strip()[:80]
    what_to_understand = str(data.get("whatToUnderstand") or "").strip()[:800]
    what_support_helps = str(data.get("whatSupportHelps") or "").strip()[:800]
    useful_phrase = str(data.get("usefulPhrase") or "").strip()[:400]
    language = str(data.get("language") or "en")[:16]
    with closing(connect()) as conn, conn:
        conn.execute(
            """
            INSERT INTO caregiver_invitations
            (id, code, child_user_id, age_group, topic, caregiver_role, what_to_understand, what_support_helps,
             useful_phrase, language, status, support_action_chosen, viewed_count, created_at, updated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, 0, ?, ?, ?)
            """,
            (
                iid,
                code,
                user_id,
                age_group,
                topic,
                caregiver_role,
                what_to_understand,
                what_support_helps,
                useful_phrase,
                language,
                now,
                now,
                expires,
            ),
        )
        row = conn.execute("SELECT * FROM caregiver_invitations WHERE id = ?", (iid,)).fetchone()
    return _format_invite(dict(row))


def list_caregiver_invites(user_id: str) -> list[dict[str, Any]]:
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT * FROM caregiver_invitations WHERE child_user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [_format_invite(dict(r)) for r in rows]


def revoke_caregiver_invite(user_id: str, code: str) -> dict[str, Any] | None:
    now = _now_iso()
    with closing(connect()) as conn, conn:
        row = conn.execute(
            "SELECT * FROM caregiver_invitations WHERE code = ? AND child_user_id = ?",
            (code, user_id),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE caregiver_invitations SET status = 'revoked', updated_at = ? WHERE code = ? AND child_user_id = ?",
            (now, code, user_id),
        )
        updated = conn.execute("SELECT * FROM caregiver_invitations WHERE code = ?", (code,)).fetchone()
    return _format_invite(dict(updated))


def open_caregiver_invite_by_code(code: str) -> dict[str, Any] | None:
    now = _now_iso()
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT * FROM caregiver_invitations WHERE code = ?", (code,)).fetchone()
        if not row:
            return None
        d = _check_invite_expiry(dict(row))
        if d["status"] in ("revoked", "expired"):
            return _format_invite(d)
        next_status = "acknowledged" if d["status"] == "pending" else d["status"]
        conn.execute(
            """
            UPDATE caregiver_invitations
            SET status = ?, viewed_count = viewed_count + 1, updated_at = ?
            WHERE id = ?
            """,
            (next_status, now, d["id"]),
        )
        updated = conn.execute("SELECT * FROM caregiver_invitations WHERE id = ?", (d["id"],)).fetchone()
    return _format_invite(dict(updated))


def complete_caregiver_invite(code: str, support_action: str) -> dict[str, Any] | None:
    now = _now_iso()
    with closing(connect()) as conn, conn:
        row = conn.execute("SELECT * FROM caregiver_invitations WHERE code = ?", (code,)).fetchone()
        if not row:
            return None
        d = _check_invite_expiry(dict(row))
        if d["status"] in ("revoked", "expired"):
            return _format_invite(d)
        conn.execute(
            """
            UPDATE caregiver_invitations
            SET status = 'completed', support_action_chosen = ?, updated_at = ?
            WHERE id = ?
            """,
            (support_action.strip()[:400], now, d["id"]),
        )
        updated = conn.execute("SELECT * FROM caregiver_invitations WHERE id = ?", (d["id"],)).fetchone()
    return _format_invite(dict(updated))


# ---------------------------------------------------------------- appointment_requests

def _format_appointment(row: dict) -> dict[str, Any]:
    return {
        "id": row["id"],
        "requestCode": row["request_code"],
        "creatorRole": row["creator_role"],
        "specialistId": row["specialist_id"],
        "specialistName": row["specialist_name"],
        "specialty": row["specialty"],
        "proposedAt": row["proposed_at"],
        "format": row["format"],
        "price": row["price"],
        "bookingType": row["booking_type"],
        "appointmentType": row["appointment_type"],
        "purposeLabel": row["purpose_label"],
        "informationScope": row["information_scope"],
        "status": row["status"],
        "participantResponse": row["participant_response"],
        "participantQuestion": row["participant_question"],
        "guardianAuthorized": bool(row["guardian_authorized"]),
        "paymentStatus": row["payment_status"],
        "providerConfirmed": bool(row["provider_confirmed"]),
        "agreementVersion": row["agreement_version"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def create_appointment_request(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    now = _now_iso()
    aid = uuid.uuid4().hex
    code = "APT-" + secrets.token_hex(3).upper()
    booking_type = str(data.get("bookingType") or "adult_self")
    if booking_type == "adult_child_invite":
        status = "PENDING_CHILD_RESPONSE"
        participant_response = "pending"
        guardian_authorized = 1
    elif booking_type == "child_guardian_request":
        status = "PENDING_GUARDIAN_APPROVAL"
        participant_response = "agreed"
        guardian_authorized = 0
    else:
        status = "REQUEST_SUBMITTED"
        participant_response = "self"
        guardian_authorized = 1

    with closing(connect()) as conn, conn:
        conn.execute(
            """
            INSERT INTO appointment_requests
            (id, request_code, creator_user_id, creator_role, specialist_id, specialist_name, specialty,
             proposed_at, format, price, booking_type, appointment_type, purpose_label, information_scope,
             status, participant_response, participant_question, guardian_authorized, payment_status,
             provider_confirmed, agreement_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'not_started', 0, 1, ?, ?)
            """,
            (
                aid,
                code,
                user_id,
                str(data.get("creatorRole") or "adult"),
                str(data.get("specialistId") or "sp-1"),
                str(data.get("specialistName") or "Dr. Maya Lin"),
                str(data.get("specialty") or "Stress & Family Communication"),
                str(data.get("proposedAt") or now),
                str(data.get("format") or "Video"),
                int(data.get("price") or 95),
                booking_type,
                str(data.get("appointmentType") or "self"),
                str(data.get("purposeLabel") or "").strip()[:600],
                str(data.get("informationScope") or "Specialist, proposed time, attendees, and general purpose").strip()[:600],
                status,
                participant_response,
                guardian_authorized,
                now,
                now,
            ),
        )
        row = conn.execute("SELECT * FROM appointment_requests WHERE id = ?", (aid,)).fetchone()
    return _format_appointment(dict(row))


def list_appointment_requests(user_id: str) -> list[dict[str, Any]]:
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT * FROM appointment_requests WHERE creator_user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [_format_appointment(dict(r)) for r in rows]


def get_appointment_request(req_id: str) -> dict[str, Any] | None:
    row = _row("SELECT * FROM appointment_requests WHERE id = ? OR request_code = ?", req_id)
    if not row:
        with closing(connect()) as conn:
            r2 = conn.execute(
                "SELECT * FROM appointment_requests WHERE id = ? OR request_code = ?",
                (req_id, req_id),
            ).fetchone()
        row = dict(r2) if r2 else None
    return _format_appointment(row) if row else None


def respond_to_appointment(req_id: str, response: str, question: str | None = None) -> dict[str, Any] | None:
    now = _now_iso()
    with closing(connect()) as conn, conn:
        row = conn.execute(
            "SELECT * FROM appointment_requests WHERE id = ? OR request_code = ?",
            (req_id, req_id),
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        if response == "accept":
            next_status = "PARTICIPANT_AGREED"
            part_resp = "accept"
        elif response == "more_information":
            next_status = "QUESTIONS_REQUESTED"
            part_resp = "more_information"
        else:
            next_status = "DECLINED"
            part_resp = "decline"
        conn.execute(
            """
            UPDATE appointment_requests
            SET status = ?, participant_response = ?, participant_question = ?, updated_at = ?
            WHERE id = ?
            """,
            (next_status, part_resp, (question or "").strip()[:500] or None, now, d["id"]),
        )
        updated = conn.execute("SELECT * FROM appointment_requests WHERE id = ?", (d["id"],)).fetchone()
    return _format_appointment(dict(updated))


def update_appointment_scope(
    user_id: str,
    req_id: str,
    information_scope: str,
    proposed_at: str | None = None,
    appointment_type: str | None = None,
) -> dict[str, Any] | None:
    """Changing details or sharing scope bumps agreement_version and resets child agreement to pending."""
    now = _now_iso()
    with closing(connect()) as conn, conn:
        row = conn.execute(
            "SELECT * FROM appointment_requests WHERE id = ? AND creator_user_id = ?",
            (req_id, user_id),
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        next_ver = int(d["agreement_version"]) + 1
        next_time = proposed_at or d["proposed_at"]
        next_type = appointment_type or d["appointment_type"]
        conn.execute(
            """
            UPDATE appointment_requests
            SET information_scope = ?, proposed_at = ?, appointment_type = ?,
                status = 'PENDING_CHILD_RESPONSE', participant_response = 'pending',
                agreement_version = ?, updated_at = ?
            WHERE id = ?
            """,
            (information_scope.strip()[:600], next_time, next_type, next_ver, now, d["id"]),
        )
        updated = conn.execute("SELECT * FROM appointment_requests WHERE id = ?", (d["id"],)).fetchone()
    return _format_appointment(dict(updated))


def authorize_child_appointment_by_guardian(req_id: str, action: str) -> dict[str, Any] | None:
    now = _now_iso()
    with closing(connect()) as conn, conn:
        row = conn.execute(
            "SELECT * FROM appointment_requests WHERE id = ? OR request_code = ?",
            (req_id, req_id),
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        if action == "approve":
            conn.execute(
                """
                UPDATE appointment_requests
                SET status = 'REQUEST_SUBMITTED', guardian_authorized = 1, payment_status = 'guardian_approved', updated_at = ?
                WHERE id = ?
                """,
                (now, d["id"]),
            )
        else:
            conn.execute(
                """
                UPDATE appointment_requests
                SET status = 'DECLINED', guardian_authorized = 0, updated_at = ?
                WHERE id = ?
                """,
                (now, d["id"]),
            )
        updated = conn.execute("SELECT * FROM appointment_requests WHERE id = ?", (d["id"],)).fetchone()
    return _format_appointment(dict(updated))
