import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "sun";

const base =
  "inline-flex items-center justify-center gap-2 rounded-inner font-display font-extrabold transition active:translate-y-[2px] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-course text-white shadow-[0_4px_0_var(--course-primary-dark)] hover:brightness-105 active:shadow-[0_2px_0_var(--course-primary-dark)]",
  sun: "bg-sun text-on-sun shadow-[0_4px_0_#F2A818] hover:brightness-105 active:shadow-[0_2px_0_#F2A818]",
  secondary: "border-[1.5px] border-line-strong bg-surface text-ink hover:bg-canvas",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
  danger: "border-[1.5px] border-coral/40 bg-surface text-coral hover:bg-coral-soft",
};

const sizes = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-12 px-5 text-[15px]",
  lg: "h-14 px-6 text-[17px]",
};

type Common = { variant?: ButtonVariant; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: Common = {}, className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & Common) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}
