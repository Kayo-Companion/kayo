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
    icon: Brain,
    title: "認知症対策・脳の体操",
    body: "しりとり、なぞなぞ、思い出話。楽しい会話の中に、認知機能の維持につながる脳の体操を自然に組み込みます。",
    examples: [
      "ことば遊び・回想法・連想ゲーム",
      "ご本人のペースで毎日続けられる",
      "米国NIH・I-CONECT研究でも会話介入の効果が示唆",
    ],
    gradient: "from-violet-300 to-violet-500",
    shadow: "shadow-violet-300/50",
  },
  {
    icon: ShieldCheck,
    title: "ご家族の早期の気づき",
    body: "毎日の会話の様子をご家族のダッシュボードで確認。気になる変化があれば、いち早く気づけるようサポートします。",
    examples: [
      "会話の活発さ・言葉の豊かさを記録",
      "応答なし／気になる発言を自動通知",
      "もしもの時に医療機関への相談につなぐ",
    ],
    gradient: "from-emerald-300 to-emerald-500",
    shadow: "shadow-emerald-300/50",
  },
  {
    icon: MessageCircle,
    title: "毎日の楽しい習慣に",
    body: "季節の話、思い出話、孫の話。ご本人が楽しめる時間だからこそ、無理なく毎日続く健康習慣になります。",
    examples: [
      "ご本人のペースに合わせた自然な会話",
      "テストではなく『楽しい時間』として続く",
      "ご家族との会話のきっかけにも",
    ],
    gradient: "from-rose-300 to-coral",
    shadow: "shadow-rose-300/50",
  },
  {
    icon: Lightbulb,
    title: "暮らしのアシスタント",
    body: "わからないことや、ちょっとした調べごとを電話で気軽に。スマホやパソコンが苦手でも、話すだけで使えます。",
    examples: [
      "「今日の天気は？」",
      "「この薬、いつ飲むんだっけ」",
      "「孫の誕生日、何を贈ろう」",
    ],
    gradient: "from-amber-300 to-warm-orange",
    shadow: "shadow-amber-300/50",
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
            カヨは、認知症対策をこう支えます。
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-warm-brown/70">
            楽しい毎日の習慣として、ご両親の脳の健康とご家族の安心を。
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
