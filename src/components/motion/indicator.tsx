import { ViewTransition, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared moving highlight. Render it only inside the active item of a group,
 * always with the same `name`: on the next navigation (or startTransition) React
 * pairs the old and new one and the browser slides it between the items.
 * The parent needs `relative isolate`.
 */
export function Indicator({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <ViewTransition name={name} share="indicator" default="none">
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10", className)} style={style} />
    </ViewTransition>
  );
}

/**
 * Props for a label that sits on an indicator. Gives it a unique
 * view-transition-name so it is drawn above the moving highlight during the
 * slide (see .vt-label in globals.css). `id` must be unique on the page.
 */
export function vtLabel(id: string, enabled = true) {
  if (!enabled) return { className: "relative" };
  return {
    className: "vt-label relative",
    style: { viewTransitionName: `l-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}` } as CSSProperties,
  };
}
