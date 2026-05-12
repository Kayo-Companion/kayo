"""Family-facing notifications. SMS via Twilio."""

from __future__ import annotations

import logging

from .config import get_settings
from .db import get_db
from .models import AlertSeverity, AlertType, Senior

logger = logging.getLogger(__name__)


async def notify_distress(senior: Senior, call_id: str, summary: str) -> None:
    """Record a distress alert in the DB and SMS the emergency contact.

    Caller is responsible for gating on senior.emergency_on_distress — this
    function unconditionally sends if called (the toggle check lives at the
    call site so the alert row is also gated, not just the SMS).
    """

    settings = get_settings()
    db = get_db()

    # Always record the alert row so the dashboard can show history even
    # if SMS dispatch fails (or the senior has no emergency_contact_phone).
    try:
        await db.create_alert(
            senior_id=senior.id,
            call_id=call_id,
            type_=AlertType.DISTRESS.value,
            severity=AlertSeverity.HIGH.value,
            message=summary,
        )
    except Exception:
        logger.exception("Failed to record distress alert for senior %s", senior.id)

    if not senior.emergency_contact_phone:
        logger.warning(
            "Distress flagged for senior %s but no emergency_contact_phone set — skipping SMS",
            senior.id,
        )
        return

    body = (
        f"【カヨ】{senior.name}さんとの通話で気になる発言がありました。"
        f"ご様子をご確認ください。"
    )
    # Local import to avoid the twilio_handler ↔ notifications circular
    # import that would happen if we imported at module load.
    from .twilio_handler import send_sms

    try:
        await send_sms(to=senior.emergency_contact_phone, body=body)
        logger.warning(
            "Distress SMS sent to %s for senior %s",
            senior.emergency_contact_phone, senior.id,
        )
    except Exception:
        logger.exception("Failed to send distress SMS for senior %s", senior.id)
