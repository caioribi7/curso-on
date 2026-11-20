import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-2xl border-[1.5px] border-line-strong bg-surface px-4 text-[15px] text-ink placeholder:text-subtle outline-none transition focus:border-course focus:ring-4 focus:ring-course/15 aria-[invalid=true]:border-coral";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  aside,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="font-display text-sm font-bold text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-semibold text-coral">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-[52px]", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-[52px] appearance-none pr-10", className)} {...props} />;
}

export function FormMessage({ state }: { state?: { error?: string; message?: string } }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-2xl bg-mint-soft px-4 py-3 text-sm font-semibold text-mint-dark">
        {state.message}
      </p>
    );
  }
  return null;
}
