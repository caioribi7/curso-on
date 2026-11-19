import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logo V1: "curso" + a switch pill that holds "on" and the yellow knob. */
export function Logo({ size = "md", href = "/", className }: { size?: "sm" | "md" | "lg"; href?: string | null; className?: string }) {
  const s = {
    sm: { word: "text-[22px]", pill: "h-7 pl-2 pr-[3px] gap-1", on: "text-[16px]", knob: "size-[21px]" },
    md: { word: "text-[28px]", pill: "h-9 pl-2.5 pr-1 gap-1.5", on: "text-[21px]", knob: "size-7" },
    lg: { word: "text-[44px]", pill: "h-14 pl-4 pr-1.5 gap-2", on: "text-[32px]", knob: "size-11" },
  }[size];

  const mark = (
    <span className={cn("inline-flex items-center gap-1.5 font-display font-black tracking-[-0.03em]", className)}>
      <span className={cn("leading-none text-ink", s.word)}>curso</span>
      <span className={cn("inline-flex items-center rounded-full bg-brand", s.pill)}>
        <span className={cn("leading-none text-white", s.on)}>on</span>
        <span className={cn("rounded-full bg-sun", s.knob)} />
      </span>
    </span>
  );

  if (href === null) return mark;
  return (
    <Link href={href} aria-label="Curso On — página inicial" className="rounded-lg">
      {mark}
    </Link>
  );
}
