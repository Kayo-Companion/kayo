import { Heart, Gift, ArrowRight } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-rose-300/50 bg-white/70 px-3 py-1 text-xs font-medium text-warm-brown">
    {children}
  </span>
);

export function ForWhomSection() {
  return (
    <section className="relative w-full bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
            2つの使い方
          </span>
          <h2 className="font-serif text-3xl font-medium tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            カヨは、こんなふうに使えます。
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-warm-brown/70">
            自分のためにも、大切な人へのプレゼントとしても。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 自分のために */}
          <GlassCard className="group p-8 transition-transform hover:-translate-y-1">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-300 to-rose-400 shadow-lg shadow-rose-300/50">
              <Heart className="h-7 w-7 text-white" />
            </div>
            <h3 className="mb-2 font-serif text-2xl font-medium text-warm-brown">
              自分のために
            </h3>
            <p className="mb-5 leading-relaxed text-warm-brown/75">
              毎日5分、心が軽くなる時間を。
              <br />
              一人暮らしでも、家族と離れていても、カヨが話し相手になります。
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip>単身世帯</Chip>
              <Chip>自分のペースで</Chip>
              <Chip>話し相手がほしい</Chip>
            </div>
          </GlassCard>

          {/* 大切な人に贈る */}
          <GlassCard className="group p-8 transition-transform hover:-translate-y-1">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/50">
              <Gift className="h-7 w-7 text-white" />
            </div>
            <h3 className="mb-2 font-serif text-2xl font-medium text-warm-brown">
              大切な人に贈る
            </h3>
            <p className="mb-5 leading-relaxed text-warm-brown/75">
              離れて暮らすご両親・祖父母に。
              <br />
              あなたが申し込んで、カヨから毎日お電話します。通話の様子はダッシュボードで確認できます。
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip>親の見守り</Chip>
              <Chip>毎日の通話履歴</Chip>
              <Chip>気になる発言を通知</Chip>
            </div>
          </GlassCard>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-coral transition-colors hover:text-coral-600"
          >
            どちらもサインアップで選べます
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
