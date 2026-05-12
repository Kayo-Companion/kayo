"""Variant- and model-aware prompt builder for Kayo.

Three prompt configurations are available:

  - companion + mini         (prompts_mini.py)
  - companion + realtime-2   (prompts_realtime2.py — currently identical
                              to mini; will diverge once tuned)
  - smart    + any model     (prompts_smart.py — ChatGPT-style)

Selection rules:
  1. If `KAYO_PROMPT_VARIANT=smart`, always use prompts_smart.py
     regardless of model.
  2. Otherwise (companion variant), pick by model family:
       - "mini" in model name → prompts_mini.py
       - everything else       → prompts_realtime2.py

This lets you compare:
  A) mini model + companion prompt          (current default)
  B) realtime-2 model + companion prompt    (same persona, smarter model)
  C) mini model + smart prompt              (cheap model + better prompt)

by flipping just env vars in Railway. The greeting *script* Kayo reads
(the audible opening line) is shared business logic across all variants.
"""

from __future__ import annotations

from datetime import datetime

import pytz

from . import prompts_mini, prompts_realtime2, prompts_smart
from .config import get_settings
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
# Variant + model selection
# ---------------------------------------------------------------------------

# Valid values for KAYO_PROMPT_VARIANT.
PROMPT_VARIANT_COMPANION = "companion"
PROMPT_VARIANT_SMART = "smart"


def _is_mini(model: str | None) -> bool:
    """True if the configured model is in the gpt-realtime-mini family."""
    return bool(model) and "mini" in model.lower()


def _variant() -> str:
    """Read KAYO_PROMPT_VARIANT from settings. Unknown values fall back
    to companion so a typo doesn't silently switch personas."""
    raw = (get_settings().kayo_prompt_variant or "").strip().lower()
    if raw == PROMPT_VARIANT_SMART:
        return PROMPT_VARIANT_SMART
    return PROMPT_VARIANT_COMPANION


def _prompt_module(model: str | None):
    """Pick which prompt module (mini / realtime2 / smart) to use.

    Variant overrides model selection — smart variant uses prompts_smart
    on ANY model. Within the companion variant, model picks between the
    mini-tuned and realtime-2-tuned companion prompts.
    """
    if _variant() == PROMPT_VARIANT_SMART:
        return prompts_smart
    return prompts_mini if _is_mini(model) else prompts_realtime2


def _system_template(model: str | None) -> str:
    return _prompt_module(model).KAYO_SYSTEM_PROMPT_TEMPLATE


def _opening_template(model: str | None) -> str:
    return _prompt_module(model).OPENING_INSTRUCTIONS_TEMPLATE


# ---------------------------------------------------------------------------
# Public builders
# ---------------------------------------------------------------------------

# Default agent name when the senior hasn't customized it.
DEFAULT_AGENT_NAME = "カヨ"


def _agent_name(senior: Senior) -> str:
    """Return the senior's custom agent name, or the product default."""
    name = (senior.agent_name or "").strip()
    return name or DEFAULT_AGENT_NAME


def build_kayo_prompt(
    senior: Senior,
    past_summaries: list[str] | None = None,
    model: str | None = None,
) -> str:
    """Compose the personalized system prompt for a given senior + model.

    Memory is split into two blocks:
    - long_term_facts_block: durable facts about the user (from
      senior.long_term_facts). Loaded into every call. Worth recalling
      spontaneously if relevant.
    - recent_calls_block: last 2 call summaries — short-term context only.
      The agent should NOT proactively bring these topics up; only refer
      to them if the user does.
    """
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

    # Durable facts about this senior — accumulated across calls. These
    # should feel naturally available, like things a friend already knows.
    if senior.long_term_facts:
        long_term_facts_block = "\n".join(
            f"- {f}" for f in senior.long_term_facts[-20:]
        )
    else:
        long_term_facts_block = "（まだ覚えていることはありません）"

    # Recent-call summaries are SHORT-TERM context only. Limit to the last 2
    # so we don't bury the model in irrelevant topics from a week ago.
    if past_summaries:
        recent_calls_block = "\n".join(
            f"- {s}" for s in past_summaries[-2:]
        )
    else:
        recent_calls_block = "（初回の通話です）"

    next_call = _next_call_phrase(senior.schedule, senior.call_timezone)

    return _system_template(model).format(
        agent_name=_agent_name(senior),
        user_name=senior.name,
        personal_context_block=personal_block,
        long_term_facts=long_term_facts_block,
        past_conversations_summary=recent_calls_block,
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
    """The actual greeting line the agent says verbatim.

    Shared across models — this is business logic, not model tuning.
    First call gets the full disclaimer + introduction; subsequent calls
    get a shorter friendlier opener.
    """
    is_first_call = not (past_summaries or [])
    agent = _agent_name(senior)

    if senior.is_self:
        prefix = f"もしもし、お話相手の{agent}です。{_DISCLAIMER}"
    else:
        introducer = senior.introducer_name or "ご家族"
        relationship = senior.introducer_relationship or "ご家族"
        prefix = (
            f"もしもし、お話相手の{agent}です。"
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
        f"もしもし、お話相手の{agent}です。"
        f"{senior.name}さん、こんにちは。今日は何について話しましょうか？"
    )


def build_opening_instructions(full_script: str, model: str | None = None) -> str:
    """Wrap the audible script in the model-specific meta-instructions
    that go into the FIRST response.create's `instructions` field."""
    return _opening_template(model).format(full_script=full_script)
