import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * One-off Stripe Checkout for a "100-minute add-on pack". The webhook
 * (api/webhooks/stripe) bumps families.minutes_limit on completion.
 *
 * Triggered as a `<form action="/api/billing/buy-minutes" method="post">` from
 * the dashboard, so this returns a redirect (303) to the Stripe URL.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { data: family } = await supabase
    .from("families")
    .select("id, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) {
    return NextResponse.json({ error: "family_not_found" }, { status: 404 });
  }

  const priceId = process.env.STRIPE_PRICE_ID_MINUTE_PACK;
  if (!priceId) {
    return NextResponse.json(
      { error: "minute_pack_price_not_configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const origin =
    request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: family.stripe_customer_id ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      family_id: family.id,
      kind: "minute_pack",
      minutes: "100",
    },
    success_url: `${origin}/dashboard?topped_up=1`,
    cancel_url: `${origin}/dashboard`,
    locale: "ja",
  });

  if (!session.url) {
    return NextResponse.json({ error: "checkout_url_missing" }, { status: 500 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
