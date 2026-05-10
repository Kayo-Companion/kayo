"use client";

import { ArrowLeft, ArrowRight, Heart, Gift, Plus, X, Loader2, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import type { Plan, ScheduleEntry, SignUpData, Weekday } from "../page";

/**
 * Hook for fighting Chrome's autofill that ignores autocomplete="off" on tel
 * inputs. Render the input readOnly initially; lift readOnly on first focus
 * (or after a short tick). Chrome's autofill heuristic skips readonly inputs.
 *
 * Returns a ref + onFocus handler to spread on the input.
 */
function useNoAutofill() {
  const ref = useRef<HTMLInputElement>(null);
  // Skip the readonly trick on touch devices — there, focusing a readonly
  // input suppresses the on-screen keyboard, and when readonly lifts the
  // input is already focused so no new focus event fires to summon it.
  // The Chrome autofill heuristic this guards against is a desktop problem.
  const [readOnly, setReadOnly] = useState(() => {
    if (typeof window === "undefined") return true;
    const isTouch =
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ??
      false;
    return !isTouch;
  });
  useEffect(() => {
    const t = setTimeout(() => setReadOnly(false), 250);
    return () => clearTimeout(t);
  }, []);
  return {
    ref,
    readOnly,
    onFocus: () => setReadOnly(false),
    onClick: () => setReadOnly(false),
  };
}

export type Audience = "self" | "family";

type SubStep =
  | "name"
  | "phone"
  | "verify"
  | "schedule"
  | "agent-name"
  | "context"
  | "buyer-phone"
  | "buyer-verify";

interface Props {
  audience: Audience;
  plan: Plan;
  initialData?: SignUpData | null;
  onBack: () => void;
  onSubmit: (data: SignUpData) => void;
}

export function SignUpFormStep({
  audience,
  plan,
  initialData,
  onBack,
  onSubmit,
}: Props) {
  const isFamily = audience === "family";
  // Self path: recipient phone === buyer phone, so we verify it inline after
  // the phone step. Schedule is the last step and submits directly.
  // Family path: ask the buyer for their own phone at the end and verify it
  // there. The verify step is the last step and submits on success.
  const order: SubStep[] = isFamily
    ? ["name", "phone", "schedule", "agent-name", "context", "buyer-phone", "buyer-verify"]
    : ["name", "phone", "verify", "schedule", "agent-name"];

  const [subStep, setSubStep] = useState<SubStep>("name");
  const [recipientName, setRecipientName] = useState(
    initialData?.recipientName ?? ""
  );
  const [recipientPhone, setRecipientPhone] = useState(
    initialData?.recipientPhone ?? ""
  );
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(
    initialData?.schedule && initialData.schedule.length > 0
      ? initialData.schedule
      : [{ weekday: "mon", time: "09:00" }]
  );
  const [introducerName, setIntroducerName] = useState(
    initialData?.introducerName ?? ""
  );
  const [introducerRelationship, setIntroducerRelationship] = useState(
    initialData?.introducerRelationship ?? "お子様"
  );
  const [buyerPhone, setBuyerPhone] = useState(initialData?.buyerPhone ?? "");
  const [buyerPhoneVerified, setBuyerPhoneVerified] = useState(
    initialData?.buyerPhoneVerified ?? false
  );
  const [agentName, setAgentName] = useState(initialData?.agentName ?? "");

  // Self path: buyer phone always tracks recipient phone. Reset verification
  // if the user edits the recipient phone after verifying.
  useEffect(() => {
    if (!isFamily) {
      setBuyerPhone(recipientPhone);
      // If they go back and change the recipient phone, drop the verified
      // flag — they need to verify again.
      setBuyerPhoneVerified((wasVerified) =>
        wasVerified && (initialData?.recipientPhone ?? "") === recipientPhone
          ? wasVerified
          : false
      );
    }
  }, [isFamily, recipientPhone, initialData?.recipientPhone]);

  const indexOf = order.indexOf(subStep);
  const goBack = () => {
    if (indexOf === 0) onBack();
    else setSubStep(order[indexOf - 1]);
  };

  // Submit; takes an optional verifiedOverride so callers (the verify-step
  // handlers) can pass `true` directly without waiting for React to commit
  // the setBuyerPhoneVerified(true) state update — important when the verify
  // step is the LAST step and submits in the same event tick.
  const handleFinalSubmit = (verifiedOverride?: boolean) => {
    const finalBuyerPhone = isFamily ? buyerPhone.trim() : recipientPhone.trim();
    onSubmit({
      audience,
      plan,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      schedule,
      introducerName: isFamily ? introducerName.trim() : undefined,
      introducerRelationship: isFamily ? introducerRelationship : undefined,
      buyerPhone: finalBuyerPhone,
      buyerPhoneVerified: verifiedOverride ?? buyerPhoneVerified,
      agentName: agentName.trim() || undefined,
    });
  };

  // Advance to the next sub-step, or submit if we're already on the last one.
  const proceedFrom = (current: SubStep, verifiedOverride?: boolean) => {
    const idx = order.indexOf(current);
    if (idx === order.length - 1) {
      handleFinalSubmit(verifiedOverride);
    } else {
      setSubStep(order[idx + 1]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            isFamily
              ? "bg-coral/15 text-coral"
              : "bg-rose-300/30 text-rose-500"
          }`}
        >
          {isFamily ? (
            <>
              <Gift className="h-3 w-3" /> 大切な人へ
            </>
          ) : (
            <>
              <Heart className="h-3 w-3" /> 自分のため
            </>
          )}
        </span>
      </div>

      <SubStepProgress current={indexOf} total={order.length} />

      {subStep === "name" && (
        <NameStep
          audience={audience}
          value={recipientName}
          onChange={setRecipientName}
          onNext={() => proceedFrom("name")}
        />
      )}

      {subStep === "phone" && (
        <PhoneStep
          audience={audience}
          name={recipientName}
          value={recipientPhone}
          onChange={setRecipientPhone}
          onNext={() => proceedFrom("phone")}
        />
      )}

      {subStep === "verify" && (
        <VerifyPhoneStep
          phone={recipientPhone}
          headline={`${recipientPhone || "ご登録の番号"} にSMSで6桁のコードをお送りしました。`}
          onVerified={() => {
            setBuyerPhoneVerified(true);
            proceedFrom("verify", true);
          }}
        />
      )}

      {subStep === "schedule" && (
        <ScheduleStep
          name={recipientName}
          schedule={schedule}
          onChange={setSchedule}
          onNext={() => proceedFrom("schedule")}
        />
      )}

      {subStep === "agent-name" && (
        <AgentNameStep
          recipientName={recipientName}
          value={agentName}
          onChange={setAgentName}
          onNext={() => proceedFrom("agent-name")}
          isLast={!isFamily}
        />
      )}

      {subStep === "context" && isFamily && (
        <ContextStep
          recipientName={recipientName}
          introducerName={introducerName}
          setIntroducerName={setIntroducerName}
          introducerRelationship={introducerRelationship}
          setIntroducerRelationship={setIntroducerRelationship}
          onNext={() => proceedFrom("context")}
        />
      )}

      {subStep === "buyer-phone" && (
        <BuyerPhoneStep
          value={buyerPhone}
          onChange={(v) => {
            setBuyerPhone(v);
            // Editing the phone resets the verification.
            setBuyerPhoneVerified(false);
          }}
          onNext={() => proceedFrom("buyer-phone")}
        />
      )}

      {subStep === "buyer-verify" && (
        <VerifyPhoneStep
          phone={buyerPhone}
          headline={`${buyerPhone || "ご登録の番号"} にSMSで6桁のコードをお送りしました。`}
          isLast
          onVerified={() => {
            setBuyerPhoneVerified(true);
            proceedFrom("buyer-verify", true);
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-step components
// -----------------------------------------------------------------------------

function NameStep({
  audience,
  value,
  onChange,
  onNext,
}: {
  audience: Audience;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const heading =
    audience === "self"
      ? "なんてお呼びすれば良いですか？"
      : "あの方を、なんてお呼びすれば良いですか？";
  const sub =
    audience === "self"
      ? "カヨが毎日のお電話でお呼びする名前です。下のお名前やニックネームでも大丈夫です。"
      : "カヨが毎日のお電話でお呼びする、お相手の名前です。下のお名前やニックネームで大丈夫です。";
  const placeholder = audience === "self" ? "例：花子" : "例：美智子";
  const canProceed = value.trim().length > 0;
  const noAutofill = useNoAutofill();

  return (
    <StepShell heading={heading} sub={sub}>
      <input
        key="name-input"
        ref={noAutofill.ref}
        name="kayo-recipient-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} text-lg`}
        autoComplete="off"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore=""
        spellCheck={false}
        readOnly={noAutofill.readOnly}
        onFocus={noAutofill.onFocus}
        onClick={noAutofill.onClick}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && canProceed) {
            e.preventDefault();
            onNext();
          }
        }}
      />
      <NextButton onClick={onNext} disabled={!canProceed} />
    </StepShell>
  );
}

