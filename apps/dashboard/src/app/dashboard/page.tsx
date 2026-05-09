import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: family } = await supabase
    .from("families")
    .select("id, name, minutes_limit, minutes_used, subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: seniors } = await supabase
    .from("seniors")
    .select("id, name, phone, schedule, is_self, introducer_name, introducer_relationship")
    .eq("family_id", family?.id ?? "")
    .order("created_at", { ascending: true });

  return (
    <DashboardClient
      family={family ?? null}
      seniors={(seniors ?? []) as Senior[]}
    />
  );
}

interface Senior {
  id: string;
  name: string;
  phone: string;
  schedule: { weekday: string; time: string }[];
  is_self: boolean;
  introducer_name: string | null;
  introducer_relationship: string | null;
}
