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
            これは慰めではなく、科学です。米国NIHが資金提供した臨床試験
            <span className="font-semibold text-warm-brown"> I-CONECT </span>
            が、毎日の会話介入が高齢者の認知機能を有意に改善することを示しました。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            value="+1.75点"
            label="MoCA総合認知機能の改善"
            description="6ヶ月間の毎日の会話介入後、対照群と比較してMCI実験群で有意な改善（p=0.03）。"
          />
          <StatCard
            icon={Brain}
            value="d = 0.73"
            label="効果量（Cohen's d）"
            description="統計学的に「大きな効果」に分類される改善幅。記憶機能でもd=0.67を記録。"
          />
          <StatCard
            icon={Calendar}
            value="10年分"
            label="加齢遅延に相当"
            description="この1.75点の改善は、同コホートにおいて10年分の年齢差に相当する大きさ。"
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
                I-CONECT 試験（Internet-Based Conversational Engagement Clinical Trial）
              </div>
              <div className="text-warm-gray">
                ClinicalTrials.gov{" "}
                <span className="font-mono">NCT02871921</span> ／ 責任者:
                Hiroko H. Dodge, Ph.D., Harvard Medical School & Massachusetts General Hospital ／
                資金: 米国国立衛生研究所（NIH）
              </div>
              <div className="text-warm-gray">
                対象: 75歳以上の社会的に孤立した高齢者186名（正常認知86名・MCI 100名）。Webカメラ経由で訓練された面接者と週4回30分の半構造化会話を6ヶ月間。
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
