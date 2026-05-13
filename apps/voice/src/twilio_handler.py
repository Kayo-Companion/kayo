"""Twilio webhook + outbound REST helpers.

- /twilio/incoming returns TwiML that opens a Media Stream to /twilio/stream
- /twilio/stream is a WebSocket; the bridge wires it to OpenAI Realtime
- place_outbound_call() places a call from Kayo's number to a senior; the
  same /twilio/incoming TwiML (parameterized by senior_id) handles audio.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Form, HTTPException, Request, WebSocket
from fastapi.responses import Response
from tenacity import retry, stop_after_attempt, wait_exponential
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client
from twilio.twiml.voice_response import Connect, VoiceResponse

from .config import get_settings
from .db import MISSED_CALL_SUMMARY, get_db, minutes_for_call
from .memory import summarize_and_persist
from .models import CallSummary, Mood
from .notifications import notify_distress
from .openai_bridge import CallBridge

logger = logging.getLogger(__name__)
router = APIRouter()


def _twilio_client() -> Client:
    s = get_settings()
    return Client(s.twilio_account_sid, s.twilio_auth_token)


# AMD verdicts that mean "no human is on the line" — we hang up silently
# without engaging the OpenAI Realtime bridge. Saves Twilio + OpenAI minutes
# and avoids leaving a creepy AI voicemail.
_MACHINE_ANSWERED_BY = {
    "machine_start",
    "machine_end_beep",
    "machine_end_silence",
    "machine_end_other",
    "fax",
}


@router.post("/twilio/incoming")
async def twilio_incoming(
    request: Request,
    CallSid: str = Form(...),  # noqa: N803 — Twilio param naming
    From: str = Form(...),  # noqa: N803
    To: str = Form(...),  # noqa: N803
    AnsweredBy: str | None = Form(None),  # noqa: N803 — set when machine_detection is on
) -> Response:
    """TwiML response: open a bidirectional Media Stream to our WS endpoint.

    The senior_id can be passed in via query params (set when we place the
    outbound call). For inbound calls (a senior dialing in) we look up by
    phone number.

    If Twilio's Answering Machine Detection determined the pickup is a
    voicemail / fax / answering machine, hang up immediately — don't connect
    the audio bridge. Otherwise we'd burn minutes and OpenAI cost talking to
    a voicemail box, and the senior would later hear a confused half-call
    recorded on their voicemail.
    """
    settings = get_settings()
    db = get_db()

    if AnsweredBy and AnsweredBy.lower() in _MACHINE_ANSWERED_BY:
        logger.info(
            "Outbound call %s (to=%s) detected as %s — hanging up without engaging bridge",
            CallSid, To, AnsweredBy,
        )
        return _twiml_response(_hangup_twiml())

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

    logger.info(
        "Incoming call %s for senior %s answered_by=%s -> stream=%s",
        CallSid, senior_id, AnsweredBy or "human", stream_url,
    )
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

    # Did a real human ever talk on this call? Voicemail / AMD-inconclusive
    # / immediate-hangup all result in a bridge run with zero user turns
    # (just Kayo's greeting going into the void). Don't run those through
    # the summarizer — the LLM hallucinates a "conversation" from nothing
    # ("しゅんすけさんは元気そうです"), which then leaks into the NEXT call's
    # past_summaries and confuses the agent.
    user_turns = sum(1 for t in (transcript or []) if t.get("role") == "user")
    is_missed = user_turns == 0 or duration_s < 8

    if is_missed:
        logger.info(
            "Missed call (user_turns=%d, duration=%.1fs) — skipping summarizer for %s",
            user_turns, duration_s, call.id,
        )
        try:
            await db.update_call_summary(
                call_id=call.id,
                summary=CallSummary(
                    summary=MISSED_CALL_SUMMARY,
                    topics=[],
                    mood=Mood.NEUTRAL,
                    distress_detected=False,
                    distress_reason=None,
                ),
            )
        except Exception:
            logger.exception("Failed to mark call %s as missed", call.id)
    elif transcript:
        try:
            summary = await summarize_and_persist(
                call_id=call.id,
                senior_id=senior.id,
                transcript=transcript,
                agent_name=senior.agent_name or "カヨ",
            )
            # Distress notification — gated on (a) GPT post-call decision
            # and (b) the per-senior emergency_on_distress toggle.
            # Live regex-based detection has been removed from the bridge.
            if summary.distress_detected and senior.emergency_on_distress:
                await notify_distress(senior=senior, call_id=call.id, summary=summary.summary)
            elif summary.distress_detected:
                logger.info(
                    "Distress flagged on call %s but emergency_on_distress=False — not notifying",
                    call.id,
                )
        except Exception:
            logger.exception("Failed to summarize/notify for call %s", call.id)


@router.post("/twilio/call-status")
async def twilio_call_status(
    request: Request,
    CallSid: str = Form(...),  # noqa: N803
    CallStatus: str = Form(...),  # noqa: N803
    To: str = Form(...),  # noqa: N803
    AnsweredBy: str | None = Form(None),  # noqa: N803
    CallDuration: str | None = Form(None),  # noqa: N803
) -> Response:
    """Twilio posts here when an outbound call ends (we wire the URL up in
    `place_outbound_call`). Sends an SMS to the configured emergency contact
    if the senior didn't actually reach Kayo on this call.

    "Didn't reach Kayo" means any of:
      - explicit no-answer / busy / failed status from Twilio
      - status=completed but AMD says the line was a machine / voicemail
      - status=completed with no AMD verdict and call <= 8s (voicemail
        often picks up around 5-7s; if the call ended that fast we treat
        it as a missed connect)
    """
    senior_id = request.query_params.get("senior_id")
    answered_by = (AnsweredBy or "").lower().strip()
    try:
        duration_s = int(CallDuration or 0)
    except ValueError:
        duration_s = 0

    logger.info(
        "Call status callback: sid=%s status=%s answered_by=%s dur=%ds to=%s senior=%s",
        CallSid, CallStatus, answered_by or "(none)", duration_s, To, senior_id,
    )

    failed_status = CallStatus in {"no-answer", "busy", "failed"}
    machine_pickup = (
        CallStatus == "completed" and answered_by in _MACHINE_ANSWERED_BY
    )
    likely_voicemail = (
        CallStatus == "completed"
        and duration_s > 0
        and duration_s <= 8
        and answered_by not in {"human"}
    )

    if not (failed_status or machine_pickup or likely_voicemail):
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


@router.post("/twilio/amd-result")
async def twilio_amd_result(
    CallSid: str = Form(...),  # noqa: N803
    AnsweredBy: str | None = Form(None),  # noqa: N803
) -> Response:
    """Async AMD verdict from Twilio.

    With `async_amd=true`, the voice webhook fires immediately on pickup
    (no AMD wait) and Twilio posts the AMD verdict here separately ~2-4s
    later. If it says machine/voicemail, we hang up the active call by
    SID so Kayo doesn't keep talking into a voicemail box.

    By the time this fires, Kayo has likely already said the first few
    seconds of her greeting. That fragment ends up recorded on the
    voicemail — a minor cost we trade for ~3-4s faster perceived
    latency on every scheduled call.
    """
    answered_by = (AnsweredBy or "").lower().strip()
    logger.info("Async AMD result: sid=%s answered_by=%s", CallSid, answered_by or "(none)")

    if answered_by not in _MACHINE_ANSWERED_BY:
        return Response(status_code=204)

    # Voicemail detected — terminate the call. Twilio's REST client is
    # synchronous so this briefly blocks; the call is short and we don't
    # care if it races with normal hangup.
    try:
        _twilio_client().calls(CallSid).update(status="completed")
        logger.info("Async AMD: hung up call %s (machine pickup)", CallSid)
    except TwilioRestException:
        # Likely already ended (status_callback fired first) — fine.
        logger.info("Async AMD: call %s already ended, nothing to hang up", CallSid)
    except Exception:
        logger.exception("Async AMD: failed to hang up call %s", CallSid)

    return Response(status_code=204)


@router.post("/twilio/recording-status")
async def twilio_recording_status(
    request: Request,
    CallSid: str = Form(...),  # noqa: N803
    RecordingSid: str = Form(...),  # noqa: N803
    RecordingUrl: str = Form(...),  # noqa: N803
    RecordingStatus: str = Form(...),  # noqa: N803
    RecordingDuration: str | None = Form(None),  # noqa: N803
) -> Response:
    """Twilio posts here when the call recording is fully assembled.

    We persist the URL on the call row so the family dashboard and the
    research pipeline can fetch the audio. Recordings live in Twilio's
    storage by default; a later job can mirror them to Supabase Storage
    if we want long-term retention beyond Twilio's retention window.

    The URL Twilio posts here lacks an extension; appending `.mp3` (or
    `.wav`) gives you the playable file, but we store the canonical form
    and let downstream code decide.
    """
    senior_id = request.query_params.get("senior_id")
    logger.info(
        "Recording status: call=%s recording=%s status=%s duration=%ss senior=%s",
        CallSid, RecordingSid, RecordingStatus, RecordingDuration or "?", senior_id,
    )

    if RecordingStatus != "completed":
        return Response(status_code=204)

    if not senior_id:
        logger.warning("Recording callback missing senior_id query param")
        return Response(status_code=204)

    db = get_db()
    # Recording completed-callbacks fire after the call ends. The matching
    # call row is the most recently started call for this senior. We don't
    # currently persist Twilio's CallSid on the row, so we use that
    # latest-call heuristic instead — robust enough since recording-status
    # arrives within ~30 seconds of call end.
    try:
        res = (
            await db._client.table("calls")  # type: ignore[attr-defined]
            .select("id")
            .eq("senior_id", senior_id)
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        call_id = rows[0]["id"] if rows else None
    except AttributeError:
        # Memory DB fallback — no Supabase client. Skip persistence.
        return Response(status_code=204)
    except Exception:
        logger.exception("Failed to look up call for recording %s", RecordingSid)
        return Response(status_code=204)

    if not call_id:
        logger.warning("No call row found for senior %s", senior_id)
        return Response(status_code=204)

    try:
        await db.save_recording_url(call_id=call_id, url=RecordingUrl)
        logger.info("Saved recording URL for call %s: %s", call_id, RecordingUrl)
    except Exception:
        logger.exception("Failed to save recording URL for call %s", call_id)

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


def _hangup_twiml() -> str:
    """Silent immediate hangup. Used when AMD says the pickup is voicemail."""
    response = VoiceResponse()
    response.hangup()
    return str(response)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
async def place_outbound_call(
    senior_id: str,
    to_number: str,
    *,
    enforce_quota: bool = True,
    manual: bool = False,
) -> str:
    """Place a call from Kayo's number to a senior. Returns Twilio CallSid.

    enforce_quota=False bypasses the minutes_used < minutes_limit check —
    used by the dev /admin/test-call-now endpoint.

    manual=True means a human just pressed "今すぐ電話" — the senior is
    expected to be at the phone right now. In that case we skip Answering
    Machine Detection entirely so Kayo can start speaking ~3-4s earlier.
    The voicemail-recording risk is tiny because someone literally just
    initiated this call from the dashboard.

    manual=False (scheduled calls) uses **async AMD** — Twilio fires the
    voice webhook immediately on pickup and runs AMD in parallel,
    posting the verdict to `/twilio/amd-result`. If it comes back as
    machine/voicemail we forcibly terminate the call. This shaves the
    same ~3-4s off scheduled calls at the cost of occasionally recording
    a few seconds of Kayo's greeting into voicemail — which our missed-
    call detection already cleans up downstream.
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
    # Twilio posts here once the call recording is fully assembled. We
    # stash the URL on the call row so the dashboard / future research
    # pipeline can fetch the audio.
    recording_callback_url = (
        f"{settings.voice_api_url}/twilio/recording-status?{qs}"
    )

    # Common kwargs across both call paths.
    #
    # Recording is enabled on every outbound call so we have the audio
    # available for (a) the family if they want to listen back and (b)
    # future research / model training. The recording captures the whole
    # call audio in parallel with the Media Stream the bridge consumes;
    # there's no impact on the live conversation.
    call_kwargs: dict[str, Any] = {
        "to": to_number,
        "from_": settings.twilio_phone_number,
        "url": twiml_url,
        "timeout": 30,
        "status_callback": status_callback_url,
        "status_callback_method": "POST",
        "status_callback_event": ["completed"],
        "record": True,
        "recording_status_callback": recording_callback_url,
        "recording_status_callback_method": "POST",
        "recording_status_callback_event": ["completed"],
    }

    if manual:
        # No AMD — fastest possible path to first audio. Kayo starts
        # speaking ~3-4s sooner. Risk: voicemail will record her
        # greeting if the user isn't actually there. Acceptable for
        # button-initiated calls.
        logger.info("Manual call to senior %s — AMD disabled for speed", senior_id)
    else:
        # Async AMD: webhook fires immediately on pickup; AMD verdict
        # arrives separately at /twilio/amd-result, where we hang up if
        # it says machine.
        amd_callback_url = f"{settings.voice_api_url}/twilio/amd-result?{qs}"
        call_kwargs.update({
            "machine_detection": "DetectMessageEnd",
            "machine_detection_speech_threshold": 2400,  # ms; default 2400
            "machine_detection_silence_timeout": 5000,   # ms before assuming human
            "async_amd": "true",
            "async_amd_status_callback": amd_callback_url,
            "async_amd_status_callback_method": "POST",
        })

    try:
        call = client.calls.create(**call_kwargs)
    except TwilioRestException as exc:
        logger.error("Twilio outbound failed for senior %s: %s", senior_id, exc)
        raise HTTPException(status_code=502, detail="twilio_call_failed") from exc

    logger.info(
        "Outbound call placed: senior=%s sid=%s mode=%s",
        senior_id, call.sid, "manual-no-amd" if manual else "scheduled-async-amd",
    )
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
