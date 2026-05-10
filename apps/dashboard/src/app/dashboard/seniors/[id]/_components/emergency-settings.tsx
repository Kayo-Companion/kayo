"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";

/**
 * Single-toggle emergency-contact section. Emergency contact phone is
 * automatically the buyer's login phone (passed in as buyerPhone) — no
 * separate input field. Toggle auto-saves on change.
 */
export function EmergencySettings({
  seniorId,
  seniorName,
  initialEnabled,
  buyerPhone,
}: {
  seniorId: string;
  seniorName: string;
  initialEnabled: boolean;
  buyerPhone: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const toggle = async () => {
    if (status.kind === "saving") return;
    if (!buyerPhone) {
      setStatus({
        kind: "error",
        message: "ログイン用の電話番号が見つかりません。",
      });
      return;
    }
    const next = !enabled;
    setEnabled(next);
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/seniors/${seniorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergency_on_no_answer: next,
          // When turning on, stamp the buyer's phone as the destination.
          // When turning off, clear it (we don't need the address anymore).
          emergency_contact_phone: next ? buyerPhone : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // Roll back the optimistic flip.
        setEnabled(!next);
        setStatus({
          kind: "error",
          message: body.message ?? "保存に失敗しました。",
        });
        return;
      }
      setStatus({ kind: "saved" });
      router.refresh();
    } catch {
      setEnabled(!next);
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  return (
    <GlassCard className="space-y-4 p-6 md:p-8">
      <div>
        <h2 className="font-serif text-xl font-medium text-warm-brown">
          通知
        </h2>
        <p className="mt-1 text-sm text-warm-brown/70">
          カヨからのお電話に出られなかった時、SMSでお知らせします。
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-300/40 bg-white/60 p-4">
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium text-warm-brown">
            {seniorName}さんが電話に出ない場合に通知を受け取る
          </div>
          <p className="text-xs text-warm-gray">
            送信先：{buyerPhone ? formatPhone(buyerPhone) : "（未設定）"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={status.kind === "saving" || !buyerPhone}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-coral" : "bg-rose-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {status.kind === "saving" && (
        <p className="flex items-center gap-1.5 text-xs text-warm-gray">
          <Loader2 className="h-3 w-3 animate-spin" />
          保存中…
        </p>
      )}
      {status.kind === "saved" && (
        <p className="text-xs text-emerald-600">✓ 保存しました</p>
      )}
      {status.kind === "error" && (
        <p className="flex items-center gap-1 text-xs text-coral">
          <AlertTriangle className="h-3 w-3" />
          {status.message}
        </p>
      )}
    </GlassCard>
  );
}

function formatPhone(e164: string): string {
  const cleaned = e164.startsWith("+") ? e164 : `+${e164}`;
  if (/^\+1\d{10}$/.test(cleaned)) {
    const d = cleaned.slice(2);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (/^\+81\d{9,10}$/.test(cleaned)) {
    const d = cleaned.slice(3);
    if (d.length === 10) return `+81 ${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `+81 ${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5)}`;
  }
  return cleaned;
}
