"""Supabase data layer with an in-memory fallback for local dev.

The fallback exists so the voice service can run end-to-end on a developer
laptop without Supabase configured — useful for trying the audio bridge
against a single hardcoded senior loaded from env / fixtures.
"""

from __future__ import annotations

import asyncio
import logging
import math
import uuid
from datetime import UTC, datetime, time
from typing import Any, Protocol

from supabase import AsyncClient, create_async_client

from .config import get_settings
from .models import Call, CallStatus, CallSummary, ScheduleEntry, Senior

logger = logging.getLogger(__name__)


class DB(Protocol):
    async def get_senior(self, senior_id: str) -> Senior | None: ...
    async def find_senior_by_phone(self, phone: str) -> Senior | None: ...
    async def list_active_seniors(self) -> list[Senior]: ...
    async def create_call(self, senior_id: str) -> Call: ...
    async def finalize_call(
        self,
        call_id: str,
        transcript: list[dict[str, Any]],
        distress_detected: bool,
        distress_reason: str | None,
        openai_usage: dict[str, int] | None = None,
        openai_cost_usd: float | None = None,
    ) -> None: ...
    async def update_call_summary(self, call_id: str, summary: CallSummary) -> None: ...
    async def get_recent_summaries(self, senior_id: str, limit: int = 5) -> list[str]: ...
    async def append_long_term_facts(
        self, senior_id: str, new_facts: list[str]
    ) -> None: ...
    async def create_alert(
        self, senior_id: str, call_id: str, type_: str, severity: str, message: str
    ) -> None: ...
    async def family_has_minutes(self, family_id: str) -> bool: ...
    async def increment_minutes_used(self, family_id: str, minutes: int) -> None: ...
    async def get_family_email(self, family_id: str) -> str | None: ...


def _coerce_schedule(raw: Any) -> list[ScheduleEntry]:
    """Parse the JSONB `schedule` column into ScheduleEntry models."""
    if not raw:
        return []
    out: list[ScheduleEntry] = []
    for item in raw:
        wd = item.get("weekday")
        t = item.get("time")
        if not wd or not t:
            continue
        if isinstance(t, str):
            hh, mm, *_ = t.split(":")
            t = time(int(hh), int(mm))
        out.append(ScheduleEntry(weekday=wd, time=t))
    return out


