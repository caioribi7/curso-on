import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, tone = "course" }: { value: number; className?: string; tone?: "course" | "sun" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-3 w-full overflow-hidden rounded-full bg-course-soft", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", tone === "sun" ? "bg-sun" : "bg-course")}
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
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--course-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-[28px] border border-line bg-white", className)}>{children}</div>;
}
