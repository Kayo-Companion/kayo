import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePhoneE164 } from "@/lib/phone";

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface CreateSeniorPayload {
  audience: "self" | "family";
  recipientName: string;
  recipientPhone: string;
  schedule: { weekday: Weekday; time: string }[];
  introducerName?: string;
  introducerRelationship?: string;
  agentName?: string;
}

/**
 * Add another senior to an authenticated buyer's family. No SMS verify, no
 * Stripe — the buyer's session proves identity, and additional seniors share
 * the family's existing minute pool.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = (await request.json()) as CreateSeniorPayload;

  const phone = normalizePhoneE164(data.recipientPhone);
  if (!phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  const name = data.recipientName?.trim();
  if (!name) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }
  const isFamily = data.audience === "family";
  if (isFamily && !data.introducerName?.trim()) {
    return NextResponse.json({ error: "missing_introducer" }, { status: 400 });
  }

  const { data: family, error: familyErr } = await supabase
    .from("families")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (familyErr || !family) {
    return NextResponse.json({ error: "no_family" }, { status: 404 });
  }

  const agentName = data.agentName?.trim() || null;

  const { data: senior, error } = await supabase
    .from("seniors")
    .insert({
      family_id: family.id,
      name,
      phone,
      schedule: Array.isArray(data.schedule) ? data.schedule : [],
      is_self: data.audience === "self",
      introducer_name: isFamily ? data.introducerName!.trim() : null,
      introducer_relationship: isFamily ? data.introducerRelationship ?? null : null,
      health_notes: null,
      is_active: true,
      agent_name: agentName,
    })
    .select("id")
    .single();
  if (error || !senior) {
    console.error("seniors insert failed:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ id: senior.id });
}
