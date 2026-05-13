import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { GlassCard } from "@/components/ui/glass-card";
import { SeniorTabs } from "./_components/senior-tabs";
import { ActivityBars, type DayCalls } from "./_components/activity-bars";
import { CallNowButton } from "./_components/call-now-button";
import {
  ObservationsCard,
  type Observation,
  type ObservationEntry,
} from "./_components/observations-card";

const TZ = "Asia/Tokyo";

export default async function SeniorDashboardPage({
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
    .select("id, name, phone, family_id, is_self, call_timezone")
    .eq("id", id)
    .maybeSingle();
  if (!senior) notFound();

  const { data: family } = await supabase
    .from("families")
    .select("id, minutes_limit, minutes_used")
    .eq("id", senior.family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) notFound();

  // Pull last 7 days of calls for the activity bars. Wider window than the
  // 7 days we render so we don't miss calls that span midnight in the
  // senior's timezone.
  const since = new Date();
  since.setDate(since.getDate() - 8);
  since.setHours(0, 0, 0, 0);
  const { data: calls } = await supabase
    .from("calls")
    .select("id, started_at, duration_seconds, summary, mood, distress_detected")
    .eq("senior_id", id)
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: true });

  // 30-day window for the observations card. Most calls produce no
  // observations, so we cast a wider net than the activity bars.
  const obsSince = new Date();
  obsSince.setDate(obsSince.getDate() - 30);
  obsSince.setHours(0, 0, 0, 0);
  const { data: obsRows } = await supabase
    .from("calls")
    .select("id, started_at, observations")
    .eq("senior_id", id)
    .gte("started_at", obsSince.toISOString())
    .not("observations", "is", null)
    .order("started_at", { ascending: false });

  const observationEntries: ObservationEntry[] = flattenObservations(obsRows ?? []);

  const days = aggregateByDay(calls ?? [], senior.call_timezone || TZ);
  const familyHasMinutes = family.minutes_used < family.minutes_limit;

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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
                {senior.is_self ? "自分用" : "大切な方"}
              </div>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
                {senior.name} さん
              </h1>
              <p className="mt-1 text-sm text-warm-brown/70">{senior.phone}</p>
            </div>
            <CallNowButton
              seniorId={senior.id}
              disabled={!familyHasMinutes}
              disabledReason={
                !familyHasMinutes ? "残り分数がありません" : undefined
              }
            />
          </div>
          <SeniorTabs seniorId={senior.id} />
        </header>

        <GlassCard className="space-y-5 p-6 md:p-8">
          <div>
            <h2 className="font-serif text-xl font-medium text-warm-brown">
              お話の記録（直近7日間）
            </h2>
            <p className="mt-1 text-sm text-warm-brown/70">
              バーの高さで、その日にお話しした時間の長さがわかります。
            </p>
          </div>
          <ActivityBars
            days={days}
            seniorName={senior.name}
            tz={senior.call_timezone || TZ}
          />
        </GlassCard>

        <ObservationsCard
          seniorName={senior.name}
          entries={observationEntries}
          tz={senior.call_timezone || TZ}
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
  // Cap at a reasonable display count so the card stays scannable. Most
  // calls produce 0–2 observations, so 12 covers a typical month while
  // still ranking high-severity items near the top.
  out.sort((a, b) => {
    // 1) high-severity concerning items first
    const sevA = severityRank(a.observation);
    const sevB = severityRank(b.observation);
    if (sevA !== sevB) return sevA - sevB;
    // 2) then by date desc
    return b.started_at.localeCompare(a.started_at);
  });
  return out.slice(0, 12);
}

function severityRank(o: Observation): number {
  if (o.positive) return 3;
  if (o.severity === "high") return 0;
  if (o.severity === "medium") return 1;
  return 2;
}

interface CallRow {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  summary: string | null;
  mood: string | null;
  distress_detected: boolean;
}

function aggregateByDay(calls: CallRow[], tz: string): DayCalls[] {
  // Group by local date in the senior's timezone. We use Intl rather than a
  // tz library to avoid pulling moment/date-fns-tz into the bundle.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const buckets = new Map<string, DayCalls>();
  for (const c of calls) {
    const date = fmt.format(new Date(c.started_at)); // "YYYY-MM-DD"
    const minutes = c.duration_seconds
      ? Math.max(1, Math.ceil(c.duration_seconds / 60))
      : 0;
    let entry = buckets.get(date);
    if (!entry) {
      entry = { date, total_minutes: 0, calls: [] };
      buckets.set(date, entry);
    }
    entry.total_minutes += minutes;
    entry.calls.push(c);
  }
  return Array.from(buckets.values());
}
