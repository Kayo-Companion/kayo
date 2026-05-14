import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeniorTabs } from "../_components/senior-tabs";
import { InsightsBuckets } from "../_components/insights-buckets";
import {
  keyFor,
  type Observation,
  type ObservationEntry,
} from "../_components/insights-types";

const TZ = "Asia/Tokyo";

/**
 * The 気づき tab — a single combined timeline of observations the family
 * may want to glance at. New entries stack at the top; each row has a ✓
 * dismiss button.
 *
 * Filtering rules (server-side):
 *   - Drop positive observations entirely (they were just summary noise).
 *   - Drop observations whose key ("<call_id>:<index>") is in
 *     seniors.dismissed_observations (set when the family clicks ✓).
 *
 * Deliberately non-clinical: no scores, percentages, or medical
 * language — disclaimer at the bottom reinforces this.
 */
export default async function SeniorInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: senior } = await supabase
    .from("seniors")
    .select("id, name, family_id, call_timezone, dismissed_observations")
    .eq("id", id)
    .maybeSingle();
  if (!senior) notFound();

  // Owner check via family_id ↔ user_id.
  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("id", senior.family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) notFound();

  const dismissed = new Set<string>(
    Array.isArray(senior.dismissed_observations)
      ? (senior.dismissed_observations as string[])
      : []
  );

  // 30-day window. Cast a wide enough net to catch repeating patterns
  // without overwhelming the UI; the dismiss flow keeps it manageable.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const { data: obsRows } = await supabase
    .from("calls")
    .select("id, started_at, observations")
    .eq("senior_id", id)
    .gte("started_at", since.toISOString())
    .not("observations", "is", null)
    .order("started_at", { ascending: false });

  const rows = (obsRows ?? []) as ObservationRow[];
  // Flatten, drop positives, drop dismissed.
  const entries: ObservationEntry[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.observations)) continue;
    row.observations.forEach((obs, index) => {
      if (!obs || typeof obs !== "object" || !obs.detail) return;
      if (obs.positive) return;
      const entry: ObservationEntry = {
        observation: obs,
        call_id: row.id,
        index,
        started_at: row.started_at,
      };
      if (dismissed.has(keyFor(entry))) return;
      entries.push(entry);
    });
  }
  // Already in newest-first order because the SQL is desc by started_at
  // and forEach preserves array order within each call. Good as-is.

  const tz = senior.call_timezone || TZ;

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ戻る
        </Link>

        <header className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
              気づき
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
              {senior.name} さん
            </h1>
            <p className="mt-2 text-sm text-warm-brown/75 leading-relaxed">
              最近のお話から、ご家族にお伝えしたい
              <strong className="text-warm-brown">「気にとめておきたい」</strong>
              点をまとめています。新しいものから順に表示され、確認したら ✓ で消せます。
            </p>
          </div>
          <SeniorTabs seniorId={senior.id} />
        </header>

        <InsightsBuckets
          seniorId={senior.id}
          seniorName={senior.name}
          entries={entries}
          callsScanned={rows.length}
          tz={tz}
        />
      </div>
    </main>
  );
}

interface ObservationRow {
  id: string;
  started_at: string;
  observations: Observation[] | null;
}
