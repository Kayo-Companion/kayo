"use client";

import { useEffect, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Compact share-row attached to the home dashboard's "カヨの電話番号" card.
 *
 * Two buttons:
 *   - シェア          (Web Share API on mobile; on desktop falls back to
 *                     copying the link to the clipboard so we never
 *                     render an inert button)
 *   - 自分の端末で開く (direct .vcf download for the buyer's own phone)
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
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [origin, setOrigin] = useState("");

  // Origin must be read client-side so the URL we share is the actual
  // visible host (kayo.chat, localhost:3456, etc.) — not a build-time
  // env var that may be stale across previews.
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  // Share the LANDING PAGE, not the raw .vcf:
  //   - LINE in-app browser can't trigger Contacts on a raw .vcf
  //     response but renders a normal HTML page fine.
  //   - The ?openExternalBrowser=1 param tells LINE to open the URL
  //     in Safari / Chrome instead of its in-app webview — happy path.
  //   - The landing page has a big "連絡先に追加する" button that
  //     navigates to the .vcf, which is where Contacts actually
  //     hooks in.
  // Direct .vcf download (the "self" button below) still points at
  // /api/contact-card so the buyer can grab the file on their own
  // device without bouncing through the landing page.
  const landingPath = "/contact?openExternalBrowser=1";
  const vcfPath = `/api/contact-card?name=${encodeURIComponent("カヨ")}`;
  const shareUrl = origin ? `${origin}${landingPath}` : "";
  const vcfUrl = origin ? `${origin}${vcfPath}` : "";

  /**
   * One unified "share" affordance:
   *   - Mobile (Web Share API present): open the native share sheet
   *     so the buyer can pick LINE / SMS / Mail / copy in one tap.
   *   - Desktop (no Web Share API): copy the URL to the clipboard so
   *     the buyer can paste it into whichever app they're already in.
   */
  const handleShare = async () => {
    if (!shareUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "カヨの連絡先",
          text: "お話相手AI「カヨ」を連絡先に追加してください。",
          url: shareUrl,
        });
      } catch {
        // User cancelled — no-op.
      }
      return;
    }
    // Desktop fallback.
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("リンクをコピーしてください:", shareUrl);
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
        <Button variant="primary" size="sm" onClick={handleShare}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> コピーしました
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />{" "}
              {canNativeShare ? "シェア" : "リンクをコピー"}
            </>
          )}
        </Button>
        {vcfUrl && (
          <a href={vcfUrl} download="カヨ.vcf" target="_blank" rel="noopener">
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" /> 自分の端末で開く
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