class SupabaseDB:
    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    @staticmethod
    def _row_to_senior(row: dict[str, Any]) -> Senior:
        return Senior(
            id=row["id"],
            family_id=row["family_id"],
            name=row["name"],
            phone=row["phone"],
            schedule=_coerce_schedule(row.get("schedule")),
            call_timezone=row.get("call_timezone", "Asia/Tokyo"),
            is_self=row.get("is_self", False),
            introducer_name=row.get("introducer_name"),
            introducer_relationship=row.get("introducer_relationship"),
            health_notes=row.get("health_notes"),
            is_active=row.get("is_active", True),
            agent_name=row.get("agent_name"),
            long_term_facts=row.get("long_term_facts") or [],
            emergency_contact_phone=row.get("emergency_contact_phone"),
            emergency_on_no_answer=row.get("emergency_on_no_answer", False),
        )

    async def get_senior(self, senior_id: str) -> Senior | None:
        res = (
            await self._client.table("seniors")
            .select("*")
            .eq("id", senior_id)
            .maybe_single()
            .execute()
        )
        return self._row_to_senior(res.data) if res.data else None

    async def find_senior_by_phone(self, phone: str) -> Senior | None:
        res = (
            await self._client.table("seniors")
            .select("*")
            .eq("phone", phone)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
        return self._row_to_senior(res.data) if res.data else None

    async def list_active_seniors(self) -> list[Senior]:
        res = await self._client.table("seniors").select("*").eq("is_active", True).execute()
        return [self._row_to_senior(r) for r in (res.data or [])]

    async def create_call(self, senior_id: str) -> Call:
        call_id = str(uuid.uuid4())
        now = datetime.now(UTC)
        await self._client.table("calls").insert(
            {
                "id": call_id,
                "senior_id": senior_id,
                "started_at": now.isoformat(),
                "status": CallStatus.IN_PROGRESS.value,
            }
        ).execute()
        return Call(id=call_id, senior_id=senior_id, started_at=now)

    async def finalize_call(
        self,
        call_id: str,
        transcript: list[dict[str, Any]],
        distress_detected: bool,
        distress_reason: str | None,
        openai_usage: dict[str, int] | None = None,
        openai_cost_usd: float | None = None,
    ) -> None:
        ended_at = datetime.now(UTC)
        update: dict[str, Any] = {
            "ended_at": ended_at.isoformat(),
            "transcript": transcript,
            "status": CallStatus.COMPLETED.value,
            "distress_detected": distress_detected,
            "distress_reason": distress_reason,
        }
        if openai_usage is not None:
            update["openai_usage"] = openai_usage
        if openai_cost_usd is not None:
            update["openai_cost_usd"] = openai_cost_usd
        try:
            await self._client.table("calls").update(update).eq("id", call_id).execute()
        except Exception as exc:
            # If the openai_* columns aren't migrated yet, retry without them
            # so the call still finalizes.
            if "openai_usage" in str(exc) or "openai_cost_usd" in str(exc):
                update.pop("openai_usage", None)
                update.pop("openai_cost_usd", None)
                await self._client.table("calls").update(update).eq("id", call_id).execute()
            else:
                raise

    async def update_call_summary(self, call_id: str, summary: CallSummary) -> None:
        await self._client.table("calls").update(
            {
                "summary": summary.summary,
                "topics_discussed": summary.topics,
                "mood": summary.mood.value,
                "distress_detected": summary.distress_detected,
                "distress_reason": summary.distress_reason,
            }
        ).eq("id", call_id).execute()

    async def get_recent_summaries(self, senior_id: str, limit: int = 5) -> list[str]:
        res = (
            await self._client.table("calls")
            .select("summary")
            .eq("senior_id", senior_id)
            .not_.is_("summary", "null")
            .order("started_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [r["summary"] for r in (res.data or []) if r.get("summary")]

    async def append_long_term_facts(
        self, senior_id: str, new_facts: list[str]
    ) -> None:
        """Append + dedupe long-term facts on a senior row.

        Reads the current list, merges in new facts (case-insensitive dedup
        on stripped text), and writes back. Race-prone if two calls finalize
        simultaneously for the same senior, but that's vanishingly rare and
        the loss is at most a handful of facts.
        """
        if not new_facts:
            return
        res = (
            await self._client.table("seniors")
            .select("long_term_facts")
            .eq("id", senior_id)
            .maybe_single()
            .execute()
        )
        existing: list[str] = (res.data or {}).get("long_term_facts") or []
        # Case-insensitive dedup; preserve original casing of first occurrence.
        seen = {f.strip().lower() for f in existing if f and f.strip()}
        for f in new_facts:
            k = (f or "").strip()
            if not k or k.lower() in seen:
                continue
            existing.append(k)
            seen.add(k.lower())
        try:
            await self._client.table("seniors").update(
                {"long_term_facts": existing}
            ).eq("id", senior_id).execute()
        except Exception as exc:
            # Column may not be migrated yet on this database.
            if "long_term_facts" in str(exc):
                logger.warning(
                    "long_term_facts column missing; skipping fact persistence"
                )
                return
            raise

    async def create_alert(
        self, senior_id: str, call_id: str, type_: str, severity: str, message: str
    ) -> None:
        await self._client.table("alerts").insert(
            {
                "senior_id": senior_id,
                "call_id": call_id,
                "type": type_,
                "severity": severity,
                "message": message,
            }
        ).execute()

    async def family_has_minutes(self, family_id: str) -> bool:
        res = (
            await self._client.table("families")
            .select("minutes_limit, minutes_used")
            .eq("id", family_id)
            .maybe_single()
            .execute()
        )
        if not res.data:
            return False
        return res.data["minutes_used"] < res.data["minutes_limit"]

    async def increment_minutes_used(self, family_id: str, minutes: int) -> None:
        # Postgres-side atomic increment via raw SQL would be cleanest; for now
        # do read-then-write — concurrency for a single family is low.
        res = (
            await self._client.table("families")
            .select("minutes_used")
            .eq("id", family_id)
            .maybe_single()
            .execute()
        )
        if not res.data:
            return
        new_used = (res.data["minutes_used"] or 0) + minutes
        await self._client.table("families").update({"minutes_used": new_used}).eq(
            "id", family_id
        ).execute()

    async def get_family_email(self, family_id: str) -> str | None:
        res = (
            await self._client.table("families")
            .select("email")
            .eq("id", family_id)
            .maybe_single()
            .execute()
        )
        return res.data.get("email") if res.data else None


class InMemoryDB:
    """Dev fallback. Holds a single senior wired up via env or test fixture."""

    def __init__(self) -> None:
        self._seniors: dict[str, Senior] = {}
        self._calls: dict[str, Call] = {}
        self._summaries: dict[str, list[str]] = {}
        self._minutes_used: dict[str, int] = {}
        self._minutes_limit: dict[str, int] = {}
        self._lock = asyncio.Lock()

    def upsert_senior(self, senior: Senior) -> None:
        self._seniors[senior.id] = senior

    async def get_senior(self, senior_id: str) -> Senior | None:
        return self._seniors.get(senior_id)

    async def find_senior_by_phone(self, phone: str) -> Senior | None:
        for s in self._seniors.values():
            if s.phone == phone and s.is_active:
                return s
        return None

    async def list_active_seniors(self) -> list[Senior]:
        return [s for s in self._seniors.values() if s.is_active]

    async def create_call(self, senior_id: str) -> Call:
        async with self._lock:
            call = Call(
                id=str(uuid.uuid4()),
                senior_id=senior_id,
                started_at=datetime.now(UTC),
                status=CallStatus.IN_PROGRESS,
            )
            self._calls[call.id] = call
            return call

    async def finalize_call(
        self,
        call_id: str,
        transcript: list[dict[str, Any]],
        distress_detected: bool,
        distress_reason: str | None,
        openai_usage: dict[str, int] | None = None,
        openai_cost_usd: float | None = None,
    ) -> None:
        call = self._calls.get(call_id)
        if not call:
            return
        call.ended_at = datetime.now(UTC)
        call.transcript = transcript
        call.status = CallStatus.COMPLETED
        call.distress_detected = distress_detected
        call.distress_reason = distress_reason

    async def update_call_summary(self, call_id: str, summary: CallSummary) -> None:
        call = self._calls.get(call_id)
        if not call:
            return
        call.summary = summary.summary
        call.topics_discussed = summary.topics
        call.mood = summary.mood
        self._summaries.setdefault(call.senior_id, []).append(summary.summary)

    async def get_recent_summaries(self, senior_id: str, limit: int = 5) -> list[str]:
        return list(reversed(self._summaries.get(senior_id, [])))[:limit]

    async def append_long_term_facts(
        self, senior_id: str, new_facts: list[str]
    ) -> None:
        senior = self._seniors.get(senior_id)
        if not senior:
            return
        seen = {f.strip().lower() for f in senior.long_term_facts if f and f.strip()}
        for f in new_facts:
            k = (f or "").strip()
            if k and k.lower() not in seen:
                senior.long_term_facts.append(k)
                seen.add(k.lower())

    async def create_alert(
        self, senior_id: str, call_id: str, type_: str, severity: str, message: str
    ) -> None:
        logger.info("ALERT [%s/%s] senior=%s: %s", type_, severity, senior_id, message)

    async def family_has_minutes(self, family_id: str) -> bool:
        used = self._minutes_used.get(family_id, 0)
        limit = self._minutes_limit.get(family_id, 400)
        return used < limit

    async def increment_minutes_used(self, family_id: str, minutes: int) -> None:
        self._minutes_used[family_id] = self._minutes_used.get(family_id, 0) + minutes

    async def get_family_email(self, family_id: str) -> str | None:
        return None


_db: DB | None = None


async def init_db() -> None:
    global _db
    settings = get_settings()
    if settings.supabase_url and settings.supabase_service_role_key:
        client = await create_async_client(
            settings.supabase_url, settings.supabase_service_role_key
        )
        _db = SupabaseDB(client)
        logger.info("Initialized Supabase DB")
    else:
        _db = InMemoryDB()
        logger.warning("Supabase not configured — using in-memory DB (dev only)")


def get_db() -> DB:
    if _db is None:
        raise RuntimeError("DB not initialized; call init_db() at startup")
    return _db


def minutes_for_call(started_at: datetime, ended_at: datetime) -> int:
    """Round up to the next whole minute, matching how Twilio bills."""
    secs = max(0, int((ended_at - started_at).total_seconds()))
    return math.ceil(secs / 60) if secs > 0 else 0
