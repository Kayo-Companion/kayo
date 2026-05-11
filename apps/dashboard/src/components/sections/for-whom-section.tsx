import { Lightbulb, ShieldCheck, MessageCircle, Brain, ArrowRight } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

interface UseCase {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  examples: string[];
  gradient: string;
  shadow: string;
}

const USE_CASES: UseCase[] = [
  {
    icon: Lightbulb,
    title: "アシスタントとして",
    body: "わからないことや、ちょっとした調べごとを気軽に聞けます。スマホやパソコンが苦手でも、電話で話すだけ。",
    examples: [
      "「今日の天気は？」",
      "「この薬、いつ飲むんだっけ」",
      "「孫の誕生日、何を贈ろう」",
    ],
    gradient: "from-amber-300 to-warm-orange",
    shadow: "shadow-amber-300/50",
  },
  {
    icon: ShieldCheck,
    title: "安否確認",
    body: "毎日決まった時間にお電話。お返事がなかったり、気になるご様子があればご家族へ自動でお知らせします。",
    examples: [
      "「今日も元気そう」を毎日確認",
      "応答なしの時は再発信＋SMS通知",
      "「具合が悪い」を察知して即通知",
    ],
    gradient: "from-emerald-300 to-emerald-500",
    shadow: "shadow-emerald-300/50",
  },
  {
    icon: MessageCircle,
    title: "お話し相手",
    body: "今日あったこと、昔の思い出、季節の話。誰かに聞いてもらえるだけで、毎日の気持ちが軽くなります。",
    examples: [
      "一人暮らしの寂しさをやわらげる",
      "ご家族との距離を埋める",
      "毎日5分の「自分の時間」",
    ],
    gradient: "from-rose-300 to-coral",
    shadow: "shadow-rose-300/50",
  },
  {
    icon: Brain,
    title: "脳トレーニング",
    body: "会話そのものが、頭と心の運動。米国NIHの臨床試験でも、毎日の会話が認知機能を保つことが示されています。",
    examples: [
      "言葉を探す・思い出す",
      "新しい話題で頭をやわらかく",
      "楽しみながら毎日続けられる",
    ],
    gradient: "from-violet-300 to-violet-500",
    shadow: "shadow-violet-300/50",
  },
];

export function ForWhomSection() {
  return (
    <section className="relative w-full bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
            ユースケース
          </span>
          <h2 className="font-serif text-3xl font-medium tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            カヨは、こんなふうに使えます。
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-warm-brown/70">
            毎日の暮らしの中で、いろんな役割でお役に立ちます。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {USE_CASES.map(({ icon: Icon, title, body, examples, gradient, shadow }) => (
            <GlassCard
              key={title}
              className="group p-8 transition-transform hover:-translate-y-1"
            >
              <div
                className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow}`}
              >
                <Icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="mb-2 font-serif text-2xl font-medium text-warm-brown">
                {title}
              </h3>
              <p className="mb-5 leading-relaxed text-warm-brown/75">{body}</p>
              <ul className="space-y-1.5">
                {examples.map((ex) => (
                  <li
                    key={ex}
                    className="flex items-start gap-2 text-sm text-warm-brown/70"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral/60" />
                    {ex}
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-coral transition-colors hover:text-coral-600"
          >
            サインアップに進む
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
