import { ArrowRight, Star, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-cream py-24 md:py-28">
      {/* Photo background — almost fully visible, softly tinted into our palette */}
      <div
        className="absolute inset-0 z-0 bg-[url('/hero-couple.jpg')] bg-cover bg-center"
        style={{
          filter: "saturate(0.85) contrast(0.95)",
        }}
      />
      {/* Translucent warm gradient wash so the people show through but the
          page still feels pink/peach, like Meela. */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-gradient-to-br from-cream/85 via-peach/60 to-rose-200/75"
      />
      {/* Subtle radial highlight from top — adds the airy "sun" feeling */}
      <div
        aria-hidden
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,232,214,0.55) 0%, transparent 70%)",
        }}
      />

      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-10 z-0 h-96 w-96 rounded-full bg-rose-300/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 z-0 h-96 w-96 rounded-full bg-warm-orange/20 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-8">
          {/* Heading */}
          <h1
            className="animate-fade-in delay-200 font-serif text-[2.75rem] font-medium leading-[1.15] tracking-tight text-warm-brown sm:text-6xl lg:text-[5rem] lg:leading-[1.05]"
            style={{ fontFeatureSettings: '"palt"', wordBreak: "keep-all" }}
          >
            <span className="block">
              ご両親の
              <span className="bg-gradient-to-br from-coral via-rose-400 to-warm-orange bg-clip-text text-transparent">
                脳の健康
              </span>
              、
            </span>
            <span className="block">今のうちから。</span>
          </h1>

          {/* Description */}
          <p className="animate-fade-in delay-300 max-w-2xl text-base leading-relaxed text-warm-brown/80 md:text-lg">
            ご両親の認知機能の維持を、毎日の習慣に。
            <br />
            楽しいことば遊びと会話の中に、認知症対策を自然に組み込みました。
            <br />
            変化があれば、ご家族が一番早く気づけるように。
          </p>

          {/* CTA */}
          <div className="animate-fade-in delay-400 pt-2">
            <Link href="/sign-up">
              <Button variant="primary" size="lg" className="group">
                今すぐはじめる
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* Trust micro row */}
          <div className="animate-fade-in delay-500 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-xs text-warm-gray">
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-warm-orange text-warm-orange" />
              <span>4.8 ご家族評価</span>
            </span>
            <span className="text-rose-300">・</span>
            <span>初月7日間無料</span>
            <span className="text-rose-300">・</span>
            <span>いつでも解約OK</span>
            <span className="text-rose-300">・</span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-coral" />
              オレオレ詐欺対策設計
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
