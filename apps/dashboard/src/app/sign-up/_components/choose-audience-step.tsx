"use client";

import { Heart, Gift, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import type { Audience } from "./sign-up-form-step";

export function ChooseAudienceStep({
  onChoose,
}: {
  onChoose: (audience: Audience) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown sm:text-4xl">
          どなたがお使いになりますか？
        </h1>
        <p className="mt-3 text-sm text-warm-brown/70">
          選んでいただくと、登録の項目が変わります。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => onChoose("self")}
          className="group text-left"
        >
          <GlassCard className="p-7 transition-all hover:-translate-y-1 group-hover:border-rose-400/60">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-300 to-rose-400 shadow-lg shadow-rose-300/50">
              <Heart className="h-7 w-7 text-white" />
            </div>
            <h2 className="mb-2 font-serif text-xl font-medium text-warm-brown">
              自分のために
            </h2>
            <p className="text-sm text-warm-brown/75">
              ご自身がお使いになる場合。お名前と電話番号を登録するだけで、明日からカヨから毎日お電話します。
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-coral group-hover:gap-2 transition-all">
              選ぶ <ArrowRight className="h-4 w-4" />
            </div>
          </GlassCard>
        </button>

        <button
          onClick={() => onChoose("family")}
          className="group text-left"
        >
          <GlassCard className="p-7 transition-all hover:-translate-y-1 group-hover:border-coral/60">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/50">
              <Gift className="h-7 w-7 text-white" />
            </div>
            <h2 className="mb-2 font-serif text-xl font-medium text-warm-brown">
              大切な人に贈る
            </h2>
            <p className="text-sm text-warm-brown/75">
              ご両親や祖父母など、大切な方に。あなたが申込者として登録します。
            </p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-coral group-hover:gap-2 transition-all">
              選ぶ <ArrowRight className="h-4 w-4" />
            </div>
          </GlassCard>
        </button>
      </div>

      <p className="text-center text-xs text-warm-gray">
        後から変更することもできます。
      </p>
    </div>
  );
}
