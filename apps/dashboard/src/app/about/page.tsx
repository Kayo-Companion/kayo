import type { Metadata } from "next";
import Image from "next/image";
import { Mail } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GlassCard } from "@/components/ui/glass-card";

export const metadata: Metadata = {
  title: "運営会社について",
  description:
    "カヨを運営する代表者・中谷マーク駿介と、サービスを立ち上げた背景について。",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-cream">
      <SiteHeader />

      <section className="relative w-full overflow-hidden bg-gradient-to-b from-cream via-peach-200/40 to-cream pt-32 pb-20 md:pt-40 md:pb-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-rose-300/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-warm-orange/15 blur-3xl"
        />

        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
              運営会社について
            </span>
            <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
              カヨは、おばあちゃんから始まりました。
            </h1>
          </div>

          <GlassCard className="p-8 md:p-10">
            {/* Representative */}
            <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-4 ring-rose-200/60 shadow-lg shadow-rose-300/30 sm:h-32 sm:w-32">
                <Image
                  src="/mark-photo.jpg"
                  alt="中谷 マーク 駿介"
                  fill
                  sizes="(min-width: 640px) 128px, 112px"
                  className="object-cover"
                  style={{ objectPosition: "center 22%" }}
                  priority
                />
              </div>
              <div className="text-center sm:text-left">
                <div className="text-xs font-semibold tracking-wide text-coral">
                  代表者
                </div>
                <div className="font-serif text-2xl font-medium text-warm-brown sm:text-3xl">
                  中谷 マーク 駿介
                </div>
              </div>
            </div>

            <div className="mb-8 h-px w-full bg-rose-200/60" />

            {/* Story */}
            <div className="space-y-5 text-base leading-relaxed text-warm-brown/85">
              <p>
                きっかけは、自分のおばあちゃんでした。
              </p>
              <p>
                足が悪くなって外に出る機会が減り、だんだんと寂しさを口にすることが増えていきました。
                少しでも力になりたくて、当時話題だったAIサービスのアプリをインストールして渡してみたのですが、アプリの操作はおばあちゃんには難しすぎて、結局使えずじまいでした。
              </p>
              <p>
                「もっと当たり前のもの──電話でAIと話せたら、おばあちゃんでも使えるんじゃないか」。
                そう思ったのが、カヨを立ち上げた出発点です。
              </p>
              <p>
                スマートフォンや新しい機器を覚える必要はありません。
                受話器を取るだけで、毎日の話し相手になる。アプリでもチャットでもなく、シニアの方が一番慣れ親しんだ「電話」というインターフェースで届けることに決めました。
              </p>
              <p>
                過去にはアメリカでブロックチェーン関連の会社を起業した経験があります。
                その時に培った技術と、家族と過ごした時間。両方を活かして、離れて暮らすご家族にとっての「もう一つの優しい声」を作っていきます。
              </p>
            </div>

            <div className="mt-10 border-t border-rose-200/60 pt-6">
              <div className="flex items-start gap-3 text-sm text-warm-brown/80">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <div>
                  <div className="text-xs font-semibold tracking-wide text-warm-gray">
                    お問い合わせ
                  </div>
                  <a
                    href="mailto:snakatani0401@gmail.com"
                    className="font-medium text-warm-brown hover:text-coral"
                  >
                    snakatani0401@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
