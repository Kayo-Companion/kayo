# Migration: switch sign-up + sign-in from email-OTP to phone-OTP

You are picking up an in-progress task on the **Kayo** codebase (a senior-care AI phone companion service). The previous Claude session ran out of context. **Read this whole file first**, then implement.

---

## Project at a glance

- **Monorepo**: `apps/dashboard` (Next.js 15 App Router, TypeScript) + `apps/voice` (FastAPI Python).
- **Dashboard responsibilities**: marketing site, sign-up wizard, embedded Stripe checkout, post-payment auth, dashboard pages.
- **Voice service responsibilities**: Twilio Media Streams ↔ OpenAI Realtime bridge for actual phone calls. **Out of scope for this task**.
- **Auth**: Supabase (`@supabase/supabase-js@2.105.4`, `@supabase/ssr@0.10.3`).
- **Payments**: Stripe Embedded Checkout (`ui_mode: "embedded_page"`, subscription mode).
- **SMS provider**: Twilio (the same Twilio account is already wired up for outbound voice calls).

Run `cd apps/dashboard && npm run dev -- -p 3456` to test locally. Supabase + Stripe creds are already in `apps/dashboard/.env.local`.

---

## Current state (what you're replacing)

The signup wizard ends with an **email** step (`AccountStep`). After Stripe checkout completes, the webhook creates a Supabase user with that email (`email_confirm: true`), and `/sign-up/return` mints a Magic Link that drops the user onto `/dashboard` already authenticated.

For returning users, `/sign-in/page.tsx` uses **email OTP** — `signInWithOtp({ email })` sends a 6-digit code, the user types it on the same page, `verifyOtp({ email, token, type: "email" })` issues a session.

**Why we're changing**: a user who mistypes their email at signup gets locked out forever (no other identifier to recover with). Phones are also more reliable for the Japanese senior demographic.

---

## Target state

### New signup flow

The wizard already has these sub-steps for each path. We're going to add a phone-auth step in place of (or alongside) email.

