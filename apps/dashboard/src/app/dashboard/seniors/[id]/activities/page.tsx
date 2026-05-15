import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeniorTabs } from "../_components/senior-tabs";
import { CognitiveHistory, type HdsrSession } from "./cognitive-history";

const TZ = "Asia/Tokyo";

interface HdsrEntry {
  type: "brain_training";
  total?: number;
  max?: number;
  interpretation?: string;
  notes?: string;
  questions?: HdsrSession["questions"];
}

interface CallRow {
  id: string;
  started_at: string;
  activity_results: HdsrEntry[] | null;
}

/**
 * 認知機能チェック tab — slide-style history of HDS-R results.
 *
 * Habit-tracker style UX: left/right arrows let the family flip
 * through each past 脳トレ session. Newest first. No bar charts of
 * "how many quizzes did mom do this month" — the user explicitly
 * asked us to drop that and focus on cognitive scoring only.
 *
 * The senior themselves never sees these numbers; Kayo deliberately
 * never speaks the score back to them. This page is the family's
 * only view into the cognitive measurements.
 */
export default async function SeniorActivitiesPage({
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

  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("id", senior.family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) notFound();

  // Pull all calls that have any HDS-R results. We don't time-box this:
  // the slider is for browsing all sessions over the lifetime of the
  // subscription, not "this month only".
  const { data: callRows } = await supabase
    .from("calls")
    .select("id, started_at, activity_results")
    .eq("senior_id", id)
    .not("activity_results", "is", null)
    .order("started_at", { ascending: false });

  const rows = (callRows ?? []) as CallRow[];
  const tz = senior.call_timezone || TZ;

  // Flatten one HDS-R result per call into the slider's session array.
  // Newest first. Multiple HDS-R sessions in one call (rare) get
  // separate slides.
  const sessions: HdsrSession[] = [];
  for (const row of rows) {
    if (!row.activity_results) continue;
    for (const entry of row.activity_results) {
      if (entry.type !== "brain_training") continue;
      sessions.push({
        started_at: row.started_at,
        call_id: row.id,
        total: entry.total ?? 0,
        max: entry.max ?? 30,
        interpretation: entry.interpretation ?? "",
        notes: entry.notes,
        questions: entry.questions ?? [],
      });
    }
  }

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
              認知機能チェック
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
              {senior.name} さん
            </h1>
            <p className="mt-2 text-sm text-warm-brown/75 leading-relaxed">
              通話中にご本人が「脳トレ」を選んだときの結果（HDS-R 形式・全9問）を、過去のものから順に確認できます。左右の矢印で履歴をめくれます。
            </p>
          </div>
          <SeniorTabs seniorId={senior.id} />
        </header>

        <CognitiveHistory sessions={sessions} tz={tz} />
      </div>
    </main>
  );
}
