import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleEditor } from "./schedule-editor";

interface ScheduleEntry {
  weekday: string;
  time: string;
}

export default async function SeniorSettingsPage({
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

  // Owner-scoped fetch via the family relationship; RLS would also enforce
  // this but checking explicitly gives us a clean 404 vs. forbidden split.
  const { data: senior } = await supabase
    .from("seniors")
    .select("id, name, phone, schedule, family_id")
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

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          ← ダッシュボードへ戻る
        </a>
        <header>
          <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
            設定
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
            {senior.name} さん
          </h1>
          <p className="mt-1 text-sm text-warm-brown/70">{senior.phone}</p>
        </header>

        <ScheduleEditor
          seniorId={senior.id}
          initialSchedule={(senior.schedule ?? []) as ScheduleEntry[]}
        />
      </div>
    </main>
  );
}
