"use client";

import { useEffect } from "react";
import { X, AlertTriangle, PhoneCall, Phone } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  rawPhone: string;
  displayPhone: string;
}

export function KayoCallWarningModal({
  open,
  onClose,
  rawPhone,
  displayPhone,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const telHref = `tel:${rawPhone.replace(/\s/g, "")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-warm-brown/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-warning-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-amber-300/60 bg-cream shadow-[0_30px_80px_-20px_rgba(245,158,11,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-amber-400 to-warm-orange px-6 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-2xl"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur-md">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
                通話料金にご注意
              </div>
              <h2
                id="call-warning-title"
                className="mt-0.5 font-serif text-xl font-medium leading-snug"
              >
                国際電話料金がかかる可能性があります
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm leading-relaxed text-warm-brown/85">
            カヨは現在<span className="font-semibold text-warm-brown">アメリカの電話番号</span>しか取得できていません。
          </p>
          <p className="text-sm leading-relaxed text-warm-brown/85">
            日本の電話番号からこちらの番号におかけになる場合、
            <span className="font-semibold text-coral">国際電話の通話料が発生する可能性</span>
            があるのでご注意ください。
          </p>

          {/* Recommended path */}
          <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200/70">
            <div className="mb-2 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-coral" />
              <div className="text-xs font-semibold uppercase tracking-wider text-coral">
                通話料がかからない方法
              </div>
            </div>
            <p className="text-sm leading-relaxed text-warm-brown/85">
              ご登録のシニアを選択し、
              <span className="font-semibold text-warm-brown">「今すぐ電話」ボタン</span>
              を押してください。カヨ側からお電話するので、ユーザー側に通話料は発生しません。
            </p>
          </div>

          {/* Number reference */}
          <div className="rounded-xl bg-white/70 p-3 ring-1 ring-rose-200/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-warm-gray">
              発信先（カヨの番号）
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-warm-brown">
              {displayPhone}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="block w-full rounded-full bg-gradient-to-r from-coral to-warm-orange py-3 text-center text-sm font-semibold text-white shadow-lg shadow-coral/30 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              キャンセル
            </button>
            <a
              href={telHref}
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-300/60 bg-white/70 py-3 text-center text-xs font-medium text-warm-gray transition-colors hover:bg-white"
            >
              <Phone className="h-3.5 w-3.5" />
              それでもこの番号にかける（通話料が発生する可能性あり）
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
