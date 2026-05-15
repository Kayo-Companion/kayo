import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SeniorTabs } from "../_components/senior-tabs";

const TZ = "Asia/Tokyo";

const CATEGORY_LABEL_JP: Record<string, string> = {
  animals: "動物",
  geography: "日本の地理",
  showa: "昭和の歌・芸能",
  seasons: "季節・行事",
  cooking: "食べ物・料理",
  history: "日本史",
  kanji: "漢字読み",
  proverbs: "ことわざ・慣用句",
  mixed: "ミックス",
};

const ACTIVITY_LABEL_JP: Record<string, string> = {
  conversation: "会話",
  quiz: "クイズ",
  shiritori: "しりとり",
  brain_training: "脳トレ",
};

interface QuizItem {
  q: string;
  user_answer: string;
  correct: boolean;
  correct_answer?: string;
}

interface HdsrQuestion {
  id: number;
  type: string;
  user_answer: string;
  score: number;
  max: number;
}

type ActivityResult =
  | { type: "conversation" }
  | {
      type: "quiz";
      category?: string;
      category_label?: string;
      items?: QuizItem[];
      correct?: number;
      total?: number;
    }
  | {
      type: "shiritori";
      turn_count?: number;
      winner?: string;
      ended_by?: string;
    }
  | {
      type: "brain_training";
      total?: number;
      max?: number;
      interpretation?: string;
      questions?: HdsrQuestion[];
    };

interface CallRow {
  id: string;
  started_at: string;
  activity_results: ActivityResult[] | null;
}

/**
 * Activity history tab.
 *
 * Shows the last 30 days of opt-in activity sessions (会話 / クイズ /
 * しりとり / 脳トレ) the senior chose from Kayo's call menu. Two top-level
 * cards:
 *   1. Monthly mix — bar/count of each activity type
 *   2. Per-call timeline — newest first, expandable details
 *
 * The 脳トレ (HDS-R) entries are deliberately rendered with disclaimer text
 * because the user (the senior) never sees their score — this is the
 * family's only view into the numbers, and we want to be very clear it's
 * not a medical diagnosis.
 */
