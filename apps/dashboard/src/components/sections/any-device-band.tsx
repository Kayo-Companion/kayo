import { Phone, Smartphone, PhoneCall, Check } from "lucide-react";

const DEVICES = [
  {
    icon: Phone,
    label: "固定電話",
    note: "おうちの黒電話でも",
  },
  {
    icon: Smartphone,
    label: "スマートフォン",
    note: "iPhone・Android",
  },
  {
    icon: PhoneCall,
    label: "ガラケー",
    note: "従来の携帯電話でも",
  },
];

export function AnyDeviceBand() {
  return (
    <section className="relative w-full overflow-hidden bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-rose-200/60 bg-white/80 p-8 shadow-[0_20px_60px_-20px_rgba(232,93,93,0.18)] backdrop-blur-xl md:p-12">
          {/* Decorative blob */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full bg-rose-200/40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-warm-orange/20 blur-3xl"
          />

          <div className="relative z-10 grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-rose-200/60 px-3 py-1 text-[11px] font-semibold tracking-wide text-coral">
                <Check className="h-3.5 w-3.5" />
                アプリ・新しい機器いりません
              </div>
              <h2 className="font-serif text-2xl font-medium leading-tight tracking-tight text-warm-brown sm:text-3xl md:text-4xl">
                どんな電話でも、
                <br className="hidden sm:block" />
                そのまま使えます。
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-warm-brown/75 md:text-base">
                今お使いの電話番号にカヨからお電話します。
                <br />
                受話器を取るだけ。難しい設定は一切ありません。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 md:gap-4">
              {DEVICES.map(({ icon: Icon, label, note }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-2xl border border-rose-200/60 bg-gradient-to-br from-white to-peach-200/40 p-4 text-center shadow-sm md:p-5"
                >
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-coral/15 to-warm-orange/15 ring-1 ring-rose-300/40 md:h-14 md:w-14">
                    <Icon className="h-6 w-6 text-coral md:h-7 md:w-7" />
                  </div>
                  <div className="text-sm font-semibold text-warm-brown md:text-base">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-warm-gray md:text-xs">
                    {note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
