"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Detects common in-app webviews and shows a friendly fallback notice.
 *
 * The shared link includes `?openExternalBrowser=1`, which LINE honors
 * by opening the URL in Safari / Chrome instead of its in-app browser.
 * But that only fires when LINE itself processes the tap — older LINE
 * versions, redirects, or pasted links may still land us inside the
 * webview, where the "Add to Contacts" download flow is unreliable.
 *
 * In that case we show a banner explaining how to open the page in the
 * external browser. No magic — webviews don't expose a "exit me"
 * API — so the user has to use the in-app menu manually.
 */
export function InAppBrowserNotice() {
  const [inApp, setInApp] = useState<"line" | "fb" | "ig" | "other" | null>(
    null
  );

  useEffect(() => {
    const ua = navigator.userAgent;
    // LINE webview signature: "Line/12.x.x" anywhere in UA
    if (/Line\//i.test(ua)) {
      setInApp("line");
      return;
    }
    // Facebook
    if (/(FBAN|FBAV)/i.test(ua)) {
      setInApp("fb");
      return;
    }
    // Instagram
    if (/Instagram/i.test(ua)) {
      setInApp("ig");
      return;
    }
    // Other catch-all heuristics: missing Safari token on iOS = webview
    // (excluding Chrome, which has CriOS). Skip strict detection here to
    // avoid false positives on legitimate Chrome / Edge / etc.
  }, []);

  if (!inApp) return null;

  const appName =
    inApp === "line" ? "LINE" : inApp === "fb" ? "Facebook" : inApp === "ig" ? "Instagram" : "アプリ";

  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/90 p-4 text-left">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          strokeWidth={2.2}
        />
        <div className="text-sm leading-relaxed text-warm-brown/90">
          <div className="font-semibold text-warm-brown">
            {appName}の中で開いているようです
          </div>
          <p className="mt-1 text-xs">
            このまま「連絡先に追加する」を押してもうまくいかない場合は、
            右上の「⋯」または「⋮」メニューから
            <strong className="text-warm-brown">
              「Safariで開く」または「Chromeで開く」
            </strong>
            を選んでから、もう一度ボタンを押してください。
          </p>
        </div>
      </div>
    </div>
  );
}
