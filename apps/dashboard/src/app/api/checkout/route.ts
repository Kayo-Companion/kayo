import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { normalizePhoneE164 } from "@/lib/phone";

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Plan = "light" | "standard" | "premium";

interface ScheduleEntry {
  weekday: Weekday;
  time: string;
}

interface SignUpPayload {
  audience: "self" | "family";
  plan: Plan;
  recipientName: string;
  // Western year (e.g. 1948). Required at signup; validated again here.
  recipientBirthYear: number;
  recipientPhone: string;
  schedule: ScheduleEntry[];
  introducerName?: string;
  introducerRelationship?: string;
  buyerPhone: string;
  buyerPhoneVerified: boolean;
  agentName?: string;
  // Required: the legal acceptance gate. Without this the checkout was
  // blocked on the client; we re-check here in case the request was
  // crafted without going through the UI.
  termsAccepted?: boolean;
  // Optional opt-in: future research use of anonymized data.
  researchConsent?: boolean;
}

function planPriceId(plan: Plan): string | undefined {
  switch (plan) {
    case "light":
      return process.env.STRIPE_PRICE_ID_LIGHT;
    case "standard":
      return process.env.STRIPE_PRICE_ID_STANDARD;
    case "premium":
      return process.env.STRIPE_PRICE_ID_PREMIUM;
  }
}

/**
 * Embedded Stripe Checkout — user enters card on kayo.me, no redirect.
 *
 * We DON'T create the Supabase user / family / senior here. That happens in
 * the Stripe webhook after `checkout.session.completed`, so payment success
 * is the only path that writes data. All sign-up details ride along inside
 * `subscription_data.metadata` so the webhook can reconstruct everything.
 *
 */
export async function POST(request: Request) {
  const data = (await request.json()) as SignUpPayload;

  const phone = normalizePhoneE164(data.recipientPhone);
  if (!phone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }
  const buyerPhone = normalizePhoneE164(data.buyerPhone);
  if (!buyerPhone) {
    return NextResponse.json({ error: "invalid_buyer_phone" }, { status: 400 });
  }
  if (!data.buyerPhoneVerified) {
    return NextResponse.json({ error: "buyer_phone_unverified" }, { status: 400 });
  }
  if (!data.termsAccepted) {
    return NextResponse.json({ error: "terms_not_accepted" }, { status: 400 });
  }
  // Mirror the DB CHECK on seniors.birth_year. Reject obviously-bad
  // values rather than letting them propagate into Stripe metadata.
  const birthYear = Number(data.recipientBirthYear);
  if (
    !Number.isInteger(birthYear) ||
    birthYear < 1900 ||
    birthYear > 2010
  ) {
    return NextResponse.json({ error: "invalid_birth_year" }, { status: 400 });
  }

  // Treat placeholder values (e.g. "sk_test_...") as "not configured" so the
  // dev flow keeps working when the user has scaffolded .env.local but not
  // yet pasted real Stripe keys.
  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const looksReal = (k: string) => k.length > 20 && !k.endsWith("...");
  const stub = !looksReal(sk) || !looksReal(pk);

  if (stub) {
    console.log("[checkout] stub mode — Stripe keys missing or placeholder");
    return NextResponse.json({ stub: true, url: "/sign-up/thanks" });
  }

  const priceId = planPriceId(data.plan);
  if (!priceId) {
    return NextResponse.json(
      { error: "plan_price_not_configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const origin =
    request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kayo.me";

  const session = await stripe.checkout.sessions.create({
    // Stripe renamed the value: "embedded" → "embedded_page", "hosted" →
    // "hosted_page". The new names are required as of late-2025 API versions.
    ui_mode: "embedded_page",
    mode: "subscription",
    // No customer_email — phone is the auth identifier; no email collected at
    // signup. Stripe creates a Customer without an email; receipts are not
    // auto-mailed.
    line_items: [{ price: priceId, quantity: 1 }],
    // Show a "Have a promo code?" field on the embedded checkout. Promo
    // codes are created in Stripe Dashboard (Coupons → Promotion codes).
    // The discount applies on top of the trial — e.g., "100% off for 1
    // month" effectively extends the free trial; "50% off forever" gives
    // a permanent discount.
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        plan: data.plan,
        audience: data.audience,
        recipient_name: data.recipientName,
        recipient_birth_year: String(birthYear),
        recipient_phone: phone,
        buyer_phone: buyerPhone,
        introducer_name: data.introducerName ?? "",
        introducer_relationship: data.introducerRelationship ?? "",
        schedule: JSON.stringify(data.schedule),
        agent_name: (data.agentName ?? "").trim(),
        // Captured at checkout — applied to the family row by the
        // post-payment webhook. Stripe metadata values are always strings.
        terms_accepted_at: new Date().toISOString(),
        research_consent: data.researchConsent ? "true" : "false",
      },
    },
    return_url: `${origin}/sign-up/return?session_id={CHECKOUT_SESSION_ID}`,
    locale: "ja",
  });

  if (!session.client_secret) {
    return NextResponse.json({ error: "session_secret_missing" }, { status: 500 });
  }

  return NextResponse.json({ clientSecret: session.client_secret });
}
