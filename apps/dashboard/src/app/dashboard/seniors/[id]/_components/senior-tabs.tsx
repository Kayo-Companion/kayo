"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pill-style tab switcher under the per-senior page header.
 *
 * Three links: dashboard (default route), 認知機能チェック (HDS-R
 * history), and settings. Active tab is determined from the current
 * pathname so we don't thread an `active` prop through every page.
 */
export function SeniorTabs({ seniorId }: { seniorId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/seniors/${seniorId}`;

  const tabs: { href: string; label: string; isActive: boolean }[] = [
    {
      href: base,
      label: "ダッシュボード",
      isActive: pathname === base,
    },
    {
      href: `${base}/activities`,
      label: "認知機能チェック",
      isActive: pathname.startsWith(`${base}/activities`),
    },
    {
      href: `${base}/settings`,
      label: "設定",
      isActive: pathname.startsWith(`${base}/settings`),
    },
  ];

  return (
    <nav className="inline-flex rounded-full border border-rose-300/40 bg-white/60 p-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            t.isActive
              ? "bg-coral text-white shadow-sm"
              : "text-warm-gray hover:text-coral"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
