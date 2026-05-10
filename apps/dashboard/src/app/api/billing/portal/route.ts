import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * Create a Stripe Customer Portal session and return its URL.
 *
 * The portal is Stripe-hosted — it handles plan changes, cancellations,
 * payment method updates, and invoice history without us touching card data.
 *
 * `flow=update` deep-links into the plan-change UI; `flow=cancel` deep-links
 * into the cancellation flow. Omit `flow` for the default portal landing.
 *
 * Customer Portal must be enabled at:
 *   https://dashboard.stripe.com/settings/billing/portal
 * (separately for live + test mode).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: family } = await supabase
    .from("families")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family?.stripe_customer_id) {
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const url = new URL(request.url);
  const flow = url.searchParams.get("flow"); // "update" | "cancel" | null

  const stripe = getStripe();
  const origin =
    request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;

  const params: Parameters<typeof stripe.billingPortal.sessions.create>[0] = {
    customer: family.stripe_customer_id,
    return_url: `${origin}/dashboard/settings`,
    locale: "ja",
  };

  // Deep-link flows. Both require an active subscription.
  if ((flow === "update" || flow === "cancel") && family.stripe_subscription_id) {
    if (flow === "update") {
      params.flow_data = {
        type: "subscription_update",
        subscription_update: { subscription: family.stripe_subscription_id },
      };
    } else {
      params.flow_data = {
        type: "subscription_cancel",
        subscription_cancel: { subscription: family.stripe_subscription_id },
      };
    }
  }

  try {
    const session = await stripe.billingPortal.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billingPortal.sessions.create failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    // The most common deploy-time bug: Customer Portal hasn't been activated
    // in this Stripe mode (live + test are separate). Surface it so the user
    // (= operator) knows what to fix.
    if (/default configuration has not been created|No configuration/i.test(message)) {
      return NextResponse.json(
        {
          error: "portal_not_configured",
          message:
            "Stripe Customer Portal が有効化されていません。Stripe Dashboard → Settings → Billing → Customer Portal で設定を保存してください。",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "portal_session_failed", message: message.slice(0, 200) },
      { status: 500 }
    );
  }
}
