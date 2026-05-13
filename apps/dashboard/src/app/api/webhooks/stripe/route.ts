import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";

const PLAN_MINUTES: Record<string, number> = {
  light: 100,
  standard: 400,
  premium: 1000,
};

/**
 * Stripe webhook. Source of truth for "did the payment succeed". We do all
 * the Supabase writes here (create user, family, senior) so they only happen
 * when payment actually went through.
 *
 * Set STRIPE_WEBHOOK_SECRET and point Stripe to:
 *   POST {APP_URL}/api/webhooks/stripe
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("stripe webhook signature verify failed:", err);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // One-off minute-pack purchase: top up minutes_limit.
      if (session.mode === "payment" && session.metadata?.kind === "minute_pack") {
        const familyId = session.metadata.family_id;
        const minutesToAdd = Number(session.metadata.minutes ?? 100);
        if (familyId) {
          const { data: row } = await supabase
            .from("families")
            .select("minutes_limit")
            .eq("id", familyId)
            .maybeSingle();
          if (row) {
            await supabase
              .from("families")
              .update({ minutes_limit: (row.minutes_limit ?? 0) + minutesToAdd })
              .eq("id", familyId);
          }
        }
        break;
      }

      // Subscription signup — provision the user, family, and senior.
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      if (!subscriptionId) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const md = sub.metadata;

      const buyerPhone = md.buyer_phone;
      if (!buyerPhone) {
        console.error("checkout.session.completed missing metadata.buyer_phone");
        break;
      }

      // 1. Create (or fetch) the Supabase user. Phone is the sole auth
      //    identifier — verified up-front via Twilio Verify before checkout.
      let userId: string | undefined;
      const { data: createRes, error: createErr } = await supabase.auth.admin.createUser({
        phone: buyerPhone,
        phone_confirm: true,
        user_metadata: {
          name: md.introducer_name || md.recipient_name,
        },
      });
      if (createRes?.user) {
        userId = createRes.user.id;
      } else if (createErr && /already.*registered|exists|already exists/i.test(createErr.message)) {
        // User already exists (idempotent re-run, or buyer signed up before
        // with this phone) — look them up by phone. listUsers is paginated;
        // pull a generous page to find them.
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = list?.users.find(
          (u: { phone?: string }) =>
            u.phone === buyerPhone.replace(/^\+/, "") || u.phone === buyerPhone
        )?.id;
      } else if (createErr) {
        console.error("admin.createUser failed:", createErr);
        break;
      }
      if (!userId) {
        console.error("Could not resolve Supabase user id for phone:", buyerPhone);
        break;
      }

      // 2. Upsert family row (one per user_id). No email — phone is the auth
      //    identifier and we don't collect email at signup. The families.email
      //    column stays nullable for future use.
      const plan = (md.plan as "light" | "standard" | "premium") ?? "standard";
      // Consent flags captured at checkout. Both are persisted on the
      // family row; terms_accepted_at is timestamped by us (the timestamp
      // came across in metadata as an ISO string); research_consent is a
      // boolean flag the user explicitly opted into. research_consent_at
      // is set whenever the flag flips on, so we can later show the user
      // when they granted consent.
      const termsAcceptedAt = md.terms_accepted_at || null;
      const researchConsent = md.research_consent === "true";
      const { data: family, error: familyErr } = await supabase
        .from("families")
        .upsert(
          {
            user_id: userId,
            name: md.introducer_name || md.recipient_name,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "trialing",
            plan,
            minutes_limit: PLAN_MINUTES[plan] ?? 400,
            minutes_used: 0,
            terms_accepted_at: termsAcceptedAt,
            research_consent: researchConsent,
            research_consent_at: researchConsent ? new Date().toISOString() : null,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (familyErr || !family) {
        console.error("families upsert failed:", familyErr);
        break;
      }

      // 3. Insert senior row — guarded by phone match so a webhook re-run
      //    or a parallel /sign-up/return self-heal doesn't create duplicates.
      let schedule: unknown[] = [];
      try {
        schedule = JSON.parse(md.schedule || "[]");
      } catch {
        schedule = [];
      }

      const { data: existingSenior } = await supabase
        .from("seniors")
        .select("id")
        .eq("family_id", family.id)
        .eq("phone", md.recipient_phone)
        .maybeSingle();

      // birth_year arrives as a string in Stripe metadata. Validate the
      // same range the DB CHECK enforces; fall back to null on any
      // unexpected value so a malformed metadata field doesn't block the
      // senior row from being created.
      const birthYearRaw = Number(md.recipient_birth_year);
      const birthYear =
        Number.isInteger(birthYearRaw) &&
        birthYearRaw >= 1900 &&
        birthYearRaw <= 2010
          ? birthYearRaw
          : null;

      let senior: { id: string } | null = existingSenior ?? null;
      if (!existingSenior) {
        const { data: created, error: seniorErr } = await supabase
          .from("seniors")
          .insert({
            family_id: family.id,
            name: md.recipient_name,
            phone: md.recipient_phone,
            schedule,
            is_self: md.audience === "self",
            introducer_name: md.introducer_name || null,
            introducer_relationship: md.introducer_relationship || null,
            health_notes: null,
            is_active: true,
            agent_name: md.agent_name?.trim() || null,
            birth_year: birthYear,
          })
          .select("id")
          .single();
        if (seniorErr) {
          console.error("seniors insert failed:", seniorErr);
          break;
        }
        senior = created;
      }
      if (!senior) break;

      // 4. Stamp family_id + senior_id back onto the subscription metadata
      //    so renewal/cancellation webhooks can find them later.
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          ...md,
          family_id: family.id,
          senior_id: senior.id,
        },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      // Subscription renewal — reset usage for the new period.
      const invoice = event.data.object as Stripe.Invoice & {
        subscription: string | Stripe.Subscription | null;
      };
      if (invoice.billing_reason === "subscription_cycle") {
        const subId =
          typeof invoice.subscription === "string" ? invoice.subscription : null;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const familyId = sub.metadata.family_id;
          const plan = sub.metadata.plan as "light" | "standard" | "premium" | undefined;
          const minutesForPlan = (plan && PLAN_MINUTES[plan]) ?? 400;
          if (familyId) {
            await supabase
              .from("families")
              .update({
                minutes_used: 0,
                minutes_limit: minutesForPlan,
                period_start: new Date().toISOString(),
              })
              .eq("id", familyId);
          }
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const familyId = sub.metadata.family_id;
      const seniorId = sub.metadata.senior_id;
      const status = sub.status;

      if (familyId) {
        await supabase
          .from("families")
          .update({ subscription_status: status })
          .eq("id", familyId);
      }
      if (seniorId && (status === "canceled" || status === "unpaid")) {
        await supabase.from("seniors").update({ is_active: false }).eq("id", seniorId);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