function PhoneStep({
  audience,
  name,
  value,
  onChange,
  onNext,
}: {
  audience: Audience;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const heading =
    audience === "self"
      ? `${name || "あなた"}さん、お電話の連絡先を教えてください`
      : `${name || "大切な方"}さんの電話番号を教えてください`;
  const canProceed = value.trim().length >= 10;
  const noAutofill = useNoAutofill();

  return (
    <StepShell heading={heading}>
      <Field label="電話番号" required>
        <input
          key="phone-input"
          ref={noAutofill.ref}
          name="kayo-recipient-phone"
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例：090-1234-5678 / +1 385-324-2215"
          className={`${inputClass} text-lg`}
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore=""
          spellCheck={false}
          readOnly={noAutofill.readOnly}
          onFocus={noAutofill.onFocus}
          onClick={noAutofill.onClick}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && canProceed) {
              e.preventDefault();
              onNext();
            }
          }}
        />
        <p className="mt-1.5 text-xs text-warm-gray">
          海外の番号は国番号（+1, +44 など）を付けてください。なしの場合は日本（+81）として扱います。
        </p>
      </Field>
      <NextButton onClick={onNext} disabled={!canProceed} />
    </StepShell>
  );
}

const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "mon", label: "月曜日" },
  { value: "tue", label: "火曜日" },
  { value: "wed", label: "水曜日" },
  { value: "thu", label: "木曜日" },
  { value: "fri", label: "金曜日" },
  { value: "sat", label: "土曜日" },
  { value: "sun", label: "日曜日" },
];

