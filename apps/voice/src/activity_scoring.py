"""Detect activities (会話/クイズ/しりとり/脳トレ) from a call transcript
and score them using gpt-4o-mini.

Runs in the post-call pipeline (memory.summarize_and_persist). The flow:

  1. Detect which activity segments occurred in the transcript. A single
     call can contain multiple — e.g. 会話 → クイズ → しりとり.
  2. For each segment, build a scoring prompt tailored to that activity:
       - 会話: nothing to score, just record it happened.
       - クイズ: tally correct/incorrect per question.
       - しりとり: count turns + chain validity.
       - 脳トレ: run the full HDS-R rubric against the 9 questions.
  3. Persist the result so the dashboard can show progress.

Why gpt-4o-mini rather than rule-based: senior responses are noisy
(filler words, partial answers, mid-thought corrections). A small LLM
handles "えーと、桜と…猫…と…電車かな" → all three words, far better
than regex. Cost is negligible (~¥0.04 per transcript).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Literal

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from .config import get_settings
from .hdsr import TOTAL_MAX_SCORE, build_protocol, interpret_score
from .quizzes import CATEGORY_LABELS_JP

logger = logging.getLogger(__name__)

ActivityType = Literal["conversation", "quiz", "shiritori", "brain_training"]


# --------------------------------------------------------------------------
# Activity detection
# --------------------------------------------------------------------------

DETECT_SYSTEM = """\
あなたは日本のシニア向けAI電話サービス「カヨ」の通話記録を解析するアシスタントです。
1通話の中で実行された **活動 (activity)** を時系列で抽出してください。

活動は以下の4種類のうちのどれか：
- "conversation": 普通の雑談・世間話
- "quiz": クイズ（カテゴリ別の問題出題と回答）
- "shiritori": しりとりゲーム
- "brain_training": 脳トレ（HDS-R形式の9問テスト）

1通話に複数の活動が含まれる場合があります。例: 通常会話 → クイズ → 会話 → しりとり。
連続する同じ活動は1つにまとめてください。

JSON 形式で返答：
{
  "segments": [
    {"activity": "conversation" | "quiz" | "shiritori" | "brain_training",
     "quiz_category": "animals|geography|showa|seasons|cooking|history|kanji|proverbs|mixed|null"}
  ]
}

