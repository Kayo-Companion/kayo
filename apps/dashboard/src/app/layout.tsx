import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-serif-jp",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://kayo.me";

const SITE_NAME = "カヨ";
const DEFAULT_TITLE = "カヨ｜ご両親の脳の健康、今のうちから。";
const DEFAULT_DESCRIPTION =
  "カヨは認知症対策に特化したAI電話サービス。楽しいことば遊びと会話の中に認知症対策を自然に組み込み、ご両親の認知機能の維持と、ご家族の早期の気づきをサポートします。アプリ不要、電話のみ。月額3,980円から、初月7日間無料。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s｜${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "認知症 対策",
    "認知症 予防",
    "認知機能 維持",
    "脳の健康",
    "高齢者 電話",
    "シニア AI",
    "親 見守り",
    "認知症 早期発見",
    "MCI 軽度認知障害",
    "離れて暮らす親",
    "オレオレ詐欺 対策",
    "カヨ",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description:
      "ご両親の認知機能の維持を、毎日の習慣に。楽しい会話の中に認知症対策を自然に組み込み、ご家族の早期の気づきをサポート。",
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "/logo-mark.png",
        width: 904,
        height: 733,
        alt: "カヨ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description:
      "ご両親の認知機能の維持を、毎日の習慣に。楽しい会話の中に認知症対策を自然に組み込み、ご家族の早期の気づきをサポート。",
    images: ["/logo-mark.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  category: "lifestyle",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${notoSerifJP.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
