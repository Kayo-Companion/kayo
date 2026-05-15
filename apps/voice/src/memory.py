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
- distress_detected: 通話相手の本人（高齢者ご本人）が**今まさに健康または安全上の危機にある**
  ことを示す発言をした場合のみ true。**一般的な不安・心配・気がかりは false**。
  家族へのアラートに直結する判定なので、誤検知を避けるため厳しめに判定すること。

  ★ true にすべき例（本人の身体・精神の危機を本人が訴えている）：
    - 「胸が苦しい」「胸が痛い」「息ができない」「動けない」「倒れた／倒れそう」
    - 「とても辛い」「具合が悪い」「意識がもうろうとする」「救急車を呼んで」
    - 「死にたい」「消えてしまいたい」「もう生きていたくない」
    - 数日以上続く強い体調不良の訴え（例：「3日間ご飯が食べられない」）

  ★ false にすべき例（true ではない — これらは要注意ではない）：
    - 経済・社会の話題に対する心配（「ナフサの供給が心配」「友達の会社が潰れそう」「年金が不安」）
    - 単なる予定の言及（「来週病院の予約がある」「明日検査に行く」）
    - 日常の軽い不安（「ご飯がうまく炊けるか心配」「明日の天気が気になる」）
    - 軽度の疲れや調子の話（「ちょっと疲れた」「最近寝つきが悪い」）
    - 過去の病気の話を冷静に振り返っている場合
    - 本人ではなく他人の健康状態の話（「友達が入院した」「夫が腰を痛めた」）
    - 軽い咳・くしゃみ・鼻水程度の不調

  迷ったら false にしてください。

- distress_reason: distress_detected が true のときに限り、本人の実際の発言を簡潔に
  引用する形で書く（例：「『胸が苦しい』と訴えた」）。false の時は空文字。

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

    # Extract dashboard observations ("気になる変化" / "良い変化"). Best-effort
    # — never blocks the rest of the post-call pipeline.
    try:
        # Local import avoids a circular dependency at module load time.
        from .observations import extract_observations

        senior = await db.get_senior(senior_id)
        long_term_facts = (senior.long_term_facts or []) if senior else []
        # The summary we just wrote is included so the model can compare
        # today to a longer recent window. Fetch BEFORE the new summary
        # was added to keep the comparison meaningful — but the summary
        # already exists in DB now, so request limit+1 and drop today's.
        recent = await db.get_recent_summaries(senior_id, limit=6)
        recent_minus_today = [s for s in recent if s != summary.summary][:5]

        observations = await extract_observations(
            transcript,
            long_term_facts=long_term_facts,
            past_summaries=recent_minus_today,
            agent_name=agent_name,
        )
        if observations:
            await db.save_observations(call_id=call_id, observations=observations)
            logger.info(
                "Saved %d observation(s) for call %s", len(observations), call_id
            )
    except Exception:
        logger.exception("Failed to extract observations for call %s", call_id)

    # Detect and score per-call brain-training (HDS-R) sessions.
    # Best-effort — failures here never block the call from finalizing.
    # We deliberately only persist `brain_training` entries: the dashboard
    # cares about cognitive-screening scores over time, not bar charts of
    # how often the senior chose chat vs quiz vs shiritori.
    try:
        from datetime import datetime, UTC
        from .activity_scoring import extract_activities

        all_results = await extract_activities(
            transcript,
            agent_name=agent_name,
            call_date=datetime.now(UTC),
        )
        brain_results = [a for a in all_results if a.get("type") == "brain_training"]
        if brain_results:
            await db.save_activity_results(
                call_id=call_id, activity_results=brain_results
            )
            logger.info(
                "Saved %d brain_training result(s) for call %s (skipped %d non-HDSR entries)",
                len(brain_results), call_id, len(all_results) - len(brain_results),
            )
    except Exception:
        logger.exception("Failed to extract activities for call %s", call_id)

    return summary
