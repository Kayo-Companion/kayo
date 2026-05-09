import { NextResponse } from "next/server";

interface SignUpPayload {
  audience: "self" | "family";
  recipientName: string;
  recipientPhone: string;
  introducerName?: string;
  introducerRelationship?: string;
}

/**
 * Dev/test endpoint: forwards the sign-up payload straight to the voice
 * service's /admin/test-call-now, bypassing Stripe / Supabase. Lets the user
 * register their number and immediately receive a call from Kayo.
 *
 * Requires VOICE_API_URL pointing at the voice service (cloudflared tunnel
 * URL or http://localhost:8000). Voice must be running in in-memory mode
 * (i.e. SUPABASE_URL unset).
 */
export async function POST(request: Request) {
  const data = (await request.json()) as SignUpPayload;
  const voiceUrl = process.env.VOICE_API_URL ?? "http://localhost:8000";

  const phone = normalizePhone(data.recipientPhone);
  if (!phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const payload = {
    to_number: phone,
    name: data.recipientName,
    is_self: data.audience === "self",
    introducer_name: data.introducerName ?? null,
    introducer_relationship: data.introducerRelationship ?? null,
  };

  let res: Response;
  try {
    res = await fetch(`${voiceUrl}/admin/test-call-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "voice_unreachable",
        detail: `voice serviceに接続できませんでした (${voiceUrl})。uvicornとtunnelが起動していますか？`,
      },
      { status: 502 }
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: body?.detail ?? "call_failed", detail: body?.detail },
      { status: res.status }
    );
  }
  return NextResponse.json(body);
}

/** Normalize a user-typed phone to E.164.
 *
 * - "+1 (385) 324-2215" → "+13853242215" (already international, kept as-is)
 * - "+44 7700 900123"   → "+447700900123"
 * - "090-1234-5678"     → "+819012345678" (no plus → assume Japan)
 * - "9012345678"        → "+819012345678"
 */
function normalizePhone(input: string): string | null {
  const cleaned = input.trim().replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) {
    return /^\+\d{8,15}$/.test(cleaned) ? cleaned : null;
  }
  if (/^\d{9,11}$/.test(cleaned)) {
    return `+81${cleaned.replace(/^0/, "")}`;
  }
  return null;
}
