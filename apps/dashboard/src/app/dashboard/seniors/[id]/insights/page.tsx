import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeniorTabs } from "../_components/senior-tabs";
import {
  InsightsBuckets,
  type Observation,
  type ObservationEntry,
} from "../_components/insights-buckets";

const TZ = "Asia/Tokyo";

/**
 * The 気づき tab — traffic-light buckets of observations from the last
 * ~20 calls (or 30 days, whichever is smaller in practice). Deliberately
 * non-clinical:
 *   🟢 安心ポイント
 *   🟡 ちょっと気にとめておきたい
 *   🔴 ご家族と話してみてください
 *
 * The bucket logic lives in insights-buckets.tsx so it stays unit-
 * testable and can later get its own observations-aggregator route
 * for parents who want the data as JSON.
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
    .select("id, name, family_id, call_timezone")
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

  // 30-day window matches the existing observations card. Most calls
  // produce 0-2 observations so this is a generous net.
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
  const entries: ObservationEntry[] = flattenObservations(rows);

  const tz = senior.call_timezone || TZ;

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      {/* Wider than other tabs (max-w-3xl) because the buckets need room
          to lay out side-by-side on desktop without each column becoming
          too narrow. */}
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
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
              最近のお話の中から、ご家族にお伝えしたい
              <strong className="text-warm-brown">「気にとめておきたい」</strong>
              点や
              <strong className="text-warm-brown">「安心」</strong>
              ポイントを、3つの信号にまとめています。
            </p>
          </div>
          <SeniorTabs seniorId={senior.id} />
        </header>

        <InsightsBuckets
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

function flattenObservations(rows: ObservationRow[]): ObservationEntry[] {
  const out: ObservationEntry[] = [];
  for (const row of rows) {
    if (!Array.isArray(row.observations)) continue;
    for (const obs of row.observations) {
      if (!obs || typeof obs !== "object" || !obs.detail) continue;
      out.push({
        observation: obs,
        call_id: row.id,
        started_at: row.started_at,
      });
    }
  }
  return out;
}
