import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { GlassCard } from "@/components/ui/glass-card";
import { SubscriptionActions } from "./subscription-actions";

const PLAN_INFO: Record<string, { name: string; price: number; minutes: number }> = {
  light: { name: "ライト", price: 3980, minutes: 100 },
  standard: { name: "スタンダード", price: 9800, minutes: 400 },
  premium: { name: "プレミアム", price: 19800, minutes: 1000 },
};

function formatJpDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const STATUS_LABELS: Record<string, string> = {
  trialing: "無料トライアル中",
  active: "ご利用中",
  past_due: "お支払いが滞っています",
  canceled: "解約済み",
  unpaid: "未払い",
  incomplete: "登録未完了",
  incomplete_expired: "登録未完了（期限切れ）",
  paused: "一時停止中",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: family } = await supabase
    .from("families")
    .select(
      "name, plan, subscription_status, minutes_limit, minutes_used, stripe_customer_id, stripe_subscription_id"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const planInfo = family ? PLAN_INFO[family.plan] : null;

  // Fetch trial end + cancel-pending state from Stripe so we can show the
  // user clearly whether they'll be charged on cancel. trial_end is a Unix
  // timestamp (seconds); null/past = no active trial.
  let trialEndsAt: string | null = null;
  let cancelAtPeriodEnd = false;
  let periodEndsAt: string | null = null;
  if (family?.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(family.stripe_subscription_id);
      const now = Math.floor(Date.now() / 1000);
      if (sub.trial_end && sub.trial_end > now) {
        trialEndsAt = formatJpDate(sub.trial_end);
      }
      cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
      const subWithPeriod = sub as unknown as { current_period_end?: number };
      if (cancelAtPeriodEnd && subWithPeriod.current_period_end) {
        periodEndsAt = formatJpDate(subWithPeriod.current_period_end);
      }
    } catch (err) {
      console.error("settings: subscription retrieve failed:", err);
    }
  }

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ戻る
        </Link>

        <header>
          <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
            設定
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
            アカウント・サブスクリプション
          </h1>
          <p className="mt-2 text-sm text-warm-brown/70">
            ログイン用電話番号：{user.phone ? `+${user.phone}` : "—"}
          </p>
        </header>

        <GlassCard className="space-y-5 p-6 md:p-8">
          <div>
            <h2 className="font-serif text-xl font-medium text-warm-brown">
              現在のプラン
            </h2>
            {!family || !planInfo ? (
              <p className="mt-2 text-sm text-warm-gray">
                サブスクリプション情報が見つかりません。
                <Link href="/sign-up" className="ml-1 text-coral hover:underline">
                  新規登録はこちら
                </Link>
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-2xl font-medium text-warm-brown">
                    {planInfo.name}プラン
                  </span>
                  <span className="text-warm-brown">
                    ¥{planInfo.price.toLocaleString()}
                    <span className="ml-1 text-xs text-warm-gray">/月</span>
                  </span>
                </div>
                <div className="text-xs text-warm-gray">
                  {planInfo.minutes}分／月 ・{" "}
                  {STATUS_LABELS[family.subscription_status] ??
                    family.subscription_status}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-rose-200/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-coral to-warm-orange"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (family.minutes_used /
                            Math.max(1, family.minutes_limit)) *
                            100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-warm-gray">
                  今月のご利用：{family.minutes_used} / {family.minutes_limit} 分
                </div>
              </div>
            )}
          </div>

          {family?.stripe_customer_id && (
            <SubscriptionActions
              hasActiveSubscription={
                family.subscription_status === "active" ||
                family.subscription_status === "trialing" ||
                family.subscription_status === "past_due"
              }
              trialEndsAt={trialEndsAt}
              cancelAtPeriodEnd={cancelAtPeriodEnd}
              periodEndsAt={periodEndsAt}
            />
          )}
        </GlassCard>

        <p className="text-center text-xs text-warm-gray">
          お支払い方法・領収書の確認も上のボタンからご利用いただけます。
        </p>
      </div>
    </main>
  );
}
