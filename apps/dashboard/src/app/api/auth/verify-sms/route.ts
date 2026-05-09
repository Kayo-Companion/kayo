import { NextResponse } from "next/server";
import { normalizePhoneE164 } from "@/lib/phone";

/**
 * Twilio Verify "check code". Returns { approved: true } on success. The
 * frontend stores buyerPhoneVerified=true client-side; the Stripe webhook
 * then trusts the buyer_phone metadata to create the Supabase user with
 * phone_confirm=true.
 *
 * Brute-force is bounded by Twilio Verify's per-attempt limits (5 attempts
 * per code by default).
 */
export async function POST(req: Request) {
  const { phone, code } = (await req.json()) as { phone?: string; code?: string };
  const normalized = phone ? normalizePhoneE164(phone) : null;
  if (!normalized || !code || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json(
      { approved: false, error: "invalid_input" },
      { status: 400 }
    );
  }

  const SID = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!SID || !TOKEN || !VERIFY_SID) {
    console.error("Twilio Verify env not configured");
    return NextResponse.json({ approved: false, error: "not_configured" }, { status: 500 });
  }

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

  if (!res.ok) {
    const body = await res.text();
    console.error("twilio verify check failed:", res.status, body);
    return NextResponse.json({ approved: false, error: "check_failed" });
  }

  const body = (await res.json()) as { status?: string };
  return NextResponse.json({ approved: body.status === "approved" });
}
