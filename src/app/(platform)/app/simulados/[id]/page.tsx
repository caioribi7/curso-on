import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/icons/flat-icons";
import { MathText } from "@/components/math/math-text";
import { CountUp } from "@/components/motion/count-up";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar, Ring } from "@/components/ui/progress";
import { requireUser } from "@/lib/dal";
import { getAttempt, getAttemptReview, scoreBreakdown, type BankQuestion, type ReviewRow } from "@/lib/simulados";
import { AREAS, getSubject } from "@/lib/subjects";
import { formatMinutes } from "@/lib/time";
import { cn, courseThemeVars } from "@/lib/utils";
import { Runner } from "./runner";

export const metadata: Metadata = { title: "Simulado" };

export default async function AttemptPage({ params, searchParams }: PageProps<"/app/simulados/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/app/simulados/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getAttempt(id);
  if (!data) notFound();
  const { attempt, items, questions } = data;

  if (!attempt.submitted_at) {
    const answers: Record<string, string> = {};
    for (const it of items) if (it.option_id) answers[it.question_id] = it.option_id;
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link href="/app/simulados" className="font-display text-sm font-bold text-muted hover:text-ink">
          ← Simulados
        </Link>
        <Runner
          attemptId={attempt.id}
          title={attempt.title}
          deadline={Date.parse(attempt.deadline_at)}
          // eslint-disable-next-line react-hooks/purity -- server render time anchors the client clock
          serverNow={Date.now()}
          questions={questions}
          initialAnswers={answers}
        />
      </div>
    );
  }

  const review = await getAttemptReview(id);
  const { byArea, bySubject } = scoreBreakdown(review);
  const total = attempt.total_count || review.length;
  const correct = attempt.correct_count ?? 0;
  const pct = total ? correct / total : 0;
  const byQ = new Map(questions.map((q) => [q.id, q]));
  const spent = Math.min(attempt.duration_minutes, Math.ceil((Date.parse(attempt.submitted_at) - Date.parse(attempt.started_at)) / 60000));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/app/simulados" className="font-display text-sm font-bold text-muted hover:text-ink">
        ← Simulados
      </Link>

      <section className="anim-in flex flex-wrap items-center gap-6 rounded-card border border-line bg-surface p-card">
        <Ring value={pct} size={128} stroke={14}>
          <span className="font-display text-3xl font-black">{Math.round(pct * 100)}%</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide text-course">{sp.entregue ? "Simulado entregue!" : "Resultado"}</p>
          <h1 className="text-[30px] font-black leading-tight tracking-[-0.02em]">{attempt.title}</h1>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-full bg-mint-soft px-3 py-1 text-mint-dark">
              {correct} de {total} acertos
            </span>
            <span className="anim-pop rounded-full bg-sun-soft px-3 py-1 text-sun-ink">
              +<CountUp value={attempt.xp_gained} /> XP
            </span>
            <span className="rounded-full bg-canvas px-3 py-1 text-muted">
              {formatMinutes(Math.max(1, spent))} de {formatMinutes(attempt.duration_minutes)}
            </span>
          </div>
        </div>
        <ButtonLink href="/app/simulados" variant="secondary">
          Novo simulado
        </ButtonLink>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <ScoreCard
          title="Por área do ENEM"
          rows={byArea.map((a) => {
            const area = AREAS.find((x) => x.key === a.key);
            return { key: a.key, name: area?.name ?? "Sem área", color: area?.color ?? "#8a8f9c", correct: a.correct, total: a.total };
          })}
        />
        <ScoreCard
          title="Por matéria"
          rows={bySubject.map((s) => ({ key: s.key, name: s.name, color: getSubject(s.key)?.colors[0] ?? "#8a8f9c", correct: s.correct, total: s.total }))}
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Correção</h2>
          <nav aria-label="Ir para a questão" className="flex flex-wrap gap-1.5">
            {review.map((r) => (
              <a
                key={r.question_id}
                href={`#q-${r.position + 1}`}
                className={cn(
                  "flex size-9 items-center justify-center rounded-inner font-display text-sm font-black hover:brightness-105 active:scale-90",
                  r.is_correct ? "bg-mint text-white" : r.option_id ? "bg-coral text-white" : "bg-canvas text-muted",
                )}
              >
                {r.position + 1}
              </a>
            ))}
          </nav>
        </div>
        {review.map((r) => {
          const q = byQ.get(r.question_id);
          return q ? <ReviewCard key={r.question_id} r={r} q={q} /> : null;
        })}
      </section>
    </div>
  );
}

function ScoreCard({ title, rows }: { title: string; rows: { key: string; name: string; color: string; correct: number; total: number }[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
      <h2 className="text-xl font-black">{title}</h2>
      <ul className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1.5" style={courseThemeVars(r.color)}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display font-extrabold">{r.name}</span>
              <span className="font-display text-sm font-black text-muted">
                {r.correct}/{r.total} · {Math.round((r.correct / r.total) * 100)}%
              </span>
            </div>
            <ProgressBar value={(r.correct / r.total) * 100} className="h-2.5" label={`${r.name}: acertos`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewCard({ r, q }: { r: ReviewRow; q: BankQuestion }) {
  const subject = getSubject(q.course.subject);
  return (
    <article id={`q-${r.position + 1}`} className="flex scroll-mt-28 flex-col gap-4 rounded-card border border-line bg-surface p-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-sm font-extrabold uppercase tracking-wide text-muted">
          Questão {r.position + 1}
          {subject ? ` · ${subject.name}` : ""}
        </span>
        <span
          className={cn(
            "rounded-full px-3 py-1 font-display text-xs font-black",
            r.is_correct ? "bg-mint-soft text-mint-dark" : r.option_id ? "bg-coral-soft text-coral" : "bg-canvas text-muted",
          )}
        >
          {r.is_correct ? "Acertou" : r.option_id ? "Errou" : "Em branco"}
        </span>
      </div>
      <p className="whitespace-pre-line text-lg font-black leading-snug">
        <MathText text={q.statement} />
      </p>
      <ul className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const isRight = o.id === r.correct_option_id;
          const isWrongPick = o.id === r.option_id && !isRight;
          return (
            <li
              key={o.id}
              className={cn(
                "flex items-center gap-3 rounded-panel p-panel pr-4 ring-2 ring-inset",
                isRight ? "bg-mint-soft ring-mint" : isWrongPick ? "bg-coral-soft ring-coral" : "ring-line",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-inner font-display font-black",
                  isRight ? "bg-mint text-white" : isWrongPick ? "bg-coral text-white" : "bg-canvas text-muted",
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 flex-1 font-semibold">
                <MathText text={o.body} />
              </span>
              {isRight ? <CheckIcon className="shrink-0" /> : null}
              {o.id === r.option_id ? <span className="shrink-0 font-display text-xs font-black text-muted">sua resposta</span> : null}
            </li>
          );
        })}
      </ul>
      {r.explanation ? (
        <p className="whitespace-pre-line rounded-inner bg-canvas px-4 py-3 text-ink">
          <MathText text={r.explanation} />
        </p>
      ) : null}
    </article>
  );
}
