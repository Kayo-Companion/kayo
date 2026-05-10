import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * "Call now" trigger from the dashboard. Verifies the logged-in user owns the
 * senior, then forwards to the voice service's authenticated /calls/start.
 */
export async function POST(request: Request) {
  const { senior_id } = (await request.json()) as { senior_id?: string };
  if (!senior_id) {
    return NextResponse.json({ error: "missing_senior_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // RLS will already restrict this — but we double-check here so we can give a
  // clearer error than 403.
  const { data: senior } = await supabase
    .from("seniors")
    .select("id, family_id")
    .eq("id", senior_id)
    .maybeSingle();
  if (!senior) {
    return NextResponse.json({ error: "senior_not_found" }, { status: 404 });
  }

  const { data: family } = await supabase
    .from("families")
    .select("id, minutes_limit, minutes_used")
    .eq("id", senior.family_id)
    .maybeSingle();
  if (!family) {
    return NextResponse.json({ error: "family_not_found" }, { status: 404 });
  }
  if (family.minutes_used >= family.minutes_limit) {
    return NextResponse.json(
      { error: "minutes_exhausted" },
      { status: 402 }
    );
  }

  const voiceUrl = process.env.VOICE_API_URL;
  const apiKey = process.env.VOICE_INTERNAL_API_KEY;
  if (!voiceUrl || !apiKey) {
    console.error(
      "voice_not_configured: VOICE_API_URL or VOICE_INTERNAL_API_KEY missing"
    );
    return NextResponse.json({ error: "voice_not_configured" }, { status: 500 });
  }

  let res: Response;
  try {
    res = await fetch(`${voiceUrl}/calls/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ senior_id }),
    });
  } catch (err) {
    // Most common cause: VOICE_API_URL points at a dead/local URL from
    // Vercel's perspective. Surface that clearly in logs.
    console.error(
      `voice_unreachable: fetch to ${voiceUrl}/calls/start threw:`,
      err
    );
    return NextResponse.json(
      { error: "voice_unreachable", detail: String(err).slice(0, 200) },
      { status: 502 }
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(
      `voice service returned ${res.status}:`,
      data?.detail ?? data?.error ?? "(no body)"
    );
    return NextResponse.json(
      { error: data.detail ?? data.error ?? "call_failed", status: res.status },
      { status: res.status }
    );
  }
  return NextResponse.json(data);
}
