"use client";

import { CheckCircle2, ArrowRight, Phone, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import type { Plan, ScheduleEntry, SignUpData, Weekday } from "../page";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

const PLAN_INFO: Record<Plan, { name: string; price: number; minutes: number; perDay: string }> = {
  light: { name: "ライト", price: 3980, minutes: 100, perDay: "1日 約3分" },
  standard: { name: "スタンダード", price: 9800, minutes: 400, perDay: "1日 約13分" },
  premium: { name: "プレミアム", price: 19800, minutes: 1000, perDay: "1日 約33分" },
};

function formatSchedule(schedule: ScheduleEntry[]): string {
  if (schedule.length === 0) return "未設定（電話でいつでも話せます）";
  return schedule
    .map((s) => `${WEEKDAY_LABELS[s.weekday]} ${s.time}`)
    .join("、");
}

interface Props {
  data: SignUpData;
  onChangePlan: (plan: Plan) => void;
  onEdit: () => void;
}

type CheckoutState =
  | { kind: "review" }
  | { kind: "loading" }
  | { kind: "embedded"; clientSecret: string }
  | { kind: "error"; message: string };

export function ConfirmationStep({ data, onChangePlan, onEdit }: Props) {
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "review" });
  const [testStatus, setTestStatus] = useState<
    | { kind: "idle" }
    | { kind: "calling" }
    | { kind: "success"; phone: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleStartCheckout = async () => {
    setCheckout({ kind: "loading" });
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setCheckout({
        kind: "error",
        message: body.error ?? "通信エラーが発生しました。もう一度お試しください。",
      });
      return;
    }
    const body = (await response.json()) as
      | { clientSecret: string }
      | { stub: true; url: string };
    if ("stub" in body) {
      // Stripe not configured (dev) — bounce to the static thanks page.
      window.location.href = body.url;
      return;
    }
    setCheckout({ kind: "embedded", clientSecret: body.clientSecret });
  };

  const handleTestCall = async () => {
    setTestStatus({ kind: "calling" });
    const response = await fetch("/api/test-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setTestStatus({
        kind: "error",
        message:
          body?.detail ?? body?.error ?? "発信に失敗しました。voice serviceとtunnelが起動しているかご確認ください。",
      });
      return;
    }
    setTestStatus({ kind: "success", phone: data.recipientPhone });
  };

  const audienceLabel =
    data.audience === "self" ? "ご自身のため" : "大切な方へのプレゼント";

  // Embedded Stripe checkout view — replaces the review UI in-place.
  if (checkout.kind === "embedded" && stripePromise) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCheckout({ kind: "review" })}
            className="text-sm text-warm-gray hover:text-coral"
          >
            ← 内容を確認しなおす
          </button>
          <button
            onClick={onEdit}
            className="text-sm text-warm-gray hover:text-coral"
          >
            登録内容を編集する
          </button>
        </div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-warm-brown">
          お支払い情報を入力
        </h1>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-20px_rgba(232,93,93,0.18)]">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret: checkout.clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onEdit}
        className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
      >
        ← 登録内容を編集する
      </button>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/40">
          <CheckCircle2 className="h-7 w-7 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-warm-brown sm:text-3xl">
          内容のご確認
        </h1>
        <p className="mt-2 text-sm text-warm-brown/70">
          ご登録内容に間違いがなければ、お支払いに進んでください。
        </p>
      </div>

      <GlassCard className="space-y-4 p-6 md:p-8">
        <Row label="お申込み種別" value={audienceLabel} />
        <Row label="お名前" value={data.recipientName} />
        {data.audience === "self" ? (
          <Row label="電話番号（ログイン兼用）" value={data.recipientPhone} />
        ) : (
          <>
            <Row label="大切な方の電話番号（カヨが発信）" value={data.recipientPhone} />
            <Row label="ログイン用電話番号（あなた）" value={data.buyerPhone} />
          </>
        )}
        <Row label="お電話のスケジュール" value={formatSchedule(data.schedule)} />

        {data.audience === "family" && (
          <Row
            label="紹介者（あなた）"
            value={`${data.introducerName} さん（${data.introducerRelationship}）`}
          />
        )}
      </GlassCard>

      <div>
        <div className="mb-3 text-sm font-medium text-warm-brown">プランを選ぶ</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.keys(PLAN_INFO) as Plan[]).map((p) => {
            const info = PLAN_INFO[p];
            const selected = data.plan === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChangePlan(p)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  selected
                    ? "border-coral bg-white shadow-[0_8px_30px_-10px_rgba(232,93,93,0.25)]"
                    : "border-rose-300/40 bg-white/60 hover:border-rose-300"
                }`}
              >
                <div className={`text-xs font-semibold ${selected ? "text-coral" : "text-warm-gray"}`}>
                  {info.name}
                </div>
                <div className="mt-1 font-serif text-xl font-medium text-warm-brown">
                  ¥{info.price.toLocaleString()}
                  <span className="ml-1 text-xs text-warm-gray">/月</span>
                </div>
                <div className="mt-1 text-[10px] text-warm-gray">
                  {info.minutes}分・{info.perDay}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-warm-gray">
          初月7日間は無料・いつでも解約OK・100分パック ¥2,500 で追加可能
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleStartCheckout}
        disabled={checkout.kind === "loading"}
      >
        {checkout.kind === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            お支払い画面を準備中…
          </>
        ) : (
          <>
            7日間無料ではじめる
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
      {checkout.kind === "error" && (
        <p className="text-center text-sm text-coral">{checkout.message}</p>
      )}

      {/* Dev / test mode — bypass Stripe and trigger a real call right now. */}
      <div className="rounded-2xl border border-dashed border-rose-300/60 bg-white/40 p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-warm-gray">
          開発・テスト用
        </div>
        <p className="mb-3 text-xs text-warm-brown/75">
          会計をスキップして、今すぐ
          {data.recipientPhone}
          にカヨから電話をかけます。voice serviceが起動している必要があります。
        </p>
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={handleTestCall}
          disabled={testStatus.kind === "calling"}
        >
          <Phone className="h-4 w-4" />
          {testStatus.kind === "calling"
            ? "発信中..."
            : "テストで発信（決済スキップ）"}
        </Button>
        {testStatus.kind === "success" && (
          <p className="mt-2 text-xs text-emerald-600">
            ✓ 発信しました。{testStatus.phone} にカヨから電話がかかります。
          </p>
        )}
        {testStatus.kind === "error" && (
          <p className="mt-2 text-xs text-coral">{testStatus.message}</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-rose-200/40 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-sm text-warm-gray">{label}</span>
      <span className="text-sm font-medium text-warm-brown sm:text-right">
        {value}
      </span>
    </div>
  );
}
