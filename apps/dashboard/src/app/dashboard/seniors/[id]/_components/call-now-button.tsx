"use client";

import { Phone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CallNowButton({
  seniorId,
  disabled,
  disabledReason,
}: {
  seniorId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [calling, setCalling] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callNow = async () => {
    setCalling(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senior_id: seniorId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "通話の発信に失敗しました。");
      else setSuccess(true);
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="md"
        onClick={callNow}
        disabled={disabled || calling}
      >
        <Phone className="h-4 w-4" />
        {calling ? "発信中..." : "今すぐ電話"}
      </Button>
      {disabled && disabledReason && (
        <span className="text-[10px] text-warm-gray">{disabledReason}</span>
      )}
      {success && (
        <span className="text-[10px] text-emerald-600">✓ 発信しました</span>
      )}
      {error && <span className="text-[10px] text-coral">{error}</span>}
    </div>
  );
}
