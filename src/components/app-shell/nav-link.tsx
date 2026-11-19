"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-[14px] px-4 py-2.5 font-display text-[15px] transition",
        active ? "bg-brand-soft font-extrabold text-brand" : "font-bold text-muted hover:bg-canvas hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
