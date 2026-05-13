"""Post-call observation extraction.

Distinct from `memory.summarize_call` (which writes a human-readable
summary + long-term facts). This module produces the structured
"気になる変化" / "良い変化" observations that surface on the family
dashboard — and that we will later replay against research-labelled
data once we have it.

Design notes:
- LLM-as-judge over the transcript + known facts + recent topics.
- Output schema is deliberately small and stable; we want the dashboard
  to be able to render new observations the moment we ship them.
- The LLM compares today's call to the senior's known long-term facts
  (`seniors.long_term_facts`) and the recent call summaries
  (already passed into the system prompt during the live call). That
  context is what unlocks the "先週○○の話を忘れている" detection
  without us maintaining a separate per-fact memory table.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import get_settings

logger = logging.getLogger(__name__)

# These types map 1:1 to icons/colors on the family dashboard. Don't add
# new types here without also adding rendering for them client-side.
OBSERVATION_TYPES = {
    "forgot_past_fact",     # 既知の事実を忘れている様子
    "repeated_story",       # 同じ話を繰り返している
    "temporal_confusion",   # 日付・曜日・季節の取り違え
    "word_finding",         # 言葉が出てこない場面の増加
    "engagement_low",       # 応答が短い、無関心
    "engagement_high",      # いつもより活発・好調
    "new_topic",            # 新しい興味・出来事
    "positive_note",        # その他のポジティブな観察
}

OBSERVATION_SYSTEM = """\
あなたは高齢者との通話を観察し、ご家族のダッシュボードに表示するための
"気になる変化" と "良い変化" を抽出するアシスタントです。

提供される入力：
- 今日の通話の文字起こし
- 過去の通話で得られている、本人について確からしい事実のリスト
- 直近の通話の要約（最大5件）
- **過去通話数のヒント**（baseline_available: true / false）

抽出する観察項目（observations）は、以下のうち該当するもののみ：

- forgot_past_fact   : 既知の事実を忘れている様子（例：「先週孫が運動会だった」と
                       過去に話していたのに今日は「孫は何もないわよ」と答える）
- repeated_story     : 同じ話を最近の通話と繰り返している（その自覚なく）
- temporal_confusion : 日付・曜日・月・季節を取り違えている
- word_finding       : 「あれ」「それ」など、固有名詞が出てこない場面の増加
- engagement_low     : 応答が普段より極端に短い、無関心、反応が鈍い
- engagement_high    : 普段より明らかに活発、話題が豊富、楽しんでいる様子
- new_topic          : 新しく出てきた興味・趣味・予定など、家族が知っておくと良いこと
- positive_note      : その他のポジティブな観察

# baseline_available による出力制限（**最重要**）

`baseline_available = false`（過去通話が3件未満）の場合：
- 「普段と比べて」「いつもより」「最近より」のような**比較表現は絶対に使わない**。
  まだ比較対象となる本人の通常状態が確立されていないので、比較が成立しない。
- 以下のタイプは**出力しない**（比較がないと判断不能）:
  - engagement_low / engagement_high
  - word_finding（「場面の増加」が判断できないため）
  - repeated_story（繰り返しを判定するには複数回の履歴が必要）
- 出力可能なタイプ:
  - forgot_past_fact（既知事実との照合、long_term_facts があれば判定可能）
  - temporal_confusion（客観的に今日の日付/曜日とずれていれば判定可能）
  - new_topic（今日初出の話題として記録）
  - positive_note（今日の楽しそうな様子など、客観的な観察）

`baseline_available = true`（過去通話3件以上）の場合：
- 全てのタイプを使ってよい。比較表現も使える。

JSON で次のように返してください：
{
  "observations": [
    {
      "type": "<上記いずれか>",
      "detail": "ご家族向けの、断定を避けた優しい表現。1〜2文。",
      "severity": "low" | "medium" | "high",   // 良い変化は常に "low"
      "evidence": "通話中の該当部分の短い引用または要約。15-40字程度。",
      "positive": true | false
    }
  ]
}

