"use client";

import { Loader2, AlertTriangle, Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

/**
 * 安否確認モード — two independent SMS triggers:
 *
 *   (1) No-pickup: Kayo's scheduled call goes unanswered → SMS the buyer
 *   (2) Daily check: no call in EITHER direction by the chosen JST time →
 *       SMS the buyer
 *
 * Destination is the buyer's login phone (passed in), so no separate
 * phone-entry field. Both triggers can be enabled/disabled independently.
 * (1) is a simple toggle and auto-saves. (2) has a time picker and a
 * manual save button so the user isn't pestered every keystroke.
 */
export function EmergencySettings({
  seniorId,
  seniorName,
  initialOnNoAnswer,
  initialDailyDeadline,
  buyerPhone,
}: {
  seniorId: string;
  seniorName: string;
  initialOnNoAnswer: boolean;
  initialDailyDeadline: string | null;
  buyerPhone: string | null;
}) {
  const router = useRouter();

  // (1) No-pickup toggle — auto-saves on flip.
  const [onNoAnswer, setOnNoAnswer] = useState(initialOnNoAnswer);
  const [togglingNoAnswer, setTogglingNoAnswer] = useState(false);

  // (2) Daily deadline — time picker, manual save.
  const [dailyDeadline, setDailyDeadline] = useState(initialDailyDeadline ?? "");
  const [savingDaily, setSavingDaily] = useState(false);

  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flashSaved = (key: string) => {
    setSavedFlash(key);
    setTimeout(() => setSavedFlash((cur) => (cur === key ? null : cur)), 1500);
  };

  const toggleNoAnswer = async () => {
    if (togglingNoAnswer) return;
    if (!buyerPhone) {
      setError("ログイン用の電話番号が見つかりません。");
      return;
    }
    const next = !onNoAnswer;
    setOnNoAnswer(next);
    setTogglingNoAnswer(true);
    setError(null);
    try {
      const res = await fetch(`/api/seniors/${seniorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emergency_on_no_answer: next,
          emergency_contact_phone: next ? buyerPhone : null,
        }),
      });
      if (!res.ok) {
        setOnNoAnswer(!next);
        setError("保存に失敗しました。");
      } else {
        flashSaved("noanswer");
        router.refresh();
      }
    } catch {
      setOnNoAnswer(!next);
      setError("通信エラーが発生しました。");
    } finally {
      setTogglingNoAnswer(false);
    }
  };

  const saveDaily = async () => {
    if (savingDaily) return;
    setSavingDaily(true);
    setError(null);
    const value = dailyDeadline.trim();
    // Empty string = disable
    if (value && !/^\d{2}:\d{2}$/.test(value)) {
      setError("時刻はHH:MMの形式で入力してください。");
      setSavingDaily(false);
      return;
    }
    try {
      const res = await fetch(`/api/seniors/${seniorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_check_deadline: value || null,
          // If enabling daily-check for the first time, also stamp the buyer
          // phone as the emergency contact destination. Server keeps any
          // existing value when this field isn't sent.
          ...(value && buyerPhone
            ? { emergency_contact_phone: buyerPhone }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "invalid_daily_check_deadline"
            ? "時刻の形式が正しくありません。"
            : "保存に失敗しました。"
        );
      } else {
        flashSaved("daily");
        router.refresh();
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSavingDaily(false);
    }
  };

  const dailyDirty =
    dailyDeadline.trim() !== (initialDailyDeadline ?? "").trim();

  return (
    <GlassCard className="space-y-5 p-6 md:p-8">
      <div>
        <h2 className="font-serif text-xl font-medium text-warm-brown">
          安否確認モード
        </h2>
        <p className="mt-1 text-sm text-warm-brown/70">
          {seniorName}さんに何かあった時に気づけるよう、ご家族へ自動でSMSをお送りします。
        </p>
        <p className="mt-1.5 text-xs text-warm-gray">
          送信先：{buyerPhone ? formatPhone(buyerPhone) : "（未設定）"}
        </p>
      </div>

      {/* (1) No-pickup toggle */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-300/40 bg-white/60 p-4">
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium text-warm-brown">
            {seniorName}さんが電話に出ない場合に通知
          </div>
          <p className="text-xs text-warm-gray">
            カヨからの予定の電話に応答がなかった時にSMSをお送りします。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={onNoAnswer}
          onClick={toggleNoAnswer}
          disabled={togglingNoAnswer || !buyerPhone}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            onNoAnswer ? "bg-coral" : "bg-rose-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              onNoAnswer ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* (2) Daily-check time picker */}
      <div className="space-y-2 rounded-2xl border border-rose-300/40 bg-white/60 p-4">
        <div className="text-sm font-medium text-warm-brown">
          毎日この時間までに通話がない場合に通知
        </div>
        <p className="text-xs text-warm-gray">
          {seniorName}さんとカヨの間で（着信・発信どちらも）1回も通話がないまま
          設定時刻を過ぎたら、SMSでお知らせします。日本時間（JST）です。
        </p>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="time"
            value={dailyDeadline}
            onChange={(e) => setDailyDeadline(e.target.value)}
            className="rounded-xl border border-rose-300/50 bg-white/90 px-3 py-2 text-warm-brown focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20"
          />
          {dailyDeadline && (
            <button
              type="button"
              onClick={() => setDailyDeadline("")}
              className="text-xs text-warm-gray hover:text-coral"
            >
              クリア（無効化）
            </button>
          )}
          <div className="ml-auto">
            <Button
              variant="primary"
              size="md"
              onClick={saveDaily}
              disabled={!dailyDirty || savingDaily || !buyerPhone}
            >
              {savingDaily ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 保存中…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> 保存
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {savedFlash && (
        <p className="text-xs text-emerald-600">✓ 保存しました</p>
      )}
      {error && (
        <p className="flex items-center gap-1 text-xs text-coral">
          <AlertTriangle className="h-3 w-3" /> {error}
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
