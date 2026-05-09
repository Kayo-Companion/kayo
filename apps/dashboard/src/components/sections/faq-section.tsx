"use client";

import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "本当にAIが話すんですか？人間ではないんですか？",
    a: "はい、カヨは人工知能（AI）です。最新の音声AI技術を使い、本物の人と話しているような自然な会話ができます。ただし、私たちは初回の通話で必ず「お話相手のAI、カヨです」と説明し、人間のふりをすることはありません。",
  },
  {
    q: "詐欺だと思って親が電話に出てくれない場合は？",
    a: "ご家族から事前に親御さんへ「カヨという話し相手のサービスを申し込んだ」とお伝えください。最初の電話でカヨは「お孫さんの〇〇さんからのご紹介でお電話しました」と必ず名乗ります。また、お金や個人情報を聞き出すことは絶対にしません。",
  },
  {
    q: "認知症の祖父・祖母でも使えますか？",
    a: "軽度認知障害（MCI）の方には、毎日の会話介入が認知機能の改善に有効であることが米国NIHの臨床試験で示されています（I-CONECT研究）。重度の認知症の方には個別の対応が必要なので、お問い合わせフォームからご相談ください。",
  },
  {
    q: "解約方法は？",
    a: "ダッシュボードから1クリックでいつでも解約できます。違約金や面倒な手続きは一切ありません。初月7日間は無料でお試しいただけます。",
  },
  {
    q: "通話料金はかかりますか？",
    a: "かかりません。月額3,980円にすべて含まれています。固定電話・携帯電話どちらでも追加料金なしでご利用いただけます。",
  },
  {
    q: "通話の内容は誰が聞けますか？プライバシーは大丈夫？",
    a: "通話内容（テキスト要約）はサインアップしたご家族のアカウントだけが閲覧できます。第三者への共有や広告利用は一切ありません。データは暗号化され、日本国内のサーバーで管理されています。",
  },
  {
    q: "毎日の電話の時間は変えられますか？",
    a: "はい。ダッシュボードから時刻を自由に変更できます。朝の時間帯がご都合悪い日は1日だけスキップすることもできます。",
  },
  {
    q: "電話に出られなかったときはどうなりますか？",
    a: "5分後に1回、さらに30分後にもう1回、自動で再発信します。それでも繋がらない場合は「またお電話します」とSMSをお送りし、ご家族のダッシュボードに「不在」として記録されます。",
  },
  {
    q: "緊急時はどう対応してくれますか？",
    a: "「具合が悪い」「胸が苦しい」など、健康上の異常を察知した場合は即座にご家族へSMSで通知します。カヨ自身も「ご家族か救急車をお呼びください」と促します。",
  },
  {
    q: "海外に住んでいる家族でも申し込めますか？",
    a: "はい、申し込めます。ダッシュボードはWebブラウザから世界中どこからでもアクセスできます。決済も日本のクレジットカードに加え、主要な海外カードに対応しています。",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative w-full bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-block rounded-full bg-rose-200/60 px-4 py-1.5 text-xs font-semibold tracking-wide text-coral">
            よくあるご質問
          </span>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-warm-brown sm:text-4xl md:text-5xl">
            気になることに、全部お答えします。
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div
                key={i}
                className={cn(
                  "overflow-hidden rounded-2xl border border-rose-300/40 bg-white/70 backdrop-blur-md transition-all",
                  open && "border-coral/40 shadow-[0_8px_30px_-10px_rgba(232,93,93,0.18)]"
                )}
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/50"
                  aria-expanded={open}
                >
                  <span className="font-medium text-warm-brown">{faq.q}</span>
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                      open
                        ? "bg-coral text-white"
                        : "bg-rose-200/70 text-coral"
                    )}
                  >
                    {open ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </div>
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300",
                    open
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-warm-brown/80">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
