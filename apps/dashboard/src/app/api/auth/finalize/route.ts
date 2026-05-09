import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

/**
 * Looks up the buyer's phone from a completed Stripe Checkout Session and
 * returns it to the client. The client then redirects to /sign-up/verify-final
 * to enter the SMS OTP and finish auth.
 *
 * This route is currently not wired up by the embedded-checkout client —
 * /sign-up/return handles everything server-side — but kept here in case a
 * future flow needs the same lookup.
 */
export async function POST(request: Request) {
  const { session_id } = (await request.json()) as { session_id?: string };
  if (!session_id) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  const looksReal = (k: string) => k.length > 20 && !k.endsWith("...");
  const stub =
    !looksReal(sk) ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (stub) {
    return NextResponse.json({ url: "/dashboard" });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.status !== "complete") {
    return NextResponse.json(
      { error: "session_not_complete", status: session.status },
      { status: 409 }
    );
  }

  const subId =
    typeof session.subscription === "string" ? session.subscription : null;
  if (!subId) {
    return NextResponse.json({ error: "no_subscription" }, { status: 400 });
  }
  const sub = await stripe.subscriptions.retrieve(subId);
  const buyerPhone = sub.metadata?.buyer_phone;
  if (!buyerPhone) {
    return NextResponse.json({ error: "no_buyer_phone" }, { status: 400 });
  }

  return NextResponse.json({
    url: `/sign-up/verify-final?phone=${encodeURIComponent(buyerPhone)}`,
    phone: buyerPhone,
  });
}
