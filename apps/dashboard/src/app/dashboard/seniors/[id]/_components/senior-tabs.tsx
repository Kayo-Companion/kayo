"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Pill-style tab switcher under the per-senior page header.
 *
 * Renders two links: dashboard (default route) and settings.
 * Active tab is determined from the current pathname so we don't have to
 * thread an `active` prop through every page.
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
