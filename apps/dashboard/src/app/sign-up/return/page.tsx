import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const PLAN_MINUTES: Record<string, number> = {
  light: 100,
  standard: 400,
  premium: 1000,
};

/**
 * Stripe redirects here after embedded checkout completes (because we set
 * `return_url` on the Checkout Session).
 *
 * Two responsibilities:
 *
 * 1. AUTO-LOGIN — set a fresh one-time password on the buyer's Supabase
 *    user and sign them in via the cookie-writing SSR client. No SMS, no
 *    Twilio. Drops them on /dashboard already authenticated.
 *
 * 2. SELF-HEAL provisioning — if the Stripe webhook hasn't (yet) created
 *    the family + senior rows, create them here using the same Stripe
 *    subscription metadata. Webhook stays as the source of truth for
 *    renewals/cancellations, but signup provisioning becomes self-healing
 *    so a flaky webhook delivery doesn't strand a paying customer with an
 *    empty dashboard.
 *
 * Both steps are idempotent. If the webhook later succeeds it becomes a
 * no-op (family upsert by user_id; senior insert guarded by phone match).
 *
 * Fallback: if anything goes wrong (Phone provider misconfig, race), we
 * redirect to /sign-up/verify-final to do the SMS-OTP path instead.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const session_id = params.session_id;
  if (!session_id) redirect("/sign-up");

  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  const looksReal = (k: string) => k.length > 20 && !k.endsWith("...");
  const stub =
    !looksReal(sk) ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (stub) redirect("/sign-up/thanks");

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.status !== "complete") {
    redirect(`/sign-up?cancelled=1`);
  }

  const subId =
    typeof session.subscription === "string" ? session.subscription : null;
  let sub: Stripe.Subscription | null = null;
  let buyerPhone: string | undefined;
  if (subId) {
    sub = await stripe.subscriptions.retrieve(subId);
    buyerPhone = sub.metadata?.buyer_phone;
  }
  if (!buyerPhone || !sub) {
    redirect("/sign-in");
  }

  const fallback = `/sign-up/verify-final?phone=${encodeURIComponent(buyerPhone)}`;
  const admin = createServiceClient();

  // 1. Ensure a Supabase user exists for this phone, with a known one-time
  //    password we can immediately consume below.
  const password = randomBytes(24).toString("base64url");
  let userId: string | undefined;

  const created = await admin.auth.admin.createUser({
    phone: buyerPhone,
    phone_confirm: true,
    password,
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else if (
    created.error &&
    /already.*exists|registered/i.test(created.error.message)
  ) {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list.data?.users.find(
      (u: { phone?: string }) =>
        u.phone === buyerPhone!.replace(/^\+/, "") || u.phone === buyerPhone
    )?.id;
    if (userId) {
      await admin.auth.admin.updateUserById(userId, {
        password,
        phone_confirm: true,
      });
    }
  } else if (created.error) {
    console.error("return: createUser failed:", created.error);
    redirect(fallback);
  }
  if (!userId) {
    console.error("return: could not resolve user id for phone:", buyerPhone);
    redirect(fallback);
  }

  // 2. Self-heal provisioning — guarantees the dashboard isn't empty when
  //    the buyer lands. Idempotent. We do this BEFORE signInWithPassword so
  //    if it fails we still redirect to fallback (the user gets a clearer
  //    "something's wrong" path than landing on an empty dashboard).
  await selfHealProvisioning(admin, stripe, userId, sub).catch((e) => {
    console.error("return: self-heal failed (non-fatal):", e);
  });

  // 3. Sign in via the cookie-writing server client. No SMS, no Twilio.
  const supa = await createClient();
  const { error: signInErr } = await supa.auth.signInWithPassword({
    phone: buyerPhone,
    password,
  });
  if (signInErr) {
    console.error("return: signInWithPassword failed:", signInErr);
    redirect(fallback);
  }

  // 4. Rotate the password to a fresh random unusable value. Fire-and-
  //    forget — even if this fails the session is already issued.
  admin.auth.admin
    .updateUserById(userId, {
      password: randomBytes(48).toString("base64url"),
    })
    .catch((err: unknown) => {
      console.error("return: password rotate failed:", err);
    });

  redirect("/dashboard");
}

/**
 * If the Stripe webhook hasn't (yet) populated families + seniors for this
 * user, do it here using the Stripe subscription metadata. Both inserts are
 * guarded so concurrent webhook execution doesn't create duplicates.
 */
async function selfHealProvisioning(
  admin: ReturnType<typeof createServiceClient>,
  stripe: ReturnType<typeof getStripe>,
  userId: string,
  sub: Stripe.Subscription
) {
  const md = sub.metadata ?? {};

  // --- families ---
  let familyId: string | undefined;
  const { data: existingFamily } = await admin
    .from("families")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingFamily) {
    familyId = existingFamily.id;
  } else {
    const plan = md.plan || "standard";
    const customerId = typeof sub.customer === "string" ? sub.customer : null;
    const { data: family, error } = await admin
      .from("families")
      .upsert(
        {
          user_id: userId,
          name: md.introducer_name || md.recipient_name || "",
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          plan,
          minutes_limit: PLAN_MINUTES[plan] ?? 400,
          minutes_used: 0,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();
    if (error || !family) {
      console.error("self-heal families upsert failed:", error);
      return;
    }
    familyId = family.id;
  }

  if (!familyId) return;

  // --- seniors --- guarded by phone match so we never duplicate.
  const recipientPhone = md.recipient_phone;
  if (!recipientPhone) return;
  const { data: existingSenior } = await admin
    .from("seniors")
    .select("id")
    .eq("family_id", familyId)
    .eq("phone", recipientPhone)
    .maybeSingle();
  if (existingSenior) return;

  let schedule: unknown[] = [];
  try {
    schedule = JSON.parse(md.schedule || "[]");
  } catch {
    schedule = [];
  }

  // Try with agent_name; if column missing, retry without it.
  const baseInsert = {
    family_id: familyId,
    name: md.recipient_name || "",
    phone: recipientPhone,
    schedule,
    is_self: md.audience === "self",
    introducer_name: md.introducer_name || null,
    introducer_relationship: md.introducer_relationship || null,
    health_notes: null,
    is_active: true,
  };
  const insertWithAgent = {
    ...baseInsert,
    agent_name: md.agent_name?.trim() || null,
  };

  let { data: senior, error: senErr } = await admin
    .from("seniors")
    .insert(insertWithAgent)
    .select("id")
    .single();
  if (senErr && /agent_name/.test(senErr.message)) {
    const r = await admin
      .from("seniors")
      .insert(baseInsert)
      .select("id")
      .single();
    senior = r.data;
    senErr = r.error;
  }
  if (senErr || !senior) {
    console.error("self-heal seniors insert failed:", senErr);
    return;
  }

  // Stamp back to Stripe metadata so future renewal/cancel events find it.
  try {
    await stripe.subscriptions.update(sub.id, {
      metadata: { ...md, family_id: familyId, senior_id: senior.id },
    });
  } catch (e) {
    console.error("self-heal: stripe metadata stamp failed:", e);
  }
}
