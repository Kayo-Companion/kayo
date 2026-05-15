"""OpenAI Realtime API <-> Twilio Media Streams audio bridge.

Both sides use G.711 μ-law @ 8kHz, so we pass audio frames through
without resampling. Twilio sends/expects base64-encoded payloads; OpenAI's
Realtime API also uses base64 for audio.

Flow per call:
  1. Twilio opens WS to /twilio/stream
  2. We open WS to wss://api.openai.com/v1/realtime?model=...
  3. Configure session.update with instructions + voice + g711_ulaw
  4. Forward Twilio "media" frames -> OpenAI input_audio_buffer.append
  5. Forward OpenAI response.audio.delta -> Twilio "media" out
  6. Capture transcripts on both sides for memory.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import websockets
from fastapi import WebSocket, WebSocketDisconnect
from websockets.asyncio.client import ClientConnection

from .config import get_settings
from .models import Senior
from .prompts import (
    PROMPT_VARIANT_SMART,
    build_kayo_prompt,
    build_opening_instructions,
    build_opening_script,
)
# Note: live regex distress detection was removed — see the comment in the
# transcription handler below. Distress is now decided post-call by the
# GPT summarizer (memory.summarize_call) for fewer false positives.

logger = logging.getLogger(__name__)

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"

# Per-model published rates (USD per 1M tokens), May 2026.
# https://developers.openai.com/api/docs/pricing
#
# Add a row here when you ship a new model — compute_cost_usd() picks the
# right one at runtime based on OPENAI_REALTIME_MODEL, so swapping the env
# var is the only change needed end-to-end.
PRICE_TABLE: dict[str, dict[str, float]] = {
    "gpt-realtime-2": {
        "audio_input":         32.00,
        "audio_input_cached":   0.40,
        "audio_output":        64.00,
        "text_input":           4.00,
        "text_input_cached":    0.40,
        "text_output":         16.00,
    },
    "gpt-realtime-1.5": {
        "audio_input":         32.00,
        "audio_input_cached":   0.40,
        "audio_output":        64.00,
        "text_input":           4.00,
        "text_input_cached":    0.40,
        "text_output":         16.00,
    },
    "gpt-realtime-mini": {
        "audio_input":         10.00,
        "audio_input_cached":   0.30,
        "audio_output":        20.00,
        "text_input":           0.60,
        "text_input_cached":    0.30,
        "text_output":          2.40,
    },
}
# Default to the most expensive model so unknown IDs over-estimate (safer
# than under-estimating a real bill).
DEFAULT_PRICES = PRICE_TABLE["gpt-realtime-2"]


def _prices_for(model: str | None) -> dict[str, float]:
    """Pick the price row for a model name. Prefix-match so dated snapshot
    IDs (e.g. "gpt-realtime-mini-2026-XX") still resolve correctly."""
    if not model:
        return DEFAULT_PRICES
    for key, prices in PRICE_TABLE.items():
        if model.startswith(key):
            return prices
    return DEFAULT_PRICES


def _session_caps_for_variant(variant: str) -> dict[str, int]:
    """Per-variant session caps. The persona drives how much room the
    model needs, not the underlying model size:

      - companion: 1-2 sentence turns (~20s of speech). Anti-rambling
        guardrail; this is what gives Kayo her "chatty grandma" rhythm.
      - smart: 2-4 sentence turns (~60s ceiling) so she can actually
        explain a topic without getting cut mid-thought.

    Opening greeting always needs ~600-800 audio tokens (identification
    + disclaimer + first question).
    """
    if variant == PROMPT_VARIANT_SMART:
        return {"ongoing": 1200, "opening": 1000}
    # companion (default)
    return {"ongoing": 400, "opening": 800}


def compute_cost_usd(usage: dict[str, int], model: str | None = None) -> float:
    """Sum the per-token rates over the per-call usage breakdown."""
    p = _prices_for(model)
    return round(
        usage.get("input_audio", 0)        / 1_000_000 * p["audio_input"]
      + usage.get("input_audio_cached", 0) / 1_000_000 * p["audio_input_cached"]
      + usage.get("output_audio", 0)       / 1_000_000 * p["audio_output"]
      + usage.get("input_text", 0)         / 1_000_000 * p["text_input"]
      + usage.get("input_text_cached", 0)  / 1_000_000 * p["text_input_cached"]
      + usage.get("output_text", 0)        / 1_000_000 * p["text_output"],
        6,
    )


# Japanese 相槌 (back-channel) acknowledgments. When the user says one of
# these mid- or post-Kayo-turn we should NOT treat it as a request for a new
# response — Kayo should just keep going (or stay silent if she's already
# done). semantic_vad with eagerness=low is also supposed to filter these
# out at the server, but it's unreliable on phone audio, so we belt-and-
# suspenders it here.
BACKCHANNEL_PATTERNS = {
    "うん", "うんうん", "うーん", "んー", "んん", "うんと", "うーんと",
    "はい", "はいはい",
    "ええ", "えー", "えーー", "えーえー",  # え* hesitations
    "そう", "そうそう", "そっか", "そうですね", "そうね", "そうだね",
    "そうよね", "そうかも", "そうかな", "そうですか",
    "へぇ", "へえ", "へー",
    "あ", "あぁ", "ああ", "あー", "あーあ",  # single-char "あ" comes up a lot as a thinking pause
    "あら", "あらー",
    "なるほど",
    "ふむ", "ふん",
    "おー", "おお",
    "まあ", "まぁ",
    "ふーん",
    "本当", "本当に", "ほんと", "ほんとに", "ほんとう",
    "そうかぁ", "そっかぁ",
    # Hesitation / vague non-answers — treat as backchannel so we don't
    # bombard the senior with more content when they're stalling.
    "どうだろう", "どうかな", "どうかしら", "なんだろう",
    "わからない", "わかんない", "わかんなーい",
    "ちょっと", "ちょっとね",
    "なんか", "なんかね",
    "えーっと", "えっと", "えっとね", "あのー", "あの",
}


# Splits on whitespace, commas, and the JP fullwidth comma so we can break
# multi-token backchannel utterances into pieces (e.g. "はい、はい、はい").
_BACKCHANNEL_SPLIT_RE = re.compile(r"[、,\s　]+")


def is_backchannel(text: str) -> bool:
    """True if `text` is a no-content acknowledgment we should not respond to.

    Handles three cases:
      1. Empty or whitespace-only.
      2. A single backchannel token possibly with trailing punctuation.
      3. Multiple backchannel tokens stuck together with commas/spaces,
         like "はい、はい" or "うん うん" — treats the whole utterance
         as a backchannel as long as every token is in the set.
    """
    if not text:
        return True
    # Strip whitespace + common punctuation/quote endings
    t = text.strip().rstrip("。、！？!?.…」』 　").strip()
    if not t:
        return True
    if t in BACKCHANNEL_PATTERNS:
        return True
    # Multi-token case: every piece must be a backchannel.
    tokens = [tok.strip() for tok in _BACKCHANNEL_SPLIT_RE.split(t) if tok.strip()]
    return bool(tokens) and all(tok in BACKCHANNEL_PATTERNS for tok in tokens)


def extract_usage(response_obj: dict[str, Any]) -> dict[str, int]:
    """Pull the per-response usage breakdown out of a `response.done` event.

    OpenAI Realtime returns:
      response.usage = {
        input_token_details:  {audio_tokens, text_tokens, cached_tokens,
                               cached_tokens_details: {audio_tokens, text_tokens}},
        output_token_details: {audio_tokens, text_tokens},
      }
    """
    u = response_obj.get("usage", {}) or {}
    inp = u.get("input_token_details", {}) or {}
    out = u.get("output_token_details", {}) or {}
    cached = inp.get("cached_tokens_details", {}) or {}

    cached_audio = int(cached.get("audio_tokens") or 0)
    cached_text  = int(cached.get("text_tokens") or 0)
    audio_total  = int(inp.get("audio_tokens") or 0)
    text_total   = int(inp.get("text_tokens")  or 0)

    return {
        "input_audio":        max(0, audio_total - cached_audio),
        "input_audio_cached": cached_audio,
        "input_text":         max(0, text_total - cached_text),
        "input_text_cached":  cached_text,
        "output_audio": int(out.get("audio_tokens") or 0),
        "output_text":  int(out.get("text_tokens")  or 0),
    }


@asynccontextmanager
async def open_realtime(model: str) -> AsyncIterator[ClientConnection]:
    settings = get_settings()
    url = f"{OPENAI_REALTIME_URL}?model={model}"
    # The GA Realtime API no longer needs the OpenAI-Beta header.
    headers = [("Authorization", f"Bearer {settings.openai_api_key}")]
    logger.info("Connecting to OpenAI Realtime: model=%s", model)
    try:
        async with websockets.connect(
            url,
            additional_headers=headers,
            max_size=16 * 1024 * 1024,
            ping_interval=20,
            ping_timeout=20,
        ) as ws:
            logger.info("OpenAI Realtime connected")
            yield ws
    except Exception:
        logger.exception("Failed to open OpenAI Realtime WebSocket")
        raise


async def configure_session(
    openai_ws: ClientConnection,
    senior: Senior,
    past_summaries: list[str] | None,
) -> None:
    """Send session.update + an initial response.create to make Kayo greet first.

    Uses the GA Realtime API schema (session.type='realtime', nested audio.*).
    Required for `gpt-realtime-2` and forward; also accepted by older models.
    """
    settings = get_settings()
    model = settings.openai_realtime_model
    variant = (settings.kayo_prompt_variant or "companion").strip().lower()
    if variant != PROMPT_VARIANT_SMART:
        variant = "companion"
    # System prompt + opening meta-instructions are variant- and model-aware
    # (live in prompts_mini.py / prompts_realtime2.py / prompts_smart.py).
    # The audible opening script itself is shared business logic.
    instructions = build_kayo_prompt(senior, past_summaries, model=model)
    full_script = build_opening_script(senior, past_summaries)
    opening_instructions = build_opening_instructions(full_script, model=model)
    caps = _session_caps_for_variant(variant)
    logger.info(
        "Session config: model=%s variant=%s caps: ongoing=%d opening=%d",
        model, variant, caps["ongoing"], caps["opening"],
    )

    session_update = {
        "type": "session.update",
        "session": {
            "type": "realtime",
            "instructions": instructions,
            # Per-model output cap. Mini stays terse (companion persona —
            # 1-2 sentence turns); realtime-2 gets room to actually answer
            # substantive questions (ChatGPT-style smart-assistant persona).
            "max_output_tokens": caps["ongoing"],
            "audio": {
                "input": {
                    # Twilio Media Streams sends G.711 μ-law @ 8kHz.
                    "format": {"type": "audio/pcmu"},
                    "transcription": {
                        "model": "gpt-4o-transcribe",
                        # Lock to Japanese — silence/noise was being
                        # hallucinated as Greek/Czech/Indonesian otherwise.
                        # The model itself still understands English audio
                        # (e.g. iOS Call Screening) directly from waveform,
                        # regardless of this transcription language setting.
                        "language": "ja",
                    },
                    "turn_detection": {
                        # semantic_vad waits for a complete utterance instead
                        # of just silence. eagerness=low = most patient.
                        "type": "semantic_vad",
                        "eagerness": "low",
                        # During the greeting, block both: (a) interruption of
                        # Kayo by background audio, and (b) auto-creating a
                        # new response when iOS screening AI talks. After the
                        # greeting completes we flip both back to True for
                        # normal conversation (see _pump_openai_to_twilio).
                        "interrupt_response": False,
                        "create_response": False,
                    },
                },
                "output": {
                    "format": {"type": "audio/pcmu"},
                    "voice": settings.openai_realtime_voice,
                    # Slightly slower than default; tweaked to feel natural for
                    # senior listeners without sounding sluggish.
                    "speed": 0.92,
                },
            },
        },
    }
    await openai_ws.send(json.dumps(session_update))

    # Greeting: feed the structured instructions directly so the model
    # follows the script + tail rules and doesn't ad-lib. Override the
    # session cap because the opening (identification + disclaimer +
    # question) needs ~600 audio tokens, more than the mini ongoing cap.
    await openai_ws.send(
        json.dumps(
            {
                "type": "response.create",
                "response": {
                    "instructions": opening_instructions,
                    "max_output_tokens": caps["opening"],
                },
            }
        )
    )


class CallBridge:
    """Tracks state for a single call and bridges Twilio <-> OpenAI WebSockets."""

    def __init__(
        self,
        twilio_ws: WebSocket,
        senior: Senior,
        past_summaries: list[str] | None = None,
    ) -> None:
        self.twilio_ws = twilio_ws
        self.senior = senior
        self.past_summaries = past_summaries or []

        self.stream_sid: str | None = None
        self.transcript: list[dict[str, Any]] = []
        self.distress_detected = False
        self.distress_reason: str | None = None
        # The first response.done event we see is the opening greeting; on
        # that event we flip interrupt_response back to True so the rest of
        # the call has normal barge-in behavior.
        self._greeting_done = False
        # Monotonic time at which the greeting finished. Used to ignore any
        # user transcription that arrives in the first ~1.5s after — those
        # are almost always speakerphone echo / background noise hallucinated
        # as Japanese by gpt-4o-transcribe, not real user speech.
        self._greeting_done_at: float | None = None
        # Tracks whether a response is currently being generated server-side.
        # Used to avoid firing duplicate `response.create` calls that race
        # semantic_vad's auto-create (when it does fire).
        self._response_in_progress = False
        # Timestamp of the most recent audio chunk we forwarded to Twilio.
        # Used to estimate whether audio is still playing in the user's
        # earpiece even after the server-side response.done has fired —
        # OpenAI streams ~20s of audio over a few seconds, so server-done
        # ≠ playback-done, and the user's barge-in needs Twilio clear
        # for that whole playback window.
        self._last_audio_sent_at: float | None = None
        # status + timestamp of the most recent response.done event. Used to:
        # - skip transcripts that arrive in the brief echo window after AI
        #   finishes speaking (mic picks up Kayo's own audio as "user")
        # - extend the patience pause after a user-cancelled response so we
        #   wait for the whole interruption instead of replying to the first
        #   1-second fragment
        self._last_response_status: str | None = None
        self._last_response_done_at: float | None = None
        # Pending response.create after the patience pause. We cancel it if a
        # new transcription arrives during the pause (user was still mid-
        # thought) — only the *latest* user turn should trigger a response.
        self._pending_response_task: asyncio.Task[None] | None = None
        # Token usage rolled up across all `response.done` events on this call.
        self.usage_totals: dict[str, int] = {
            "input_audio": 0,
            "input_audio_cached": 0,
            "input_text": 0,
            "input_text_cached": 0,
            "output_audio": 0,
            "output_text": 0,
        }

    @property
    def cost_usd(self) -> float:
        return compute_cost_usd(self.usage_totals, get_settings().openai_realtime_model)

    async def _fire_response_after_pause(
        self, openai_ws: ClientConnection, delay_s: float
    ) -> None:
        """Wait `delay_s`, then fire response.create — unless cancelled.

        The pause gives the user a moment to keep talking after a brief
        thinking pause; if a new transcription arrives, the parent cancels
        this task and schedules a fresh one with the newer transcript in
        context.
        """
        try:
            await asyncio.sleep(delay_s)
        except asyncio.CancelledError:
            return
        # Re-check state — the user may have started a new response in the
        # meantime, or interrupted, etc.
        if self._response_in_progress:
            logger.debug("Skip response.create after pause: already in progress")
            return
        try:
            await openai_ws.send(json.dumps({"type": "response.create"}))
        except Exception:
            logger.exception("Failed to send response.create after pause")


    async def run(self) -> list[dict[str, Any]]:
        settings = get_settings()
        async with open_realtime(settings.openai_realtime_model) as openai_ws:
            await configure_session(openai_ws, self.senior, self.past_summaries)
            twilio_task = asyncio.create_task(self._pump_twilio_to_openai(openai_ws))
            openai_task = asyncio.create_task(self._pump_openai_to_twilio(openai_ws))
            try:
                await asyncio.wait(
                    {twilio_task, openai_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )
            finally:
                for t in (twilio_task, openai_task):
                    if not t.done():
                        t.cancel()
        return self.transcript

    async def _pump_twilio_to_openai(self, openai_ws: ClientConnection) -> None:
        media_count = 0
        try:
            while True:
                raw = await self.twilio_ws.receive_text()
                msg = json.loads(raw)
                event = msg.get("event")

                if event == "connected":
                    logger.info("Twilio connected event: %s", msg)
                elif event == "start":
                    self.stream_sid = msg["start"]["streamSid"]
                    logger.info("Twilio stream started: %s", self.stream_sid)
                elif event == "media":
                    media_count += 1
                    if media_count == 1:
                        logger.info("First media frame received from Twilio")
                    payload = msg["media"]["payload"]  # base64 g711_ulaw
                    await openai_ws.send(
                        json.dumps(
                            {
                                "type": "input_audio_buffer.append",
                                "audio": payload,
                            }
                        )
                    )
                elif event == "mark":
                    pass
                elif event == "stop":
                    logger.info("Twilio stream stopped: %s (received %d media frames)",
                                self.stream_sid, media_count)
                    return
                else:
                    logger.info("Twilio event=%s msg=%s", event, msg)
        except WebSocketDisconnect:
            logger.info("Twilio WS disconnected (received %d media frames)", media_count)
        except Exception:
            logger.exception("Error in Twilio->OpenAI pump")

    async def _pump_openai_to_twilio(self, openai_ws: ClientConnection) -> None:
        audio_chunks_sent = 0
        try:
            async for raw in openai_ws:
                msg = json.loads(raw)
                etype = msg.get("type")

                # GA Realtime API: audio frames arrive as response.output_audio.delta.
                # (Legacy API used response.audio.delta — different event name.)
                if etype == "response.output_audio.delta":
                    audio_b64 = msg.get("delta")
                    if audio_b64 and self.stream_sid:
                        audio_chunks_sent += 1
                        if audio_chunks_sent == 1:
                            logger.info("First audio chunk forwarded to Twilio")
                        self._last_audio_sent_at = asyncio.get_event_loop().time()
                        await self.twilio_ws.send_text(
                            json.dumps(
                                {
                                    "event": "media",
                                    "streamSid": self.stream_sid,
                                    "media": {"payload": audio_b64},
                                }
                            )
                        )

                elif etype == "response.output_audio_transcript.done":
                    text = msg.get("transcript", "")
                    if text:
                        logger.info("Assistant said: %s", text)
                        self.transcript.append({"role": "assistant", "text": text})
                    # First assistant response = opening greeting completed.
                    # Flip interrupt_response back to True so the rest of the
                    # call has normal barge-in behavior. We resend the FULL
                    # audio config (not a partial) because the API treats
                    # nested objects as replacements, not merges — sending
                    # only `audio.input.turn_detection` would clear format
                    # and transcription and break input audio entirely.
                    if not self._greeting_done:
                        self._greeting_done = True
                        self._greeting_done_at = asyncio.get_event_loop().time()
                        s = get_settings()
                        await openai_ws.send(
                            json.dumps(
                                {
                                    "type": "session.update",
                                    "session": {
                                        "type": "realtime",
                                        "audio": {
                                            "input": {
                                                "format": {"type": "audio/pcmu"},
                                                "transcription": {
                                                    "model": "gpt-4o-transcribe",
                                                    "language": "ja",
                                                },
                                                "turn_detection": {
                                                    "type": "semantic_vad",
                                                    # `low` waits ~1.5-2s of silence before
                                                    # committing (vs. ~0.5-1s for `medium`).
                                                    # Trading per-turn snappiness for fewer
                                                    # mid-thought commits — seniors often
                                                    # pause to think, and committing too eagerly
                                                    # split "やっぱり孫の顔見るのが楽しいのかな
                                                    # …あ…本当に…" into 3 separate turns and
                                                    # made Kayo cut in on each one.
                                                    "eagerness": "low",
                                                    # IMPORTANT: server-side interrupt is OFF.
                                                    # If true, the server cancels Kayo's
                                                    # response on ANY detected user audio —
                                                    # including 相槌 ("はい", "うん") and
                                                    # speakerphone bleed of Kayo's own voice.
                                                    # That made her output fragmented:
                                                    # "私はAIです。かよさん、" → cut by "はい"
                                                    # → "お話できれば" → cut again.
                                                    # We do barge-in MANUALLY in the
                                                    # transcription handler instead, only
                                                    # firing response.cancel when the
                                                    # transcribed turn is substantive
                                                    # (non-backchannel).
                                                    "interrupt_response": False,
                                                    # IMPORTANT: bridge owns response.create.
                                                    # Letting semantic_vad auto-fire while we
                                                    # also fired created racing duplicates and
                                                    # phantom responses on partial commits.
                                                    "create_response": False,
                                                },
                                            },
                                            "output": {
                                                "format": {"type": "audio/pcmu"},
                                                "voice": s.openai_realtime_voice,
                                                "speed": 0.92,
                                            },
                                        },
                                    },
                                }
                            )
                        )
                        logger.info(
                            "Greeting done — server interrupt OFF (bridge handles barge-in via transcription)"
                        )

                elif etype == "conversation.item.input_audio_transcription.completed":
                    text = msg.get("transcript", "")
                    if text:
                        logger.info("User said: %s", text)
                        self.transcript.append({"role": "user", "text": text})
                    # Note: live regex-based distress detection has been
                    # removed (was: safety.detect_distress here). Distress
                    # is now decided by the post-call GPT summarizer, which
                    # judges from the full conversation context and avoids
                    # false positives on casual usage of "苦しい" / "辛い"
                    # in everyday talk. See twilio_handler.py finalize.
                    # Bridge owns response timing (create_response: false on
                    # the session post-greeting). Fire response.create after a
                    # short patience pause — and only if all of these hold:
                    #   - greeting is finished (otherwise we'd race the opening)
                    #   - we're past the post-greeting noise grace period
                    #     (immediately-after-greeting transcriptions are
                    #     almost always speakerphone echo or AI-screening
                    #     noise hallucinated as Japanese by the transcriber)
                    #   - no response is already mid-flight
                    #   - the user actually said something substantive
                    #     (not a back-channel like "うん" / "そう")
                    # If a NEW transcription arrives during the pause, cancel
                    # the pending fire — the user was still mid-thought.
                    if self._pending_response_task and not self._pending_response_task.done():
                        self._pending_response_task.cancel()
                        self._pending_response_task = None
                    now = asyncio.get_event_loop().time()
                    GRACE_S = 1.5
                    ECHO_GUARD_S = 0.6
                    in_grace = (
                        self._greeting_done_at is not None
                        and (now - self._greeting_done_at) < GRACE_S
                    )
                    # Echo guard: if our last response completed normally
                    # within the last ~600ms, this transcript is almost
                    # certainly speakerphone bleed / background noise that
                    # semantic_vad mis-committed as "user said it". Skip.
                    #
                    # We only apply this when the response COMPLETED, not
                    # when it was CANCELLED — a cancelled response means
                    # the user really did interrupt, and we want to react.
                    in_echo = (
                        self._last_response_done_at is not None
                        and self._last_response_status == "completed"
                        and (now - self._last_response_done_at) < ECHO_GUARD_S
                    )
                    # Explicit barge-in. Two flavors:
                    #
                    #  (A) Server-side response still being generated
                    #      (_response_in_progress=True):
                    #         → send response.cancel to OpenAI
                    #         → send clear to Twilio (drop buffered audio)
                    #
                    #  (B) Server-side response.done already fired, but
                    #      audio is still playing in the user's earpiece
                    #      because Twilio buffers ~20s of streamed audio:
                    #         → can't response.cancel (nothing active)
                    #         → still send clear to Twilio so the playback
                    #           stops immediately. Otherwise old audio
                    #           overlaps with the new response we're about
                    #           to generate, which feels like Kayo "talks
                    #           over" the user.
                    #
                    # Both gated on the same conditions: greeting done,
                    # past grace, not in echo window, not a 相槌.
                    AUDIO_PLAYBACK_TAIL_S = 3.0
                    audio_still_playing = (
                        self._last_audio_sent_at is not None
                        and (now - self._last_audio_sent_at) < AUDIO_PLAYBACK_TAIL_S
                    )
                    should_barge_in = (
                        self._greeting_done
                        and (self._response_in_progress or audio_still_playing)
                        and not in_grace
                        and not in_echo
                        and not is_backchannel(text)
                    )
                    if should_barge_in:
                        if self._response_in_progress:
                            try:
                                await openai_ws.send(
                                    json.dumps({"type": "response.cancel"})
                                )
                                logger.info(
                                    "Barge-in (active): cancelling AI response (user said %r)",
                                    text,
                                )
                            except Exception:
                                logger.exception(
                                    "Failed to send response.cancel on barge-in"
                                )
                        else:
                            logger.info(
                                "Barge-in (playback): clearing Twilio buffer (user said %r)",
                                text,
                            )
                        if self.stream_sid:
                            try:
                                await self.twilio_ws.send_text(
                                    json.dumps(
                                        {
                                            "event": "clear",
                                            "streamSid": self.stream_sid,
                                        }
                                    )
                                )
                            except Exception:
                                logger.exception("Failed to clear Twilio audio buffer")
                    # Interrupt-aware patience: if the user just cancelled
                    # Kayo's response, they're MID-INTERRUPTION. Their first
                    # transcribed fragment is probably not the whole thought.
                    # Wait longer to give them time to finish — newer
                    # transcripts will cancel + reschedule this pending fire.
                    is_post_interrupt = (
                        self._last_response_status == "cancelled"
                        and self._last_response_done_at is not None
                        and (now - self._last_response_done_at) < 3.0
                    )
                    # Patience for normal turns: 1.0s so that trailing
                    # hesitations like "そうだね…えー" / "孫の顔…あ…本当に"
                    # don't trigger an early AI response when the user
                    # was just pausing to think. If a new transcription
                    # arrives within the window, the pending response
                    # is cancelled and rescheduled with combined context.
                    # Tuned alongside semantic_vad eagerness=low so the
                    # commit itself already takes ~1.5-2s of silence —
                    # adding 1s of bridge-side patience on top covers
                    # cases where VAD still committed eagerly.
                    patience_s = 1.5 if is_post_interrupt else 1.0

                    if not self._greeting_done:
                        pass
                    elif in_grace:
                        logger.info(
                            "Skip response.create: post-greeting grace (transcript=%r)",
                            text,
                        )
                    elif in_echo:
                        logger.info(
                            "Skip response.create: post-AI echo window (transcript=%r)",
                            text,
                        )
                    elif self._response_in_progress:
                        logger.debug("Skip response.create: one already in progress")
                    elif is_backchannel(text):
                        logger.info("Skip response.create: backchannel %r", text)
                    else:
                        self._pending_response_task = asyncio.create_task(
                            self._fire_response_after_pause(openai_ws, patience_s)
                        )

                # Note: we deliberately do NOT send response.cancel on
                # speech_started. semantic_vad handles barge-in natively,
                # and over-the-phone echo (the speaker feeding back into the
                # mic) was firing speech_started after every assistant
                # response, causing cancel_not_active errors and the model
                # restarting its greeting from scratch.

                elif etype == "error":
                    err = msg.get("error", {}) or {}
                    code = (err.get("code") or "").lower()
                    err_msg = (err.get("message") or "").lower()
                    # `response_already_active` fires when our fallback
                    # response.create races semantic_vad's auto-create. That's
                    # exactly the case we're guarding against — log at debug
                    # not error.
                    if "already" in err_msg or code == "response_already_active":
                        logger.debug("OpenAI dedupe: %s", err)
                    else:
                        logger.error("OpenAI Realtime error: %s", err)
                elif etype == "session.created":
                    logger.info("OpenAI session.created")
                elif etype == "session.updated":
                    logger.info("OpenAI session.updated")
                elif etype == "response.output_audio.done":
                    logger.info("OpenAI response.output_audio.done (chunks sent: %d)",
                                audio_chunks_sent)
                elif etype == "response.created":
                    # Marks server-side that a response is being generated.
                    # Together with response.done it gates our smart fallback.
                    self._response_in_progress = True
                elif etype == "response.done":
                    self._response_in_progress = False
                    resp_obj = msg.get("response", {}) or {}
                    self._last_response_status = resp_obj.get("status")
                    self._last_response_done_at = asyncio.get_event_loop().time()
                    # Aggregate token usage. response.usage breakdown is the
                    # billing-grade source of truth.
                    delta = extract_usage(msg.get("response", {}) or {})
                    for k, v in delta.items():
                        self.usage_totals[k] = self.usage_totals.get(k, 0) + v
                    logger.info(
                        "response.done usage: in_audio=%d (cached %d) "
                        "in_text=%d (cached %d) out_audio=%d out_text=%d "
                        "-> running total $%.4f",
                        delta["input_audio"], delta["input_audio_cached"],
                        delta["input_text"],  delta["input_text_cached"],
                        delta["output_audio"], delta["output_text"],
                        self.cost_usd,
                    )
        except websockets.ConnectionClosed:
            logger.info("OpenAI WS closed")
        except Exception:
            logger.exception("Error in OpenAI->Twilio pump")
