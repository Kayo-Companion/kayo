"""APScheduler-based outbound dialer.

Runs once per minute. For each active senior whose schedule contains a
{weekday, time} entry that matches the current minute (in their timezone),
places an outbound call.
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


async def _maybe_call(senior: Senior) -> None:
    from .twilio_handler import place_outbound_call  # avoid circular import

    try:
        tz = pytz.timezone(senior.call_timezone)
    except pytz.UnknownTimeZoneError:
        tz = pytz.timezone("Asia/Tokyo")

    now_local = datetime.now(tz)
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


async def _tick() -> None:
    db = get_db()
    seniors = await db.list_active_seniors()
    for s in seniors:
        try:
            await _maybe_call(s)
        except Exception:
            logger.exception("Scheduler call failed for senior %s", s.id)


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
