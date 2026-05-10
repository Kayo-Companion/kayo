"use client";

import { Loader2, Save, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

const DEFAULT_AGENT_NAME = "カヨ";

/**
 * Lets the buyer change the AI agent's name (the persona name Kayo uses
 * during calls). Empty input falls back to "カヨ" — both at save and at
 * runtime in the voice service.
 */
export function AgentNameEditor({
  seniorId,
  initialAgentName,
}: {
  seniorId: string;
  initialAgentName: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialAgentName ?? "");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const trimmed = value.trim();
  const dirty = trimmed !== (initialAgentName ?? "").trim();
  const effective = trimmed || DEFAULT_AGENT_NAME;

  const save = async () => {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/seniors/${seniorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_name: trimmed || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        let message = "保存に失敗しました。";
        if (body.error === "agent_name_too_long")
          message = "20文字以内でご入力ください。";
        setStatus({ kind: "error", message });
        return;
      }
      setStatus({ kind: "saved" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  return (
    <GlassCard className="space-y-4 p-6 md:p-8">
      <div>
        <h2 className="font-serif text-xl font-medium text-warm-brown">
          AIの名前
        </h2>
        <p className="mt-1 text-sm text-warm-brown/70">
          通話で使われる、AIお話相手の名前です。
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 inline-block text-sm font-medium text-warm-brown">
          名前
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus({ kind: "idle" });
          }}
          placeholder={DEFAULT_AGENT_NAME}
          maxLength={20}
          className="w-full rounded-xl border border-rose-300/50 bg-white/90 px-4 py-3 text-warm-brown placeholder:text-warm-gray/60 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/20"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-1.5 text-xs text-warm-gray">
          未入力の場合は「{DEFAULT_AGENT_NAME}」になります。
          {trimmed && trimmed !== DEFAULT_AGENT_NAME && (
            <>　→ 通話で「{effective}」と呼ばれます</>
          )}
        </p>
      </label>

      <div className="flex flex-col items-center gap-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={save}
          disabled={!dirty || status.kind === "saving"}
        >
          {status.kind === "saving" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> 保存中…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> 保存
            </>
          )}
        </Button>
        {status.kind === "saved" && (
          <p className="text-xs text-emerald-600">✓ 保存しました</p>
        )}
        {status.kind === "error" && (
          <p className="flex items-center gap-1 text-xs text-coral">
            <AlertTriangle className="h-3 w-3" />
            {status.message}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
