import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dismiss an observation from the 気づき tab.
 *
 * Body: { key: "<call_id>:<index>" }
 *
 * Appends `key` to seniors.dismissed_observations (if not already present).
 * The dashboard's insights tab filters dismissed keys out client-side, so
 * the underlying observation row stays intact — we just stop surfacing it.
 *
 * Owner check via family_id ↔ user_id, same as the rest of the seniors
 * API. 401 / 404 / 403 mirror the PATCH route's behaviour.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { key?: unknown } = {};
  try {
    body = (await request.json()) as { key?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  // Sanity check: "<uuid>:<small int>". Reject anything that doesn't look
  // like our composite key so a malicious client can't poison the array.
  if (!/^[0-9a-fA-F-]{16,}:\d{1,3}$/.test(key)) {
    return NextResponse.json({ error: "invalid_key" }, { status: 400 });
  }

  // Ownership check.
  const { data: senior } = await supabase
    .from("seniors")
    .select("id, family_id, dismissed_observations")
    .eq("id", id)
    .maybeSingle();
  if (!senior) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("id", senior.family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const existing: string[] = Array.isArray(senior.dismissed_observations)
    ? (senior.dismissed_observations as string[])
    : [];
  if (existing.includes(key)) {
    return NextResponse.json({ ok: true, already: true });
  }

  const next = [...existing, key];
  const { error } = await supabase
    .from("seniors")
    .update({ dismissed_observations: next })
    .eq("id", id);

  if (error) {
    // Fallback for envs where migration 009 hasn't been applied yet —
    // succeed silently so the UI doesn't get stuck on the spinner. The
    // observation will reappear on next page load, which is the
    // expected behaviour pre-migration.
    if (/dismissed_observations/i.test(error.message)) {
      console.warn(
        "dismiss: dismissed_observations column missing — migration 009 not applied?"
      );
      return NextResponse.json(
        { ok: true, warning: "migration_009_missing" },
        { status: 200 }
      );
    }
    console.error("dismiss observation failed:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
