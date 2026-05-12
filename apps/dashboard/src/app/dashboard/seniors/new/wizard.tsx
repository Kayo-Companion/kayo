"use client";

import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Gift,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { ChooseAudienceStep } from "@/app/sign-up/_components/choose-audience-step";
import type { Audience } from "@/app/sign-up/_components/sign-up-form-step";
import type { Weekday, ScheduleEntry } from "@/app/sign-up/page";

/**
 * "Add another senior" wizard, opened from the dashboard. Same step UX as
 * the signup wizard, but skips SMS verify (the buyer is already authed) and
 * skips Stripe (the new senior shares the family's existing minute pool).
 */

type Step = "audience" | "form";
type SubStep = "name" | "phone" | "schedule" | "agent-name" | "context";

export function AddSeniorWizard({ buyerName }: { buyerName: string }) {
  const [step, setStep] = useState<Step>("audience");
  const [audience, setAudience] = useState<Audience | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ戻る
        </a>
      </header>

      {step === "audience" && (
        <ChooseAudienceStep
          onChoose={(value) => {
            setAudience(value);
            setStep("form");
          }}
        />
      )}

      {step === "form" && audience && (
        <SeniorForm
          audience={audience}
          buyerName={buyerName}
          onBack={() => setStep("audience")}
        />
      )}
    </div>
  );
}

function SeniorForm({
  audience,
  buyerName,
  onBack,
}: {
  audience: Audience;
  buyerName: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const isFamily = audience === "family";
  const order: SubStep[] = isFamily
    ? ["name", "phone", "schedule", "context", "agent-name"]
    : ["name", "phone", "schedule", "agent-name"];

  const [subStep, setSubStep] = useState<SubStep>("name");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([
    { weekday: "mon", time: "09:00" },
  ]);
  const [introducerName, setIntroducerName] = useState(buyerName);
  const [introducerRelationship, setIntroducerRelationship] = useState("お子様");
  const [agentName, setAgentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexOf = order.indexOf(subStep);
  const isLast = (s: SubStep) => order.indexOf(s) === order.length - 1;

  const goBack = () => {
    if (indexOf === 0) onBack();
    else setSubStep(order[indexOf - 1]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/seniors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          recipientName: name.trim(),
          recipientPhone: phone.trim(),
          schedule,
          introducerName: isFamily ? introducerName.trim() : undefined,
          introducerRelationship: isFamily ? introducerRelationship : undefined,
          agentName: agentName.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "登録に失敗しました。");
        setSubmitting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました。");
      setSubmitting(false);
    }
  };

  const proceedFrom = (current: SubStep) => {
    if (isLast(current)) {
      handleSubmit();
    } else {
      setSubStep(order[order.indexOf(current) + 1]);
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
            isFamily ? "bg-coral/15 text-coral" : "bg-rose-300/30 text-rose-500"
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
          value={name}
          onChange={setName}
          onNext={() => proceedFrom("name")}
        />
      )}
      {subStep === "phone" && (
        <PhoneStep
          audience={audience}
          name={name}
          value={phone}
          onChange={setPhone}
          onNext={() => proceedFrom("phone")}
          isLast={isLast("phone")}
          submitting={submitting}
        />
      )}
      {subStep === "schedule" && (
        <ScheduleStep
          name={name}
          schedule={schedule}
          onChange={setSchedule}
          onNext={() => proceedFrom("schedule")}
        />
      )}

      {subStep === "agent-name" && (
        <AgentNameStep
          recipientName={name}
          value={agentName}
          onChange={setAgentName}
          onNext={() => proceedFrom("agent-name")}
          submitting={submitting}
        />
      )}
      {subStep === "context" && isFamily && (
        <ContextStep
          recipientName={name}
          introducerName={introducerName}
          setIntroducerName={setIntroducerName}
          introducerRelationship={introducerRelationship}
          setIntroducerRelationship={setIntroducerRelationship}
          onSubmit={() => proceedFrom("context")}
          submitting={submitting}
        />
      )}

      {error && <p className="text-center text-sm text-coral">{error}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-step components — simplified copies of the signup wizard's steps. Kept
// inline so the dashboard flow can evolve independently of the signup copy.
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
  const placeholder = audience === "self" ? "例：花子" : "例：美智子";
  const noAutofill = useNoAutofill();
  const canProceed = value.trim().length > 0;
  return (
    <StepShell heading={heading} sub="カヨが毎日のお電話でお呼びする名前です。">
      <input
        ref={noAutofill.ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} text-lg`}
        autoComplete="off"
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
  isLast,
  submitting,
}: {
  audience: Audience;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  isLast: boolean;
  submitting: boolean;
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
          ref={noAutofill.ref}
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例：090-1234-5678 / +1 385-324-2215"
          className={`${inputClass} text-lg`}
          autoComplete="off"
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
      <NextButton
        onClick={onNext}
        disabled={!canProceed || submitting}
        label={isLast ? "登録する" : "次へ"}
        loading={submitting}
      />
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
              step={300}
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
      <NextButton onClick={onNext} label="次へ" />
    </StepShell>
  );
}

function AgentNameStep({
  recipientName,
  value,
  onChange,
  onNext,
  submitting,
}: {
  recipientName: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  submitting: boolean;
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
          未入力でもOK。「カヨ」になります。あとから変更できます。
        </p>
      </Field>
      <div className="rounded-2xl border border-rose-300/40 bg-white/60 p-4 text-xs text-warm-brown/80">
        通話の冒頭で「もしもし、お話相手の<span className="font-semibold text-warm-brown">{effective}</span>です」とご挨拶します。
      </div>
      <NextButton
        onClick={onNext}
        label="登録する"
        loading={submitting}
        disabled={submitting}
      />
    </StepShell>
  );
}

function ContextStep({
  recipientName,
  introducerName,
  setIntroducerName,
  introducerRelationship,
  setIntroducerRelationship,
  onSubmit,
  submitting,
}: {
  recipientName: string;
  introducerName: string;
  setIntroducerName: (v: string) => void;
  introducerRelationship: string;
  setIntroducerRelationship: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const canProceed = introducerName.trim().length > 0;
  return (
    <StepShell
      heading="あなたのお名前と、続柄を教えてください"
      sub={`カヨは通話の冒頭で「${recipientName || "親御さん"}様への、${
        introducerName || "あなた"
      }さんからのご紹介」とお伝えします。`}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="あなたのお名前" required>
          <input
            type="text"
            value={introducerName}
            onChange={(e) => setIntroducerName(e.target.value)}
            placeholder="例：田中 健太"
            className={inputClass}
            autoComplete="off"
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
      <NextButton
        onClick={onSubmit}
        disabled={!canProceed || submitting}
        label="次へ"
        loading={submitting}
      />
    </StepShell>
  );
}

// -----------------------------------------------------------------------------
// Shared shell + UI primitives (slim copies of the signup wizard's helpers).
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

function SubStepProgress({ current, total }: { current: number; total: number }) {
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
  loading,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  loading?: boolean;
}) {
  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          登録中…
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
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

// Same anti-Chrome-autofill trick as the signup wizard.
function useNoAutofill() {
  const ref = useRef<HTMLInputElement>(null);
  const [readOnly, setReadOnly] = useState(true);
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