function ScheduleStep({
  name,
  schedule,
  onChange,
  onNext,
}: {
  name: string;
  schedule: ScheduleEntry[];
  onChange: (s: ScheduleEntry[]) => void;
  onNext: () => void;
}) {
  const updateRow = (i: number, patch: Partial<ScheduleEntry>) => {
    onChange(schedule.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };
  const removeRow = (i: number) => {
    onChange(schedule.filter((_, idx) => idx !== i));
  };
  const addRow = () => {
    onChange([...schedule, { weekday: "mon", time: "09:00" }]);
  };

  return (
    <StepShell
      heading={`${name || "あの方"}には、いつお電話しますか？`}
      sub="曜日と時刻を設定すると、その時間に自動でカヨからお電話します。あとから変更も追加もできます。"
    >
      <div className="space-y-3">
        {schedule.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-2xl border border-rose-300/40 bg-white/60 p-2"
          >
            <select
              value={row.weekday}
              onChange={(e) => updateRow(i, { weekday: e.target.value as Weekday })}
              className="w-full rounded-xl border border-rose-300/50 bg-white/90 px-3 py-2.5 text-warm-brown focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20"
            >
              {WEEKDAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={row.time}
              onChange={(e) => updateRow(i, { time: e.target.value })}
              className="rounded-xl border border-rose-300/50 bg-white/90 px-3 py-2.5 text-warm-brown focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="削除"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-warm-gray transition-colors hover:bg-rose-100 hover:text-coral"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-rose-300 bg-white/40 px-4 py-3 text-sm font-medium text-coral transition-colors hover:border-coral hover:bg-white/70"
        >
          <Plus className="h-4 w-4" /> 時間を追加
        </button>
      </div>

      {schedule.length > 0 ? (
        <p className="text-xs text-warm-gray">
          例：月曜 9:00、水曜 9:00、土曜 14:00 のように曜日ごとに別の時刻でも設定できます。
        </p>
      ) : (
        <p className="text-xs text-warm-gray">
          スケジュールを設定しなくても大丈夫です。
        </p>
      )}

      <div className="rounded-2xl border border-warm-orange/40 bg-warm-orange/5 p-4 text-xs leading-relaxed text-warm-brown/80">
        <span className="font-semibold text-warm-brown">📞 いつでもカヨに電話できます</span>
        <br />
        ご登録の電話番号からカヨ専用ダイヤルにおかけいただくと、好きな時にお話しいただけます。詳しい番号は登録後にお送りします。
      </div>

      <NextButton onClick={onNext} />
    </StepShell>
  );
}

function AgentNameStep({
  recipientName,
  value,
  onChange,
  onNext,
  isLast,
}: {
  recipientName: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  isLast?: boolean;
}) {
  const effective = value.trim() || "カヨ";
  return (
    <StepShell
      heading="AIに名前をつけますか？"
      sub={`通話で${recipientName || "あの方"}さんに呼ばれる、お話相手AIの名前です。デフォルトは「カヨ」です。`}
    >
      <Field label="AIの名前">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="カヨ"
          maxLength={20}
          className={`${inputClass} text-lg`}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onNext();
            }
          }}
        />
        <p className="mt-1.5 text-xs text-warm-gray">
          未入力でもOK。「カヨ」になります。お好きな名前に変更できます。
        </p>
      </Field>
      <div className="rounded-2xl border border-rose-300/40 bg-white/60 p-4 text-xs text-warm-brown/80">
        通話の冒頭で「もしもし、お話相手の<span className="font-semibold text-warm-brown">{effective}</span>です」とご挨拶します。
      </div>
      <NextButton onClick={onNext} label={isLast ? "確認画面へ" : "次へ"} />
    </StepShell>
  );
}

