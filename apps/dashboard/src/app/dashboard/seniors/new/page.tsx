import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddSeniorWizard } from "./wizard";

export default async function AddSeniorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Pre-fill the introducer-name field for the family path with whatever name
  // the buyer has on their account (set during signup webhook).
  const buyerName =
    (user.user_metadata?.name as string | undefined)?.trim() || "";

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <AddSeniorWizard buyerName={buyerName} />
      </div>
    </main>
  );
}
