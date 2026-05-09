import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const personalityChips = ["優しい", "共感的", "押し付けない", "知ったかぶりしない"];
const speechChips = [
  "標準語・丁寧語",
  "ゆっくり",
  "相槌をいれる",
  "短い文",
];

export function KayoPersonaSection() {
  return (
    <section className="relative w-full overflow-hidden bg-cream py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/3 h-72 w-72 rounded-full bg-rose-300/30 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left: Persona blob */}
          <div className="flex justify-center lg:col-span-5">
            <div className="relative h-72 w-72 sm:h-80 sm:w-80">
              {/* Soft gradient blob */}
              <div className="absolute inset-0 animate-float rounded-full bg-gradient-to-br from-coral via-rose-400 to-warm-orange blur-2xl opacity-60" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/90 to-rose-200/60 backdrop-blur-xl border border-white/60 shadow-2xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-coral" />
                  <div className="font-serif text-6xl font-medium tracking-tight text-warm-brown">
                    カヨ
                  </div>
                  <div className="mt-2 text-sm text-warm-gray">60代・女性</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Description */}
          <div className="space-y-6 lg:col-span-7">
            <div>
              <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
                カヨの人柄
              </span>
              <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
                はじめまして、
                <br />
                カヨです。
              </h2>
              <p className="mt-5 text-base leading-relaxed text-warm-brown/80 md:text-lg">
                60代の女性として、ゆっくり丁寧にお話します。
                押し付けがましくなく、でも一人にしない。
                同世代の友達のような距離感で、毎日少しずつお話を重ねていきます。
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-warm-gray">
                  性格
                </div>
                <div className="flex flex-wrap gap-2">
                  {personalityChips.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-full border border-rose-300/60 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-warm-brown"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-warm-gray">
                  話し方
                </div>
                <div className="flex flex-wrap gap-2">
                  {speechChips.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center rounded-full border border-warm-orange/40 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-warm-brown"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Mini conversation */}
            <GlassCard className="p-5">
              <div className="space-y-3">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-rose-200/60 px-4 py-2.5 text-sm text-warm-brown">
                    もしもし、お話相手のカヨです。今日もお元気でいらっしゃいますか？
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm text-warm-brown shadow-sm">
                    あら、カヨさん。今日は孫が来てね、お庭の手入れをしてくれたのよ。
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-rose-200/60 px-4 py-2.5 text-sm text-warm-brown">
                    まあ、それは嬉しいですね。お孫さん、お庭仕事もされるんですか？
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </section>
  );
}
