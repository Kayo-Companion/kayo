import type { Metadata } from "next";
import { UserPlus, ChevronDown, Smartphone } from "lucide-react";
import { InAppBrowserNotice } from "./_components/in-app-browser-notice";

/**
 * Public landing page for the "Add カヨ to your contacts" link.
 *
 * Why a landing page instead of sharing /api/contact-card directly:
 *   - LINE / Instagram / Facebook open links in an in-app webview that
 *     can't trigger the OS "Add to Contacts" sheet from a raw .vcf
 *     response — the senior would see either blank screen or raw vCard
 *     text and give up.
 *   - This page is rendered as plain HTML, so the webview shows
 *     something sensible. A single big "連絡先に追加する" button
 *     navigates to the .vcf, which DOES work even inside LINE's
 *     webview (it kicks the user out to Contacts on iOS / Android).
 *   - LINE also honors `?openExternalBrowser=1` and routes the link to
 *     Safari / Chrome directly, which is the happiest path.
 *   - Having a landing page also lets the LINE chat preview show a
 *     proper OG title / description / image instead of a raw API URL.
 */
export const metadata: Metadata = {
  title: "カヨの連絡先 — お話相手のAI",
  description:
    "お話相手のAI「カヨ」を電話帳に登録します。下のボタンを押すだけです。",
  openGraph: {
    title: "カヨの連絡先",
    description: "お話相手のAI「カヨ」を電話帳に登録します。",
    type: "website",
  },
  // Prevent indexing — this is intended for direct sharing only.
  robots: { index: false, follow: false },
};

export default function ContactLandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12 sm:py-16">
        <div className="space-y-7 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/40">
              <UserPlus className="h-8 w-8 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
              カヨの連絡先
            </h1>
            <p className="text-base leading-relaxed text-warm-brown/80">
              お話相手のAI「カヨ」を、お電話帳に登録します。
              <br />
              下のボタンを押してください。
            </p>
          </div>

          {/* The big primary action. Using <a download> so iOS Safari /
              Chrome Android prompt with the system "Add to Contacts"
              sheet on tap. On Chrome desktop this saves the .vcf which
              Outlook / Apple Contacts can open. */}
          <a
            href="/api/contact-card?name=%E3%82%AB%E3%83%A8"
            download="カヨ.vcf"
            className="block w-full rounded-3xl bg-gradient-to-r from-coral to-warm-orange px-6 py-5 text-center text-lg font-semibold text-white shadow-xl shadow-coral/30 transition-transform active:scale-[0.99]"
          >
            📲 連絡先に追加する
          </a>

          {/* Cross-platform post-tap guidance + the iOS-specific Quick
              Look trap (left-top "✓ 完了" looks like Save but isn't). */}
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-left">
            <div className="flex items-center gap-2 text-sm font-semibold text-warm-brown">
              <Smartphone className="h-4 w-4 text-amber-600" /> ボタンを押した後
            </div>
            <p className="mt-2 text-xs leading-relaxed text-warm-brown/90">
              連絡先の画面が表示されたら、
              <strong className="text-coral">「新規連絡先を作成」</strong>
              または
              <strong className="text-coral">「保存」</strong>
              をタップしてください。
            </p>

            {/* iPhone-specific warning. iOS Safari opens a Quick Look
                preview where the top-left ✓ is "Done" (close), not
                "Save" — this has tripped up every iOS tester. */}
            <div className="mt-3 rounded-xl border border-coral/40 bg-rose-50/80 p-3">
              <div className="text-[11px] font-semibold text-coral">
                ⚠️ iPhoneをお使いの方へ
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-warm-brown/85">
                左上の <strong>「✓ 完了」</strong> を押すだけだと保存されません。
                画面を <ChevronDown className="inline h-3 w-3 text-coral" />
                下にスクロールして、
                <strong>「新規連絡先を作成」</strong>
                を押してください。
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-warm-gray">
            登録が完了すると、カヨから電話が来た時に「カヨ」と表示されます。
          </p>

          <InAppBrowserNotice />
        </div>

        <footer className="mt-12 text-center text-[11px] text-warm-gray">
          AI会話サービス カヨ
        </footer>
      </div>
    </main>
  );
}