書き方のルール：
- detail は **医学的判断ではなく、観察ベース**で書く。
  例: "先週話していた○○の件を、今日は覚えていない様子でした。"
  NG: "認知症の兆候があります" / "MCIの可能性" / "症状の進行が…"
- 確証が低い場合は含めない。迷ったら出さない。
- 一通話で 0〜4個程度。ノイズを増やさない。
- positive_note / engagement_high は positive=true、それ以外は positive=false。
- evidence は本人の発言を短く引用するのが理想。文脈で要約してもよい。
"""

# Observation types that require a multi-call baseline to be meaningful.
# Filtered out when baseline_available=False (regardless of what the model
# returns — belt-and-suspenders for the prompt-side instruction).
COMPARATIVE_TYPES = {"engagement_low", "engagement_high", "word_finding", "repeated_story"}

# Minimum past-summary count before comparative observations are allowed.
BASELINE_MIN_CALLS = 3


def _format_transcript(transcript: list[dict[str, Any]], agent_name: str) -> str:
    """Same shape as memory._format_transcript — kept private to avoid coupling."""
    lines: list[str] = []
    for turn in transcript:
        role = agent_name if turn.get("role") == "assistant" else "本人"
        text = (turn.get("text") or "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def extract_observations(
    transcript: list[dict[str, Any]],
    *,
    long_term_facts: list[str],
    past_summaries: list[str],
    agent_name: str = "カヨ",
) -> list[dict[str, Any]]:
    """Returns a list of observation dicts (already shaped for DB storage).

    Empty list is a valid result — most calls don't surface anything
    worth flagging, and the dashboard handles that gracefully.
    """
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    convo = _format_transcript(transcript, agent_name)
    facts_block = (
        "\n".join(f"- {f}" for f in long_term_facts) if long_term_facts else "（なし）"
    )
    summaries_block = (
        "\n".join(f"- {s}" for s in past_summaries) if past_summaries else "（初回）"
    )
    baseline_available = len(past_summaries) >= BASELINE_MIN_CALLS

    user_msg = (
        f"# baseline_available: {str(baseline_available).lower()}\n"
        f"# 過去の通話数: {len(past_summaries)} 件\n\n"
        f"# 過去に分かっている本人についての事実\n{facts_block}\n\n"
        f"# 直近の通話の要約\n{summaries_block}\n\n"
        f"# 今日の通話\n{convo}\n"
    )

    response = await client.chat.completions.create(
        # gpt-4o-mini is plenty for this structured extraction job and keeps
        # the per-call cost negligible (typically <$0.005 per call).
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": OBSERVATION_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Observation extractor returned non-JSON: %s", raw[:200])
        return []

    obs_raw = data.get("observations", []) or []
    cleaned: list[dict[str, Any]] = []
    for o in obs_raw:
        if not isinstance(o, dict):
            continue
        t = str(o.get("type") or "").strip()
        if t not in OBSERVATION_TYPES:
            continue
        # Drop comparative types when we don't have enough history to
        # claim "普段より". The prompt instructs the model to skip these,
        # but enforce here too so a stray output never reaches the UI.
        if not baseline_available and t in COMPARATIVE_TYPES:
            logger.info(
                "Dropping %s observation: only %d past calls (need %d for baseline)",
                t, len(past_summaries), BASELINE_MIN_CALLS,
            )
            continue
        detail = str(o.get("detail") or "").strip()
        if not detail:
            continue
        severity = str(o.get("severity") or "low").strip().lower()
        if severity not in ("low", "medium", "high"):
            severity = "low"
        cleaned.append(
            {
                "type": t,
                "detail": detail,
                "severity": severity,
                "evidence": str(o.get("evidence") or "").strip()[:200],
                "positive": bool(o.get("positive", False)),
            }
        )
    return cleaned
