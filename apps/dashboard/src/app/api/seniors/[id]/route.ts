import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const WEEKDAYS = new Set<Weekday>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

function validSchedule(
  s: unknown
): s is { weekday: Weekday; time: string }[] {
  if (!Array.isArray(s)) return false;
  return s.every(
    (row) =>
      row &&
      typeof row === "object" &&
      WEEKDAYS.has((row as { weekday?: string }).weekday as Weekday) &&
      typeof (row as { time?: string }).time === "string" &&
      /^\d{2}:\d{2}$/.test((row as { time: string }).time)
  );
}

/**
 * Update a senior's settings. Currently scoped to schedule edits — the only
 * thing the dashboard exposes for now. Owner check via family_id ↔ user_id.
 */
export async function PATCH(
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

  const body = (await request.json()) as { schedule?: unknown };
  if (!validSchedule(body.schedule)) {
    return NextResponse.json({ error: "invalid_schedule" }, { status: 400 });
  }

  // Confirm ownership: senior.family_id must belong to a family.user_id == user.id.
  const { data: senior } = await supabase
    .from("seniors")
    .select("id, family_id")
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

  const { error } = await supabase
    .from("seniors")
    .update({ schedule: body.schedule })
    .eq("id", id);
  if (error) {
    console.error("seniors update failed:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
