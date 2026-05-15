"""HDS-R (改訂長谷川式簡易知能評価スケール) protocol + scoring.

The user opts into "脳トレ" from the menu, then Kayo administers a verbal
adaptation of the standard HDS-R. Question #8 normally requires showing
5 physical objects (clock, key, etc.); over a phone we replace that with
5 spoken food names (りんご・牛乳・パン・卵・魚) — equivalent recall task,
no visual dependency.

The 9 questions and exact wording are fixed in PROTOCOL below. The
spoken Kayo line is what we instruct the model to read verbatim; the
scoring logic that runs *after* the call uses the transcript + gpt-4o-mini
to grade each response against the rubric.

Total: 30 points (same as standard HDS-R).
Cutoff: ≤20 → cognitive impairment suspected (sensitivity 0.93, specificity 0.86).

Reference:
  加藤伸司ら, 改訂長谷川式簡易知能評価スケール（HDS-R）の作成
  老年精神医学雑誌 2(11), 1991
"""

from __future__ import annotations

from typing import TypedDict


class HDSRQuestion(TypedDict):
    id: int
    type: str           # short code for scoring logic
    kayo_says: str      # exact line Kayo reads aloud
    max_score: int
    scoring_hint: str   # passed to the gpt-4o-mini scorer
    rubric: str         # human-readable scoring rule


# Default registration words used in Q4/Q7. The standard HDS-R has two
# alternative triples (桜/猫/電車 and 梅/犬/自動車) so the same senior
# isn't re-tested on the same items in consecutive sessions.
REGISTRATION_WORDS_SETS = [
    ["桜", "猫", "電車"],
    ["梅", "犬", "自動車"],
]

# Verbal substitute for Q8 (5-item recall). The standard HDS-R uses 5
# physical objects shown to the patient; we read 5 food names instead.
FIVE_ITEMS_VARIANTS = [
    ["りんご", "牛乳", "パン", "卵", "魚"],
    ["みかん", "豆腐", "ごはん", "バナナ", "牛乳"],
]


def build_protocol(set_index: int = 0) -> list[HDSRQuestion]:
    """Build the 9-question protocol. `set_index` selects which word-set
    rotation to use so the same words don't appear back-to-back when a
    senior does the brain training multiple times in a month."""
    words = REGISTRATION_WORDS_SETS[set_index % len(REGISTRATION_WORDS_SETS)]
    items = FIVE_ITEMS_VARIANTS[set_index % len(FIVE_ITEMS_VARIANTS)]
    w_csv = "、".join(words)
    i_csv = "、".join(items)

    return [
        {
            "id": 1,
            "type": "age",
            "kayo_says": "最初の問題ね。お歳はいくつですか？",
            "max_score": 1,
            "scoring_hint": "Senior's spoken age within ±2 years of their real age counts as correct.",
            "rubric": "実年齢±2歳の範囲で1点",
        },
        {
            "id": 2,
            "type": "date_orientation",
            "kayo_says": "今日は何年何月何日？何曜日かもわかる？",
            "max_score": 4,
            "scoring_hint": "Score 1 point each for correct year, month, day-of-month, day-of-week. Compare against the call date.",
            "rubric": "年・月・日・曜日 各1点（計4点）",
        },
        {
            "id": 3,
            "type": "place_orientation",
            "kayo_says": "今いる場所はどこですか？",
            "max_score": 2,
            "scoring_hint": "2 points if the senior says home (自宅/家) or correct facility name unprompted; 1 point if they answer after a short prompt or are vague.",
            "rubric": "自発的に正答で2点、ヒント有りで1点",
        },
        {
            "id": 4,
            "type": "three_word_registration",
            "kayo_says": f"これから3つの言葉を言うから覚えてね。後で聞きますよ。{w_csv}。復唱してみて？",
            "max_score": 3,
            "scoring_hint": f"Score 1 per correctly repeated word from this exact list: {words}. Partial matches don't count. This is immediate registration, not delayed recall.",
            "rubric": "3単語の即時復唱、各1点",
        },
        {
            "id": 5,
            "type": "calculation",
            "kayo_says": "100から7を引くと？さらにそこからもう7引くと？",
            "max_score": 2,
            "scoring_hint": "Correct answers are 93 and 86. Score 1 point per correct value. If the first answer is wrong, the second is scored independently (don't penalize twice for a downstream error).",
            "rubric": "93→2点、86→2点（独立採点）",
        },
        {
            "id": 6,
            "type": "digit_span_reverse",
            "kayo_says": "数字を逆から言ってみて。「6, 8, 2」",
            "max_score": 2,
            "scoring_hint": "First sequence 6,8,2 reversed = 2,8,6. Score 1 if exact. Then Kayo says a 4-digit sequence 3,5,2,9 (reversed: 9,2,5,3). Score 1 if exact. If they get the 3-digit wrong, the 4-digit is still administered and scored.",
            "rubric": "3桁逆唱1点、4桁逆唱1点",
        },
        {
            "id": 7,
            "type": "three_word_delayed_recall",
            "kayo_says": f"さっき覚えてもらった3つの言葉、何だったか覚えてる？",
            "max_score": 6,
            "scoring_hint": f"For each of the 3 words ({words}): 2 points if recalled without hint, 1 point if recalled after a category hint (e.g., '植物の名前は？'), 0 if not recalled.",
            "rubric": "自発的再生2点／ヒント有り再生1点 × 3単語",
        },
        {
            "id": 8,
            "type": "five_items_recall_verbal",
            "kayo_says": f"これから5つの食べ物の名前を言うから覚えてね。{i_csv}。全部言える？",
            "max_score": 5,
            "scoring_hint": f"Score 1 per correctly recalled item from: {items}. Items must be named explicitly; close synonyms count only if they're equivalent (e.g., 'ミルク' for '牛乳').",
            "rubric": "5品目の再生、各1点",
        },
        {
            "id": 9,
            "type": "verbal_fluency",
            "kayo_says": "最後の問題。野菜の名前を、できるだけたくさん言ってみて。1分間でいくつ言えるかな？",
            "max_score": 5,
            "scoring_hint": "Count distinct vegetable names. Scoring: 0-5 items=0pt, 6=1pt, 7=2pt, 8=3pt, 9=4pt, 10+=5pt. Repeats and non-vegetables don't count.",
            "rubric": "野菜の名前 6個目から1点ずつ加算、10個以上で満点",
        },
    ]


# Total possible score across the 9 questions = 30. Sanity-checked in tests.
TOTAL_MAX_SCORE = 30


def interpret_score(total: int) -> str:
    """Human-readable interpretation matching standard HDS-R cutoffs.

    NOTE: This is for the dashboard label only — final diagnosis must be
    made by a clinician. The disclaimer is rendered on the dashboard.
    """
    if total <= 10:
        return "重度の認知機能低下が疑われる範囲"
    if total <= 15:
        return "中等度の認知機能低下が疑われる範囲"
    if total <= 20:
        return "認知症の疑い範囲"
    if total <= 24:
        return "軽度認知障害（MCI）の可能性がある範囲"
    return "健康な認知機能の範囲"


def closing_line(total_questions: int = 9) -> str:
    """The flat sign-off Kayo says after Q9. No scores, no 'see family
    dashboard', no encouragement that smells like feedback."""
    return f"脳トレお疲れさまでした！全部で{total_questions}問ありましたね。じゃあ次は何しよっか？"
