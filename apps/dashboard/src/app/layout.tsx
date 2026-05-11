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
const DEFAULT_TITLE = "カヨ｜大切な人に、毎日のお話し相手を。";
const DEFAULT_DESCRIPTION =
  "カヨはシニア向けAI電話コンパニオン。毎日決まった時間に、優しい話し相手から固定電話または携帯電話へお電話します。アプリも新しい機器もいりません。月額3,980円から、初月7日間無料。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s｜${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "高齢者 電話",
    "シニア AI",
    "親 見守り",
    "認知症 予防",
    "話し相手 サービス",
    "オレオレ詐欺 対策",
    "AI コンパニオン",
    "高齢者 孤独",
    "離れて暮らす親",
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
      "毎日決まった時間にカヨから電話します。電話に出るだけで会話できる、シニア向けAI話し相手サービス。",
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
      "毎日決まった時間にカヨから電話します。電話に出るだけで会話できる、シニア向けAI話し相手サービス。",
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
