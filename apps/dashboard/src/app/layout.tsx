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

export const metadata: Metadata = {
  title: "カヨ｜大切な人に、毎日のお話し相手を。",
  description:
    "カヨはシニア向けAI電話コンパニオン。毎日決まった時間にお電話で会話。アプリも新しい機械もいりません。月額3,980円。",
  openGraph: {
    title: "カヨ｜大切な人に、毎日のお話し相手を。",
    description:
      "毎日決まった時間にカヨから電話します。電話に出るだけで会話できます。",
    type: "website",
    locale: "ja_JP",
  },
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
