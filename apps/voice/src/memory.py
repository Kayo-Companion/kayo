"""Post-call summarization. Called after the bridge closes."""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import get_settings
from .db import get_db
from .models import CallSummary, Mood

logger = logging.getLogger(__name__)

SUMMARY_SYSTEM = """\
あなたは高齢者との通話内容を要約するアシスタントです。
日本語のJSONを返してください。フィールドは以下の通り：
- summary: 200文字以内の要約。話題と相手の様子を含める。
- topics: 話題のキーワードリスト（3〜6個）
- mood: "positive" / "neutral" / "negative" のいずれか
- distress_detected: 健康・精神的に心配される発言があれば true
- distress_reason: distress_detected が true のときの簡潔な理由
"""


def _format_transcript(transcript: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for turn in transcript:
        role = "カヨ" if turn.get("role") == "assistant" else "本人"
        text = turn.get("text", "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def summarize_call(transcript: list[dict[str, Any]]) -> CallSummary:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    convo = _format_transcript(transcript)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM},
            {"role": "user", "content": f"以下の通話を要約してください:\n\n{convo}"},
        ],
        temperature=0.3,
    )

    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    return CallSummary(
        summary=data.get("summary", ""),
        topics=data.get("topics", []),
        mood=Mood(data.get("mood", "neutral")),
        distress_detected=bool(data.get("distress_detected", False)),
        distress_reason=data.get("distress_reason"),
    )


async def summarize_and_persist(
    call_id: str,
    transcript: list[dict[str, Any]],
) -> CallSummary:
    summary = await summarize_call(transcript)
    db = get_db()
    await db.update_call_summary(call_id=call_id, summary=summary)
    return summary
