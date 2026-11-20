import { cn } from "@/lib/utils";

/**
 * Progress bar. The fill grows from zero when it appears and slides to the new
 * value when it changes (.bar-fill in globals.css). Track and fill are both
 * rounded-full, so they stay concentric at any height.
 */
export function ProgressBar({
  value,
  className,
  tone = "course",
  fillClassName,
  label,
}: {
  value: number;
  className?: string;
  tone?: "course" | "sun";
  fillClassName?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-course-soft", className)}
    >
      <div
        className={cn("bar-fill h-full rounded-full", tone === "sun" ? "bg-sun" : "bg-course", fillClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Ring({ value, size = 112, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--course-primary-soft)" strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--course-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: c * (1 - pct), ["--ring-c" as string]: `${c}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-card border border-line bg-surface", className)}>{children}</div>;
}
