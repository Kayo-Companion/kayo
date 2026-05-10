"""Model-aware prompt builder for Kayo.

Per-model template content lives in:
  - prompts_mini.py        (gpt-realtime-mini)
  - prompts_realtime2.py   (gpt-realtime-2)

This module owns the shared utilities (schedule formatting, next-call
phrasing, opening-script generation) and selects the right template
based on the configured OpenAI model.

The only model-specific content right now is the system instructions
template (`KAYO_SYSTEM_PROMPT_TEMPLATE`) and the opening-greeting meta-
instructions (`OPENING_INSTRUCTIONS_TEMPLATE`). The greeting *script*
that Kayo actually reads (the audible opening line) is shared because
it's business logic, not model tuning.
"""

from __future__ import annotations

from datetime import datetime

import pytz

from . import prompts_mini, prompts_realtime2
from .models import ScheduleEntry, Senior

_WEEKDAY_JP = {
    "mon": "月曜日",
    "tue": "火曜日",
    "wed": "水曜日",
    "thu": "木曜日",
    "fri": "金曜日",
    "sat": "土曜日",
    "sun": "日曜日",
}

_WEEKDAY_INDEX = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _format_time_jp(t: object) -> str:
    """Format a `datetime.time` into '9時' or '14時30分' for natural Japanese."""
    h = getattr(t, "hour", 9)
    m = getattr(t, "minute", 0)
    return f"{h}時" if m == 0 else f"{h}時{m:02d}分"


def _next_call_phrase(schedule: list[ScheduleEntry], tz_name: str) -> str:
    """Compute the human phrase for "the next time we'll talk".

    Returns e.g. 「また水曜日の9時頃にお電話しますね」.
    """
    if not schedule:
        return "また近いうちにお電話しますね"

    try:
        tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        tz = pytz.timezone("Asia/Tokyo")

    now = datetime.now(tz)
    today_idx = now.weekday()
    today_minutes = now.hour * 60 + now.minute

    best: tuple[int, ScheduleEntry] | None = None  # (minutes_until, entry)
    for entry in schedule:
        target_idx = _WEEKDAY_INDEX[entry.weekday]
        target_minutes = entry.time.hour * 60 + entry.time.minute
        days_ahead = (target_idx - today_idx) % 7
        if days_ahead == 0 and target_minutes <= today_minutes:
            days_ahead = 7
        delta = days_ahead * 24 * 60 + (target_minutes - today_minutes)
        if best is None or delta < best[0]:
            best = (delta, entry)

    assert best is not None
    delta_min, entry = best
    weekday_jp = _WEEKDAY_JP[entry.weekday]
    time_jp = _format_time_jp(entry.time)
    if delta_min < 24 * 60:
        return f"また今日{time_jp}頃にお電話しますね"
    if delta_min < 48 * 60:
        return f"また明日{time_jp}頃にお電話しますね"
    return f"また{weekday_jp}の{time_jp}頃にお電話しますね"


def _format_schedule(schedule: list[ScheduleEntry]) -> str:
    if not schedule:
        return "（未設定）"
    parts = [f"{_WEEKDAY_JP[e.weekday]}{_format_time_jp(e.time)}" for e in schedule]
    return "、".join(parts)


# ---------------------------------------------------------------------------
# Model selection
# ---------------------------------------------------------------------------

def _is_mini(model: str | None) -> bool:
    """True if the configured model is in the gpt-realtime-mini family."""
    return bool(model) and "mini" in model.lower()


def _system_template(model: str | None) -> str:
    return (
        prompts_mini.KAYO_SYSTEM_PROMPT_TEMPLATE
        if _is_mini(model)
        else prompts_realtime2.KAYO_SYSTEM_PROMPT_TEMPLATE
    )


def _opening_template(model: str | None) -> str:
    return (
        prompts_mini.OPENING_INSTRUCTIONS_TEMPLATE
        if _is_mini(model)
        else prompts_realtime2.OPENING_INSTRUCTIONS_TEMPLATE
    )


# ---------------------------------------------------------------------------
# Public builders
# ---------------------------------------------------------------------------

def build_kayo_prompt(
    senior: Senior,
    past_summaries: list[str] | None = None,
    model: str | None = None,
) -> str:
    """Compose the personalized system prompt for a given senior + model."""
    schedule_line = f"通話スケジュール：{_format_schedule(senior.schedule)}\n"
    personal_block = schedule_line
    if not senior.is_self and senior.introducer_name:
        relationship = senior.introducer_relationship or "ご家族"
        personal_block += (
            f"\n紹介者：{relationship}の{senior.introducer_name}さん"
            f"（このサービスを申し込んでくれた人）。"
            f"開口の挨拶で名前に触れた後は、紹介者の話を不必要に何度も持ち出さない。"
            f"相手から話題が出たり、関連するときだけ自然に触れる程度。\n"
        )
    if senior.health_notes:
        personal_block += f"\n本人について（自由記述）：\n{senior.health_notes}\n"

    if past_summaries:
        past_block = "\n".join(f"- {s}" for s in past_summaries[-5:])
    else:
        past_block = "（初回の通話です）"

    next_call = _next_call_phrase(senior.schedule, senior.call_timezone)

    return _system_template(model).format(
        user_name=senior.name,
        personal_context_block=personal_block,
        past_conversations_summary=past_block,
        next_call_phrase=next_call,
    )


# Anti-scam disclaimer is mandatory at the start of every call. Kept here
# because it's part of the audible script Kayo reads.
_DISCLAIMER = (
    "初めに言っておきますね、私はAIです。"
    "私からクレジットカード番号や、銀行の口座、お金の話、"
    "個人情報をお聞きすることは絶対にありません。安心してくださいね。"
)


def build_opening_script(senior: Senior, past_summaries: list[str] | None) -> str:
    """The actual greeting line Kayo says verbatim.

    Shared across models — this is business logic, not model tuning.
    First call gets the full disclaimer + introduction; subsequent calls
    get a shorter friendlier opener.
    """
    is_first_call = not (past_summaries or [])

    if senior.is_self:
        prefix = f"もしもし、お話相手のカヨです。{_DISCLAIMER}"
    else:
        introducer = senior.introducer_name or "ご家族"
        relationship = senior.introducer_relationship or "ご家族"
        prefix = (
            f"もしもし、お話相手のカヨです。"
            f"{relationship}の{introducer}さんからのご紹介でお電話しました。"
            f"{_DISCLAIMER}"
        )

    if is_first_call:
        return (
            f"{prefix}"
            f"{senior.name}さん、初めまして。"
            f"最近、何かハマっていることはありますか？"
        )
    return (
        f"もしもし、お話相手のカヨです。"
        f"{senior.name}さん、こんにちは。今日は何について話しましょうか？"
    )


def build_opening_instructions(full_script: str, model: str | None = None) -> str:
    """Wrap the audible script in the model-specific meta-instructions
    that go into the FIRST response.create's `instructions` field."""
    return _opening_template(model).format(full_script=full_script)
