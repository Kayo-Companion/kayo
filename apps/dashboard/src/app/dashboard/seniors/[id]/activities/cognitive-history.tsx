"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

interface HdsrQuestion {
  id: number;
  type: string;
  user_answer: string;
  score: number;
  max: number;
  verified?: boolean;
  reason?: string;
}

export interface HdsrSession {
  started_at: string;   // ISO
  call_id: string;
  total: number;
  max: number;
  interpretation: string;
  notes?: string;
  questions: HdsrQuestion[];
}

const QUESTION_LABEL_JP: Record<string, string> = {
  age: "年齢",
  date_orientation: "時間見当識",
  place_orientation: "場所見当識",
  three_word_registration: "3単語の即時記銘",
  calculation: "計算（100-7）",
  digit_span_reverse: "数字の逆唱",
  three_word_delayed_recall: "3単語の遅延再生",
  five_items_recall_verbal: "5物品の再生",
  verbal_fluency: "言語の流暢性（野菜）",
};

/**
 * Slide-style history viewer for HDS-R sessions. Habit-tracker UX:
 *   ← [June 15  27/30  健康範囲] →
 *
 * Newest session is index 0; left arrow goes to older sessions.
 * The breakdown of all 9 questions is shown below the headline card,
 * with verified=false items rendered as "確認できませんでした" instead of
 * a numeric score (the user said the senior shouldn't be penalized for
 * a question Kayo couldn't reliably administer).
 */
export function CognitiveHistory({
  sessions,
  tz,
}: {
  sessions: HdsrSession[];
  tz: string;
}) {
  const [idx, setIdx] = useState(0);

  if (sessions.length === 0) {
    return (
      <section className="rounded-2xl border border-rose-300/40 bg-white/70 p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-100/70">
          <AlertCircle className="h-6 w-6 text-warm-gray" />
        </div>
        <h2 className="font-serif text-lg font-medium text-warm-brown">
          まだ記録がありません
        </h2>
        <p className="mt-2 text-sm text-warm-brown/75 leading-relaxed">
          次回のお電話でカヨが「今日は何しよっか？」と聞いた時に、ご本人が「脳トレ」を選ぶと、ここに結果が表示されます。
        </p>
      </section>
    );
  }

  const session = sessions[idx];
  const canPrev = idx < sessions.length - 1;
  const canNext = idx > 0;

  return (
    <div className="space-y-4">
      {/* Headline slider */}
      <section className="rounded-2xl border border-rose-300/40 bg-white/70 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => canPrev && setIdx(idx + 1)}
            disabled={!canPrev}
            aria-label="前回の結果"
            className="rounded-full p-2 text-warm-brown transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 text-center">
            <div className="text-xs uppercase tracking-wider text-warm-gray">
              {fmtDate(session.started_at, tz)}
            </div>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className="font-serif text-5xl font-medium text-warm-brown tabular-nums">
                {session.total}
              </span>
              <span className="text-warm-gray">/ {session.max}</span>
            </div>
            <div className="mt-1 text-sm text-warm-brown/85">
              {session.interpretation}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-wider text-warm-gray">
              {idx + 1} / {sessions.length} 回目
            </div>
          </div>

          <button
            type="button"
            onClick={() => canNext && setIdx(idx - 1)}
            disabled={!canNext}
            aria-label="次回の結果"
            className="rounded-full p-2 text-warm-brown transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Mini timeline showing all session positions */}
        {sessions.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {sessions.slice().reverse().map((_, i) => {
              const dotIdx = sessions.length - 1 - i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(dotIdx)}
                  aria-label={`${i + 1}回目を表示`}
                  className={`h-1.5 rounded-full transition-all ${
                    dotIdx === idx
                      ? "w-6 bg-coral"
                      : "w-1.5 bg-rose-200 hover:bg-rose-300"
                  }`}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Breakdown of this session */}
      <section className="rounded-2xl border border-rose-200/60 bg-white/70 p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-warm-brown">内訳</h3>
        <ul className="space-y-2">
          {session.questions.map((q) => {
            const unverified = q.verified === false;
            const label = QUESTION_LABEL_JP[q.type] || q.type;
            return (
              <li key={q.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-warm-brown">
                    問{q.id} {label}
                  </div>
                  {unverified ? (
                    <div className="mt-0.5 text-xs italic text-warm-gray">
                      この項目は確認できませんでした
                    </div>
                  ) : (
                    q.user_answer && (
                      <div className="mt-0.5 text-xs text-warm-gray">
                        回答: {q.user_answer}
                      </div>
                    )
                  )}
                </div>
                <div className="shrink-0 tabular-nums">
                  {unverified ? (
                    <span className="text-warm-gray">—</span>
                  ) : (
                    <span className="text-warm-brown">
                      {q.score} / {q.max}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {session.notes && (
          <p className="mt-3 rounded-md bg-rose-50/60 px-3 py-2 text-xs leading-relaxed text-warm-brown/85">
            {session.notes}
          </p>
        )}
      </section>

      <p className="rounded-md bg-rose-50/40 px-4 py-3 text-xs leading-relaxed text-warm-gray">
        ※ Kayo の認知機能チェックは医師の正式な認知症診断の代替ではありません。点数の変化や「確認できませんでした」が続く項目があれば、お近くの神経内科や物忘れ外来でご相談ください。
      </p>
    </div>
  );
}

function fmtDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
