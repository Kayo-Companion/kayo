#!/usr/bin/env python3
"""Place a test phone call from Kayo to your phone.

Prerequisites:
  1. apps/voice running locally (uvicorn src.main:app --port 8000)
  2. cloudflared / ngrok tunnel exposing localhost:8000 publicly
  3. apps/voice/.env has OPENAI_API_KEY + TWILIO_* set
  4. apps/voice/.env has VOICE_API_URL=<your tunnel URL>
  5. Twilio phone number's voice webhook → <tunnel>/twilio/incoming

Usage:
  python scripts/test_call.py +819012345678
  python scripts/test_call.py +819012345678 --name "山田 花子" --about "園芸が好き"
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Place a test call from Kayo.")
    parser.add_argument("to_number", help="E.164 phone to dial, e.g. +819012345678")
    parser.add_argument("--api", default="http://localhost:8000", help="Voice API base URL")
    parser.add_argument("--name", default="テスト 太郎", help="Senior's name")
    parser.add_argument("--family", action="store_true", help="Treat as 'gift' flow (needs --introducer)")
    parser.add_argument("--introducer", default=None)
    parser.add_argument("--relationship", default="お子様")
    parser.add_argument("--about", default=None, help="Free-text personal context")
    args = parser.parse_args()

    if not args.to_number.startswith("+"):
        print("Phone number must be E.164 (start with +).", file=sys.stderr)
        return 2

    payload = {
        "to_number": args.to_number,
        "name": args.name,
        "is_self": not args.family,
        "introducer_name": args.introducer if args.family else None,
        "introducer_relationship": args.relationship if args.family else None,
        "about": args.about,
    }

    req = urllib.request.Request(
        f"{args.api}/admin/test-call-now",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Connection failed: {e}\nIs the voice service running?", file=sys.stderr)
        return 1

    print(f"Call placed.\n  call_sid:  {data['call_sid']}\n  senior_id: {data['senior_id']}")
    print("Pick up your phone — Kayo should be calling momentarily.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
