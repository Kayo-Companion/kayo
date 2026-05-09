"use client";

import { ArrowLeft, ArrowRight, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { createClient } from "@/lib/supabase/client";

/**
 * Post-payment login. The Stripe webhook has just created the user with
 * phone_confirm=true. We send one fresh SMS via Supabase's Phone provider
 * (configured to use Twilio Verify) and have the user type the code to drop
 * the auth cookie.
 *
 * Reaches here from /sign-up/return?session_id=... → 302 with ?phone=+81xxx.
 */
function VerifyFinalInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const phone = params.get("phone") ?? "";

  const [code, setCode] = useState("");
  const [stage, setStage] = useState<
    | { kind: "sending" }
    | { kind: "ready" }
    | { kind: "verifying" }
    | { kind: "error"; message: string }
  >({ kind: "sending" });

  const sendCode = async () => {
    if (!phone) {
      setStage({ kind: "error", message: "電話番号が見つかりません。" });
      return;
    }
    setStage({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      console.error("signInWithOtp(phone) failed:", error);
      setStage({
        kind: "error",
        message: "SMSの送信に失敗しました。しばらく経ってから再度お試しください。",
      });
      return;
    }
    setStage({ kind: "ready" });
  };

  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyCode = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) return;
    setStage({ kind: "verifying" });
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: trimmed,
      type: "sms",
    });
    if (error) {
      console.error("verifyOtp(phone) failed:", error);
      setStage({
        kind: "error",
        message:
          error.message?.includes("expired") || error.message?.includes("invalid")
            ? "コードが間違っているか、期限切れです。再送して、もう一度お試しください。"
            : `ログインに失敗しました：${error.message ?? "不明なエラー"}`,
      });
      return;
    }
    router.push("/dashboard");
  };

  const valid = /^\d{6}$/.test(code.trim());

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

        <div className="space-y-5">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-warm-brown sm:text-3xl">
              最後のひとつ：ログインのご確認
            </h1>
            <p className="mt-2 text-sm text-warm-brown/70">
              <MessageSquare className="mr-1 inline h-4 w-4 text-coral" />
              {phone || "ご登録の番号"} にSMSで6桁のコードをお送りしました。
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
                disabled={stage.kind === "sending" || stage.kind === "verifying"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && valid) verifyCode();
                }}
              />
            </label>

            {stage.kind === "sending" && (
              <p className="flex items-center gap-1.5 text-xs text-warm-gray">
                <Loader2 className="h-3 w-3 animate-spin" />
                SMSを送信中…
              </p>
            )}
            {stage.kind === "error" && (
              <p className="text-sm text-coral">{stage.message}</p>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={verifyCode}
              disabled={!valid || stage.kind === "sending" || stage.kind === "verifying"}
            >
              {stage.kind === "verifying" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  確認中…
                </>
              ) : (
                <>
                  ダッシュボードへ
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setCode("");
                sendCode();
              }}
              disabled={stage.kind === "sending" || stage.kind === "verifying"}
              className="flex w-full items-center justify-center gap-1 text-sm text-warm-gray hover:text-coral disabled:opacity-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              コードを再送する
            </button>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}

export default function VerifyFinalPage() {
  return (
    <Suspense>
      <VerifyFinalInner />
    </Suspense>
  );
}
