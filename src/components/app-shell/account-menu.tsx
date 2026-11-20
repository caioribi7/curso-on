"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Avatar button plus floating panel. Fades/drops in, fades out, and closes on
 * outside click, Escape or navigation.
 */
export function AccountMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Menu da conta"
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full border-[3px] border-brand bg-sun font-display text-[16px] font-black text-on-sun hover:scale-105 active:scale-95"
      >
        {label}
      </button>
      <div
        id={id}
        data-open={open}
        className="popover-panel absolute right-0 z-40 mt-2 w-60 rounded-panel border border-line bg-surface p-panel shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
