import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizePhoneE164 } from "@/lib/phone";

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

interface PatchBody {
  schedule?: unknown;
  emergency_on_no_answer?: unknown;
  emergency_contact_phone?: unknown;
  agent_name?: unknown;
  daily_check_deadline?: unknown;
  emergency_on_distress?: unknown;
}

/**
 * Update a senior's settings. Owner check via family_id ↔ user_id.
 *
 * Accepts any subset of:
 *   - schedule
 *   - emergency_on_no_answer (boolean)
 *   - emergency_contact_phone (string, normalized to E.164; empty/null clears)
 *
 * Validates each field independently so partial updates work.
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

  const body = (await request.json()) as PatchBody;

  const update: Record<string, unknown> = {};

  if (body.schedule !== undefined) {
    if (!validSchedule(body.schedule)) {
      return NextResponse.json({ error: "invalid_schedule" }, { status: 400 });
    }
    update.schedule = body.schedule;
  }

  if (body.emergency_on_no_answer !== undefined) {
    if (typeof body.emergency_on_no_answer !== "boolean") {
      return NextResponse.json(
        { error: "invalid_emergency_on_no_answer" },
        { status: 400 }
      );
    }
    update.emergency_on_no_answer = body.emergency_on_no_answer;
  }

  if (body.emergency_on_distress !== undefined) {
    if (typeof body.emergency_on_distress !== "boolean") {
      return NextResponse.json(
        { error: "invalid_emergency_on_distress" },
        { status: 400 }
      );
    }
    update.emergency_on_distress = body.emergency_on_distress;
  }

  if (body.agent_name !== undefined) {
    if (body.agent_name === null || body.agent_name === "") {
      update.agent_name = null;
    } else if (typeof body.agent_name === "string") {
      const trimmed = body.agent_name.trim();
      if (trimmed.length === 0) {
        update.agent_name = null;
      } else if (trimmed.length > 20) {
        return NextResponse.json(
          { error: "agent_name_too_long" },
          { status: 400 }
        );
      } else {
        update.agent_name = trimmed;
      }
    } else {
      return NextResponse.json(
        { error: "invalid_agent_name" },
        { status: 400 }
      );
    }
  }

  if (body.daily_check_deadline !== undefined) {
    if (body.daily_check_deadline === null || body.daily_check_deadline === "") {
      update.daily_check_deadline = null;
    } else if (
      typeof body.daily_check_deadline === "string" &&
      /^\d{2}:\d{2}$/.test(body.daily_check_deadline)
    ) {
      update.daily_check_deadline = body.daily_check_deadline;
    } else {
      return NextResponse.json(
        { error: "invalid_daily_check_deadline" },
        { status: 400 }
      );
    }
  }

  if (body.emergency_contact_phone !== undefined) {
    const raw = body.emergency_contact_phone;
    if (raw === null || raw === "") {
      update.emergency_contact_phone = null;
    } else if (typeof raw === "string") {
      const normalized = normalizePhoneE164(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: "invalid_emergency_phone" },
          { status: 400 }
        );
      }
      update.emergency_contact_phone = normalized;
    } else {
      return NextResponse.json(
        { error: "invalid_emergency_phone" },
        { status: 400 }
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
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

  const { error } = await supabase.from("seniors").update(update).eq("id", id);
  if (error) {
    console.error("seniors update failed:", error);
    // If newer columns (emergency_*, agent_name) aren't migrated yet, retry
    // without them so the rest of the update still lands.
    const newish = [
      "emergency_on_no_answer",
      "emergency_contact_phone",
      "agent_name",
      "daily_check_deadline",
      "emergency_on_distress",
    ];
    if (newish.some((k) => k in update)) {
      const fallback = { ...update };
      for (const k of newish) delete fallback[k];
      if (Object.keys(fallback).length > 0) {
        const { error: fbErr } = await supabase
          .from("seniors")
          .update(fallback)
          .eq("id", id);
        if (!fbErr) {
          return NextResponse.json(
            { ok: true, warning: "newer_columns_missing" },
            { status: 200 }
          );
        }
      }
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
