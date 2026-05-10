"use client";

import {
  Phone,
  Clock,
  Plus,
  ShoppingBag,
  UserPlus,
  Settings,
  PhoneIncoming,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

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
  return (
    <main className="min-h-screen bg-cream py-12 md:py-16">
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
              <SeniorCard
                key={s.id}
                senior={s}
                familyHasMinutes={Boolean(
                  family && family.minutes_used < family.minutes_limit
                )}
              />
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
  const telHref = raw ? `tel:${raw.replace(/\s/g, "")}` : undefined;

  return (
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
            <a
              href={telHref}
              className="mt-1 block font-serif text-2xl font-medium tracking-tight text-warm-brown hover:text-coral"
            >
              {display}
            </a>
          ) : (
            <p className="mt-1 text-sm text-warm-gray">
              （未設定）.env.local の NEXT_PUBLIC_KAYO_PHONE_NUMBER を設定してください
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-warm-brown/75">
            ご登録の電話番号からこの番号におかけいただくと、いつでもカヨとお話しいただけます。
          </p>
        </div>
      </div>
    </GlassCard>
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

function SeniorCard({
  senior,
  familyHasMinutes,
}: {
  senior: Senior;
  familyHasMinutes: boolean;
}) {
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const callNow = async () => {
    setCalling(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senior_id: senior.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "通話の発信に失敗しました。");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setCalling(false);
    }
  };

  const schedule = senior.schedule ?? [];

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-serif text-xl font-medium text-warm-brown">
            {senior.name}
            <span className="text-xs text-warm-gray">{senior.phone}</span>
            <Link
              href={`/dashboard/seniors/${senior.id}`}
              aria-label={`${senior.name}の設定`}
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-warm-gray transition-colors hover:bg-rose-100 hover:text-coral"
            >
              <Settings className="h-4 w-4" />
            </Link>
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

        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <Button
            variant="primary"
            size="md"
            className="group whitespace-nowrap"
            onClick={callNow}
            disabled={calling || !familyHasMinutes}
          >
            {calling ? (
              "発信中..."
            ) : (
              <>
                <Phone className="h-4 w-4" />
                今すぐ電話
              </>
            )}
          </Button>
          {!familyHasMinutes && (
            <span className="text-[10px] text-warm-gray">
              ※ 残り分数がありません
            </span>
          )}
          {success && (
            <span className="text-[10px] text-emerald-600">
              ✓ 発信しました。{senior.phone} に電話がかかります。
            </span>
          )}
          {error && (
            <span className="text-[10px] text-coral">{error}</span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
