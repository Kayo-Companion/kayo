import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "サービス",
    links: [
      { label: "料金", href: "#pricing" },
      { label: "よくある質問", href: "#faq" },
      { label: "お問い合わせ", href: "mailto:snakatani0401@gmail.com" },
    ],
  },
  {
    title: "安全について",
    links: [
      { label: "オレオレ詐欺対策", href: "#safety" },
      { label: "プライバシー方針", href: "/privacy" },
      { label: "セキュリティ", href: "/security" },
    ],
  },
  {
    title: "会社",
    links: [
      { label: "運営会社", href: "/about" },
      { label: "ニュース", href: "/news" },
      { label: "採用情報", href: "/careers" },
    ],
  },
  {
    title: "法務",
    links: [
      { label: "利用規約", href: "/terms" },
      { label: "特定商取引法に基づく表記", href: "/legal" },
      { label: "プライバシーポリシー", href: "/privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rose-200/50 bg-gradient-to-b from-cream to-peach-200/40 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo-mark.png"
                alt="カヨ"
                width={36}
                height={36}
                className="h-9 w-9"
              />
              <span className="font-serif text-xl font-medium tracking-tight text-warm-brown">
                カヨ
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-warm-gray">
              シニアとご家族のための、
              <br />
              毎日の電話AIコンパニオン。
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-warm-gray">
                {col.title}
              </div>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-warm-brown/75 transition-colors hover:text-coral"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-rose-200/50 pt-6 sm:flex-row sm:items-center">
          <div className="text-xs text-warm-gray">
            © 2026 Kayo Inc. All rights reserved.
          </div>
          <div className="text-xs text-warm-gray">
            お問い合わせ:{" "}
            <a
              href="mailto:snakatani0401@gmail.com"
              className="hover:text-coral"
            >
              snakatani0401@gmail.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
