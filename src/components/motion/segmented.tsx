import Link from "next/link";
import { Indicator, vtLabel } from "@/components/motion/indicator";
import { cn } from "@/lib/utils";

export type SegmentItem = {
  key: string;
  href: string;
  label: React.ReactNode;
  /** Indicator color for this item (e.g. the ENEM area color). Defaults to the brand/course class. */
  color?: string;
};

/**
 * Link-based segmented control (tabs that change the URL). The active item
 * carries a shared indicator, so switching slides the highlight from the old
 * item to the new one. Concentric: the bar is --r-panel with --pad-panel of
 * padding, and the items/indicator are --r-inner = --r-panel − --pad-panel.
 * It scrolls sideways on small screens.
 */
export function Segmented({
  name,
  label,
  items,
  active,
  tone = "brand",
  className,
}: {
  name: string;
  label: string;
  items: SegmentItem[];
  active: string;
  tone?: "brand" | "course";
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("max-w-full overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <div className="inline-flex gap-1 rounded-panel bg-surface p-panel ring-1 ring-line ring-inset">
        {items.map((it) => {
          const on = it.key === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative isolate shrink-0 rounded-inner px-4 py-2.5 font-display font-extrabold whitespace-nowrap active:scale-[0.97]",
                on ? "text-white" : "text-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {on ? (
                <Indicator
                  name={name}
                  className={cn("rounded-inner", !it.color && (tone === "course" ? "bg-course" : "bg-brand"))}
                  style={it.color ? { background: it.color } : undefined}
                />
              ) : null}
              <span {...vtLabel(`${name}-${it.key}`)}>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
