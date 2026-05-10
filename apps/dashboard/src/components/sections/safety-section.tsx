import { Check, X, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const willDo = [
  "通話の冒頭で「お孫さんの〇〇さんからのご紹介」と必ず名乗る",
  "お話相手としての会話だけを行う",
  "通話履歴・要約は全てご家族のダッシュボードで確認できる",
  "気になる発言を察知したら、ご家族に通知する",
];

const wontDo = [
  "お金の話（振込・口座・暗証番号・金額）",
  "個人情報の聞き出し（住所・生年月日・家族構成の詳細）",
  "「今すぐ」「至急」など緊急性を煽る言葉",
  "家族の代わりとして物事を頼む（「振り込んで」など）",
  "医療診断や薬の推奨",
];

export function SafetySection() {
  return (
    <section className="relative w-full bg-gradient-to-b from-cream to-peach-200/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-2xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5" />
            オレオレ詐欺対策
          </span>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            ご家族に、安心していただくために。
          </h2>
          <p className="mt-4 text-base leading-relaxed text-warm-brown/75">
            高齢者をめぐる詐欺被害は深刻です。カヨは「絶対にやらないこと」を厳格に定めて設計しています。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Will do */}
          <GlassCard className="p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <Check className="h-5 w-5 text-emerald-600" strokeWidth={3} />
              </div>
              <h3 className="font-serif text-xl font-medium text-warm-brown">
                カヨは必ずこうします
              </h3>
            </div>
            <ul className="space-y-3">
              {willDo.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-emerald-600"
                    strokeWidth={3}
                  />
                  <span className="text-sm leading-relaxed text-warm-brown/85">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* Won't do */}
          <GlassCard className="p-8">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-200/70">
                <X className="h-5 w-5 text-coral" strokeWidth={3} />
              </div>
              <h3 className="font-serif text-xl font-medium text-warm-brown">
                カヨは絶対にしません
              </h3>
            </div>
            <ul className="space-y-3">
              {wontDo.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <X
                    className="mt-1 h-4 w-4 shrink-0 text-coral"
                    strokeWidth={3}
                  />
                  <span className="text-sm leading-relaxed text-warm-brown/85">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>

      </div>
    </section>
  );
}
