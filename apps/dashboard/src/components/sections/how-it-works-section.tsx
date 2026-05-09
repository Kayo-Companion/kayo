import { UserPlus, Settings2, PhoneCall } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "申し込む",
    description:
      "オンライン3分。お使いになる方のお名前・電話番号・希望時刻をご登録ください。",
  },
  {
    number: "02",
    icon: Settings2,
    title: "カヨが覚える",
    description:
      "興味のある話題、避けたい話題、紹介者のお名前など、会話のための設定をします。",
  },
  {
    number: "03",
    icon: PhoneCall,
    title: "毎日かかってくる",
    description:
      "決まった時刻にカヨからお電話。電話に出るだけで会話できます。アプリ不要。",
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative w-full bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
            使い方
          </span>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            たった3ステップ。
          </h2>
          <p className="mt-4 text-base text-warm-brown/70">
            申込から数日以内に、カヨから最初のお電話が始まります。
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Connecting line on desktop */}
          <div
            aria-hidden
            className="absolute left-[16%] right-[16%] top-12 hidden h-px bg-gradient-to-r from-transparent via-rose-300/60 to-transparent md:block"
          />

          {steps.map((step) => (
            <GlassCard
              key={step.number}
              className="relative p-7 transition-transform hover:-translate-y-1"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/40">
                  <step.icon className="h-6 w-6 text-white" />
                </div>
                <span className="font-serif text-3xl font-medium text-rose-300">
                  {step.number}
                </span>
              </div>
              <h3 className="mb-2 font-serif text-xl font-medium text-warm-brown">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-warm-brown/75">
                {step.description}
              </p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
