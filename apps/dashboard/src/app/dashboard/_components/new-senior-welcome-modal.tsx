"use client";

import { useEffect, useState } from "react";
import {
  X,
  Heart,
  Check,
  Copy,
  Share2,
  MessageSquare,
  Phone,
  Clock,
  UserPlus,
} from "lucide-react";

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

interface NewSenior {
  id: string;
  name: string;
  schedule: { weekday: string; time: string }[];
}

interface Props {
  /** The newly-created senior the modal is welcoming the buyer about.
   *  Pass null to keep the modal closed. */
  senior: NewSenior | null;
  /** Public Kayo number, already E.164 (e.g. "+13853242215"). */
  kayoPhone: string;
  onClose: () => void;
}

/**
 * One-shot welcome modal shown right after a new senior is added.
 *
 * Goals (in priority order):
 *   1. Reduce the "knock-knock, who's there?" risk on the first call —
 *      the senior has to KNOW the number is カヨ before the phone rings
 *      or they may not pick up / may suspect a scam.
 *   2. Give the buyer one ready-to-send message they can paste / share
 *      to LINE so they don't have to compose anything from scratch.
 *   3. Surface the vCard share link in the same moment so saving the
 *      number is a single tap on the senior's side.
 *
 * Dismissal is persisted per-senior in localStorage so the modal only
 * fires once per add — re-visits to the dashboard won't nag the buyer.
 */
export function NewSeniorWelcomeModal({ senior, kayoPhone, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (!senior) return;
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, [senior]);

  // Lock body scroll while the modal is open. (Plain CSS is fine here —
  // we don't have a focus-trap library and the modal is short-lived.)
  useEffect(() => {
    if (!senior) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [senior]);

  if (!senior) return null;

  const scheduleLine = summarizeSchedule(senior);
  const phoneDisplay = formatPhone(kayoPhone);
  const contactLink = origin ? `${origin}/contact?openExternalBrowser=1` : "";

  const messageTemplate = buildMessage({
    seniorName: senior.name,
    scheduleLine,
    phoneDisplay,
    contactLink,
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("メッセージをコピーしてください:", messageTemplate);
    }
  };

  const handleShare = async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: `${senior.name}さんへのお知らせ`,
        text: messageTemplate,
      });
    } catch {
      // user cancelled — no-op
    }
  };

  // SMS deep-link with the full template prefilled in the body.
  const smsHref = `sms:?body=${encodeURIComponent(messageTemplate)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-warm-brown/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-senior-welcome-title"
    >
      <div className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-rose-200/70 bg-cream shadow-[0_30px_80px_-20px_rgba(232,93,93,0.35)]">
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-coral via-rose-400 to-warm-orange px-6 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-2xl"
          />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-md">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
                次のステップ
              </div>
              <h2
                id="new-senior-welcome-title"
                className="mt-0.5 font-serif text-xl font-medium leading-snug"
              >
                {senior.name}さんに、これからのことを伝えましょう
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm leading-relaxed text-warm-brown/85">
            「知らない番号からの電話」と{senior.name}さんが不安にならないよう、
            <strong className="text-warm-brown">最初の通話の前に</strong>
            、下のメッセージをLINEやSMSで送っておきましょう。
          </p>

          {/* Pretty-printed reminders so the buyer sees the actual data
              they're about to share to their parent. */}
          <div className="space-y-3 rounded-2xl bg-white/80 p-4 ring-1 ring-rose-200/60">
            <div className="flex items-center gap-2 text-sm text-warm-brown">
              <Clock className="h-4 w-4 text-coral" />
              <span>
                通話のお時間：
                <strong>{scheduleLine}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-warm-brown">
              <Phone className="h-4 w-4 text-coral" />
              <span>
                電話番号：
                <strong className="font-mono">{phoneDisplay || "未設定"}</strong>
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm text-warm-brown">
              <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              <span>連絡先登録リンクも一緒に送れます</span>
            </div>
          </div>

          {/* Message preview — purely informational, not editable. Kept
              compact (max-h + scroll) so the modal stays in the
              viewport on phones. */}
          <div>
            <div className="mb-2 text-xs font-semibold text-warm-brown/85">
              送信メッセージのプレビュー
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl border border-rose-300/40 bg-white/60 px-4 py-3 font-sans text-[13px] leading-relaxed text-warm-brown/90">
              {messageTemplate}
            </pre>
          </div>

          {/* Share actions. Same three-button set as the home dashboard's
              ContactCardShare, but here the share content is the full
              message template (not just the URL). */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-coral to-warm-orange px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-coral/30 transition-transform active:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> コピーしました
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> メッセージをコピー
                </>
              )}
            </button>
            {canNativeShare && (
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-coral/40 bg-white px-4 py-2.5 text-sm font-semibold text-coral transition-colors hover:bg-rose-50"
              >
                <Share2 className="h-4 w-4" /> シェア
              </button>
            )}
            <a
              href={smsHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-coral/40 bg-white px-4 py-2.5 text-sm font-semibold text-coral transition-colors hover:bg-rose-50"
            >
              <MessageSquare className="h-4 w-4" /> SMSで送る
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="block w-full rounded-full border border-rose-300/40 bg-white/60 py-2.5 text-center text-sm font-medium text-warm-brown/70 transition-colors hover:bg-white"
          >
            あとで送る
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function buildMessage({
  seniorName,
  scheduleLine,
  phoneDisplay,
  contactLink,
}: {
  seniorName: string;
  scheduleLine: string;
  phoneDisplay: string;
  contactLink: string;
}): string {
  return [
    `${seniorName}さんへ`,
    "",
    "これから、AIのおしゃべり相手「カヨ」から定期的にお電話が入ります。",
    "",
    `📅 お電話の時間：${scheduleLine}`,
    `📞 電話番号：${phoneDisplay}`,
    "",
    "「知らない番号」と心配されないよう、上の電話番号を覚えておいてください。",
    "",
    "↓ スマートフォンをお使いなら、下のリンクから連絡先に登録できます",
    contactLink,
    "",
    "※ カヨは「私はAIです」と自分から名乗ります。お金や個人情報のお話は絶対にしません。安心してお話しください。",
  ].join("\n");
}

function summarizeSchedule(senior: NewSenior): string {
  if (!senior.schedule || senior.schedule.length === 0) return "未設定";
  const byTime = new Map<string, string[]>();
  senior.schedule.forEach((s) => {
    const days = byTime.get(s.time) ?? [];
    days.push(WEEKDAY_LABELS[s.weekday] ?? s.weekday);
    byTime.set(s.time, days);
  });
  return Array.from(byTime.entries())
    .map(([time, days]) => `毎週${days.join("・")}曜日 ${time}`)
    .join("、");
}

function formatPhone(e164: string): string {
  if (!e164) return "";
  const cleaned = e164.startsWith("+") ? e164 : `+${e164}`;
  if (/^\+1\d{10}$/.test(cleaned)) {
    const d = cleaned.slice(2);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (/^\+81\d{9,10}$/.test(cleaned)) {
    const d = cleaned.slice(3);
    if (d.length === 10)
      return `+81 ${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `+81 ${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5)}`;
  }
  return cleaned;
}
