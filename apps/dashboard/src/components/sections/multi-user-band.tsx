import { Users, Plus } from "lucide-react";

export function MultiUserBand() {
  return (
    <section className="relative w-full overflow-hidden bg-cream py-12 md:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-coral via-coral to-warm-orange p-8 shadow-[0_20px_60px_-15px_rgba(232,93,93,0.45)] md:p-12">
          {/* Decorative blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-rose-200/30 blur-3xl"
          />

          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
            {/* Avatar cluster */}
            <div className="flex shrink-0 -space-x-3">
              {[
                { bg: "bg-rose-200", text: "母" },
                { bg: "bg-peach-200", text: "父" },
                { bg: "bg-amber-200", text: "祖" },
                { bg: "bg-white/90", icon: true },
              ].map((a, i) => (
                <div
                  key={i}
                  className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white text-base font-semibold text-coral shadow-md ${a.bg} md:h-14 md:w-14`}
                >
                  {a.icon ? (
                    <Plus className="h-5 w-5 text-coral md:h-6 md:w-6" />
                  ) : (
                    a.text
                  )}
                </div>
              ))}
            </div>

            <div className="flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
                <Users className="h-3.5 w-3.5" />
                一つのお申し込みで
              </div>
              <h2 className="font-serif text-2xl font-medium leading-tight text-white sm:text-3xl md:text-4xl">
                ご家族を、何人でも追加できます。
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90 md:text-base">
                お母様もお父様も、おじいちゃんもおばあちゃんも。
                ダッシュボードから人数を増やすだけで、それぞれにカヨからのお電話が始まります。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
