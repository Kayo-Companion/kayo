"use client";

import { ArrowRight, ArrowLeft, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { createClient } from "@/lib/supabase/client";
import { normalizePhoneE164 } from "@/lib/phone";

type Stage =
  | { kind: "phone" }
  | { kind: "code"; phone: string }
  | { kind: "verifying"; phone: string }
  | { kind: "sending" }
  | { kind: "error"; phone?: string; message: string };

export default function SignInPage() {
  const supabase = createClient();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>({ kind: "phone" });
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");

  const normalized = normalizePhoneE164(phoneInput);
  const isValidPhone = normalized !== null;

  const sendCode = async (phoneOverride?: string) => {
    const target = phoneOverride ?? normalized;
    if (!target) return;
    setStage({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      phone: target,
      // No new accounts via /sign-in — accounts are created at signup via the
      // Stripe webhook with phone_confirm=true.
      options: { shouldCreateUser: false },
    });
    if (error) {
      console.error("signInWithOtp(phone) failed:", error);
      const raw = error.message ?? "";
      let message: string;
      if (/signups? not allowed|not found|user/i.test(raw)) {
        message =
          "この電話番号で登録されたアカウントが見つかりません。日本以外の番号は国番号（+1 など）を必ず付けてください。新規の方は下の「新規登録」からお進みください。";
      } else if (/invalid from|caller id|21212/i.test(raw)) {
        message =
          "SMSの送信設定に問題があります（Supabase Phoneプロバイダの設定をご確認ください）。";
      } else {
        message = "コードの送信に失敗しました。電話番号をご確認ください。";
      }
      setStage({ kind: "error", phone: target, message });
      return;
    }
    setStage({ kind: "code", phone: target });
  };

  const verifyCode = async () => {
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) return;
    if (stage.kind !== "code") return;
    setStage({ kind: "verifying", phone: stage.phone });

    const { error } = await supabase.auth.verifyOtp({
      phone: stage.phone,
      token: trimmedCode,
      type: "sms",
    });

    if (error) {
      console.error("verifyOtp(phone) failed:", error);
      const message =
        error.message?.includes("expired") || error.message?.includes("invalid")
          ? "コードが間違っているか、期限切れです。もう一度コードを送信してください。"
          : `ログインに失敗しました：${error.message ?? "不明なエラー"}`;
      setStage({ kind: "error", phone: stage.phone, message });
      return;
    }
    router.push("/dashboard");
  };

  const onPhoneStep =
    stage.kind === "phone" ||
    stage.kind === "sending" ||
    (stage.kind === "error" && !stage.phone);

  return (
    <main className="min-h-screen bg-cream py-20">
      <div className="mx-auto max-w-md px-4">
        <header className="mb-10 text-center">
          <Link
            href="/"
            className="font-serif text-2xl font-medium tracking-tight text-warm-brown hover:text-coral"
          >
            カヨ
          </Link>
        </header>

        {onPhoneStep ? (
          <PhoneStep
            phone={phoneInput}
            setPhone={setPhoneInput}
            onSubmit={() => sendCode()}
            disabled={!isValidPhone || stage.kind === "sending"}
            sending={stage.kind === "sending"}
            error={stage.kind === "error" ? stage.message : null}
          />
        ) : (
          <CodeStep
            phone={
              stage.kind === "code" || stage.kind === "verifying" || stage.kind === "error"
                ? stage.phone ?? phoneInput
                : phoneInput
            }
            code={code}
            setCode={setCode}
            onVerify={verifyCode}
            onResend={() => {
              setCode("");
              const target =
                stage.kind === "code" || stage.kind === "verifying" || stage.kind === "error"
                  ? stage.phone
                  : undefined;
              sendCode(target);
            }}
            verifying={stage.kind === "verifying"}
            error={stage.kind === "error" ? stage.message : null}
          />
        )}

        <p className="mt-8 text-center text-xs text-warm-gray">
          アカウントをお持ちでない方は{" "}
          <Link href="/sign-up" className="font-medium text-coral hover:underline">
            こちらから新規登録
          </Link>
        </p>
      </div>
    </main>
  );
}

function PhoneStep({
  phone,
  setPhone,
  onSubmit,
  disabled,
  sending,
  error,
}: {
  phone: string;
  setPhone: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  sending: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-warm-brown sm:text-3xl">
          ログイン
        </h1>
        <p className="mt-2 text-sm text-warm-brown/70">
          ご登録の携帯電話番号を入力すると、SMSで6桁のコードをお送りします。
        </p>
      </div>

      <GlassCard className="space-y-4 p-6">
        <label className="block">
          <span className="mb-1.5 inline-block text-sm font-medium text-warm-brown">
            携帯電話番号
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例：090-1234-5678 / +1 206-910-6988"
            className="w-full rounded-xl border border-rose-300/50 bg-white/90 px-4 py-3 text-warm-brown placeholder:text-warm-gray/60 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20"
            autoComplete="tel"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !disabled) onSubmit();
            }}
          />
          <p className="mt-1.5 text-xs text-warm-gray">
            日本以外の番号は国番号（+1, +44 など）を必ず付けてください。
          </p>
        </label>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onSubmit}
          disabled={disabled}
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              送信中…
            </>
          ) : (
            <>
              コードを送信
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {error && <p className="text-sm text-coral">{error}</p>}
      </GlassCard>
    </div>
  );
}

function CodeStep({
  phone,
  code,
  setCode,
  onVerify,
  onResend,
  verifying,
  error,
}: {
  phone: string;
  code: string;
  setCode: (v: string) => void;
  onVerify: () => void;
  onResend: () => void;
  verifying: boolean;
  error: string | null;
}) {
  const valid = /^\d{6}$/.test(code.trim());
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-warm-brown sm:text-3xl">
          コードを入力
        </h1>
        <p className="mt-2 text-sm text-warm-brown/70">
          <MessageSquare className="mr-1 inline h-4 w-4 text-coral" />
          {phone} にSMSで6桁のコードをお送りしました。
        </p>
      </div>

      <GlassCard className="space-y-4 p-6">
        <label className="block">
          <span className="mb-1.5 inline-block text-sm font-medium text-warm-brown">
            6桁のコード
          </span>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) onVerify();
            }}
          />
        </label>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onVerify}
          disabled={!valid || verifying}
        >
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              確認中…
            </>
          ) : (
            <>
              ログイン
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        {error && <p className="text-sm text-coral">{error}</p>}

        <button
          onClick={onResend}
          className="flex w-full items-center justify-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          コードを再送する
        </button>
      </GlassCard>
    </div>
  );
}
