"use client";

import { useMemo, useState } from "react";

export interface DayCalls {
  date: string; // YYYY-MM-DD in senior's timezone
  total_minutes: number;
  calls: {
    id: string;
    started_at: string;
    duration_seconds: number | null;
    summary: string | null;
    mood: string | null;
    distress_detected: boolean;
  }[];
}

const MOOD_EMOJI: Record<string, string> = {
  positive: "😊",
  neutral: "🙂",
  negative: "😟",
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * iPhone-Screen-Time-style 7-day bar graph. Each bar = one day, height
 * scales to that day's total call minutes. Tap a bar to inline-show that
 * day's call summaries below.
 *
 * `tz` is the senior's call_timezone (e.g. "Asia/Tokyo"). We anchor the
 * rightmost bar to TODAY in *that* timezone, not the browser's, so a
 * buyer in PT viewing a Tokyo-based senior still sees their day labeled
 * correctly (otherwise the rightmost cell drifts to yesterday).
 */
export function ActivityBars({
  days,
  seniorName,
  tz = "Asia/Tokyo",
}: {
  days: DayCalls[];
  seniorName: string;
  tz?: string;
}) {
  const todayIso = useMemo(() => {
    // ISO local-date string in the senior's timezone, e.g. "2026-05-12"
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, [tz]);
  const week = useMemo(() => buildWeek(todayIso, days), [todayIso, days]);
  const max = Math.max(1, ...week.map((d) => d.total_minutes));

  // Default-select today (the rightmost bar) so users see something
  // immediately if there's data, instead of an empty hint.
  const todayKey = week[week.length - 1]?.date ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const selectedDay = week.find((d) => d.date === selectedDate) ?? null;

  return (
    <div className="space-y-5">
      {/* Bars */}
      <div className="flex h-40 items-end justify-between gap-2 sm:gap-3">
        {week.map((d) => {
          const isSelected = d.date === selectedDate;
          const isEmpty = d.total_minutes === 0;
          // Bar fills proportional to max in this week. Min 4% so empty days
          // are still tappable, but visually look empty (lighter color).
          const heightPct = isEmpty
            ? 4
            : Math.max(8, Math.round((d.total_minutes / max) * 100));
          return (
            <button
              key={d.date}
              type="button"
              onClick={() =>
                setSelectedDate(isSelected ? null : d.date)
              }
              className="group flex flex-1 flex-col items-center gap-1.5"
              aria-label={`${d.label} ${d.total_minutes}分`}
            >
              <div className="relative flex h-32 w-full items-end justify-center">
                {/* Top label: minutes (only when non-empty) */}
                {!isEmpty && (
                  <div
                    className={`absolute -top-1 text-[10px] font-medium leading-none transition-colors ${
                      isSelected ? "text-coral" : "text-warm-gray"
                    }`}
                    style={{ bottom: `calc(${heightPct}% + 4px)` }}
                  >
                    {d.total_minutes}m
                  </div>
                )}
                {/* The bar */}
                <div
                  className={`w-full rounded-t-md transition-all ${
                    isEmpty
                      ? "bg-rose-200/60"
                      : isSelected
                        ? "bg-gradient-to-t from-warm-orange to-coral"
                        : "bg-coral/55 group-hover:bg-coral/75"
                  } ${isSelected ? "shadow-md shadow-coral/30" : ""}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              {/* X-axis weekday label */}
              <div
                className={`text-xs font-medium ${
                  isSelected ? "text-coral" : "text-warm-gray"
                }`}
              >
                {d.weekdayLabel}
              </div>
              <div
                className={`text-[10px] ${
                  isSelected ? "text-coral" : "text-warm-gray/70"
                }`}
              >
                {d.dayOfMonth}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <DayDetailPanel day={selectedDay} seniorName={seniorName} />
      ) : (
        <p className="text-center text-xs text-warm-gray">
          日付をタップすると、その日のお話のまとめがご覧いただけます。
        </p>
      )}
    </div>
  );
}

function DayDetailPanel({
  day,
  seniorName,
}: {
  day: DayCalls & { label: string };
  seniorName: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-rose-300/40 bg-white/60 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg font-medium text-warm-brown">
          {day.label}
        </h3>
        <span className="text-xs text-warm-gray">{day.total_minutes}分</span>
      </div>
      {day.calls.length === 0 ? (
        <p className="text-sm text-warm-gray">この日のお電話はありませんでした。</p>
      ) : (
        <ul className="space-y-3">
          {day.calls.map((c) => (
            <li
              key={c.id}
              className="space-y-1 border-b border-rose-200/40 pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between text-xs text-warm-gray">
                <span>
                  {formatJpTime(c.started_at)}
                  {c.duration_seconds != null
                    ? ` ・ ${Math.max(1, Math.ceil(c.duration_seconds / 60))}分`
                    : ""}
                  {c.mood && MOOD_EMOJI[c.mood]
                    ? ` ・ ${MOOD_EMOJI[c.mood]}`
                    : ""}
                </span>
                {c.distress_detected && (
                  <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-semibold text-coral">
                    要注意
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-warm-brown">
                {c.summary?.trim() || `${seniorName}さんとお話しました。`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface WeekDay extends DayCalls {
  label: string;          // 「5月10日（土）」
  weekdayLabel: string;   // 「土」
  dayOfMonth: string;     // 「10」
}

function buildWeek(todayIso: string, days: DayCalls[]): WeekDay[] {
  // Map of date string -> DayCalls for fast lookup.
  const map = new Map<string, DayCalls>();
  for (const d of days) map.set(d.date, d);

  // Parse the ISO date as a UTC midnight so date math is timezone-agnostic;
  // we only do day-by-day arithmetic, never inspect hours.
  const [yy, mm, dd] = todayIso.split("-").map(Number);
  const todayUTC = new Date(Date.UTC(yy, (mm ?? 1) - 1, dd ?? 1));

  const out: WeekDay[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(todayUTC);
    d.setUTCDate(d.getUTCDate() - offset);
    const iso = isoFromUTCDate(d);
    const existing = map.get(iso);
    out.push({
      date: iso,
      total_minutes: existing?.total_minutes ?? 0,
      calls: existing?.calls ?? [],
      label: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAY_LABELS[d.getUTCDay()]}）`,
      weekdayLabel: WEEKDAY_LABELS[d.getUTCDay()],
      dayOfMonth: String(d.getUTCDate()),
    });
  }
  return out;
}

function isoFromUTCDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatJpTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
