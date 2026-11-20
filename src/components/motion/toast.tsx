"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom toast: rises in, closes by itself after `duration` (or on ×) with a
 * slide out. `clearParams` removes the query string that triggered it, so a
 * reload doesn't show it again.
 */
export function Toast({
  children,
  tone = "mint",
  duration = 6000,
  clearParams = false,
}: {
  children: React.ReactNode;
  tone?: "mint" | "sun";
  duration?: number;
  clearParams?: boolean;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (clearParams) window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setLeaving(true), duration);
    return () => clearTimeout(t);
  }, [clearParams, duration]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
      <div
        role="status"
        data-leaving={leaving}
        className={cn(
          "toast pointer-events-auto flex max-w-md items-center gap-3 rounded-panel border p-panel pl-4 shadow-xl",
          leaving && "hidden",
          tone === "mint" ? "border-mint/30 bg-mint-soft text-mint-dark" : "border-sun/40 bg-sun-soft text-sun-ink",
        )}
      >
        <div className="min-w-0 flex-1 py-1.5 font-display font-extrabold">{children}</div>
        <button
          type="button"
          onClick={() => setLeaving(true)}
          aria-label="Fechar aviso"
          className="flex size-9 shrink-0 items-center justify-center rounded-inner text-lg opacity-70 hover:bg-black/5 hover:opacity-100 active:scale-90"
        >
          ×
        </button>
      </div>
    </div>
  );
}