- quiz_category は activity が "quiz" の時だけ埋める（カテゴリが判別できない時は "mixed"）。
- 他の活動の場合は null。
- 何も活動が無い（接続不良など）場合は空配列。
- 普通の挨拶や雑談だけなら "conversation" を1つだけ。
"""


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
async def detect_segments(
    transcript: list[dict[str, Any]],
    agent_name: str,
) -> list[dict[str, str | None]]:
    """Return a list of segment dicts. Empty list if nothing detected."""
    if not transcript:
        return []

    convo = _format_transcript(transcript, agent_name)
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": DETECT_SYSTEM},
            {"role": "user", "content": convo},
        ],
        temperature=0.0,
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    segments = data.get("segments", [])
    return [s for s in segments if isinstance(s, dict) and s.get("activity")]


# --------------------------------------------------------------------------
# HDS-R scoring
# --------------------------------------------------------------------------

def _build_hdsr_scoring_prompt(call_date: datetime) -> str:
    """Compose the system prompt for HDS-R scoring. We inline the protocol
    + rubric so the scoring model knows exactly which question maps to
    which response."""
    protocol = build_protocol(set_index=0)
    lines = [
        "あなたは改訂長谷川式簡易知能評価スケール（HDS-R）の採点者です。",
        "通話の transcript から、HDS-R 9問に対する回答を抽出して採点してください。",
        f"通話日: {call_date.strftime('%Y年%m月%d日')}（{['月','火','水','木','金','土','日'][call_date.weekday()]}曜日）",
        "",
        "# 厳格な採点ルール（最重要）",
        "",
        "1. **曖昧な答え・答えになっていない発話は score=0 で `verified=false` にする**",
        "   - 例: 「今は」「うーん」「えーと」「あー」などの言いかけ",
        "   - 例: 文字化け、外国語のような明らかな ASR エラー",
        "   - 例: 質問と無関係な発話（カテゴリ違いの単語など）",
        "   - これらは「未確認 (verified=false)」として記録し、ダッシュボードで",
        "     「この項目は確認できませんでした」と表示するため。",
        "",
        "2. **明確に答えがあれば、正誤に関わらず `verified=true`**",
        "   - 部分正解でも、本人が明確に何か答えた → verified=true で部分点採点",
        "",
        "3. **質問の意図と違うカテゴリの答えは score=0**",
        "   - 例: 問8（5物品: りんご・牛乳・パン・卵・魚）に対して「キャベツ、レタス、ニンジン」（野菜）と答えた",
        "     → これは食べ物ではなく野菜なので score=0, verified=true",
        "   - 例: 問9（野菜の流暢性）に対して食べ物（牛乳・パンなど）を答えた → 該当しない単語は数えない",
        "",
        "# 問題別の採点ルール",
    ]
    for q in protocol:
        lines.append(f"問{q['id']}（{q['type']}, 最大{q['max_score']}点）: {q['rubric']}")
        lines.append(f"  カヨの読み上げ: {q['kayo_says']}")
        lines.append(f"  採点根拠: {q['scoring_hint']}")
    lines.extend([
        "",
        "# 出力形式（JSON）",
        "{",
        '  "questions": [',
        '    {"id": 1, "type": "age", "user_answer": "...", "score": 0-1, "max": 1, "verified": true|false, "reason": "score=0の理由（任意）"},',
        '    ...',
        '  ],',
        '  "total": 0-30,',
        '  "notes": "短いメモ（任意）"',
        "}",
        "",
        "# verified の判定基準",
        '- verified=true: ユーザーが明確に何か答えた（正誤問わず）',
        '- verified=false: 答えになっていない、ASR エラー、未回答',
        "",
        "verified=false の場合、ダッシュボードで「この項目は確認できませんでした」と表示します。",
        "transcript の中で回答が見つからない問題は score=0, verified=false, user_answer=\"未回答\" にしてください。",
        "問8（5物品再生）は『食べ物 5つ（りんご・牛乳・パン・卵・魚）』であって野菜ではありません。",
        "問9（流暢性）は『野菜の名前』であって食べ物全般ではありません。",
    ])
    return "\n".join(lines)


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
async def score_hdsr(
    transcript: list[dict[str, Any]],
    agent_name: str,
    call_date: datetime,
) -> dict[str, Any] | None:
    """Score an HDS-R session from the transcript. Returns the score dict
    or None if the transcript doesn't contain a recognizable session."""
    convo = _format_transcript(transcript, agent_name)
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _build_hdsr_scoring_prompt(call_date)},
            {"role": "user", "content": convo},
        ],
        temperature=0.0,
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    questions = data.get("questions", [])
    if not questions:
        return None
    total = int(data.get("total", sum(int(q.get("score", 0)) for q in questions)))
    total = max(0, min(total, TOTAL_MAX_SCORE))
    return {
        "type": "brain_training",
        "questions": questions,
        "total": total,
        "max": TOTAL_MAX_SCORE,
        "interpretation": interpret_score(total),
        "notes": data.get("notes", ""),
    }


# --------------------------------------------------------------------------
# Quiz scoring
# --------------------------------------------------------------------------

