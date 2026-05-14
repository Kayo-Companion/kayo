"use client";

import { useEffect, useState } from "react";
import { X, ShieldCheck, Check } from "lucide-react";
import { ContactCardShare } from "./contact-card-share";

const STORAGE_KEY = "kayo:safety-reminder:acknowledged";

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

interface Senior {
  id: string;
  name: string;
  schedule: { weekday: string; time: string }[];
}

interface Props {
  seniors: Senior[];
  kayoPhone: string;
}

function summarizeSchedule(senior: Senior): string {
  if (!senior.schedule || senior.schedule.length === 0) return "未設定";
  const byTime = new Map<string, string[]>();
  senior.schedule.forEach((s) => {
    const days = byTime.get(s.time) ?? [];
    days.push(WEEKDAY_LABELS[s.weekday] ?? s.weekday);
    byTime.set(s.time, days);
  });
  return Array.from(byTime.entries())
    .map(([time, days]) => `${days.join("・")} ${time}`)
    .join("、");
}

const ITEMS = [
  {
    key: "number" as const,
    label: "「この番号・この時間に電話が来る」と親に伝えた",
  },
  {
    key: "contact" as const,
    label: "連絡先に「カヨ」として登録するよう親に伝えた",
  },
  {
    key: "scam" as const,
    label:
      "「お金・カード・住所を聞かれたら詐欺。すぐ切って」と親に伝えた",
  },
];

export function SafetyReminderModal({ seniors, kayoPhone }: Props) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let acknowledged: string | null = null;
    try {
      acknowledged = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage blocked — show once per session by default
    }
    if (!acknowledged) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const allChecked = ITEMS.every((i) => checked[i.key]);

  const handleAcknowledge = () => {
    if (!allChecked) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-warm-brown/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-reminder-title"
    >
      <div className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-rose-200/70 bg-cream shadow-[0_30px_80px_-20px_rgba(232,93,93,0.35)]">
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-coral via-rose-400 to-warm-orange px-6 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-2xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
                はじめにご確認ください
              </div>
              <h2
                id="safety-reminder-title"
                className="mt-0.5 font-serif text-xl font-medium leading-snug"
              >
                安心して使うために
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          {/* Quick-reference card */}
          <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-rose-200/60">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-warm-gray">
              カヨの電話番号
            </div>
            <div className="mt-0.5 font-mono text-base font-semibold text-warm-brown">
              {kayoPhone || "未設定"}
            </div>
            {/* Inline share action — lets the buyer push the .vcf to their
                parent right here, then tick off the corresponding checkbox
                below. Same component as the home-dashboard card. */}
            {kayoPhone && (
              <div className="mt-3">
                <ContactCardShare />
              </div>
            )}
            {seniors.length > 0 && (
              <div className="mt-3 space-y-0.5 border-t border-rose-300/30 pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-warm-gray">
                  通話のお時間
                </div>
                {seniors.map((s) => (
                  <div key={s.id} className="text-sm text-warm-brown/85">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-warm-gray"> ／ </span>
                    <span>{summarizeSchedule(s)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div>
            <div className="mb-2 text-center text-[11px] font-medium text-coral">
              ↓ 一つずつタップしてチェックしてください ↓
            </div>
            <div className="space-y-2">
              {ITEMS.map((item) => {
                const on = !!checked[item.key];
                return (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() =>
                      setChecked((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 text-left shadow-sm transition-all active:scale-[0.98] ${
                      on
                        ? "border-coral bg-rose-50 shadow-coral/10"
                        : "border-dashed border-coral/60 bg-white hover:border-solid hover:border-coral hover:bg-rose-50/60 hover:shadow-md"
                    }`}
                    aria-pressed={on}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                        on
                          ? "bg-gradient-to-br from-coral to-warm-orange shadow-md shadow-coral/30"
                          : "border-2 border-coral/50 bg-white"
                      }`}
                    >
                      {on && (
                        <Check className="h-6 w-6 text-white" strokeWidth={3.5} />
                      )}
                    </div>
                    <span className="flex-1 text-sm leading-relaxed text-warm-brown">
                      {item.label}
                    </span>
                    {!on && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-coral/70">
                        タップ
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={!allChecked}
            className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition-all ${
              allChecked
                ? "bg-gradient-to-r from-coral to-warm-orange text-white shadow-lg shadow-coral/30 hover:scale-[1.01] active:scale-[0.99]"
                : "cursor-not-allowed bg-rose-200/50 text-warm-brown/40"
            }`}
          >
            {allChecked ? "確認しました" : "すべてチェックしてください"}
          </button>
        </div>

        {/* Hidden close (escape hatch — only shown if all checked, so they can't bypass) */}
        {allChecked && (
          <button
            type="button"
            onClick={handleAcknowledge}
            aria-label="閉じる"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
