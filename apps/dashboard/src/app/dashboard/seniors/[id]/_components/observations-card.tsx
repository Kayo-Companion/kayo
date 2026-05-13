import { AlertTriangle, Sparkles, Sprout } from "lucide-react";
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

interface Props {
  seniorName: string;
  entries: ObservationEntry[];
  tz: string;
}

/**
 * Family-facing "気になる変化 / 良い変化" card. Observations are produced
 * post-call by the voice service's LLM analyzer and stored on each call
 * row; this component just renders them.
 *
 * Important: the copy is deliberately observation-based ("覚えていない
 * 様子でした") rather than diagnostic ("認知症の兆候"). The same care
 * shows up in the disclaimer at the bottom.
 */
export function ObservationsCard({ seniorName, entries, tz }: Props) {
  const concerning = entries.filter((e) => !e.observation.positive);
  const positive = entries.filter((e) => e.observation.positive);

  return (
    <GlassCard className="space-y-4 p-6 md:p-8">
      <div>
        <h2 className="font-serif text-xl font-medium text-warm-brown">
          気になる変化・良い変化
        </h2>
        <p className="mt-1 text-sm text-warm-brown/70">
          {seniorName}さんとの最近のお話から、ご家族にお伝えしたい観察をまとめています。
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-rose-300/40 bg-white/60 p-5 text-sm text-warm-brown/70">
          直近の通話で、特にお伝えするような変化は見つかっていません。
          引き続き、毎日のお話を見守ります。
        </p>
      ) : (
        <div className="space-y-3">
          {concerning.length > 0 && (
            <ul className="space-y-2">
              {concerning.map((e, i) => (
                <ObservationRow key={`c-${i}`} entry={e} tz={tz} />
              ))}
            </ul>
          )}
          {positive.length > 0 && (
            <ul className="space-y-2 pt-1">
              {positive.map((e, i) => (
                <ObservationRow key={`p-${i}`} entry={e} tz={tz} />
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="rounded-xl border border-rose-300/40 bg-rose-50/60 px-3 py-2 text-xs leading-relaxed text-warm-brown/80">
        ※ これは会話から得られた観察であり、医学的な判断ではありません。
        気になる変化が続く場合は、もの忘れ外来等の医療機関へのご相談を
        おすすめします。
      </p>
    </GlassCard>
  );
}

function ObservationRow({
  entry,
  tz,
}: {
  entry: ObservationEntry;
  tz: string;
}) {
  const { observation, started_at } = entry;
  const dateLabel = formatDate(started_at, tz);

  const visual = visualFor(observation);

  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border ${visual.border} ${visual.bg} p-4`}
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${visual.iconBg}`}
      >
        <visual.Icon className={`h-4 w-4 ${visual.iconColor}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1 space-y-1">
        <div className="text-sm leading-relaxed text-warm-brown/85">
          {observation.detail}
        </div>
        {observation.evidence && (
          <div className="text-xs text-warm-gray">
            「{observation.evidence}」
          </div>
        )}
        <div className="text-[11px] text-warm-gray">{dateLabel}</div>
      </div>
    </li>
  );
}

function visualFor(observation: Observation) {
  if (observation.positive) {
    return {
      Icon: Sparkles,
      border: "border-emerald-300/50",
      bg: "bg-emerald-50/60",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    };
  }
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
    Icon: Sprout,
    border: "border-rose-300/40",
    bg: "bg-white/60",
    iconBg: "bg-rose-200/60",
    iconColor: "text-coral",
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
