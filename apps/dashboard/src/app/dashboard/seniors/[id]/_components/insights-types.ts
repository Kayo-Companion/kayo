/**
 * Shared types + pure helpers for the 気づき (insights) tab.
 *
 * These are imported from BOTH the server page (insights/page.tsx) and the
 * client component (insights-buckets.tsx). Keeping them in a separate, non-
 * "use client" module lets Next.js call helpers like `keyFor` on the server
 * without crossing the server/client boundary.
 */

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

export function keyFor(entry: ObservationEntry): string {
  return `${entry.call_id}:${entry.index}`;
}