QUIZ_SCORING_SYSTEM = """\
あなたは日本のシニア向けクイズの採点者です。
通話 transcript の中でクイズが出題された部分から、各問題と回答を抽出し、
正解 / 不正解を判定してください。

# 判定ルール
- カヨが「正解！」「惜しい！正解は◯◯」のように言っている場合は、それに従う
- ユーザーが正解と意味的に近い答えを言っていれば正解（例: 「鶴」と「タンチョウ」は意味的に近い）
- ヒント有りの正解も「正解」として扱う

# 出力形式（JSON）
{
  "category": "animals|geography|showa|seasons|cooking|history|kanji|proverbs|mixed",
  "items": [
    {"q": "問題文", "user_answer": "ユーザーの答え", "correct": true|false, "correct_answer": "正解"},
    ...
  ],
  "correct_count": 整数,
  "total_count": 整数
}
"""


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
async def score_quiz(
    transcript: list[dict[str, Any]],
    agent_name: str,
    category_hint: str | None = None,
) -> dict[str, Any] | None:
    """Score a quiz session. category_hint is what the segment detector
    found; the scorer may override if it sees something different."""
    convo = _format_transcript(transcript, agent_name)
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    user_prompt = convo
    if category_hint:
        user_prompt = f"（推定カテゴリ: {category_hint}）\n\n{convo}"

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": QUIZ_SCORING_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.0,
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    items = data.get("items", [])
    if not items:
        return None
    category = data.get("category", category_hint or "mixed")
    return {
        "type": "quiz",
        "category": category,
        "category_label": CATEGORY_LABELS_JP.get(category, category),
        "items": items,
        "correct": int(data.get("correct_count", sum(1 for i in items if i.get("correct")))),
        "total": int(data.get("total_count", len(items))),
    }


# --------------------------------------------------------------------------
# Shiritori scoring
# --------------------------------------------------------------------------

SHIRITORI_SCORING_SYSTEM = """\
あなたは日本のしりとりゲームのスコア計算をします。
通話 transcript から、しりとりのターンを抽出してください。

# 抽出するもの
- 各ターンに誰が何を言ったか（カヨ or 本人）
- 「ん」で終わった、既出の言葉を使った、などのルール違反

# 出力形式（JSON）
{
  "turns": [
    {"speaker": "kayo"|"user", "word": "..."}
  ],
  "ended_by": "user_said_n"|"natural_end"|"user_stopped"|"timeout",
  "winner": "kayo"|"user"|"tie"
}
"""


@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=1, max=4))
async def score_shiritori(
    transcript: list[dict[str, Any]],
    agent_name: str,
) -> dict[str, Any] | None:
    convo = _format_transcript(transcript, agent_name)
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SHIRITORI_SCORING_SYSTEM},
            {"role": "user", "content": convo},
        ],
        temperature=0.0,
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    turns = data.get("turns", [])
    if not turns:
        return None
    return {
        "type": "shiritori",
        "turns": turns,
        "turn_count": len(turns),
        "ended_by": data.get("ended_by"),
        "winner": data.get("winner"),
    }


# --------------------------------------------------------------------------
# Entry point used by memory.summarize_and_persist
# --------------------------------------------------------------------------

async def extract_activities(
    transcript: list[dict[str, Any]],
    agent_name: str,
    call_date: datetime,
) -> list[dict[str, Any]]:
    """Detect and score all activities present in a call. Returns a list
    suitable for jsonb storage in calls.activity_results."""
    segments = await detect_segments(transcript, agent_name)
    if not segments:
        return []

    results: list[dict[str, Any]] = []
    for seg in segments:
        activity = seg.get("activity")
        try:
            if activity == "brain_training":
                scored = await score_hdsr(transcript, agent_name, call_date)
                if scored:
                    results.append(scored)
            elif activity == "quiz":
                scored = await score_quiz(transcript, agent_name, seg.get("quiz_category"))
                if scored:
                    results.append(scored)
            elif activity == "shiritori":
                scored = await score_shiritori(transcript, agent_name)
                if scored:
                    results.append(scored)
            elif activity == "conversation":
                # No scoring for free chat — just record it happened so
                # the dashboard can show activity mix.
                results.append({"type": "conversation"})
        except Exception:
            logger.exception("Activity scoring failed for activity=%s", activity)
    return results


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _format_transcript(transcript: list[dict[str, Any]], agent_name: str) -> str:
    lines: list[str] = []
    for turn in transcript:
        role = agent_name if turn.get("role") == "assistant" else "本人"
        text = (turn.get("text") or "").strip()
        if text:
            lines.append(f"{role}: {text}")
    return "\n".join(lines)
