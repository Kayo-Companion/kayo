"use client";

import { Check, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";

/** One observation row stored under `calls.observations`. */
export interface Observation {
  type:
    | "forgot_past_fact"
    | "repeated_story"
    | "temporal_confusion"
    | "word_finding"
    | "engagement_low"
    | "engagement_high"
    | "new_topic"
    | "positive_note";
  detail: string;
  severity: "low" | "medium" | "high";
  evidence?: string;
  positive?: boolean;
}

export interface ObservationEntry {
  observation: Observation;
  call_id: string;
  /** Position of the observation in the original calls.observations array.
   *  Combined with call_id this forms the dismiss key "<call_id>:<index>". */
  index: number;
  started_at: string; // ISO
}

interface Props {
  seniorId: string;
  seniorName: string;
  /** Already filtered: positives stripped, dismissed entries removed. */
  entries: ObservationEntry[];
  /** Number of calls scanned. Shown in the disclaimer. */
  callsScanned: number;
  tz: string;
}

/**
 * 気づき timeline — single combined "気にとめておきたい" list.
 *
 * Earlier versions split this into 🟢 安心 / 🟡 ちょっと / 🔴 注意 columns,
 * but the green bucket was just a re-statement of the summary, and the
 * yellow/red split was confusing for non-clinical readers. New design:
 *
 *   - One timeline, newest at top.
 *   - Each row is color-coded by severity (yellow vs red) but lives in
 *     the same list so it reads as "things to glance at this week".
 *   - Each row has a ✓ dismiss button. Dismissed entries are persisted
 *     on the senior row and never reappear.
 *   - Positive observations are not rendered here at all — they're
 *     useful context for the LLM but noisy for the family UI.
 *
 * Same non-clinical framing: observation, not diagnosis.
 */
export function InsightsBuckets({
  seniorId,
  seniorName,
  entries,
  callsScanned,
  tz,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [locallyDismissed, setLocallyDismissed] = useState<Set<string>>(
    new Set()
  );

  const visible = entries.filter(
    (e) => !locallyDismissed.has(keyFor(e))
  );

  const handleDismiss = (entry: ObservationEntry) => {
    const key = keyFor(entry);
    if (dismissing.has(key)) return;

    // Optimistically remove the row.
    setDismissing((prev) => new Set(prev).add(key));
    setLocallyDismissed((prev) => new Set(prev).add(key));

    fetch(`/api/seniors/${seniorId}/observations/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // Roll back the optimistic removal on failure.
          setLocallyDismissed((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        } else {
          // Refresh server-rendered list so subsequent navigations are
          // consistent without relying on the local set.
          startTransition(() => router.refresh());
        }
      })
      .catch(() => {
        setLocallyDismissed((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .finally(() => {
        setDismissing((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });
  };

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-3 p-5 md:p-6">
        <div>
          <h2 className="font-serif text-lg font-medium text-warm-brown">
            気にとめておきたいこと
            <span className="ml-2 text-sm font-normal text-warm-gray">
              ({visible.length})
            </span>
          </h2>
          <p className="mt-1 text-xs text-warm-gray">
            確認したら ✓ で消せます。新しい気づきは上に追加されます。
          </p>
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-rose-300/40 bg-white/60 p-5 text-sm text-warm-brown/70">
            今のところ、{seniorName}さんとの通話から気にとめておきたい点は見つかっていません。
            引き続き、毎日のお話を見守ります。
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((entry) => {
              const key = keyFor(entry);
              return (
                <ObservationRow
                  key={key}
                  entry={entry}
                  tz={tz}
                  busy={dismissing.has(key) || isPending}
                  onDismiss={() => handleDismiss(entry)}
                />
              );
            })}
          </ul>
        )}
      </GlassCard>

      <p className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-4 py-3 text-xs leading-relaxed text-warm-brown/80">
        ※ ここに表示されているのは、{seniorName}さんと{agentDefault()}の通話
        （直近{callsScanned}件）から得られた**観察**で、医学的な判断ではありません。
        ご心配な点が続く場合は、もの忘れ外来などの医療機関へのご相談をおすすめします。
      </p>
    </div>
  );
}

export function keyFor(entry: ObservationEntry): string {
  return `${entry.call_id}:${entry.index}`;
}

function agentDefault(): string {
  return "AI";
}

interface RowProps {
  entry: ObservationEntry;
  tz: string;
  busy: boolean;
  onDismiss: () => void;
}

function ObservationRow({ entry, tz, busy, onDismiss }: RowProps) {
  const { observation, started_at } = entry;
  const visual = visualFor(observation);

  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border ${visual.border} ${visual.bg} p-3.5 transition-opacity ${
        busy ? "opacity-50" : ""
      }`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${visual.iconBg}`}
      >
        <visual.Icon className={`h-4 w-4 ${visual.iconColor}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1 space-y-1">
        <div className="text-sm leading-relaxed text-warm-brown/90">
          {observation.detail}
        </div>
        {observation.evidence && (
          <div className="text-xs text-warm-gray">「{observation.evidence}」</div>
        )}
        <div className="text-[11px] text-warm-gray">
          {formatDate(started_at, tz)}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        disabled={busy}
        aria-label="確認済みにする"
        title="確認済みにする"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-warm-gray transition-colors hover:bg-rose-100 hover:text-coral disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>
    </li>
  );
}

function visualFor(observation: Observation) {
  // High severity → red. Everything else (low/medium) → yellow.
  if (observation.severity === "high") {
    return {
      Icon: AlertTriangle,
      border: "border-coral/40",
      bg: "bg-rose-100/40",
      iconBg: "bg-coral/15",
      iconColor: "text-coral",
    };
  }
  return {
    Icon: AlertCircle,
    border: "border-amber-300/40",
    bg: "bg-amber-50/60",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  };
}

function formatDate(iso: string, tz: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("ja-JP", {
      timeZone: tz,
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    return fmt.format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
