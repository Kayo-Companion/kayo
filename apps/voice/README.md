# Kayo Voice Service

FastAPI service that bridges **Twilio Media Streams** ↔ **OpenAI Realtime API**.

- Inbound calls → TwiML opens a `<Stream>` to `/twilio/stream` (WebSocket)
- The bridge proxies G.711 μ-law audio frames bidirectionally with no resampling
  (both sides speak `g711_ulaw` at 8 kHz)
- Per-senior system prompt with persona + safety rules
- Scheduler places outbound calls at each senior's `call_time`
- Post-call: Whisper transcript → GPT-4o-mini summary → Supabase
- Distress detection (Japanese patterns) → SMS to family's emergency contact

## Local setup

```bash
cd apps/voice
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in
uvicorn src.main:app --reload --port 8000
```

If you don't set `SUPABASE_URL`, the service uses an in-memory DB so the audio
bridge still works end-to-end against a single test senior.

## Exposing to Twilio (local)

Use `ngrok` or `cloudflared` to give Twilio a public URL:

```bash
cloudflared tunnel --url http://localhost:8000
# copy the printed https://xxx.trycloudflare.com URL
```

Then in Twilio Console → your number → set the **Voice webhook** to:

```
POST https://xxx.trycloudflare.com/twilio/incoming
```

Set `VOICE_API_URL=https://xxx.trycloudflare.com` in `.env` so outbound calls
also reference the public URL.

## Triggering a test call

```bash
curl -X POST http://localhost:8000/admin/test-call \
  -H 'content-type: application/json' \
  -d '{"senior_id":"<uuid>","to_number":"+819012345678"}'
```

## Architecture

```
              ┌──────────────────────────┐
PSTN ───────► │  Twilio Voice            │
              └──────────┬───────────────┘
                         │ Media Streams (G.711 μ-law, 8kHz)
                         ▼
              ┌──────────────────────────┐
              │  /twilio/stream (WS)     │
              │  CallBridge              │
              │  - twilio→openai pump    │
              │  - openai→twilio pump    │
              │  - distress detection    │
              └──────────┬───────────────┘
                         │ wss://api.openai.com/v1/realtime
                         ▼
              ┌──────────────────────────┐
              │ OpenAI Realtime API      │
              │ voice=marin, g711_ulaw   │
              │ instructions=system_prompt│
              └──────────────────────────┘
```

After hangup: `memory.summarize_and_persist` writes summary + topics + mood to
`calls`, and `notifications.notify_distress` SMS-es the family if needed.

## Deploy (Railway)

`railway up` from this directory, or connect the repo and set Root Directory to
`apps/voice`. Set env vars in Railway dashboard (or via Doppler integration).

Set custom domain `voice.kayo.me` in Railway → Settings → Networking.

## Files

- `src/main.py` — FastAPI app, lifespan, /healthz, /admin/test-call
- `src/twilio_handler.py` — webhook, WS endpoint, outbound REST helper, SMS
- `src/openai_bridge.py` — `CallBridge` (the core audio relay)
- `src/prompts.py` — `KAYO_SYSTEM_PROMPT_TEMPLATE` + per-senior renderer
- `src/safety.py` — distress / suspicious regex patterns
- `src/memory.py` — post-call summarization (gpt-4o-mini, JSON mode)
- `src/db.py` — Supabase client + in-memory dev fallback
- `src/scheduler.py` — APScheduler tick: dial seniors at their `call_time`
- `src/notifications.py` — family SMS on distress
- `src/models.py` — Pydantic types
- `src/config.py` — env settings (pydantic-settings)