**Self path (`audience="self"`)** — 6 sub-steps:
1. `name` — お名前（呼び名）
2. `phone` — 電話番号 (this is BOTH the buyer's phone AND Kayo's call target since it's the same person)
3. **`verify` (NEW)** — SMS 6-digit OTP verification of the phone above
4. `schedule` — 曜日 × 時刻
5. `email` — メールアドレス (for Stripe receipts only — *not* the auth identifier anymore)
6. confirmation page → embedded Stripe → `/dashboard`

**Family path (`audience="family"`)** — 8 sub-steps:
1. `name` — 大切な方のお名前
2. `phone` — 大切な方の電話番号 (Kayo dials this)
3. `schedule`
4. `context` — あなたのお名前 + 続柄
5. **`buyer-phone` (NEW)** — あなたの電話番号 (login + emergency contact channel)
6. **`verify` (NEW)** — SMS 6-digit OTP verification of the buyer's phone
7. `email` — メールアドレス (Stripe receipt)
8. confirmation → embedded Stripe → `/dashboard`

### New login flow

Replace email OTP entirely:
- `/sign-in` asks for **phone number** (not email)
- `signInWithOtp({ phone })` sends SMS
- User types 6-digit code on the same page
- `verifyOtp({ phone, token, type: "sms" })` issues a session
- Redirect to `/dashboard`

---

## Provider choice: **Twilio Verify** (Option B)

We're using Twilio Verify (a separate Twilio product priced per-verification, ~$0.05/JP) instead of plain Programmable SMS because:
- Built-in SMS pumping fraud protection (geo-blocks, per-IP rate limits, ML detection)
- Slightly cheaper at scale
- Same Twilio account — no new vendor

Supabase Auth supports Twilio Verify as a Phone provider directly. The frontend code stays nearly identical — just `phone` instead of `email`.

---

## Implementation steps

### Step 1: Supabase configuration (do this first, manually)

In Supabase Dashboard → your project → Auth → Providers:

1. Find **Phone** provider → click to expand → toggle **Enable phone provider** ON.
2. SMS Provider: select **"Twilio Verify"**.
3. Fill in:
   - **Twilio Account SID**: same `ACxxx...` value as in `apps/voice/.env`
   - **Twilio Auth Token**: same as voice .env
   - **Twilio Verify Service SID**: needs to be created in Twilio Console → Verify → Services → Create Service. Name it "Kayo Auth" or similar. Copy the `VAxxxxx...` SID and paste here.
4. Save.

If the Twilio Verify Service doesn't exist yet, create one at <https://console.twilio.com/us1/develop/verify/services> first.

The user has a Twilio Trial account currently. Trial accounts MAY have restrictions on Verify — confirm with the user before assuming this works for testing. If trial is blocking, we test via the unverified-number path or wait until upgrade.

### Step 2: Update SignUpData type

`apps/dashboard/src/app/sign-up/page.tsx`:

```ts
export interface SignUpData {
  audience: Audience;
  plan: Plan;
  recipientName: string;
  recipientPhone: string;        // Kayo's call target (existing)
  schedule: ScheduleEntry[];
  introducerName?: string;
  introducerRelationship?: string;
  buyerPhone: string;            // NEW — login phone for family path; same as recipientPhone for self
  buyerPhoneVerified: boolean;   // NEW — gates checkout
  accountEmail: string;          // unchanged, but no longer auth-critical
}
```

For self path, set `buyerPhone = recipientPhone` automatically when the form is submitted (don't ask twice).

### Step 3: Add `verify` and `buyer-phone` sub-steps to the wizard

`apps/dashboard/src/app/sign-up/_components/sign-up-form-step.tsx`:

The `SubStep` type currently is:
```ts
type SubStep = "name" | "phone" | "schedule" | "context" | "account";
```

Change to:
```ts
type SubStep = "name" | "phone" | "verify" | "schedule" | "context" | "buyer-phone" | "buyer-verify" | "account";
```

`order` array:
- Self: `["name", "phone", "verify", "schedule", "account"]`
- Family: `["name", "phone", "schedule", "context", "buyer-phone", "buyer-verify", "account"]`

(Self verifies the recipient phone since it IS the buyer phone. Family verifies the buyer phone separately, after collecting it in step 5.)

Build a reusable `VerifyPhoneStep` component:
```tsx
function VerifyPhoneStep({
  phone,
  onVerified,
  onBack,
}: {
  phone: string;
  onVerified: () => void;
  onBack: () => void;
}) {
  // 1. On mount, call /api/auth/send-sms with { phone }
  // 2. Show 6-digit input
  // 3. On submit, call /api/auth/verify-sms with { phone, code }
  // 4. On success, set buyerPhoneVerified=true and call onVerified()
}
```

The send-sms and verify-sms endpoints are **new** — see step 4.

### Step 4: New API routes

Create `apps/dashboard/src/app/api/auth/send-sms/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// During SIGNUP we just want to verify ownership of the phone — we don't yet
// want to create a Supabase auth.users row (Stripe webhook will do that
// after successful payment). So we call Twilio Verify directly here, not
// supabase.auth.signInWithOtp.
//
// Twilio Verify endpoint: POST https://verify.twilio.com/v2/Services/{SID}/Verifications
// with form-encoded { To: "+81...", Channel: "sms" }.

export async function POST(req: Request) {
  const { phone } = await req.json();
  const normalized = normalizePhoneE164(phone);  // existing helper in checkout/route.ts
  if (!normalized) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID!;

  const auth = Buffer.from(`${SID}:${TOKEN}`).toString("base64");
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: normalized, Channel: "sms" }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("twilio verify send failed:", res.status, body);
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

Create `apps/dashboard/src/app/api/auth/verify-sms/route.ts`:

```ts
import { NextResponse } from "next/server";

// Posts to Twilio Verify's VerificationCheck endpoint. Returns ok=true if
// approved. The frontend stores buyerPhoneVerified=true client-side; the
// Stripe webhook re-verifies authoritatively later (see step 5).

export async function POST(req: Request) {
  const { phone, code } = await req.json();
  const normalized = normalizePhoneE164(phone);
  if (!normalized || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID!;
  const auth = Buffer.from(`${SID}:${TOKEN}`).toString("base64");

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: normalized, Code: code }),
    }
  );
  const body = await res.json();
  const approved = body.status === "approved";
  return NextResponse.json({ approved });
}
```

Add `TWILIO_VERIFY_SERVICE_SID=VA...` to `apps/dashboard/.env.local` (and `.env.example`).

### Step 5: Stripe checkout + webhook changes

`apps/dashboard/src/app/api/checkout/route.ts`:
- Validate `buyerPhone` is normalized E.164 (use existing `normalizePhone` helper)
- Add `buyer_phone` to `subscription_data.metadata`
- **Pre-flight check**: also re-verify the phone via Twilio Verify's "approved" status query before creating the Stripe session, OR trust the frontend (simpler). For MVP, trust frontend; phones can't be brute-forced cheaply.
- Keep `customer_email: data.accountEmail` for Stripe receipt — but it's no longer the auth identifier.

`apps/dashboard/src/app/api/webhooks/stripe/route.ts`:

Currently creates the Supabase user with `admin.createUser({ email, email_confirm: true })`. Change to:

```ts
// Phone is the auth identifier; email is decorative for receipts.
const { data: createRes, error: createErr } = await supabase.auth.admin.createUser({
  phone: md.buyer_phone,
  phone_confirm: true,
  email: email || undefined,
  email_confirm: !!email,
  user_metadata: {
    name: md.introducer_name || md.recipient_name,
  },
});
```

Lookup-on-conflict: if the user already exists (re-running webhook), find by phone:
```ts
// list users and filter by phone
const { data: list } = await supabase.auth.admin.listUsers();
const existing = list?.users.find((u) => u.phone === md.buyer_phone);
```

### Step 6: Auth finalize + return page

`apps/dashboard/src/app/sign-up/return/page.tsx` and `apps/dashboard/src/app/api/auth/finalize/route.ts` currently use `admin.generateLink({ type: "magiclink", email })` to issue a one-time login URL.

Phone-based equivalent: there's no built-in `generateLink` for phone. Options:
- (a) After payment, re-send a fresh SMS OTP to the buyer's phone, redirect them to a "code entry" page on `/sign-up/verify-final`. They type the code, we call `verifyOtp({ phone, token, type: "sms" })`, then push to `/dashboard`.
- (b) Issue a session token server-side using `supabase.auth.admin.signInWithUserId(userId)` (deprecated) or `admin.generateLink({ type: "recovery", phone })` — this is a hack, may not work.

Recommended: **(a)** — small UX cost (one more SMS), works reliably. Add a "verify-final" page that's exactly the same UI as sign-in but assumes the phone from URL params or session.

Actually simpler for MVP: **the user already verified their phone during signup, so we know they own it.** We can issue them a fresh SMS code at the end of webhook, redirect them to a code-entry page on `/sign-up/verify-final?phone=+81xxxxx`, and have them type the code to log in. Twilio Verify cost = one extra SMS = ¥7. Acceptable.

### Step 7: `/sign-in` page rewrite

`apps/dashboard/src/app/sign-in/page.tsx`:

Replace email field with phone field. Replace `signInWithOtp({ email })` / `verifyOtp({ email, token, type: "email" })` with phone variants:

```ts
await supabase.auth.signInWithOtp({ phone });
await supabase.auth.verifyOtp({ phone, token, type: "sms" });
```

This requires Supabase's Phone provider to be configured (Step 1).

Phone normalization: reuse the same logic from `/api/checkout/route.ts` — accept `090-1234-5678` etc. and convert to `+81...`.

### Step 8: Confirmation step display

`apps/dashboard/src/app/sign-up/_components/confirmation-step.tsx`:

Currently shows a row "アカウント用メール". Change/add:
- "ログイン用電話番号" — `data.buyerPhone`
- "電話番号" (recipient — Kayo dials this) — `data.recipientPhone`
- "メールアドレス（領収書用）" — `data.accountEmail`

For self path, `buyerPhone === recipientPhone`, so show one row "電話番号".

### Step 9: Tests

- TypeScript: `cd apps/dashboard && npx tsc --noEmit` should pass.
- Manual: do a full signup with a real JP mobile phone. Verify SMS arrives, code works, user is logged in afterwards.
- Manual: log out, go to `/sign-in`, enter the same phone, verify SMS, log back in.

### Step 10: Cleanup

- Drop unused email-OTP code paths from `/sign-in`.
- Update `.env.example` with the new `TWILIO_VERIFY_SERVICE_SID`.
- The `email_confirm: true` flag in webhook stays — email is still verified-on-arrival via Stripe (Stripe doesn't accept invalid emails for receipts).

---

## File checklist

Files you will touch:

- `apps/dashboard/src/app/sign-up/page.tsx` — SignUpData type
- `apps/dashboard/src/app/sign-up/_components/sign-up-form-step.tsx` — sub-steps, new VerifyPhoneStep + BuyerPhoneStep components
- `apps/dashboard/src/app/sign-up/_components/confirmation-step.tsx` — row labels
- `apps/dashboard/src/app/sign-in/page.tsx` — phone-OTP rewrite
- `apps/dashboard/src/app/api/checkout/route.ts` — buyer_phone in metadata
- `apps/dashboard/src/app/api/webhooks/stripe/route.ts` — create user with phone
- `apps/dashboard/src/app/api/auth/finalize/route.ts` — phone-based finalize
- `apps/dashboard/src/app/sign-up/return/page.tsx` — same
- `apps/dashboard/src/app/sign-up/verify-final/page.tsx` — **NEW** post-payment OTP entry
- `apps/dashboard/src/app/api/auth/send-sms/route.ts` — **NEW**
- `apps/dashboard/src/app/api/auth/verify-sms/route.ts` — **NEW**
- `apps/dashboard/.env.local` — add `TWILIO_VERIFY_SERVICE_SID`
- `apps/dashboard/.env.example` — same

Don't touch: `apps/voice/*`, `supabase/migrations/*` (schema is already phone-friendly).

---

## Edge cases to handle

- **Landline phones**: cannot receive SMS. Reject with a clear error: 「携帯電話番号をご入力ください（SMSを受信できる番号）」. Don't try to send the SMS — Twilio Verify will fail anyway, just fail fast.
- **Trial Twilio account**: Twilio Verify may reject sending to unverified numbers on a trial account. The user already verified `+1 206-910-6988` (US) and `+81 70-4434-1385` (JP) on their trial. Other numbers will fail. Note this in the error UI: 「アカウントが本番モードに切り替わるまで、登録された電話番号にしかSMSを送信できません」.
- **SMS pumping**: Twilio Verify has built-in protections; trust the defaults. Add a basic per-IP rate limit on the `/api/auth/send-sms` endpoint as belt-and-suspenders (e.g., max 3 send-sms per IP per minute).
- **Webhook idempotency**: Stripe may fire `checkout.session.completed` twice. The user-creation block must be idempotent — already handled in current code via the "user already exists" branch.

---

## Rollback

If anything goes wrong, the email-OTP code is recoverable from git history. Don't delete files in this PR — comment them out or replace contents with the new logic. The user can revert with `git checkout HEAD~1`.

---

## Deliverables

When done:
- Full phone-OTP signup + login flow working locally with Stripe test cards
- `npx tsc --noEmit` passes
- A short summary message to the human user describing:
  1. What they need to do in Supabase Dashboard (Step 1)
  2. What they need to do in Twilio Console (create Verify Service)
  3. The single env var to add to `.env.local` (`TWILIO_VERIFY_SERVICE_SID`)
  4. How to test the flow end-to-end

Take your time, read files before editing, run typecheck after each substantial change.
