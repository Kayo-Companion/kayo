import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
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
  started_at: string; // ISO
}

/**
 * Family-facing "気づき" view. Buckets observations from the most recent
 * window of calls into three traffic-light signals:
 *
 *   🟢 安心ポイント        — positive observations (good signs)
 *   🟡 ちょっと気にとめておきたい — low/medium concerning observations
 *   🔴 ご家族と話してみてください — high-severity OR same type repeating 3+ times
 *
 * Note: this is deliberately NOT a clinical assessment. We never use
 * scores, percentages, risk levels, or any medical / diagnostic language.
 * The disclaimer at the bottom reinforces this.
 */

interface BucketEntry {
  /** Headline shown in the bucket. */
  headline: string;
  /** Evidence / quote shown in light gray. */
  evidence?: string;
  /** Latest call this was observed in (ISO). */
  latestDate: string;
  /** How many calls in the recent window this type was seen. */
  count: number;
  /** Underlying type for grouping. */
  type: Observation["type"];
}

interface Buckets {
  green: BucketEntry[];
  yellow: BucketEntry[];
  red: BucketEntry[];
}

/**
 * Threshold: if a non-positive observation type shows up this many times
 * in the recent window, we escalate from yellow to red. Picked at 3
 * because that's "noticeable pattern, not isolated event" without being
 * so high it never fires.
 */
const RED_REPEAT_THRESHOLD = 3;

/**
 * Reduce a flat list of observation entries into the three buckets.
 *
 * - Positive entries → green (deduped by type, keep latest detail).
 * - Non-positive entries → group by type. Count occurrences.
 *   - severity=high                        → red
 *   - count >= RED_REPEAT_THRESHOLD        → red (with "X回観察" framing)
 *   - else                                 → yellow
 */
export function bucketObservations(entries: ObservationEntry[]): Buckets {
  // Order entries newest-first so "latest detail" picks the most recent.
  const sorted = [...entries].sort((a, b) =>
    b.started_at.localeCompare(a.started_at)
  );

  // Group by type for non-positives; positives are deduped by type too but
  // shown straight (no "X回" framing — positives are positives).
  const greenByType = new Map<Observation["type"], BucketEntry>();
  const concernByType = new Map<
    Observation["type"],
    { entries: ObservationEntry[]; maxSeverity: "low" | "medium" | "high" }
  >();

  for (const e of sorted) {
    const o = e.observation;
    if (o.positive) {
      if (!greenByType.has(o.type)) {
        greenByType.set(o.type, {
          headline: o.detail,
          evidence: o.evidence,
          latestDate: e.started_at,
          count: 1,
          type: o.type,
        });
      } else {
        const existing = greenByType.get(o.type)!;
        existing.count += 1;
      }
    } else {
      if (!concernByType.has(o.type)) {
        concernByType.set(o.type, { entries: [e], maxSeverity: o.severity });
      } else {
        const g = concernByType.get(o.type)!;
        g.entries.push(e);
        if (severityRank(o.severity) > severityRank(g.maxSeverity)) {
          g.maxSeverity = o.severity;
        }
      }
    }
  }

  const yellow: BucketEntry[] = [];
  const red: BucketEntry[] = [];

  for (const [type, group] of concernByType) {
    const latest = group.entries[0]; // sorted newest-first
    const count = group.entries.length;
    const isRepeated = count >= RED_REPEAT_THRESHOLD;
    const isHighSeverity = group.maxSeverity === "high";

    const entry: BucketEntry = {
      headline: isRepeated
        ? `${latest.observation.detail}（${count}回観察）`
        : latest.observation.detail,
      evidence: latest.observation.evidence,
      latestDate: latest.started_at,
      count,
      type,
    };

    if (isHighSeverity || isRepeated) {
      red.push(entry);
    } else {
      yellow.push(entry);
    }
  }

  return {
    green: [...greenByType.values()],
    yellow,
    red,
  };
}

