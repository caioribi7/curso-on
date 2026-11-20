"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Indicator, vtLabel } from "@/components/motion/indicator";
import { cn } from "@/lib/utils";

/** Item of the navbar pill. The active one carries the shared indicator that slides between items. */
export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative isolate flex items-center gap-2 rounded-full px-4 py-2 font-display text-[15px] active:scale-[0.97]",
        active ? "font-extrabold text-brand" : "font-bold text-muted hover:bg-surface/70 hover:text-ink",
      )}
    >
      {active ? <Indicator name="nav-main" className="rounded-full bg-brand-soft" /> : null}
      <span {...vtLabel(`nav-${href}`)}>
        <span className="flex items-center gap-2">{children}</span>
      </span>
    </Link>
  );
}

/** Row in the account menu (mobile also gets the main links here). */
export function MenuLink({ href, exact, children, className }: { href: string; exact?: boolean; children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-inner px-3 py-2.5 text-sm font-semibold active:scale-[0.98]",
        active ? "bg-brand-soft text-brand" : "hover:bg-canvas",
        className,
      )}
    >
      {children}
    </Link>
  );
}