function ContextStep({
  recipientName,
  introducerName,
  setIntroducerName,
  introducerRelationship,
  setIntroducerRelationship,
  onNext,
}: {
  recipientName: string;
  introducerName: string;
  setIntroducerName: (v: string) => void;
  introducerRelationship: string;
  setIntroducerRelationship: (v: string) => void;
  onNext: () => void;
}) {
  const canProceed = introducerName.trim().length > 0;
  return (
    <StepShell
      heading="あなたのお名前と、続柄を教えてください"
      sub={`カヨは通話の冒頭で「${recipientName || "親御さん"}様への、${introducerName || "あなた"}さんからのご紹介」とお伝えします。`}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="あなたのお名前" required>
          <input
            key="introducer-input"
            name="kayo-introducer-name"
            type="text"
            value={introducerName}
            onChange={(e) => setIntroducerName(e.target.value)}
            placeholder="例：田中 健太"
            className={inputClass}
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore=""
            spellCheck={false}
            autoFocus
          />
        </Field>
        <Field label="相手から見た関係性" required>
          <select
            value={introducerRelationship}
            onChange={(e) => setIntroducerRelationship(e.target.value)}
            className={inputClass}
          >
            <option>お子様</option>
            <option>お孫さん</option>
            <option>お嫁さん</option>
            <option>お婿さん</option>
            <option>甥御さん</option>
            <option>姪御さん</option>
            <option>お友達</option>
            <option>パートナー</option>
          </select>
        </Field>
      </div>
      <p className="text-xs text-warm-gray">
        通話の冒頭で「{introducerRelationship}の{introducerName || "〇〇"}
        さんからのご紹介でお電話しました」と名乗ります。
      </p>
      <NextButton onClick={onNext} disabled={!canProceed} />
    </StepShell>
  );
}

