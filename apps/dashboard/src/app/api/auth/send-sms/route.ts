import { NextResponse } from "next/server";
import { normalizePhoneE164 } from "@/lib/phone";

/**
 * Twilio Verify "send code" — used during signup to prove ownership of the
 * buyer's phone before we create a Supabase user (the user is created later
 * by the Stripe webhook on `checkout.session.completed`).
 *
 * We deliberately do NOT use `supabase.auth.signInWithOtp({ phone })` here
 * because that would create an unconfirmed auth.users row before payment.
 *
 * For sign-in (returning users), the front-end calls supabase.auth directly,
 * which routes through Supabase's configured Phone provider (also Twilio
 * Verify) — that path creates/updates the session.
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = ipHits.get(ip)?.filter((t) => now - t < RATE_LIMIT_WINDOW_MS) ?? [];
  if (arr.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, arr);
    return true;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "rate_limited", message: "送信回数が多すぎます。少し時間をおいてから再度お試しください。" },
      { status: 429 }
    );
  }

  const { phone } = (await req.json()) as { phone?: string };
  if (!phone) {
    return NextResponse.json({ error: "missing_phone" }, { status: 400 });
  }
  const normalized = normalizePhoneE164(phone);
  if (!normalized) {
    return NextResponse.json(
      { error: "invalid_phone", message: "電話番号の形式が正しくありません。" },
      { status: 400 }
    );
  }

  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!SID || !TOKEN || !VERIFY_SID) {
    console.error("Twilio Verify env not configured");
    return NextResponse.json(
      { error: "not_configured", message: "SMS送信が設定されていません。" },
      { status: 500 }
    );
  }

  const auth = Buffer.from(`${SID}:${TOKEN}`).toString("base64");
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: normalized, Channel: "sms", Locale: "ja" }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("twilio verify send failed:", res.status, body);
    // Common trial-account failure: number not verified on the trial account.
    let message = "SMSの送信に失敗しました。携帯電話番号をご確認ください。";
    if (body.includes("unverified")) {
      message =
        "Twilioのトライアルアカウントでは、事前に登録した電話番号にしかSMSを送信できません。";
    } else if (body.includes("Invalid") || body.includes("not a mobile")) {
      message = "SMSを受信できる携帯電話番号をご入力ください。";
    }
    return NextResponse.json({ error: "sms_failed", message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
