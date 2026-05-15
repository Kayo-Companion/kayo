"""Shiritori (しりとり) helpers.

Pure LLM-driven shiritori is unreliable — gpt-realtime-mini in particular
will sometimes reuse words, ignore "ん" loss conditions, or accept obvious
katakana mismatches. So we keep the *rules* in this module (deterministic
Python) and let the model handle only the conversational delivery.

The bridge doesn't yet enforce these in-call (that's a follow-up — see the
TODO in `prompts_menu.py`). For now this module exists so the post-call
scorer can mark sessions where the user successfully kept the chain going,
and so the system prompt can reference a stable list of seed words.
"""

from __future__ import annotations

import unicodedata

# Common kana ending → kana that the next word must start with. Shiritori's
# "ー" (long-vowel mark) maps to the preceding vowel; "を" maps to "お"; small
# kana (ゃゅょ) map to their full-size counterpart (や/ゆ/よ).
_LONG_VOWEL_MAP = {
    "あ": "あ", "い": "い", "う": "う", "え": "え", "お": "お",
    "か": "あ", "き": "い", "く": "う", "け": "え", "こ": "お",
    "さ": "あ", "し": "い", "す": "う", "せ": "え", "そ": "お",
    "た": "あ", "ち": "い", "つ": "う", "て": "え", "と": "お",
    "な": "あ", "に": "い", "ぬ": "う", "ね": "え", "の": "お",
    "は": "あ", "ひ": "い", "ふ": "う", "へ": "え", "ほ": "お",
    "ま": "あ", "み": "い", "む": "う", "め": "え", "も": "お",
    "や": "あ", "ゆ": "う", "よ": "お",
    "ら": "あ", "り": "い", "る": "う", "れ": "え", "ろ": "お",
    "わ": "あ",
}

_SMALL_KANA_MAP = {
    "ゃ": "や", "ゅ": "ゆ", "ょ": "よ",
    "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
}


def to_hiragana(s: str) -> str:
    """Convert a string to all-hiragana, lower-casing katakana and stripping
    surrounding spaces. Useful before chain-validation. Does NOT handle kanji
    — those need a separate reading lookup (out of scope for the in-call
    enforcement, which only sees ASR transcripts which are kana-heavy)."""
    out = []
    for ch in unicodedata.normalize("NFKC", s.strip()):
        cp = ord(ch)
        # Katakana → Hiragana
        if 0x30A1 <= cp <= 0x30F6:
            out.append(chr(cp - 0x60))
        else:
            out.append(ch)
    return "".join(out)


def last_phoneme(word: str) -> str | None:
    """Return the kana the NEXT word must start with. Returns None if the
    word ends in "ん" (shiritori loss condition) or has no resolvable
    trailing kana."""
    h = to_hiragana(word).rstrip()
    if not h:
        return None
    last = h[-1]
    if last == "ん":
        return None  # shiritori loss
    if last == "ー" and len(h) >= 2:
        prev = h[-2]
        return _LONG_VOWEL_MAP.get(prev, prev)
    if last in _SMALL_KANA_MAP:
        return _SMALL_KANA_MAP[last]
    return last


def is_valid_continuation(prev_word: str, candidate: str) -> tuple[bool, str]:
    """Return (ok, reason). `reason` is empty when ok=True; otherwise it's
    a kana-friendly explanation Kayo can paraphrase ('「ん」で終わったね')."""
    if not candidate.strip():
        return False, "言葉が聞き取れなかった"
    cand_h = to_hiragana(candidate)
    if cand_h.endswith("ん"):
        return False, f"「{candidate}」は「ん」で終わったね"
    required = last_phoneme(prev_word)
    if required is None:
        # The previous word ended on "ん" — caller should have ended the
        # game already. Be lenient and accept anything.
        return True, ""
    cand_first = cand_h[0]
    if cand_first in _SMALL_KANA_MAP:
        cand_first = _SMALL_KANA_MAP[cand_first]
    if cand_first != required:
        return False, f"「{required}」から始まる言葉でお願い"
    return True, ""


# Seed words Kayo can use to kick off a round. Keep ~30 so they don't
# repeat within a few sessions.
SEED_WORDS = [
    "りんご", "さくら", "きつね", "ねこ", "うさぎ",
    "たんぽぽ", "あさがお", "あめんぼ", "かたつむり", "とんぼ",
    "なすび", "きゅうり", "とうもろこし", "じゃがいも", "にんじん",
    "おにぎり", "うどん", "そうめん", "ようかん", "おまんじゅう",
    "ふじさん", "とうきょう", "おおさか", "ほっかいどう", "おきなわ",
    "ひこうき", "しんかんせん", "ふね", "じてんしゃ", "おうだんほどう",
]


def closing_line(turn_count: int) -> str:
    """Phrase Kayo says when a shiritori round ends naturally (user said
    "やめる" or "ん"). turn_count = total turns (Kayo + senior combined)."""
    return f"しりとりお疲れさまでした！全部で{turn_count}回続いたね。じゃあ次は何しよっか？"
