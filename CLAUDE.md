# Kayo — Codebase Guide for Claude Sessions

This file orients an AI assistant joining mid-stream. **Read top-to-bottom before editing anything.**

## What Kayo is

Kayo (カヨ) is a **subscription AI phone-companion service for Japanese seniors**. The buyer (typically the senior's adult child, 30-50) signs up online; the service then calls the senior at scheduled times via Twilio, with an OpenAI Realtime audio model playing the role of "カヨ" — a friendly 60-something woman.

Pricing: ¥3,980 / ¥9,800 / ¥19,800 per month (light / standard / premium) for 100 / 400 / 1000 minutes. Add-on packs of 100 min for ¥2,500.

Core safety design:
- Anti-scam (オレオレ詐欺) protections — Kayo announces "I'm AI" up front and refuses any money/personal-info questions.
- I-CONECT research framing — daily conversation as a cognitive-decline intervention.
- Buyer's name is dropped naturally in the opening ("お孫さんの〇〇さんからのご紹介でお電話しました").

## Repo layout

```
Kayo/
├── apps/
│   ├── dashboard/         Next.js 15 (App Router, TS) — landing + signup + dashboard. Deployed to Vercel.
│   └── voice/             FastAPI (Python 3.12) — Twilio ↔ OpenAI Realtime audio bridge. Deployed to Railway.
├── supabase/
│   └── migrations/        DB schema (families, seniors, calls, alerts) + RLS.
├── scripts/               One-off helpers (e.g., test_call.py).
├── docs/                  Migration plans / specs / runbooks.
└── CLAUDE.md              You are here.
```

`apps/dashboard` and `apps/voice` are independent — they communicate only via:
- Supabase (shared DB)
- HTTP: dashboard's "今すぐ電話" button calls voice service's `/calls/start` (auth via shared `INTERNAL_API_KEY`)
- Twilio webhooks (Twilio → voice service)

---

## apps/dashboard — every file, what it does

### Pages (`src/app/...`)

| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout. Loads Noto Sans/Serif JP fonts, sets `<html lang="ja">`, OG meta. |
| `app/page.tsx` | Landing page — composes the marketing sections in order. |
| `app/sign-up/page.tsx` | Signup wizard state machine: `audience → form → confirm`. Holds `SignUpData` shape, accepts `?plan=light\|standard\|premium` URL param. |
| `app/sign-up/_components/choose-audience-step.tsx` | Step 1: pick "自分用" or "大切な人用". |
| `app/sign-up/_components/sign-up-form-step.tsx` | Multi-substep wizard (name → phone → schedule → context → account). Has the readonly-trick anti-Chrome-autofill hook. Branches on audience. |
| `app/sign-up/_components/confirmation-step.tsx` | Review screen + plan picker + embedded Stripe iframe. Has dev-mode テストで発信 button that bypasses Stripe. |
| `app/sign-up/return/page.tsx` | Stripe `return_url` lands here. Server-side: looks up Stripe session, generates Supabase magic link, redirects user logged-in to /dashboard. |
| `app/sign-up/thanks/page.tsx` | Static fallback "ありがとう" page (used in stub mode when Stripe isn't configured). |
| `app/sign-in/page.tsx` | Email-OTP login (sends 6-digit code via Supabase). |
| `app/auth/callback/route.ts` | Supabase magic link callback — exchanges `?code=` for session cookie. |
| `app/dashboard/page.tsx` | Server component. Loads family + seniors for the logged-in user. |
| `app/dashboard/dashboard-client.tsx` | Client component for dashboard UI: usage card, senior list, "今すぐ電話" buttons. |

### API routes (`src/app/api/...`)

| Route | Method | Purpose |
|---|---|---|
| `api/checkout/route.ts` | POST | Creates Stripe Embedded Checkout session (`ui_mode: "embedded_page"`). All sign-up details ride in `subscription_data.metadata`. Has stub mode for missing keys. |
| `api/webhooks/stripe/route.ts` | POST | Verifies Stripe signature. On `checkout.session.completed` (subscription) creates Supabase user with `email_confirm: true`, upserts family, inserts senior with `is_active: true`. Also handles minute-pack one-offs and renewal/cancel. |
| `api/auth/finalize/route.ts` | POST | After payment, mints a Magic Link `action_link` server-side and returns it. Frontend redirects → cookie set → /dashboard logged in. |
| `api/calls/start/route.ts` | POST | Authenticated "今すぐ電話" — verifies user owns senior, checks minutes_used < limit, forwards to voice service `/calls/start` with shared `VOICE_INTERNAL_API_KEY`. |
| `api/billing/buy-minutes/route.ts` | POST | One-off Stripe Checkout for ¥2,500 / 100-min add-on pack. |
| `api/test-call/route.ts` | POST | Dev/test endpoint. Bypasses Stripe + Supabase, calls voice service `/admin/test-call-now` directly. The dashed テストで発信 button uses this. |

### Components & lib

| File | Purpose |
|---|---|
| `components/site-header.tsx` | Floating pill nav (Meela-style), fixed at top. |
| `components/site-footer.tsx` | Footer with 特商法 / privacy / contact links (most still placeholder routes). |
| `components/sections/hero-section.tsx` | Full-screen hero with elderly couple photo (`public/hero-couple.jpg`) + soft pink gradient. |
| `components/sections/{for-whom,research,how-it-works,safety,kayo-persona,dashboard-preview,pricing,faq}-section.tsx` | Marketing page sections, top-to-bottom in order. |
| `components/ui/voice-chat.tsx` | Animated demo voice-orb (used to be in hero, currently unused after hero redesign). |
| `components/ui/glass-card.tsx` | Reusable rounded glassmorphism card with backdrop blur. |
| `components/ui/button.tsx` | Primary / secondary buttons, coral palette. |
| `lib/supabase/client.ts` | Browser-side Supabase client (anon key, cookie-based). |
| `lib/supabase/server.ts` | Server-side Supabase client (auth-cookie reader) AND `createServiceClient()` (service-role key, bypasses RLS). |
| `lib/stripe.ts` | Lazy `getStripe()` singleton. |
| `lib/utils.ts` | `cn()` className helper (clsx + tailwind-merge). |

### Env vars

`apps/dashboard/.env.local` (also `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_LIGHT/STANDARD/PREMIUM/MINUTE_PACK`
- `VOICE_API_URL` (= http://localhost:8000 in dev, the Railway URL in prod)
- `VOICE_INTERNAL_API_KEY` (shared with voice service)
- `NEXT_PUBLIC_APP_URL`

### Stub mode

`/api/checkout` detects placeholder Stripe keys (`sk_test_...` literal or empty) and returns `{stub: true, url: "/sign-up/thanks"}` — keeps the UX demoable without real Stripe.

---

## apps/voice — every file, what it does

| File | Purpose |
|---|---|
| `src/main.py` | FastAPI app + lifespan. Mounts `twilio_router`. Has `/healthz`, `/calls/start` (authenticated), `/admin/test-call-now` (dev-only seeding). Boots APScheduler if `ENABLE_SCHEDULER=true`. |
| `src/twilio_handler.py` | `/twilio/incoming` (POST, returns TwiML with `<Connect><Stream>`), `/twilio/stream/{senior_id}` (WebSocket, hands off to `CallBridge`), `place_outbound_call()` (calls Twilio API with `machine_detection="DetectMessageEnd"` to wait through carrier announcements), `send_sms()`. |
| `src/openai_bridge.py` | The audio bridge. `CallBridge` class pumps Twilio Media Streams ↔ OpenAI Realtime API both ways. Handles G.711 μ-law passthrough. Uses `gpt-realtime-2` (GA schema with nested `audio.input`/`audio.output`). semantic_vad with `interrupt_response: false` during the opening greeting, then flips to `true` after greeting completes. `max_output_tokens: 200` session-level + `400` override on the opening response. |
| `src/prompts.py` | `KAYO_SYSTEM_PROMPT_TEMPLATE` — persona, safety rules, conversation style. `build_kayo_prompt(senior, past_summaries)` interpolates per-call data. |
| `src/safety.py` | Regex patterns for distress (具合が悪い、胸が苦しい etc.) and suspicious (振込、口座 etc.). Used to flag during transcript playback. |
| `src/memory.py` | Post-call summarization. Calls GPT-4o-mini with the full transcript, returns `{summary, topics, mood, distress_detected, distress_reason}` JSON. |
| `src/db.py` | `Protocol DB` interface + `SupabaseDB` (real, async via `supabase-py`) + `InMemoryDB` (dev fallback when Supabase not configured). `init_db()` picks one at startup. `minutes_for_call()` ceiling helper. |
| `src/scheduler.py` | APScheduler tick once/minute. For each `is_active=true` senior, checks if any `schedule[]` entry matches now (tz-aware). Places outbound call. |
| `src/notifications.py` | `notify_distress()` — records alert row + (when family.phone is set) sends SMS via Twilio. |
| `src/models.py` | Pydantic types: `Senior`, `Family`, `Call`, `CallSummary`, `ScheduleEntry`, enums (`Mood`, `CallStatus`, `AlertType`, `AlertSeverity`). |
| `src/config.py` | pydantic-settings — loads env into typed `Settings`. `get_settings()` lru-cached. |

### Env vars

`apps/voice/.env`:
- `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL=gpt-realtime-2`, `OPENAI_REALTIME_VOICE=marin`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (E.164 format)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (blank = use InMemoryDB)
- `VOICE_API_URL` (the public URL Twilio calls back into — cloudflared tunnel in dev, voice.kayo.me in prod)
- `INTERNAL_API_KEY` (shared with dashboard for `/calls/start`)
- `ENABLE_SCHEDULER` (false in dev to avoid surprise calls)
- `SCHEDULER_TIMEZONE=Asia/Tokyo`

---

## Supabase schema (`supabase/migrations/001_initial_schema.sql`)

Four tables, all with RLS:

- `families` — one row per buyer (`user_id` from `auth.users` is unique). Fields: `name`, `email`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan` (light/standard/premium), `minutes_limit`, `minutes_used`, `period_start`.
- `seniors` — one or more per family. Fields: `family_id`, `name`, `phone`, `schedule` (JSONB array of `{weekday: "mon|tue|...|sun", time: "HH:MM"}`), `is_self`, `introducer_name`, `introducer_relationship`, `health_notes` (currently always null since the form's about-step was removed), `is_active` (flipped on by webhook).
- `calls` — call log. `senior_id`, `twilio_call_sid`, `started_at`, `ended_at`, generated `duration_seconds`, `status`, `summary`, `topics_discussed`, `mood`, `distress_detected`, `distress_reason`, `transcript` (JSONB).
- `alerts` — distress/health/no-answer/suspicious flags. `senior_id`, `call_id`, `type`, `severity`, `message`, `notified_family`, `resolved`.

RLS: families can only see/edit their own row; seniors/calls/alerts are scoped via family ownership.

---

## Key flows

### Sign-up (current state)

1. `/sign-up?plan=light` → `ChooseAudienceStep`
2. `SignUpFormStep` wizard: name → phone → schedule → (family path: context) → email
3. `ConfirmationStep` — review + plan picker + click 「7日間無料ではじめる」
4. POST `/api/checkout` — server creates Stripe Checkout Session, returns `{clientSecret}`
5. `<EmbeddedCheckoutProvider>` renders inline — user enters card on kayo.me
6. Stripe charges → redirects iframe to `/sign-up/return?session_id=...`
7. `/sign-up/return` (server) — retrieves session, mints magic link, 302 to action_link
8. Magic link consumed → session cookie set → land on `/dashboard` logged in

Webhook (`/api/webhooks/stripe`) runs in parallel: creates Supabase user with `email_confirm: true`, upserts family with plan + minutes, inserts senior with `is_active: true`, stamps `family_id` + `senior_id` back onto subscription metadata for renewal handling.

### Returning sign-in

`/sign-in` — email field → `signInWithOtp({ email })` → 6-digit code via Supabase email → `verifyOtp({ email, token, type: "email" })` → /dashboard.

### Outbound call (scheduled)

`scheduler.py` ticks every minute. For each active senior, if any `schedule[i]` matches current weekday+HH:MM in Asia/Tokyo, calls `place_outbound_call()` → Twilio dials → recipient picks up (Twilio waits through any carrier announcement via `DetectMessageEnd`) → Twilio webhooks `/twilio/incoming` → returns TwiML with `<Connect><Stream>` → WS opens at `/twilio/stream/{senior_id}` → `CallBridge` connects to OpenAI Realtime → audio flows both ways → on hangup, transcript persisted, summary generated by `gpt-4o-mini`, distress notify if needed.

### Dev test (no Stripe, no Supabase)

Dashed "**テストで発信（決済スキップ）**" button on `/sign-up` confirmation page → POST `/api/test-call` → forwards to voice service `/admin/test-call-now` → seeds an in-memory Senior → `place_outbound_call()` with `enforce_quota=False`. Phone rings.

---

## Conventions

- Japanese-first copy. UI labels are 日本語. Code comments in English (English is faster for AI sessions to parse).
- Tailwind palette: `coral` / `rose` / `peach` / `cream` / `warm-orange` / `warm-brown` / `warm-gray`. Defined in `apps/dashboard/tailwind.config.ts`.
- Forms: anti-Chrome-autofill via the `useNoAutofill()` hook (readOnly trick).
- Stripe: `ui_mode: "embedded_page"` literal (the SDK's TS types call this `embedded_page`, but for a while the API also accepted `embedded` — that was deprecated).
- Pricing copy: ¥ + comma-formatted, half-width digits.

---

## What's pending / known issues

- **Email-typo lockout**: a buyer who mistypes their email at signup can't log back in. There's a planned migration to phone-OTP — see `docs/MIGRATION-phone-auth.md` for the full spec.
- **`health_notes` is unused** — the form step that filled it was removed. Column stays for future use.
- **Voice-service deploy is local-only** in dev — production migration to Railway is pending.
- **特商法 / プライバシー / 利用規約** pages are placeholder routes.
- **No usage-cap enforcement on the call-now endpoint server-side beyond the dashboard pre-check** — the voice service does check `family_has_minutes` inside `place_outbound_call`, but minute increments happen post-call.

---

## Working with Kayo

- Run dev:
  - Dashboard: `cd apps/dashboard && PORT=3456 npm run dev` (port 3000 is occupied locally).
  - Voice: `cd apps/voice && .venv/bin/uvicorn src.main:app --port 8000`.
  - Tunnel: `cloudflared tunnel --url http://localhost:8000` — paste the printed URL into `VOICE_API_URL` in voice .env.
- Typecheck: `cd apps/dashboard && npx tsc --noEmit` (strict, must pass).
- Python compile check: `cd apps/voice && python3 -m compileall -q src/`.
- Logs:
  - `/tmp/kayo-dash.log` — dashboard
  - `/tmp/kayo-voice.log` — voice service
  - `/tmp/kayo-tunnel.log` — cloudflared
  - `/tmp/stripe-webhook.log` — stripe CLI listener
- The user is on macOS (zsh). Stripe CLI installed at `~/.local/bin/stripe`.

---

## Don't do

- **Don't run any uvicorn / next / cloudflared / stripe listen commands during normal coding.** They're already running in the background — kill+restart only when explicitly needed (config change). Use `pkill -f "..."; sleep 2; ... &` pattern.
- **Don't dial Twilio outbound numbers without user permission** — costs real money and may ring real people.
- **Don't commit anything** — the user does git themselves.
- **Don't blindly retry failing commands** — read logs first.
