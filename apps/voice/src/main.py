"""FastAPI entrypoint for the Kayo voice service.

Routes:
  POST /twilio/incoming  — Twilio Webhook → TwiML
  WS   /twilio/stream    — Twilio Media Streams → OpenAI Realtime bridge
  POST /admin/test-call  — manual outbound trigger (dev only)
  GET  /healthz          — liveness for Railway

The scheduler ticks once per minute for outbound calls.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import sentry_sdk
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from sentry_sdk.integrations.fastapi import FastApiIntegration

import uuid
from datetime import time as dt_time

from .config import get_settings
from .db import InMemoryDB, get_db, init_db
from .models import ScheduleEntry, Senior
from .scheduler import build_scheduler
from .twilio_handler import place_outbound_call, router as twilio_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if settings.sentry_dsn_voice:
        sentry_sdk.init(
            dsn=settings.sentry_dsn_voice,
            environment=settings.env,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
        )
        logger.info("Sentry initialized")

    await init_db()

    scheduler = build_scheduler() if settings.enable_scheduler else None
    if scheduler:
        scheduler.start()
        logger.info("Scheduler started (tz=%s)", settings.scheduler_timezone)

    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)


app = FastAPI(title="Kayo Voice", lifespan=lifespan)
app.include_router(twilio_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


class TestCallRequest(BaseModel):
    senior_id: str
    to_number: str


@app.post("/admin/test-call")
async def test_call(payload: TestCallRequest) -> dict[str, str]:
    """Manually trigger an outbound call. For dev/staging — guard in prod."""
    settings = get_settings()
    if settings.env == "production":
        raise HTTPException(status_code=403, detail="disabled in production")
    db = get_db()
    if await db.get_senior(payload.senior_id) is None:
        raise HTTPException(status_code=404, detail="senior not found")
    sid = await place_outbound_call(
        senior_id=payload.senior_id,
        to_number=payload.to_number,
        manual=True,
    )
    return {"call_sid": sid}


class QuickTestCallRequest(BaseModel):
    """Single-shot test: seeds an in-memory senior and dials it.

    Use this when you just want to hear Kayo on your phone without setting up
    Supabase. Requires the in-memory DB (i.e. SUPABASE_URL not configured).
    """

    to_number: str
    name: str = "テスト 太郎"
    is_self: bool = True
    introducer_name: str | None = None
    introducer_relationship: str | None = None
    about: str | None = None  # free-text personal context


class StartCallRequest(BaseModel):
    """Authenticated 'call now' from the dashboard. Looks up the senior, checks
    minute quota, places the outbound call.
    """

    senior_id: str


@app.post("/calls/start")
async def calls_start(
    payload: StartCallRequest,
    x_api_key: str | None = Header(default=None),
) -> dict[str, str]:
    settings = get_settings()
    if not settings.internal_api_key or x_api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="invalid_api_key")

    db = get_db()
    senior = await db.get_senior(payload.senior_id)
    if senior is None:
        raise HTTPException(status_code=404, detail="senior_not_found")
    if not senior.is_active:
        raise HTTPException(status_code=409, detail="senior_inactive")

    # Dashboard "今すぐ電話" button — user is at the phone right now,
    # so we skip AMD for the fastest path to first audio.
    sid = await place_outbound_call(
        senior_id=senior.id, to_number=senior.phone, manual=True
    )
    return {"call_sid": sid}


@app.post("/admin/test-call-now")
async def test_call_now(payload: QuickTestCallRequest) -> dict[str, str]:
    settings = get_settings()
    if settings.env == "production":
        raise HTTPException(status_code=403, detail="disabled in production")

    db = get_db()
    if not isinstance(db, InMemoryDB):
        raise HTTPException(
            status_code=400,
            detail="quick test requires in-memory DB (unset SUPABASE_URL)",
        )

    senior = Senior(
        id=str(uuid.uuid4()),
        family_id=str(uuid.uuid4()),
        name=payload.name,
        phone=payload.to_number,
        schedule=[ScheduleEntry(weekday="mon", time=dt_time(9, 0))],
        is_self=payload.is_self,
        introducer_name=payload.introducer_name,
        introducer_relationship=payload.introducer_relationship,
        health_notes=payload.about,
    )
    db.upsert_senior(senior)

    # Quota-bypass: dev test endpoint shouldn't be gated by minute limits.
    # Treated as manual (no AMD) for speed.
    sid = await place_outbound_call(
        senior_id=senior.id,
        to_number=payload.to_number,
        enforce_quota=False,
        manual=True,
    )
    return {"call_sid": sid, "senior_id": senior.id}
