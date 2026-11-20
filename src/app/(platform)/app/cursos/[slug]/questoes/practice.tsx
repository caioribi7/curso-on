"use client";

import { startTransition, useActionState, useState, ViewTransition } from "react";
import { MathText } from "@/components/math/math-text";
import { CountUp } from "@/components/motion/count-up";
import { Indicator, vtLabel } from "@/components/motion/indicator";
import { ProgressBar } from "@/components/ui/progress";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Question, QuestionOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { answerQuestion, type AnswerState } from "../../../actions";

type Q = Question & { options: QuestionOption[] };
type Result = NonNullable<AnswerState["result"]>;

const primaryBtn =
  "w-fit rounded-inner bg-course px-6 py-3 font-display font-extrabold text-white shadow-[0_4px_0_var(--course-primary-dark)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_var(--course-primary-dark)]";

export function Practice({ questions }: { questions: Q[] }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, xp: 0 });
  const q = questions[index];

  if (!q) {
    return (
      <div className="anim-in flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-10 text-center">
        <p className="anim-pop text-5xl">🏆</p>
        <h2 className="text-3xl font-black">Rodada concluída!</h2>
        <p className="text-lg text-muted">
          {score.correct} de {questions.length} acertos · +<CountUp value={score.xp} /> XP
        </p>
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              setIndex(0);
              setScore({ correct: 0, xp: 0 });
            })
          }
          className={primaryBtn}
        >
          Praticar de novo
        </button>
      </div>
    );
  }

  return (
    // Keyed per question: "next" slides the old card out to the left and the new one in.
    <ViewTransition key={`${q.id}-${index}`} enter="q-enter" exit="q-exit" default="none">
      <div>
        <QuestionCard
          q={q}
          number={index + 1}
          total={questions.length}
          onNext={(r) =>
            startTransition(() => {
              setScore((s) => ({ correct: s.correct + (r.isCorrect ? 1 : 0), xp: s.xp + r.xpGained }));
              setIndex((i) => i + 1);
            })
          }
        />
      </div>
    </ViewTransition>
  );
}

function QuestionCard({ q, number, total, onNext }: { q: Q; number: number; total: number; onNext: (r: Result) => void }) {
  const [state, action] = useActionState<AnswerState, FormData>(answerQuestion, {});
  const [selected, setSelected] = useState<string | null>(null);
  const result = state.result;
  const labelProps = (id: string) => {
    const l = vtLabel(`opt-${id}`, selected !== null && !result);
    return { ...l, className: cn(l.className, "flex min-w-0 flex-1 items-center gap-4") };
  };

  return (
    <form action={action} className="flex flex-col gap-6 rounded-card border border-line bg-surface p-card">
      <input type="hidden" name="questionId" value={q.id} />
      <input type="hidden" name="optionId" value={selected ?? ""} />
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-sm font-extrabold uppercase tracking-wide text-course">
          Questão {number} de {total}
        </span>
        <span className="rounded-full bg-sun-soft px-3 py-1 font-display text-sm font-black text-sun-ink">+{q.xp_reward} XP</span>
      </div>
      <ProgressBar value={((number - 1) / total) * 100} className="h-2.5" label="Progresso da rodada" />
      <h2 className="whitespace-pre-line text-2xl font-black leading-snug">
        <MathText text={q.statement} />
      </h2>

      <ul className="flex flex-col gap-3">
        {q.options.map((o, i) => {
          const isCorrect = Boolean(result && result.correctOptionId === o.id);
          const isWrongPick = Boolean(result && !result.isCorrect && result.chosen === o.id);
          const isSelected = !result && selected === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={Boolean(result)}
                // Changing an existing pick runs in a transition, so the highlight slides
                // to the new option. The first pick has nothing to slide from: plain update.
                onClick={() => (selected === null ? setSelected(o.id) : startTransition(() => setSelected(o.id)))}
                aria-pressed={selected === o.id}
                className={cn(
                  // Concentric: option radius = letter tile radius (--r-inner) + the 6px gap around it.
                  "relative isolate flex w-full items-center gap-4 rounded-panel p-panel pr-4 text-left ring-2 ring-inset active:scale-[0.99]",
                  isCorrect && "anim-correct bg-mint-soft ring-mint",
                  isWrongPick && "anim-wrong bg-coral-soft ring-coral",
                  isSelected && "ring-transparent",
                  !isCorrect && !isWrongPick && !isSelected && "ring-line hover:bg-canvas hover:ring-line-strong",
                  result && !isCorrect && !isWrongPick && "opacity-60",
                )}
              >
                {isSelected ? <Indicator name={`pick-${q.id}`} className="rounded-panel bg-course-soft ring-2 ring-course ring-inset" /> : null}
                {/* Named only while switching options, so the "next question" slide moves them with the card. */}
                <span {...labelProps(o.id)}>
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-inner font-display font-black",
                      isCorrect ? "bg-mint text-white" : isWrongPick ? "bg-coral text-white" : isSelected ? "bg-course text-white" : "bg-canvas text-muted",
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 py-1.5 font-semibold">
                    <MathText text={o.body} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {state.error ? <p className="font-semibold text-coral">{state.error}</p> : null}

      {result ? (
        <div
          role="status"
          className={cn("anim-in flex flex-col gap-3 rounded-card p-card", result.isCorrect ? "bg-mint-soft" : "bg-coral-soft")}
        >
          <p className={cn("font-display text-xl font-black", result.isCorrect ? "anim-pop w-fit origin-left text-mint-dark" : "text-coral")}>
            {result.isCorrect
              ? result.xpGained > 0
                ? `Acertou! +${result.xpGained} XP`
                : "Acertou! (XP já ganho antes)"
              : "Quase! A correta está em verde."}
          </p>
          {result.explanation ? <p className="whitespace-pre-line text-ink">
              <MathText text={result.explanation} />
            </p> : null}
          <button type="button" onClick={() => onNext(result)} className={primaryBtn}>
            {number < total ? "Próxima questão →" : "Ver resultado"}
          </button>
        </div>
      ) : (
        <div>
          <SubmitButton disabled={!selected} pendingText="Conferindo…" size="lg">
            Responder
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
