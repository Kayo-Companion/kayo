"""APScheduler-based outbound dialer + daily safety check.

Runs once per minute. For each active senior:

1. **Outbound dialer**: if the senior's schedule contains a {weekday, time}
   entry matching this minute (in their timezone), place an outbound call.

2. **Daily safety check (安否確認モード)**: if the senior has
   daily_check_deadline set and this minute matches that deadline (in
   their TZ), check whether ANY real call has happened with them today.
   If not, send an SMS to their emergency contact.
"""

from __future__ import annotations

import logging
from datetime import datetime

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import get_settings
from .db import get_db
from .models import Senior

logger = logging.getLogger(__name__)

_WEEKDAY_INDEX = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


async def _maybe_call(senior: Senior, now_local: datetime) -> None:
    from .twilio_handler import place_outbound_call  # avoid circular import

    today_idx = now_local.weekday()
    for entry in senior.schedule:
        if (
            _WEEKDAY_INDEX[entry.weekday] == today_idx
            and entry.time.hour == now_local.hour
            and entry.time.minute == now_local.minute
        ):
            logger.info(
                "Tick matches senior %s (%s %02d:%02d) — placing call",
                senior.id,
                entry.weekday,
                entry.time.hour,
                entry.time.minute,
            )
            await place_outbound_call(senior_id=senior.id, to_number=senior.phone)
            return  # one call per tick max, even if multiple entries collide


async def _maybe_daily_check(senior: Senior, now_local: datetime) -> None:
    """If now is the senior's daily-check deadline AND no real call has
    happened today, SMS the emergency contact."""
    if not senior.daily_check_deadline:
        return
    if not senior.emergency_contact_phone:
        return
    try:
        deadline_h_s, deadline_m_s = senior.daily_check_deadline.split(":", 1)
        deadline_h = int(deadline_h_s)
        deadline_m = int(deadline_m_s)
    except (ValueError, AttributeError):
        logger.warning(
            "Senior %s has malformed daily_check_deadline=%r — skipping",
            senior.id, senior.daily_check_deadline,
        )
        return
    if now_local.hour != deadline_h or now_local.minute != deadline_m:
        return

    # Has any real call happened today (in this senior's TZ)?
    from .twilio_handler import send_sms  # avoid circular import

    db = get_db()
    today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_utc = today_start_local.astimezone(pytz.UTC).replace(tzinfo=None)
    # Make it tz-aware UTC for the DB query.
    today_start_utc = today_start_local.astimezone(pytz.UTC)

    had_call = await db.had_real_call_since(senior.id, today_start_utc)
    if had_call:
        logger.info(
            "Daily-check OK for senior %s (deadline %s) — a call happened today",
            senior.id, senior.daily_check_deadline,
        )
        return

    body = (
        f"【カヨ】{senior.name}さんと本日まだ一度も通話がありません。"
        f"ご連絡を確認してみてください。"
    )
    try:
        await send_sms(to=senior.emergency_contact_phone, body=body)
        logger.warning(
            "Daily-check SMS sent for senior %s to %s",
            senior.id, senior.emergency_contact_phone,
        )
    except Exception:
        logger.exception("Failed to send daily-check SMS for senior %s", senior.id)


async def _tick() -> None:
    db = get_db()
    seniors = await db.list_active_seniors()
    for s in seniors:
        try:
            tz = pytz.timezone(s.call_timezone)
        except pytz.UnknownTimeZoneError:
            tz = pytz.timezone("Asia/Tokyo")
        now_local = datetime.now(tz)
        try:
            await _maybe_call(s, now_local)
        except Exception:
            logger.exception("Scheduler call failed for senior %s", s.id)
        try:
            await _maybe_daily_check(s, now_local)
        except Exception:
            logger.exception("Daily-check failed for senior %s", s.id)


def build_scheduler() -> AsyncIOScheduler:
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone=settings.scheduler_timezone)
    scheduler.add_job(
        _tick,
        trigger=CronTrigger(second=0),  # every minute, on the second 0
        id="kayo-dialer",
        max_instances=1,
        coalesce=True,
    )
    return scheduler
