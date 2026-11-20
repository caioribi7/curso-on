"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Keyed by path: a route change swaps the content with a fade and short rise,
 * while query-string changes (tabs, filters) and server-action refreshes don't
 * replay it. Lives in the layout, so the header stays still.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}

/** Same place, different content: cross-fades when `id` changes (tab panels, filters). */
export function SwapTransition({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <ViewTransition key={id} enter="swap-enter" exit="swap-exit" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}
