import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

console.log("=== auth.users ===");
const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 100 });
for (const u of users.users) console.log(" ", { id: u.id, phone: u.phone, created: u.created_at });

console.log("\n=== families ===");
const { data: fams } = await sb.from("families").select("*").order("created_at", { ascending: false });
for (const f of fams ?? []) console.log(" ", { id: f.id, user_id: f.user_id, plan: f.plan, status: f.subscription_status, sub: f.stripe_subscription_id });

console.log("\n=== seniors ===");
const { data: sens } = await sb.from("seniors").select("*").order("created_at", { ascending: false });
for (const s of sens ?? []) console.log(" ", { id: s.id, family_id: s.family_id, name: s.name, phone: s.phone, is_self: s.is_self });

console.log("\n=== Stripe subscriptions (last 20, all statuses) ===");
const subs = await stripe.subscriptions.list({ limit: 20, status: "all" });
for (const sub of subs.data) {
  console.log(" ", {
    id: sub.id, status: sub.status, customer: sub.customer,
    plan: sub.metadata?.plan, audience: sub.metadata?.audience,
    recipient_name: sub.metadata?.recipient_name,
    buyer_phone: sub.metadata?.buyer_phone,
    family_id: sub.metadata?.family_id, // stamped post-webhook
  });
}
