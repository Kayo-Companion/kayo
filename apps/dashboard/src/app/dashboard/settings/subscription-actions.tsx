"use client";

import { ArrowRight, CheckCircle2, CreditCard, Info, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Two buttons that open the Stripe-hosted Customer Portal — one deep-linked
 * to the plan-change flow, one to the cancel flow. Stripe handles all the
 * billing logic, proration, payment-method updates, etc.
 *
 * We surface a clearer "no charge during trial" banner above the buttons
 * because Stripe's portal screen is misleading — it shows ¥3,980 prominently
 * even when the user is mid-trial and won't actually be charged.
 */
export function SubscriptionActions({
  hasActiveSubscription,
  trialEndsAt,
  cancelAtPeriodEnd,
  periodEndsAt,
}: {
  hasActiveSubscription: boolean;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  periodEndsAt: string | null;
}) {
  const [loading, setLoading] = useState<"update" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async (flow: "update" | "cancel") => {
    setLoading(flow);
    setError(null);
    try {
      const res = await fetch(`/api/billing/portal?flow=${flow}`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        let message = "管理画面を開けませんでした。少し時間をおいて再度お試しください。";
        if (body.error === "no_customer") {
          message = "サブスクリプション情報が見つかりません。";
        } else if (body.error === "portal_not_configured") {
          message = body.message ?? "Stripe Customer Portal が未設定です。";
        } else if (body.message) {
          message = body.message;
        }
        setError(message);
        setLoading(null);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("通信エラーが発生しました。");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3 border-t border-rose-200/40 pt-5">
      <h2 className="font-serif text-xl font-medium text-warm-brown">
        サブスクリプション
      </h2>

      {trialEndsAt && !cancelAtPeriodEnd && (
        <div className="flex gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <span className="font-semibold">
              無料トライアル中（〜{trialEndsAt}）
            </span>
            <br />
            この期間中に解約すれば、料金は<strong>一切請求されません</strong>。
          </div>
        </div>
      )}

      {cancelAtPeriodEnd && periodEndsAt && (
        <div className="flex gap-2 rounded-2xl border border-warm-orange/50 bg-warm-orange/10 p-3 text-xs leading-relaxed text-warm-brown">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warm-orange" />
          <div>
            <span className="font-semibold">解約予定です</span>
            <br />
            {periodEndsAt}まで引き続きご利用いただけます。今後の請求はありません。
          </div>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => openPortal("update")}
        disabled={!hasActiveSubscription || loading !== null}
      >
        {loading === "update" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            準備中…
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            プランを変更する
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={() => openPortal("cancel")}
        disabled={!hasActiveSubscription || loading !== null}
      >
        {loading === "cancel" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            準備中…
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4" />
            解約する
          </>
        )}
      </Button>

      {!hasActiveSubscription && (
        <p className="text-xs text-warm-gray">
          ご解約済みです。再度ご利用になりたい場合は新規登録からお進みください。
        </p>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}
