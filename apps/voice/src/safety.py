"""Lightweight pattern-based safety detectors. Run on transcript text.

These complement (not replace) the LLM-side safety prompt. We use them to
trigger family notifications and to flag calls in the dashboard. False
positives are tolerable; false negatives on health distress are not.
"""

from __future__ import annotations

import re

# Distress patterns — health/emergency
DISTRESS_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"具合が悪い",
        r"胸が(苦しい|痛い)",
        r"息が(できない|苦しい)",
        r"動けない",
        r"倒れ(た|そう)",
        r"意識が(遠のく|もうろう)",
        r"救急車",
        r"とても(辛|つら)い",
        r"死にたい",
        r"消えてしまいたい",
    )
)

# Suspicious / scam-adjacent patterns — caller (the senior) being asked
SUSPICIOUS_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p)
    for p in (
        r"振り?込",
        r"口座(番号)?",
        r"暗証番号",
        r"クレジットカード",
        r"金庫",
    )
)


def detect_distress(text: str) -> tuple[bool, str | None]:
    """Return (matched, reason). Reason is the first matched pattern source."""
    for pattern in DISTRESS_PATTERNS:
        if pattern.search(text):
            return True, pattern.pattern
    return False, None


def detect_suspicious(text: str) -> tuple[bool, str | None]:
    for pattern in SUSPICIOUS_PATTERNS:
        if pattern.search(text):
            return True, pattern.pattern
    return False, None
