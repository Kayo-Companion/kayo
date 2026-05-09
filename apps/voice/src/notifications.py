"""Family-facing notifications. SMS via Twilio (when family.phone is known)."""

from __future__ import annotations

import logging

from .config import get_settings
from .db import get_db
from .models import AlertSeverity, AlertType, Senior

logger = logging.getLogger(__name__)


async def notify_distress(senior: Senior, call_id: str, summary: str) -> None:
    """Record a distress alert in the DB. SMS dispatch is best-effort.

    The emergency_contact_phone column was removed; for now we just log the
    alert and rely on the family seeing it in the dashboard. Once we wire up
    the family.phone column we can resume SMS dispatch.
    """

    settings = get_settings()
    db = get_db()
    message = (
        f"【カヨ】{senior.name}様の通話で気になる発言がありました。\n"
        f"詳細: {settings.dashboard_url}/seniors/{senior.id}"
    )

    await db.create_alert(
        senior_id=senior.id,
        call_id=call_id,
        type_=AlertType.DISTRESS.value,
        severity=AlertSeverity.HIGH.value,
        message=summary,
    )
    logger.warning("Distress alert recorded for senior %s — %s", senior.id, message)