function severityRank(s: "low" | "medium" | "high"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

interface Props {
  seniorName: string;
  entries: ObservationEntry[];
  /** Number of calls scanned for context, e.g. "過去20件の通話から" */
  callsScanned: number;
  tz: string;
}

export function InsightsBuckets({ seniorName, entries, callsScanned, tz }: Props) {
  const { green, yellow, red } = bucketObservations(entries);

  return (
    <div className="space-y-4">
      {/* On mobile (default) stacks vertically; on lg+ shows three columns
          side-by-side. items-start keeps the cards top-aligned regardless
          of how much content they each have. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
        <Bucket
          kind="green"
          title="安心ポイント"
          emptyMessage={`${seniorName}さんの最近の通話から、ポジティブな観察はまだ見つかっていません。`}
          items={green}
          tz={tz}
        />
        <Bucket
          kind="yellow"
          title="ちょっと気にとめておきたい"
          emptyMessage="今のところ、気にとめておきたい変化はありません。"
          items={yellow}
          tz={tz}
        />
        <Bucket
          kind="red"
          title="ご家族と話してみてください"
          emptyMessage="今のところ、ご家族にご相談を促すような変化はありません。"
          items={red}
          tz={tz}
        />
      </div>

      <p className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-4 py-3 text-xs leading-relaxed text-warm-brown/80">
        ※ ここに表示されているのは、{seniorName}さんと{agentDefault()}の通話
        （直近{callsScanned}件）から得られた**観察**で、医学的な判断ではありません。
        ご心配な点が続く場合は、もの忘れ外来などの医療機関へのご相談をおすすめします。
      </p>
    </div>
  );
}

function agentDefault(): string {
  // Same neutral phrasing as elsewhere; intentionally doesn't reference
  // the per-senior agent_name because that's not in scope here.
  return "AI";
}

interface BucketProps {
  kind: "green" | "yellow" | "red";
  title: string;
  emptyMessage: string;
  items: BucketEntry[];
  tz: string;
}

function Bucket({ kind, title, emptyMessage, items, tz }: BucketProps) {
  const visual = bucketVisual(kind);
  return (
    <GlassCard className="space-y-3 p-5 md:p-6">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${visual.iconBg}`}
        >
          <visual.Icon className={`h-5 w-5 ${visual.iconColor}`} strokeWidth={2.5} />
        </div>
        <h2 className={`font-serif text-lg font-medium ${visual.titleColor}`}>
          {visual.emoji} {title}
          <span className="ml-2 text-sm font-normal text-warm-gray">
            ({items.length})
          </span>
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-warm-brown/70">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={`${item.type}-${i}`}
              className={`rounded-2xl border ${visual.rowBorder} ${visual.rowBg} p-3.5`}
            >
              <div className="text-sm leading-relaxed text-warm-brown/90">
                {item.headline}
              </div>
              {item.evidence && (
                <div className="mt-1 text-xs text-warm-gray">
                  「{item.evidence}」
                </div>
              )}
              <div className="mt-1 text-[11px] text-warm-gray">
                {formatDate(item.latestDate, tz)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function bucketVisual(kind: "green" | "yellow" | "red") {
  if (kind === "green") {
    return {
      Icon: CheckCircle2,
      emoji: "🟢",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      titleColor: "text-emerald-700",
      rowBorder: "border-emerald-300/40",
      rowBg: "bg-emerald-50/60",
    };
  }
  if (kind === "yellow") {
    return {
      Icon: AlertCircle,
      emoji: "🟡",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      titleColor: "text-amber-700",
      rowBorder: "border-amber-300/40",
      rowBg: "bg-amber-50/60",
    };
  }
  return {
    Icon: AlertTriangle,
    emoji: "🔴",
    iconBg: "bg-coral/15",
    iconColor: "text-coral",
    titleColor: "text-coral",
    rowBorder: "border-coral/40",
    rowBg: "bg-rose-100/40",
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
