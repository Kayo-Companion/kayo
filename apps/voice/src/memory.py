"""Post-call summarization. Called after the bridge closes.

Produces TWO kinds of memory from the transcript:

1. **Short-term summary** — what happened on this specific call. Written to
   the `calls.summary` column. The last few of these get loaded into the
   next call's system prompt as recent-context.

2. **Long-term facts** — durable, identity-level facts about the senior
   (likes baseball, lives in Osaka, daughter is named ハナ, dislikes coffee).
   These accumulate across calls (deduped) on the senior row and get loaded
   into every future call's system prompt under "what we know about them".

The distinction matters because past-call summaries leak transient topics
("today wants to make curry") into future calls, making the agent
proactively bring them up out of context. Long-term facts are stable and
worth recalling spontaneously.
"""

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
- long_term_facts: 本人について将来の会話で覚えておくべき**永続的な事実**の配列（0〜5個）。
  以下の基準を守ること：
  * 含めるべき：趣味・好み、家族構成、出身地、職業、健康状態、嗜好、長期の興味
    例：「野球が好き」「妻はカヨコさん」「プログラマーとして働いている」「コーヒーが苦手」「3人の孫がいる」
  * 含めないでください（短期の出来事）：
    例：「今日カレーを作る」「昨日病院に行った」「来週旅行に行く」
  * 一文を一つの事実にする。短く、断定形で書く。
  * その通話で初めて出た情報のみ。雑談の挨拶や「元気」などの一般的状況は含めない。
  * 確信が持てない情報は含めない。
"""


def _format_transcript(transcript: list[dict[str, Any]], agent_name: str) -> str:
    """Render the transcript with the agent's actual name as the assistant label.

    Without this, downstream summaries always say "カヨは…" even if the agent
    is actually named "ミント" — which leaks back into future system prompts
    as if there were two assistants.
    """
    lines: list[str] = []
    for turn in transcript:
        role = agent_name if turn.get("role") == "assistant" else "本人"
        text = turn.get("text", "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def summarize_call(
    transcript: list[dict[str, Any]],
    agent_name: str = "カヨ",
) -> tuple[CallSummary, list[str]]:
    """Returns (summary, long_term_facts)."""
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    convo = _format_transcript(transcript, agent_name)

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
    summary = CallSummary(
        summary=data.get("summary", ""),
        topics=data.get("topics", []),
        mood=Mood(data.get("mood", "neutral")),
        distress_detected=bool(data.get("distress_detected", False)),
        distress_reason=data.get("distress_reason"),
    )
    facts_raw = data.get("long_term_facts", [])
    long_term_facts = [
        str(f).strip() for f in facts_raw if isinstance(f, str) and f.strip()
    ]
    return summary, long_term_facts


async def summarize_and_persist(
    call_id: str,
    senior_id: str,
    transcript: list[dict[str, Any]],
    agent_name: str = "カヨ",
) -> CallSummary:
    summary, facts = await summarize_call(transcript, agent_name=agent_name)
    db = get_db()
    await db.update_call_summary(call_id=call_id, summary=summary)
    if facts:
        try:
            await db.append_long_term_facts(senior_id=senior_id, new_facts=facts)
            logger.info(
                "Stored %d long-term fact(s) for senior %s: %s",
                len(facts), senior_id, facts,
            )
        except Exception:
            logger.exception(
                "Failed to persist long-term facts for senior %s", senior_id
            )
    return summary