function BuyerPhoneStep({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const canProceed = value.trim().length >= 10;
  const noAutofill = useNoAutofill();
  return (
    <StepShell
      heading="あなたの電話番号を教えてください"
      sub="ログインや、緊急時のご連絡に使います。SMSが受け取れる携帯電話番号をご入力ください。"
    >
      <Field label="あなたの携帯電話番号" required>
        <input
          key="buyer-phone-input"
          ref={noAutofill.ref}
          name="kayo-buyer-phone"
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例：090-1234-5678"
          className={`${inputClass} text-lg`}
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore=""
          spellCheck={false}
          readOnly={noAutofill.readOnly}
          onFocus={noAutofill.onFocus}
          onClick={noAutofill.onClick}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && canProceed) {
              e.preventDefault();
              onNext();
            }
          }}
        />
        <p className="mt-1.5 text-xs text-warm-gray">
          次の画面でSMSに6桁のコードをお送りします。
        </p>
      </Field>
      <NextButton onClick={onNext} disabled={!canProceed} />
    </StepShell>
  );
}

function VerifyPhoneStep({
  phone,
  headline,
  onVerified,
  isLast,
}: {
  phone: string;
  headline: string;
  onVerified: () => void;
  isLast?: boolean;
}) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    | { kind: "sending" }
    | { kind: "ready" }
    | { kind: "verifying" }
    | { kind: "error"; message: string }
  >({ kind: "sending" });

  const sendCode = async () => {
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/auth/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: body.message ?? "SMSの送信に失敗しました。電話番号をご確認ください。",
        });
        return;
      }
      setStatus({ kind: "ready" });
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  // Send on mount.
  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) return;
    setStatus({ kind: "verifying" });
    try {
      const res = await fetch("/api/auth/verify-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: code.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { approved?: boolean };
      if (!res.ok || !body.approved) {
        setStatus({
          kind: "error",
          message: "コードが正しくありません。もう一度ご確認ください。",
        });
        return;
      }
      onVerified();
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  const valid = /^\d{6}$/.test(code.trim());

  return (
    <StepShell
      heading="SMSのコードを入力してください"
      sub={headline}
    >
      <Field label="6桁のコード" required>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="w-full rounded-xl border border-rose-300/50 bg-white/90 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-warm-brown placeholder:text-warm-gray/40 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20"
          autoComplete="one-time-code"
          autoFocus
          disabled={status.kind === "sending" || status.kind === "verifying"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) verifyCode();
          }}
        />
      </Field>

      {status.kind === "sending" && (
        <p className="flex items-center gap-1.5 text-xs text-warm-gray">
          <Loader2 className="h-3 w-3 animate-spin" />
          SMSを送信中…
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-sm text-coral">{status.message}</p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={verifyCode}
        disabled={!valid || status.kind === "sending" || status.kind === "verifying"}
      >
        {status.kind === "verifying" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            確認中…
          </>
        ) : (
          <>
            {isLast ? "確認画面へ" : "次へ"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <button
        type="button"
        onClick={sendCode}
        disabled={status.kind === "sending" || status.kind === "verifying"}
        className="flex w-full items-center justify-center gap-1.5 text-xs text-warm-gray hover:text-coral disabled:opacity-50"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        コードを再送する
      </button>
    </StepShell>
  );
}

// -----------------------------------------------------------------------------
// Shared shell + UI primitives
// -----------------------------------------------------------------------------

function StepShell({
  heading,
  sub,
  children,
}: {
  heading: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-medium leading-tight tracking-tight text-warm-brown sm:text-3xl">
          {heading}
        </h1>
        {sub && <p className="mt-2 text-sm leading-relaxed text-warm-brown/70">{sub}</p>}
      </div>
      {/* Wrap each step in its own form with autoComplete=off so Chrome
          doesn't carry the previous step's typed value into the next input
          when it autofocuses. */}
      <form
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
        className="contents"
      >
        <GlassCard className="space-y-5 p-6 md:p-8">{children}</GlassCard>
      </form>
    </div>
  );
}

function SubStepProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-warm-gray">
        ステップ {current + 1} / {total}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-rose-200/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-coral to-warm-orange transition-all duration-300"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function NextButton({
  onClick,
  disabled,
  label = "次へ",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

const inputClass =
  "w-full rounded-xl border border-rose-300/50 bg-white/90 px-4 py-3 text-warm-brown placeholder:text-warm-gray/60 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20 transition-colors";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-block text-sm font-medium text-warm-brown">
        {label}
        {required && <span className="ml-1 text-coral">*</span>}
      </span>
      {children}
    </label>
  );
}
