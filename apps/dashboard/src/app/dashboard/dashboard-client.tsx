"use client";

import {
  Clock,
  Plus,
  ShoppingBag,
  UserPlus,
  Settings,
  PhoneIncoming,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SafetyReminderModal } from "./_components/safety-reminder-modal";
import { KayoCallWarningModal } from "./_components/kayo-call-warning-modal";
import { ContactCardShare } from "./_components/contact-card-share";
import { NewSeniorWelcomeModal } from "./_components/new-senior-welcome-modal";

interface Family {
  id: string;
  name: string;
  minutes_limit: number;
  minutes_used: number;
  subscription_status: string;
}

interface Senior {
  id: string;
  name: string;
  phone: string;
  schedule: { weekday: string; time: string }[];
  is_self: boolean;
  introducer_name: string | null;
  introducer_relationship: string | null;
}

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

interface Props {
  family: Family | null;
  seniors: Senior[];
}

export function DashboardClient({ family, seniors }: Props) {
  const kayoPhoneRaw = process.env.NEXT_PUBLIC_KAYO_PHONE_NUMBER ?? "";
  const kayoPhone = formatPhoneForDisplay(kayoPhoneRaw);

  // New-senior welcome modal: opens when the URL has ?welcome=<senior_id>
  // (set by the signup / add-senior flows on success) and that senior
  // hasn't been welcomed before (per-id localStorage flag).
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcomeParam = searchParams.get("welcome");
  const [welcomeSenior, setWelcomeSenior] = useState<Senior | null>(null);

  useEffect(() => {
    if (!welcomeParam) return;
    const target = seniors.find((s) => s.id === welcomeParam);
    if (!target) return;
    let alreadyShown = false;
    try {
      alreadyShown = !!window.localStorage.getItem(
        `kayo:welcome-shown:${target.id}`
      );
    } catch {
      // localStorage blocked; default to "not shown" so the buyer at
      // least sees it once on this device.
    }
    if (!alreadyShown) setWelcomeSenior(target);
  }, [welcomeParam, seniors]);

  const closeWelcome = () => {
    if (welcomeSenior) {
      try {
        window.localStorage.setItem(
          `kayo:welcome-shown:${welcomeSenior.id}`,
          "1"
        );
      } catch {
        // ignore
      }
    }
    setWelcomeSenior(null);
    // Strip the ?welcome= param so a page refresh won't re-show.
    if (welcomeParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("welcome");
      const qs = params.toString();
      router.replace(`/dashboard${qs ? `?${qs}` : ""}`);
    }
  };

  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
      <SafetyReminderModal
        seniors={seniors.map((s) => ({
          id: s.id,
          name: s.name,
          schedule: s.schedule,
        }))}
        kayoPhone={kayoPhone}
      />
      <NewSeniorWelcomeModal
        senior={welcomeSenior}
        kayoPhone={kayoPhoneRaw}
        onClose={closeWelcome}
      />
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-medium tracking-tight text-warm-brown">
            ダッシュボード
          </h1>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-sm text-warm-gray hover:text-coral"
            >
              トップへ戻る
            </a>
            <Link
              href="/dashboard/settings"
              aria-label="設定"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-warm-gray transition-colors hover:bg-rose-100 hover:text-coral"
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <KayoNumberCard />

        {family && <UsageCard family={family} />}

        {seniors.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-warm-brown">登録された方がまだいません。</p>
            <Link
              href="/dashboard/seniors/new"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-coral hover:underline"
            >
              <UserPlus className="h-4 w-4" />
              追加する
            </Link>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-gray">
                ご登録の方
              </h2>
              <Link href="/dashboard/seniors/new">
                <Button variant="secondary" size="sm">
                  <Plus className="h-4 w-4" />
                  シニアを追加
                </Button>
              </Link>
            </div>
            {seniors.map((s) => (
              <SeniorCard key={s.id} senior={s} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function KayoNumberCard() {
  const raw = process.env.NEXT_PUBLIC_KAYO_PHONE_NUMBER ?? "";
  const display = formatPhoneForDisplay(raw);
  const [warningOpen, setWarningOpen] = useState(false);

  return (
    <>
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-warm-orange shadow-lg shadow-coral/40">
            <PhoneIncoming className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
              カヨの電話番号
            </div>
            {display ? (
              <button
                type="button"
                onClick={() => setWarningOpen(true)}
                className="mt-1 block text-left font-serif text-2xl font-medium tracking-tight text-warm-brown hover:text-coral"
              >
                {display}
              </button>
            ) : (
              <p className="mt-1 text-sm text-warm-gray">
                （未設定）.env.local の NEXT_PUBLIC_KAYO_PHONE_NUMBER を設定してください
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-warm-brown/75">
              ご登録の電話番号からこの番号におかけいただくと、いつでもカヨとお話しいただけます。
              <span className="mt-0.5 block text-[11px] text-warm-orange/90">
                ※現在アメリカの番号のため、日本からおかけになる場合は国際電話料金にご注意ください。
              </span>
            </p>
            {display && (
              <div className="mt-4">
                <ContactCardShare />
              </div>
            )}
          </div>
        </div>
      </GlassCard>
      {display && (
        <KayoCallWarningModal
          open={warningOpen}
          onClose={() => setWarningOpen(false)}
          rawPhone={raw}
          displayPhone={display}
        />
      )}
    </>
  );
}

// "+12012691234" → "+1 (201) 269-1234" (US/CA), "+81 90 1234 5678" (JP), or
// fall back to a single-space-grouped representation.
function formatPhoneForDisplay(e164: string): string {
  if (!e164) return "";
  const cleaned = e164.replace(/[^\d+]/g, "");
  if (/^\+1\d{10}$/.test(cleaned)) {
    const d = cleaned.slice(2);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (/^\+81\d{9,10}$/.test(cleaned)) {
    const d = cleaned.slice(3);
    if (d.length === 10) return `+81 ${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
    return `+81 ${d.slice(0, 1)}-${d.slice(1, 5)}-${d.slice(5)}`;
  }
  return cleaned;
}

function UsageCard({ family }: { family: Family }) {
  const pct = Math.min(
    100,
    Math.round((family.minutes_used / Math.max(1, family.minutes_limit)) * 100)
  );
  const remaining = Math.max(0, family.minutes_limit - family.minutes_used);
  const exhausted = remaining === 0;

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-warm-gray">
            今月のご利用
          </div>
          <div className="mt-1 font-serif text-2xl font-medium text-warm-brown">
            {family.minutes_used} / {family.minutes_limit} 分
          </div>
        </div>
        <form action="/api/billing/buy-minutes" method="post">
          <Button variant="secondary" size="sm" type="submit">
            <ShoppingBag className="h-4 w-4" />
            追加分を購入
          </Button>
        </form>
      </div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-rose-200/50">
        <div
          className={`h-full rounded-full transition-all ${
            exhausted
              ? "bg-warm-gray"
              : "bg-gradient-to-r from-coral to-warm-orange"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-warm-gray">
        {exhausted
          ? "今月分を使い切りました。追加分（100分パック）を購入すると続けてご利用いただけます。"
          : `あと約${remaining}分ご利用いただけます。`}
      </p>
    </GlassCard>
  );
}

function SeniorCard({ senior }: { senior: Senior }) {
  const schedule = senior.schedule ?? [];
  return (
    <Link
      href={`/dashboard/seniors/${senior.id}`}
      className="group block"
      aria-label={`${senior.name}さんのダッシュボードを開く`}
    >
      {/* Stronger clickable affordances:
          - explicit "詳細を見る →" call-to-action pill on the right
          - cursor-pointer + bigger lift on hover
          - the chevron now lives inside a coral-tinted circle that
            scales on hover, so the click target reads as a button. */}
      <GlassCard className="cursor-pointer p-6 transition-all group-hover:-translate-y-1 group-hover:border-coral/60 group-hover:shadow-lg group-hover:shadow-coral/15">
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-1">
            <div className="font-serif text-xl font-medium text-warm-brown">
              {senior.name}
              <span className="ml-2 text-xs text-warm-gray">{senior.phone}</span>
            </div>
            {!senior.is_self && senior.introducer_name && (
              <div className="text-xs text-warm-gray">
                紹介者: {senior.introducer_relationship}の{senior.introducer_name}さん
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
              <Clock className="h-3.5 w-3.5 text-coral" />
              {schedule.length === 0 ? (
                <span className="text-xs text-warm-gray">スケジュール未設定</span>
              ) : (
                schedule.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-rose-300/50 bg-white/70 px-2 py-0.5 text-xs text-warm-brown"
                  >
                    {WEEKDAY_LABELS[s.weekday] ?? s.weekday} {s.time}
                  </span>
                ))
              )}
            </div>
          </div>
          {/* Action affordance — explicit text + iconized button so it
              clearly reads "this row is clickable, here's where to tap". */}
          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold text-coral transition-colors">
            <span className="hidden sm:inline">詳細を見る</span>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-coral to-warm-orange text-white shadow-md shadow-coral/30 transition-transform group-hover:scale-110"
              aria-hidden
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
