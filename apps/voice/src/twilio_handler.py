"""Twilio webhook + outbound REST helpers.

- /twilio/incoming returns TwiML that opens a Media Stream to /twilio/stream
- /twilio/stream is a WebSocket; the bridge wires it to OpenAI Realtime
- place_outbound_call() places a call from Kayo's number to a senior; the
  same /twilio/incoming TwiML (parameterized by senior_id) handles audio.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from urllib.parse import urlencode

from fastapi import APIRouter, Form, HTTPException, Request, WebSocket
from fastapi.responses import Response
from tenacity import retry, stop_after_attempt, wait_exponential
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client
from twilio.twiml.voice_response import Connect, VoiceResponse

from .config import get_settings
from .db import get_db, minutes_for_call
from .memory import summarize_and_persist
from .notifications import notify_distress
from .openai_bridge import CallBridge

logger = logging.getLogger(__name__)
router = APIRouter()


def _twilio_client() -> Client:
    s = get_settings()
    return Client(s.twilio_account_sid, s.twilio_auth_token)


@router.post("/twilio/incoming")
async def twilio_incoming(
    request: Request,
    CallSid: str = Form(...),  # noqa: N803 — Twilio param naming
    From: str = Form(...),  # noqa: N803
    To: str = Form(...),  # noqa: N803
) -> Response:
    """TwiML response: open a bidirectional Media Stream to our WS endpoint.

    The senior_id can be passed in via query params (set when we place the
    outbound call). For inbound calls (a senior dialing in) we look up by
    phone number.
    """
    settings = get_settings()
    db = get_db()

    senior_id = request.query_params.get("senior_id")
    if not senior_id:
        senior = await db.find_senior_by_phone(From)
        if senior is None:
            # Unknown number — refuse politely. We deliberately don't engage
            # because (a) every minute on the line costs Twilio + OpenAI fees
            # and (b) we don't have any context on this caller, so the
            # assistant can't be useful or safe.
            logger.warning("Refused inbound call from unregistered number %s", From)
            return _twiml_response(_unknown_caller_twiml())
        senior_id = senior.id

    ws_host = settings.voice_api_url.replace("https://", "").replace("http://", "")
    # Use a path parameter — query strings get stripped by some intermediaries
    # on WebSocket upgrade. Path is bulletproof.
    stream_url = f"wss://{ws_host}/twilio/stream/{senior_id}"

    response = VoiceResponse()
    connect = Connect()
    connect.stream(url=stream_url)
    response.append(connect)

    logger.info("Incoming call %s for senior %s -> stream=%s", CallSid, senior_id, stream_url)
    return _twiml_response(str(response))


@router.websocket("/twilio/stream/{senior_id}")
async def twilio_stream(websocket: WebSocket, senior_id: str) -> None:
    # Twilio Media Streams connects without requesting a subprotocol, so we
    # accept with no subprotocol. (Echoing one back that wasn't requested
    # makes some servers/clients close the handshake.)
    await websocket.accept()
    logger.info("Twilio WS accepted from %s for senior %s", websocket.client, senior_id)

    db = get_db()
    senior = await db.get_senior(senior_id)
    if senior is None:
        logger.error("Twilio WS — senior %s not found in DB", senior_id)
        await websocket.close(code=1008, reason="senior not found")
        return

    logger.info("Twilio WS bridging senior=%s name=%s", senior.id, senior.name)
    past_summaries = await db.get_recent_summaries(senior_id, limit=5)
    call = await db.create_call(senior_id=senior_id)

    bridge = CallBridge(websocket, senior, past_summaries=past_summaries)
    try:
        transcript = await bridge.run()
    except Exception:
        logger.exception("Bridge failed for senior %s", senior_id)
        transcript = bridge.transcript

    ended_at = datetime.now(UTC)
    used_minutes = minutes_for_call(call.started_at, ended_at)

    # Persist transcript + token usage / cost. The bridge accumulated usage
    # from every `response.done` event during the call.
    await db.finalize_call(
        call_id=call.id,
        transcript=transcript,
        distress_detected=bridge.distress_detected,
        distress_reason=bridge.distress_reason,
        openai_usage=bridge.usage_totals,
        openai_cost_usd=bridge.cost_usd,
    )

    # Per-call cost summary — surfaces in /tmp/kayo-voice.log so you can spot
    # outlier-expensive calls without querying Supabase.
    u = bridge.usage_totals
    duration_s = (ended_at - call.started_at).total_seconds()
    cost = bridge.cost_usd
    cost_per_min = (cost / duration_s * 60.0) if duration_s > 0 else 0.0
    cached_in_total = u["input_audio_cached"] + u["input_text_cached"]
    fresh_in_total  = u["input_audio"]        + u["input_text"]
    cache_ratio = (cached_in_total / (cached_in_total + fresh_in_total) * 100
                   if (cached_in_total + fresh_in_total) else 0.0)
    logger.info(
        "CALL COST senior=%s call=%s duration=%.1fs "
        "in_audio=%d (cached %d) in_text=%d (cached %d) "
        "out_audio=%d out_text=%d "
        "cache_hit=%.1f%% cost=$%.4f ($%.4f/min)",
        senior.id, call.id, duration_s,
        u["input_audio"], u["input_audio_cached"],
        u["input_text"],  u["input_text_cached"],
        u["output_audio"], u["output_text"],
        cache_ratio, cost, cost_per_min,
    )

    # Bill the family for the minutes used (rounded up).
    if used_minutes > 0:
        try:
            await db.increment_minutes_used(senior.family_id, used_minutes)
        except Exception:
            logger.exception("Failed to record %d minutes for family %s", used_minutes, senior.family_id)

    if transcript:
        try:
            summary = await summarize_and_persist(
                call_id=call.id,
                senior_id=senior.id,
                transcript=transcript,
                agent_name=senior.agent_name or "カヨ",
            )
            if summary.distress_detected or bridge.distress_detected:
                await notify_distress(senior=senior, call_id=call.id, summary=summary.summary)
        except Exception:
            logger.exception("Failed to summarize/notify for call %s", call.id)


@router.post("/twilio/call-status")
async def twilio_call_status(
    request: Request,
    CallSid: str = Form(...),  # noqa: N803
    CallStatus: str = Form(...),  # noqa: N803
    To: str = Form(...),  # noqa: N803
) -> Response:
    """Twilio posts here when an outbound call ends (we wire the URL up in
    `place_outbound_call`). If the call ended in `no-answer` / `busy` /
    `failed` AND the senior has emergency_on_no_answer enabled, send an SMS
    to the configured emergency contact.
    """
    senior_id = request.query_params.get("senior_id")
    logger.info(
        "Call status callback: sid=%s status=%s to=%s senior=%s",
        CallSid, CallStatus, To, senior_id,
    )

    NO_ANSWER_STATUSES = {"no-answer", "busy", "failed"}
    if CallStatus not in NO_ANSWER_STATUSES:
        return Response(status_code=204)

    db = get_db()
    senior = await db.get_senior(senior_id) if senior_id else None
    if senior is None:
        # Last-resort lookup by To number — handles the case where senior_id
        # got dropped from the callback URL.
        senior = await db.find_senior_by_phone(To)
    if senior is None:
        logger.warning("Call-status: no senior matched for %s / %s", senior_id, To)
        return Response(status_code=204)

    if not senior.emergency_on_no_answer or not senior.emergency_contact_phone:
        return Response(status_code=204)

    # Format current time in the senior's call timezone for the SMS.
    try:
        import pytz
        tz = pytz.timezone(senior.call_timezone or "Asia/Tokyo")
    except Exception:
        import pytz
        tz = pytz.timezone("Asia/Tokyo")
    now = datetime.now(tz)
    when = f"{now.month}月{now.day}日 {now.hour}時{now.minute:02d}分頃"

    body = (
        f"【カヨ】{senior.name}さん（{when}）にお電話しましたが、"
        f"お出になりませんでした。"
    )
    try:
        await send_sms(to=senior.emergency_contact_phone, body=body)
        logger.info(
            "No-answer SMS sent to %s for senior %s",
            senior.emergency_contact_phone, senior.id,
        )
    except Exception:
        logger.exception("Failed to send no-answer SMS for senior %s", senior.id)

    return Response(status_code=204)


def _twiml_response(body: str) -> Response:
    return Response(content=body, media_type="application/xml")


def _unknown_caller_twiml() -> str:
    """Polite refusal in Japanese. Used when caller's number is not in our DB."""
    response = VoiceResponse()
    response.say(
        "申し訳ございません。お電話番号が登録されていないようです。"
        "ご家族の方からのご招待をお待ちしております。",
        language="ja-JP",
        voice="Polly.Mizuki",
    )
    response.hangup()
    return str(response)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def place_outbound_call(
    senior_id: str,
    to_number: str,
    *,
    enforce_quota: bool = True,
) -> str:
    """Place a call from Kayo's number to a senior. Returns Twilio CallSid.

    enforce_quota=False bypasses the minutes_used < minutes_limit check —
    used by the dev /admin/test-call-now endpoint.
    """
    settings = get_settings()
    db = get_db()

    if enforce_quota:
        senior = await db.get_senior(senior_id)
        if senior is None:
            raise HTTPException(status_code=404, detail="senior_not_found")
        if not await db.family_has_minutes(senior.family_id):
            raise HTTPException(status_code=402, detail="minutes_exhausted")

    client = _twilio_client()
    qs = urlencode({"senior_id": senior_id})
    twiml_url = f"{settings.voice_api_url}/twilio/incoming?{qs}"
    # Twilio posts the final call status here when the call ends. We use it
    # to fire the no-answer emergency SMS (if the senior has it enabled).
    status_callback_url = f"{settings.voice_api_url}/twilio/call-status?{qs}"

    try:
        call = client.calls.create(
            to=to_number,
            from_=settings.twilio_phone_number,
            url=twiml_url,
            timeout=30,
            status_callback=status_callback_url,
            status_callback_method="POST",
            status_callback_event=["completed"],
            # DetectMessageEnd waits through pre-recorded announcements
            # (Japanese carrier scam warnings, voicemail greetings, etc.)
            # so our webhook fires only when the line is clear and the
            # human has actually picked up.
            machine_detection="DetectMessageEnd",
            machine_detection_speech_threshold=2400,  # ms; default 2400
            machine_detection_silence_timeout=5000,   # ms before assuming human
        )
    except TwilioRestException as exc:
        logger.error("Twilio outbound failed for senior %s: %s", senior_id, exc)
        raise HTTPException(status_code=502, detail="twilio_call_failed") from exc

    logger.info("Outbound call placed: senior=%s sid=%s", senior_id, call.sid)
    return call.sid


async def send_sms(to: str, body: str) -> None:
    """Send an SMS via Twilio. Used for family distress notifications."""
    settings = get_settings()
    client = _twilio_client()
    try:
        # Note: Twilio's REST client is synchronous; the call is fast and we
        # accept the brief block rather than wrapping in run_in_executor.
        client.messages.create(to=to, from_=settings.twilio_phone_number, body=body)
    except TwilioRestException:
        logger.exception("Twilio SMS failed to %s", to)
        raise
