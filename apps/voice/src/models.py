"""Pydantic models for the call/senior/family domain."""

from __future__ import annotations

from datetime import datetime, time
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class ScheduleEntry(BaseModel):
    weekday: Weekday
    time: time


class Mood(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class CallStatus(str, Enum):
    INITIATED = "initiated"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NO_ANSWER = "no_answer"
    FAILED = "failed"


class AlertType(str, Enum):
    DISTRESS = "distress"
    HEALTH = "health"
    NO_ANSWER = "no_answer"
    SUSPICIOUS = "suspicious"


class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Senior(BaseModel):
    id: str
    family_id: str
    name: str
    phone: str
    schedule: list[ScheduleEntry] = Field(default_factory=list)
    call_timezone: str = "Asia/Tokyo"
    is_self: bool = False
    introducer_name: str | None = None
    introducer_relationship: str | None = None
    health_notes: str | None = None  # free-text "話したいこと"
    is_active: bool = True
    # Custom AI-agent name; None = fall back to the product default (カヨ).
    agent_name: str | None = None
    # Long-term facts the agent should remember across calls (likes baseball,
    # wife is カヨコ, etc.). Appended after each call by the summarizer with
    # dedup. Distinct from recent-call summaries which are short-term.
    long_term_facts: list[str] = Field(default_factory=list)
    # 安否確認モード ("Safety check mode") — two independent triggers,
    # both SMS to emergency_contact_phone:
    #
    # 1. Per-call: when an outbound call ends with no-answer / busy /
    #    failed / voicemail AND emergency_on_no_answer is True.
    # 2. Daily: if NO call (in or out, with real conversation) has
    #    happened by daily_check_deadline (HH:MM in the senior's TZ).
    #    NULL = daily-check disabled.
    emergency_contact_phone: str | None = None
    emergency_on_no_answer: bool = False
    daily_check_deadline: str | None = None  # "HH:MM" or None


class Family(BaseModel):
    id: str
    user_id: str
    name: str
    email: str | None = None
    phone: str | None = None
    subscription_status: str = "inactive"
    minutes_limit: int = 400
    minutes_used: int = 0


class Call(BaseModel):
    id: str
    senior_id: str
    twilio_call_sid: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: int | None = None
    status: CallStatus = CallStatus.INITIATED
    summary: str | None = None
    topics_discussed: list[str] = Field(default_factory=list)
    mood: Mood | None = None
    distress_detected: bool = False
    distress_reason: str | None = None
    transcript: list[dict[str, Any]] = Field(default_factory=list)


class CallSummary(BaseModel):
    """LLM-generated summary returned by memory.summarize_call."""

    summary: str
    topics: list[str]
    mood: Mood
    distress_detected: bool
    distress_reason: str | None = None
