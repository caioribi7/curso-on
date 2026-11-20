"use client";

import { useEffect, useState } from "react";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import type { AchievementView } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Badge grid. With `celebrateFor` (the owner's id), badges unlocked since the
 * student's last visit pop and glow once; what they've seen is kept in
 * localStorage. Public cards pass nothing and never animate.
 */
export function BadgeGrid({ achievements, celebrateFor }: { achievements: AchievementView[]; celebrateFor?: string }) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!celebrateFor) return;
    const key = `curso-on:conquistas-vistas:${celebrateFor}`;
    const unlocked = achievements.filter((a) => a.unlockedAt).map((a) => a.slug);
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {}
    // First visit on this device: celebrate only what was unlocked in the last day.
    const isNew = (a: AchievementView) =>
      seen ? !seen.includes(a.slug) : Date.now() - Date.parse(a.unlockedAt!) < 86_400_000;
    const next = new Set(achievements.filter((a) => a.unlockedAt && isNew(a)).map((a) => a.slug));
    // Mark as seen in the same tick as the pop: if this effect is cancelled
    // (Strict Mode, quick re-render), nothing is saved and the next run still celebrates.
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(unlocked));
      } catch {}
      if (next.size) setFresh(next);
    }, 0);
    return () => clearTimeout(t);
  }, [achievements, celebrateFor]);

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 p-card min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
      {achievements.map((a) => (
        <li key={a.slug} className="group flex flex-col items-center gap-1.5 text-center">
          <span
            className={cn(
              "relative isolate block transition group-hover:-translate-y-1 group-hover:scale-105",
              fresh.has(a.slug) && "badge-new",
            )}
          >
            <AchievementBadge slug={a.slug} unlocked={Boolean(a.unlockedAt)} />
          </span>
          <span className={cn("font-display text-sm font-extrabold leading-tight", !a.unlockedAt && "text-subtle")}>{a.name}</span>
          <span className="text-[11px] leading-tight text-muted">{a.description}</span>
          <span className="sr-only">{a.unlockedAt ? (fresh.has(a.slug) ? "Conquistada agora" : "Conquistada") : "Bloqueada"}</span>
        </li>
      ))}
    </ul>
  );
}
