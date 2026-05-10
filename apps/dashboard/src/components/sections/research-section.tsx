import { Brain, BookOpen, TrendingUp, Calendar } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const StatCard = ({
  icon: Icon,
  value,
  label,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  description: string;
}) => (
  <GlassCard className="flex flex-col items-start p-7">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-coral/15 to-warm-orange/15 ring-1 ring-rose-300/40">
      <Icon className="h-6 w-6 text-coral" />
    </div>
    <div className="mb-1 font-serif text-4xl font-medium text-warm-brown">
      {value}
    </div>
    <div className="mb-2 text-sm font-semibold text-warm-brown">{label}</div>
    <div className="text-sm leading-relaxed text-warm-gray">{description}</div>
  </GlassCard>
);

export function ResearchSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-cream via-peach-200/40 to-cream py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-1/4 h-72 w-72 rounded-full bg-rose-300/20 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral backdrop-blur-md">
            <Brain className="h-3.5 w-3.5" />
            科学的裏付け
          </span>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            毎日の会話が、
            <br />
            <span className="bg-gradient-to-br from-coral to-warm-orange bg-clip-text text-transparent">
              認知機能
            </span>
            を守る。
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-warm-brown/75 md:text-lg">
            米国の研究機関が、毎日の会話を続けた高齢者の認知機能が
            <span className="font-semibold text-warm-brown">はっきりと改善した</span>
            ことを臨床試験で確認しました。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            value="認知機能"
            label="はっきりと改善"
            description="6ヶ月間、毎日会話を続けた高齢者は、しなかったグループに比べて認知機能テストの点数が大きく伸びました。"
          />
          <StatCard
            icon={Brain}
            value="記憶力"
            label="特に大きく向上"
            description="名前や予定を思い出す力など、日常で実感しやすい記憶の項目でしっかりとした改善が見られました。"
          />
          <StatCard
            icon={Calendar}
            value="約10年分"
            label="若々しさを取り戻す"
            description="改善の大きさは、同じ年代で約10歳分の差に相当するほどでした。"
          />
        </div>

        {/* Citation */}
        <GlassCard className="mt-8 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-200/60">
              <BookOpen className="h-5 w-5 text-coral" />
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="font-semibold text-warm-brown">
                出典について
              </div>
              <div className="text-warm-gray">
                米国国立衛生研究所（NIH）が資金提供し、ハーバード大学医学部の研究チームが実施した臨床試験「I-CONECT」の研究結果に基づいています。
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Compliance footnote */}
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-warm-gray">
          ※カヨは医療機器ではありません。認知症の診断・治療・予防を目的とするものではなく、本研究は会話介入一般の認知機能への効果を示すものです。個別の症状については医療専門家にご相談ください。
        </p>
      </div>
    </section>
  );
}
