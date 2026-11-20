import { CountUp } from "@/components/motion/count-up";
import { CheckIcon } from "@/components/icons/flat-icons";
import { COMPETENCIES, STATUS_LABEL, STATUS_TONE, type EssayStatus } from "@/lib/redacao-shared";
import { cn } from "@/lib/utils";

// Peças visuais da redação usadas pelo aluno e pelo professor.

export function StatusChip({ status, className }: { status: EssayStatus; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-3 py-1 font-display text-xs font-extrabold", STATUS_TONE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Linha do tempo enviada → em correção → corrigida. */
export function StatusSteps({ status }: { status: EssayStatus }) {
  const order: EssayStatus[] = ["enviada", "em_correcao", "corrigida"];
  const at = order.indexOf(status);
  return (
    <ol className="flex items-center gap-2" aria-label="Andamento da correção">
      {order.map((s, i) => {
        const done = i < at || status === "corrigida";
        const current = i === at && status !== "corrigida";
        return (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-black",
                done ? "bg-mint text-white" : current ? "bg-brand text-white anim-pop" : "bg-canvas text-subtle",
              )}
            >
              {done ? <CheckIcon size={14} /> : i + 1}
            </span>
            <span className={cn("font-display text-sm font-extrabold whitespace-nowrap", done || current ? "text-ink" : "text-subtle")}>
              {STATUS_LABEL[s]}
            </span>
            {i < order.length - 1 ? (
              <span className="h-1 min-w-4 flex-1 overflow-hidden rounded-full bg-canvas">
                <span className="bar-fill block h-full rounded-full bg-mint" style={{ width: i < at ? "100%" : "0%" }} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const TONES = ["bg-coral", "bg-coral", "bg-sun", "bg-sun", "bg-brand", "bg-mint"];

/** Card de nota: total grande e as 5 competências com barra. */
export function ScoreBoard({ scores, notes, title = "Sua nota" }: { scores: (number | null)[]; notes: string[]; title?: string }) {
  const total = scores.reduce<number>((s, v) => s + (v ?? 0), 0);
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card" aria-label="Nota por competência">
      <div className="flex items-center gap-4">
        <span className="flex h-20 min-w-28 flex-col items-center justify-center rounded-inner bg-brand px-4 text-white anim-pop">
          <span className="font-display text-[34px] font-black leading-none">
            <CountUp value={total} />
          </span>
          <span className="font-display text-xs font-extrabold opacity-80">de 1000</span>
        </span>
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="text-sm text-muted">Cada competência vale de 0 a 200, de 40 em 40.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {COMPETENCIES.map((c, i) => {
          const v = scores[i] ?? 0;
          return (
            <li key={c.n} className="flex flex-col gap-2 rounded-inner bg-canvas px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display font-extrabold">
                  <span className="text-brand">C{c.n}</span> · {c.short}
                </span>
                <span className="font-display font-black">{v}</span>
              </div>
              <span className="h-2 overflow-hidden rounded-full bg-line">
                <span className={cn("bar-fill block h-full rounded-full", TONES[v / 40])} style={{ width: `${(v / 200) * 100}%` }} />
              </span>
              {notes[i] ? <p className="text-sm leading-relaxed text-muted">{notes[i]}</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function MotivatingText({ title, text, instructions }: { title: string; text: string; instructions?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
      <p className="font-display text-xs font-extrabold uppercase tracking-wide text-brand">Proposta</p>
      <h2 className="text-xl font-black leading-snug">{title}</h2>
      {instructions ? <p className="rounded-inner bg-brand-soft px-4 py-3 text-sm font-semibold text-brand">{instructions}</p> : null}
      {text ? (
        <div className="max-h-[420px] overflow-y-auto rounded-inner bg-canvas px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-muted">{text}</div>
      ) : null}
    </section>
  );
}
