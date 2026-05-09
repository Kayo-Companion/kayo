import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:top-6">
      <div className="pointer-events-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 rounded-full border border-rose-200/60 bg-white/85 pl-4 pr-2 shadow-[0_8px_30px_-10px_rgba(232,93,93,0.2)] backdrop-blur-xl md:pl-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-coral to-warm-orange shadow-sm shadow-coral/40">
            <span className="font-serif text-sm font-bold text-white">カ</span>
          </div>
          <span className="font-serif text-lg font-medium tracking-tight text-warm-brown">
            カヨ
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="#how-it-works"
            className="text-sm text-warm-brown/80 transition-colors hover:text-coral"
          >
            使い方
          </a>
          <a
            href="#research"
            className="text-sm text-warm-brown/80 transition-colors hover:text-coral"
          >
            科学的裏付け
          </a>
          <a
            href="#safety"
            className="text-sm text-warm-brown/80 transition-colors hover:text-coral"
          >
            安全設計
          </a>
          <a
            href="#pricing"
            className="text-sm text-warm-brown/80 transition-colors hover:text-coral"
          >
            料金
          </a>
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-full bg-warm-brown px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-warm-brown/90 active:scale-[0.97]"
            >
              はじめる
            </Link>
            <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-200 px-2.5 py-0.5 text-[10px] font-semibold text-coral shadow-sm">
              7日間無料
            </span>
          </div>
          <Link
            href="/sign-in"
            className="hidden px-3 text-sm font-medium text-warm-brown/80 underline-offset-4 transition-colors hover:text-coral hover:underline sm:inline-block"
          >
            ログイン
          </Link>
        </div>
      </div>
    </header>
  );
}
