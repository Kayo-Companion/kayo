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
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import websockets
from fastapi import WebSocket, WebSocketDisconnect
from websockets.asyncio.client import ClientConnection

from .config import get_settings
from .models import Senior
from .prompts import build_kayo_prompt
from .safety import detect_distress

logger = logging.getLogger(__name__)

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"


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
    instructions = build_kayo_prompt(senior, past_summaries)
    is_first_call = not (past_summaries or [])

    # Anti-scam disclaimer is mandatory at the start of every call.
    disclaimer = (
        "初めに言っておきますね、私はAIです。"
        "私からクレジットカード番号や、銀行の口座、お金の話、"
        "個人情報をお聞きすることは絶対にありません。安心してくださいね。"
    )

    # Identity + (family-only) introducer mention + disclaimer — same on
    # every call. We do NOT repeat the introducer's name for emphasis.
    if senior.is_self:
        prefix = f"もしもし、お話相手のカヨです。{disclaimer}"
    else:
        introducer = senior.introducer_name or "ご家族"
        relationship = senior.introducer_relationship or "ご家族"
        prefix = (
            f"もしもし、お話相手のカヨです。"
            f"{relationship}の{introducer}さんからのご紹介でお電話しました。"
            f"{disclaimer}"
        )

    # Build the opening as ONE complete script the model reads end-to-end.
    # We deliberately do NOT name-drop the user's interests in the opening
    # (it was creepy, like "I read your file"). The about_me text stays in
    # the system prompt so Kayo can reference it organically during the call.
    if is_first_call:
        full_script = (
            f"{prefix}"
            f"{senior.name}さん、初めまして。"
            f"最近、何かハマっていることはありますか？"
        )
    else:
        full_script = (
            f"もしもし、お話相手のカヨです。"
            f"{senior.name}さん、こんにちは。今日は何について話しましょうか？"
        )

    opening_instructions = (
        "これは電話の最初の挨拶です。**最後まで一気に話し切ってください**。"
        "途中で止まったり省略したりしないこと。\n\n"
        "声の出し方：60代後半の優しいおばちゃんのように、温かく、感情を込めて、"
        "ゆっくり話してください。カスタマーサービスや受付のような硬い読み上げは絶対にダメ。"
        "親しみのある柔らかいトーンで、近所のお友達に話しかけるように。\n\n"
        f"話す内容（途中で切らずに最後まで）：\n{full_script}"
    )

    session_update = {
        "type": "session.update",
        "session": {
            "type": "realtime",
            "instructions": instructions,
            # Tight cap for ongoing turns so Kayo doesn't ramble. The opening
            # greeting (much longer) overrides this with its own cap on the
            # response.create below.
            "max_output_tokens": 200,
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
                    "speed": 0.95,
                },
            },
        },
    }
    await openai_ws.send(json.dumps(session_update))

    # Greeting: feed the structured instructions directly so the model
    # follows the script + tail rules and doesn't ad-lib. Override the
    # session cap because the opening (identification + disclaimer +
    # question) needs ~600 audio tokens, more than the ongoing cap.
    await openai_ws.send(
        json.dumps(
            {
                "type": "response.create",
                "response": {
                    "instructions": opening_instructions,
                    "max_output_tokens": 800,
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
                                                    "eagerness": "low",
                                                    "interrupt_response": True,
                                                    "create_response": True,
                                                },
                                            },
                                            "output": {
                                                "format": {"type": "audio/pcmu"},
                                                "voice": s.openai_realtime_voice,
                                                "speed": 0.95,
                                            },
                                        },
                                    },
                                }
                            )
                        )
                        logger.info("Greeting done — interrupt_response=True for the rest of the call")

                elif etype == "conversation.item.input_audio_transcription.completed":
                    text = msg.get("transcript", "")
                    if text:
                        logger.info("User said: %s", text)
                        self.transcript.append({"role": "user", "text": text})
                        matched, reason = detect_distress(text)
                        if matched and not self.distress_detected:
                            self.distress_detected = True
                            self.distress_reason = reason
                            logger.warning(
                                "Distress detected on call: %s — %s", self.stream_sid, reason
                            )
                    # Belt-and-suspenders: explicitly request a response after
                    # every user-utterance transcription. semantic_vad with
                    # eagerness=low sometimes never declares end-of-turn on
                    # inbound calls (the user starts mid-thought, shorter
                    # utterances, etc.), so create_response: true on the
                    # session has nothing to trigger on. If semantic_vad has
                    # already fired one, the API rejects this with
                    # "response_already_active" and we swallow the error.
                    if self._greeting_done:
                        try:
                            await openai_ws.send(json.dumps({"type": "response.create"}))
                        except Exception:
                            logger.exception("Failed to send fallback response.create")

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
        except websockets.ConnectionClosed:
            logger.info("OpenAI WS closed")
        except Exception:
            logger.exception("Error in OpenAI->Twilio pump")
