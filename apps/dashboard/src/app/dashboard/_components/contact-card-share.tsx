"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, MessageSquare, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Compact share-row attached to the home dashboard's "カヨの電話番号" card.
 *
 * Three thingsthe buyer can do with one click:
 *   - Copy the .vcf link (works anywhere)
 *   - Native Web Share sheet (mobile only — feature-detected so we
 *     don't render a button that throws on desktop)
 *   - Send an SMS with a pre-filled body
 *
 * "カヨ" is hard-coded as the display name. Per-senior agent_name
 * customisation is deliberately not used here — the goal is to put a
 * universal "register Kayo" entry in seniors' phonebooks, and a single
 * canonical name makes the on-screen UI / phone-call mapping easier to
 * explain. Buyers who renamed the agent can still rename the contact
 * locally after import.
 */
export function ContactCardShare() {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [origin, setOrigin] = useState("");

  // Origin must be read client-side so the URL we share is the actual
  // visible host (kayo.chat, localhost:3456, etc.) — not a build-time
  // env var that may be stale across previews.
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator.share === "function");
  }, []);

  const shareUrl = origin ? `${origin}/api/contact-card?name=${encodeURIComponent("カヨ")}` : "";
  const smsBody = `お話相手AIの「カヨ」の連絡先です。下のリンクをタップして「追加」を押すと、電話帳に登録できます。\n${shareUrl}`;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("リンクをコピーしてください:", shareUrl);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "カヨの連絡先",
        text: "お話相手AI「カヨ」を連絡先に追加してください。",
        url: shareUrl,
      });
    } catch {
      // User cancelled — no-op.
    }
  };

  return (
    <div className="space-y-2 border-t border-rose-300/30 pt-3">
      <div className="text-xs font-semibold text-warm-brown/85">
        ご家族の電話帳に登録してもらう
      </div>
      <p className="text-[11px] leading-relaxed text-warm-gray">
        この連絡先を一度登録しておくと、「知らない番号からの電話」と
        間違われずに安心してお話しできます。
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> コピーしました
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> リンクをコピー
            </>
          )}
        </Button>
        {canShare && (
          <Button variant="secondary" size="sm" onClick={handleNativeShare}>
            <Share2 className="h-3.5 w-3.5" /> シェア
          </Button>
        )}
        <a href={`sms:?body=${encodeURIComponent(smsBody)}`}>
          <Button variant="secondary" size="sm">
            <MessageSquare className="h-3.5 w-3.5" /> SMSで送る
          </Button>
        </a>
        {shareUrl && (
          <a href={shareUrl} download="カヨ.vcf" target="_blank" rel="noopener">
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" /> 自分の端末で開く
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
