import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeniorTabs } from "../_components/senior-tabs";
import { ScheduleEditor } from "../_components/schedule-editor";
import { EmergencySettings } from "../_components/emergency-settings";
import { AgentNameEditor } from "../_components/agent-name-editor";

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

  const { data: senior } = await supabase
    .from("seniors")
    .select(
      "id, name, phone, schedule, family_id, is_self, emergency_contact_phone, emergency_on_no_answer, agent_name, daily_check_deadline"
    )
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
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ戻る
        </Link>

        <header className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
            {senior.is_self ? "自分用" : "大切な方"}
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
            {senior.name} さん
          </h1>
          <p className="text-sm text-warm-brown/70">{senior.phone}</p>
          <SeniorTabs seniorId={senior.id} />
        </header>

        <ScheduleEditor
          seniorId={senior.id}
          initialSchedule={(senior.schedule ?? []) as ScheduleEntry[]}
        />

        <AgentNameEditor
          seniorId={senior.id}
          initialAgentName={senior.agent_name ?? null}
        />

        <EmergencySettings
          seniorId={senior.id}
          seniorName={senior.name}
          initialOnNoAnswer={Boolean(senior.emergency_on_no_answer)}
          initialDailyDeadline={senior.daily_check_deadline ?? null}
          buyerPhone={user.phone ? `+${user.phone}` : null}
        />
      </div>
    </main>
  );
}
