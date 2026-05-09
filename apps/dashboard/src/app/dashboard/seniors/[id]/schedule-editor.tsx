"use client";

import { Plus, X, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
interface ScheduleEntry {
  weekday: Weekday;
  time: string;
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

export function ScheduleEditor({
  seniorId,
  initialSchedule,
}: {
  seniorId: string;
  initialSchedule: { weekday: string; time: string }[];
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(
    (initialSchedule as ScheduleEntry[]).map((s) => ({
      weekday: s.weekday as Weekday,
      time: s.time,
    }))
  );
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const updateRow = (i: number, patch: Partial<ScheduleEntry>) => {
    setSchedule(schedule.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setStatus({ kind: "idle" });
  };
  const removeRow = (i: number) => {
    setSchedule(schedule.filter((_, idx) => idx !== i));
    setStatus({ kind: "idle" });
  };
  const addRow = () => {
    setSchedule([...schedule, { weekday: "mon", time: "09:00" }]);
    setStatus({ kind: "idle" });
  };

  const save = async () => {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/seniors/${seniorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? "保存に失敗しました。" });
        return;
      }
      setStatus({ kind: "saved" });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "通信エラーが発生しました。" });
    }
  };

  return (
    <GlassCard className="space-y-5 p-6 md:p-8">
      <div>
        <h2 className="font-serif text-xl font-medium text-warm-brown">
          お電話のスケジュール
        </h2>
        <p className="mt-1 text-sm text-warm-brown/70">
          曜日と時刻を設定すると、その時間に自動でカヨからお電話します。
        </p>
      </div>

      <div className="space-y-3">
        {schedule.length === 0 && (
          <p className="rounded-2xl border border-dashed border-rose-300/60 bg-white/40 p-4 text-sm text-warm-gray">
            スケジュールが未設定です。下の「時間を追加」から登録できます。
          </p>
        )}
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

      <div className="flex flex-col items-center gap-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={save}
          disabled={status.kind === "saving"}
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
          <p className="text-xs text-emerald-600">✓ 保存しました。</p>
        )}
        {status.kind === "error" && (
          <p className="text-xs text-coral">{status.message}</p>
        )}
      </div>
    </GlassCard>
  );
}