export default async function SeniorActivitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: senior } = await supabase
    .from("seniors")
    .select("id, name, family_id, call_timezone")
    .eq("id", id)
    .maybeSingle();
  if (!senior) notFound();

  const { data: family } = await supabase
    .from("families")
    .select("id")
    .eq("id", senior.family_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!family) notFound();

  // 30-day window of calls with activity_results.
  const since = new Date();
  since.setDate(since.getDate() - 30);
  since.setHours(0, 0, 0, 0);

  const { data: callRows } = await supabase
    .from("calls")
    .select("id, started_at, activity_results")
    .eq("senior_id", id)
    .gte("started_at", since.toISOString())
    .not("activity_results", "is", null)
    .order("started_at", { ascending: false });

  const rows = (callRows ?? []) as CallRow[];
  const tz = senior.call_timezone || TZ;

  // Tally activity type counts for the summary card.
  const counts: Record<string, number> = {
    conversation: 0,
    quiz: 0,
    shiritori: 0,
    brain_training: 0,
  };
  for (const row of rows) {
    if (!row.activity_results) continue;
    for (const r of row.activity_results) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
  }
  const maxCount = Math.max(1, ...Object.values(counts));

  // Latest HDS-R for the headline.
  const latestHdsr = rows
    .flatMap((row) =>
      (row.activity_results ?? [])
        .filter((r): r is Extract<ActivityResult, { type: "brain_training" }> => r.type === "brain_training")
        .map((r) => ({ ...r, started_at: row.started_at, call_id: row.id }))
    )
    .at(0);

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-warm-gray hover:text-coral"
        >
          <ArrowLeft className="h-4 w-4" /> ダッシュボードへ戻る
        </Link>

        <header className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
              アクティビティ
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
              {senior.name} さん
            </h1>
            <p className="mt-2 text-sm text-warm-brown/75 leading-relaxed">
              通話中に{senior.name}さんが選んだ
              <strong className="text-warm-brown">アクティビティ（会話・クイズ・しりとり・脳トレ）</strong>
              の履歴です。過去30日分を表示しています。
            </p>
          </div>
          <SeniorTabs seniorId={senior.id} />
        </header>

        {/* Monthly mix */}
        <section className="rounded-2xl border border-rose-300/40 bg-white/70 p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-medium text-warm-brown">今月の利用状況</h2>
          <div className="space-y-3">
            {(["conversation", "quiz", "shiritori", "brain_training"] as const).map((type) => (
              <div key={type} className="flex items-center gap-3 text-sm">
                <div className="w-20 shrink-0 text-warm-gray">
                  {ACTIVITY_LABEL_JP[type]}
                </div>
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-rose-100/60">
                  <div
                    className="h-full rounded-full bg-coral"
                    style={{ width: `${(counts[type] / maxCount) * 100}%` }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right tabular-nums text-warm-brown">
                  {counts[type]}回
                </div>
              </div>
            ))}
          </div>
          {rows.length === 0 && (
            <p className="mt-4 text-sm text-warm-gray">
              まだアクティビティの記録がありません。次回の通話でカヨが「今日は何しよっか？」と聞いた時に、{senior.name}さんがクイズや脳トレなどを選ぶと、ここに結果が表示されます。
            </p>
          )}
        </section>

        {/* Latest HDS-R result, if any */}
        {latestHdsr && (
          <section className="rounded-2xl border border-rose-300/40 bg-white/70 p-5 shadow-sm">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-lg font-medium text-warm-brown">
                直近の脳トレ結果
              </h2>
              <span className="text-xs text-warm-gray">
                {fmtDate(latestHdsr.started_at, tz)}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="font-serif text-4xl font-medium text-warm-brown tabular-nums">
                {latestHdsr.total ?? "—"}
              </div>
              <div className="text-sm text-warm-gray">/ {latestHdsr.max ?? 30}</div>
            </div>
            {latestHdsr.interpretation && (
              <div className="mt-2 text-sm text-warm-brown/85">
                {latestHdsr.interpretation}
              </div>
            )}
            <p className="mt-3 rounded-md bg-rose-50/60 px-3 py-2 text-xs leading-relaxed text-warm-gray">
              ※ これは医師の正式な認知症診断の代替ではありません。心配な点があれば、お近くの神経内科や物忘れ外来でご相談ください。
            </p>
          </section>
        )}

        {/* Per-call timeline */}
        {rows.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-serif text-lg font-medium text-warm-brown">
              直近の通話履歴
            </h2>
            {rows.map((row) => (
              <CallActivityCard key={row.id} row={row} tz={tz} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function CallActivityCard({ row, tz }: { row: CallRow; tz: string }) {
  if (!row.activity_results || row.activity_results.length === 0) return null;
  return (
    <div className="rounded-2xl border border-rose-200/60 bg-white/70 p-4 shadow-sm">
      <div className="mb-2 text-xs text-warm-gray">
        {fmtDateTime(row.started_at, tz)}
      </div>
      <div className="space-y-3">
        {row.activity_results.map((result, i) => (
          <ActivityRow key={i} result={result} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ result }: { result: ActivityResult }) {
  if (result.type === "conversation") {
    return (
      <div className="flex items-center gap-2 text-sm text-warm-brown/85">
        <span className="rounded-full bg-rose-100/70 px-2 py-0.5 text-xs">会話</span>
        <span>普通のおしゃべりをしました</span>
      </div>
    );
  }
  if (result.type === "quiz") {
    const label = result.category_label || CATEGORY_LABEL_JP[result.category || "mixed"] || "クイズ";
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-warm-brown">
          <span className="rounded-full bg-rose-100/70 px-2 py-0.5 text-xs">クイズ</span>
          <span>{label}</span>
          <span className="text-warm-gray">
            ・{result.correct ?? 0} / {result.total ?? 0} 正解
          </span>
        </div>
        {result.items && result.items.length > 0 && (
          <ul className="ml-2 list-disc pl-4 text-xs text-warm-gray">
            {result.items.slice(0, 5).map((item, idx) => (
              <li key={idx}>
                {item.correct ? "✓" : "✗"} {item.q}
                {!item.correct && item.correct_answer && (
                  <span className="text-warm-brown/60"> （正解: {item.correct_answer}）</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (result.type === "shiritori") {
    return (
      <div className="flex items-center gap-2 text-sm text-warm-brown">
        <span className="rounded-full bg-rose-100/70 px-2 py-0.5 text-xs">しりとり</span>
        <span>
          {result.turn_count ?? 0}回続きました
          {result.winner && (
            <span className="ml-1 text-warm-gray">
              （{result.winner === "user" ? "ご本人の勝ち" : result.winner === "kayo" ? "カヨの勝ち" : "引き分け"}）
            </span>
          )}
        </span>
      </div>
    );
  }
  if (result.type === "brain_training") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-warm-brown">
          <span className="rounded-full bg-coral/15 px-2 py-0.5 text-xs text-coral">
            脳トレ
          </span>
          <span className="font-medium">
            {result.total ?? 0} / {result.max ?? 30}点
          </span>
          {result.interpretation && (
            <span className="text-xs text-warm-gray">・{result.interpretation}</span>
          )}
        </div>
        {result.questions && result.questions.length > 0 && (
          <details className="ml-2">
            <summary className="cursor-pointer text-xs text-warm-gray hover:text-coral">
              内訳を見る（{result.questions.length}問）
            </summary>
            <ul className="ml-2 mt-2 space-y-0.5 text-xs text-warm-gray">
              {result.questions.map((q) => (
                <li key={q.id}>
                  問{q.id}（{q.type}）: {q.score} / {q.max}点
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  }
  return null;
}

function fmtDate(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: tz,
    month: "long",
    day: "numeric",
  });
}

function fmtDateTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    timeZone: tz,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
