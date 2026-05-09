import { Calendar, Bell, TrendingUp, MessageCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export function DashboardPreviewSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-cream via-peach-200/30 to-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            <span className="inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
              ご家族向けダッシュボード
            </span>
            <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
              離れていても、
              <br />
              毎日の様子がわかる。
            </h2>
            <p className="text-base leading-relaxed text-warm-brown/75 md:text-lg">
              通話のたびに自動で要約され、気になる発言があればすぐに通知。
              親御さんの「今日」を、毎日少しずつ感じられます。
            </p>
            <ul className="space-y-3 pt-2">
              {[
                { icon: Calendar, text: "通話履歴のカレンダービュー" },
                { icon: MessageCircle, text: "毎回の通話を200文字で要約" },
                { icon: TrendingUp, text: "気分の推移グラフ（週次・月次）" },
                { icon: Bell, text: "気になる発言は即座にSMS通知" },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 ring-1 ring-rose-300/40">
                    <item.icon className="h-4 w-4 text-coral" />
                  </div>
                  <span className="text-sm text-warm-brown">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mock dashboard */}
          <div className="lg:col-span-7">
            <GlassCard className="p-6 lg:p-8">
              {/* Header bar */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-coral to-warm-orange text-sm font-bold text-white">
                    母
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-warm-brown">
                      田中 美智子さん（72歳）
                    </div>
                    <div className="text-xs text-warm-gray">毎朝 9:00 通話</div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  稼働中
                </div>
              </div>

              {/* Latest summary */}
              <div className="mb-5 rounded-2xl bg-rose-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-coral">
                  <MessageCircle className="h-3.5 w-3.5" />
                  最新の通話 — 今朝 9:03 (4分32秒)
                </div>
                <p className="text-sm leading-relaxed text-warm-brown/85">
                  今日はお孫さんが先週末に遊びに来てくれた話をされていました。お庭のあじさいが咲き始めたことも嬉しそうに。気分は良好。
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["孫", "ガーデニング", "ご機嫌"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-warm-gray"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mood chart mock */}
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-warm-gray">
                    今週の気分
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    良好 ↑
                  </span>
                </div>
                <div className="flex h-20 items-end gap-1.5">
                  {[60, 70, 55, 75, 80, 85, 90].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-coral/40 to-warm-orange/80"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-warm-gray">
                  {["月", "火", "水", "木", "金", "土", "日"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
              </div>

              {/* Calendar mini */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 14 }).map((_, i) => {
                  const called = ![3, 8].includes(i);
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-md text-center text-[10px] flex items-center justify-center font-medium ${
                        called
                          ? "bg-gradient-to-br from-coral/15 to-warm-orange/15 text-warm-brown"
                          : "bg-rose-100/40 text-warm-gray/60"
                      }`}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  );
}
