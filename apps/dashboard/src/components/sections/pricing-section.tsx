import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

interface Tier {
  id: "light" | "standard" | "premium";
  name: string;
  price: number;
  minutes: number;
  highlight?: boolean;
  pitch: string;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: "light",
    name: "ライト",
    price: 3980,
    minutes: 100,
    pitch: "週に数回、軽くおしゃべり",
    features: [
      "毎月100分まで通話",
      "ご家族を複数人ご登録可能",
      "通話履歴と自動要約",
      "気になる発言の家族通知",
      "オレオレ詐欺対策の安全設計",
    ],
  },
  {
    id: "standard",
    name: "スタンダード",
    price: 9800,
    minutes: 400,
    highlight: true,
    pitch: "気が向いた時にいつでもおしゃべり",
    features: [
      "毎月400分まで通話",
      "ご家族を複数人ご登録可能",
      "通話履歴と自動要約",
      "気になる発言の家族通知",
      "オレオレ詐欺対策の安全設計",
    ],
  },
  {
    id: "premium",
    name: "プレミアム",
    price: 19800,
    minutes: 1000,
    pitch: "ご家族複数 ・ じっくりお話したい方",
    features: [
      "毎月1,000分まで通話",
      "複数のご家族へ同時にお電話可能",
      "通話履歴と自動要約",
      "気になる発言の家族通知",
      "優先サポート",
      "オレオレ詐欺対策の安全設計",
    ],
  },
];

export function PricingSection() {
  return (
    <section className="relative w-full overflow-hidden bg-cream py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-300/30 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
            料金
          </span>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            お話の量で選べる、3つのプラン。
          </h2>
          <p className="mt-4 text-base text-warm-brown/70">
            足りなくなったら、100分パック ¥2,500 で追加もできます。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-warm-gray">
          全プラン共通：初月7日間無料・いつでも解約OK・クレジットカード決済
        </p>
      </div>
    </section>
  );
}

function PricingCard({ tier }: { tier: Tier }) {
  const isHighlight = tier.highlight;
  return (
    <GlassCard
      className={`relative p-7 transition-transform hover:-translate-y-1 ${
        isHighlight ? "ring-2 ring-coral shadow-[0_30px_70px_-20px_rgba(232,93,93,0.35)]" : ""
      }`}
      intensity={isHighlight ? "strong" : "medium"}
    >
      {isHighlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-coral to-warm-orange px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-coral/40">
          人気
        </div>
      )}

      <div className="mb-1 text-sm font-semibold text-coral">{tier.name}</div>
      <div className="mb-1 text-xs text-warm-gray">{tier.pitch}</div>

      <div className="mb-1 mt-4 font-serif text-5xl font-medium text-warm-brown">
        <span className="text-2xl text-warm-gray">¥</span>
        {tier.price.toLocaleString()}
        <span className="text-sm font-normal text-warm-gray"> / 月</span>
      </div>
      <div className="mb-6 text-sm text-warm-gray">
        毎月 {tier.minutes.toLocaleString()}分
      </div>

      <div className="mb-6 h-px w-full bg-rose-200/60" />

      <ul className="mb-7 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-coral to-warm-orange">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </div>
            <span className="text-sm leading-relaxed text-warm-brown">{f}</span>
          </li>
        ))}
      </ul>

      <Link href={`/sign-up?plan=${tier.id}`} className="block">
        <Button
          variant={isHighlight ? "primary" : "secondary"}
          size="md"
          className="group w-full"
        >
          このプランで始める
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </Link>
    </GlassCard>
  );
}
