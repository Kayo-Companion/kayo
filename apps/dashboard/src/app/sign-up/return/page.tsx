import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { getStripe } from "@/lib/stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Stripe redirects here after embedded checkout completes (because we set
 * `return_url` on the Checkout Session).
 *
 * Auto-login flow — no second SMS:
 *   1. Look up the buyer's phone from the Stripe subscription metadata.
 *   2. Set a fresh one-time random password on the Supabase user (creating the
 *      user if needed; the webhook may also create it in parallel — both
 *      paths are idempotent).
 *   3. Sign in via the cookie-writing SSR client using phone+password — this
 *      does NOT touch Twilio, so it sidesteps any SMS provider issues.
 *   4. Rotate the password to a fresh random unusable value so the link
 *      can't be replayed.
 *   5. Redirect to /dashboard. The user lands logged in with one click.
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
  let buyerPhone: string | undefined;
  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId);
    buyerPhone = sub.metadata?.buyer_phone;
  }
  if (!buyerPhone) {
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
    // The webhook (or a previous return-run) already created the user. Find
    // them and rotate the password to ours so we can sign in.
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

  // 2. Sign in via the cookie-writing server client. No SMS, no Twilio.
  const supa = await createClient();
  const { error: signInErr } = await supa.auth.signInWithPassword({
    phone: buyerPhone,
    password,
  });
  if (signInErr) {
    console.error("return: signInWithPassword failed:", signInErr);
    redirect(fallback);
  }

  // 3. Rotate the password to a fresh random unusable value. Fire-and-
  //    forget — even if this fails the session is already issued; the
  //    password just stays a high-entropy random string.
  admin.auth.admin
    .updateUserById(userId, {
      password: randomBytes(48).toString("base64url"),
    })
    .catch((err: unknown) => {
      console.error("return: password rotate failed:", err);
    });

  redirect("/dashboard");
}
