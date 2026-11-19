"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Question, QuestionOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { answerQuestion, type AnswerState } from "../../../actions";

type Q = Question & { options: QuestionOption[] };
type Result = NonNullable<AnswerState["result"]>;

const primaryBtn =
  "w-fit rounded-2xl bg-course px-6 py-3 font-display font-extrabold text-white shadow-[0_4px_0_var(--course-primary-dark)]";

export function Practice({ questions }: { questions: Q[] }) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, xp: 0 });
  const q = questions[index];

  if (!q) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[32px] border border-line bg-white p-10 text-center">
        <p className="text-5xl">🏆</p>
        <h2 className="text-3xl font-black">Rodada concluída!</h2>
        <p className="text-lg text-muted">
          {score.correct} de {questions.length} acertos · +{score.xp} XP
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setScore({ correct: 0, xp: 0 });
          }}
          className={primaryBtn}
        >
          Praticar de novo
        </button>
      </div>
    );
  }

  return (
    <QuestionCard
      key={`${q.id}-${index}`}
      q={q}
      number={index + 1}
      total={questions.length}
      onNext={(r) => {
        setScore((s) => ({ correct: s.correct + (r.isCorrect ? 1 : 0), xp: s.xp + r.xpGained }));
        setIndex((i) => i + 1);
      }}
    />
  );
}

function QuestionCard({ q, number, total, onNext }: { q: Q; number: number; total: number; onNext: (r: Result) => void }) {
  const [state, action] = useActionState<AnswerState, FormData>(answerQuestion, {});
  const [selected, setSelected] = useState<string | null>(null);
  const result = state.result;

  return (
    <form action={action} className="flex flex-col gap-6 rounded-[32px] border border-line bg-white p-6 sm:p-10">
      <input type="hidden" name="questionId" value={q.id} />
      <input type="hidden" name="optionId" value={selected ?? ""} />
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-sm font-extrabold uppercase tracking-wide text-course">
          Questão {number} de {total}
        </span>
        <span className="rounded-full bg-sun-soft px-3 py-1 font-display text-sm font-black text-[#B87C00]">+{q.xp_reward} XP</span>
      </div>
      <div className="h-2.5 rounded-full bg-course-soft">
        <div className="h-2.5 rounded-full bg-course" style={{ width: `${((number - 1) / total) * 100}%` }} />
      </div>
      <h2 className="whitespace-pre-line text-2xl font-black leading-snug">{q.statement}</h2>

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
                onClick={() => setSelected(o.id)}
                aria-pressed={selected === o.id}
                className={cn(
                  "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition",
                  isCorrect && "border-mint bg-mint-soft",
                  isWrongPick && "border-coral bg-coral-soft",
                  isSelected && "border-course bg-course-soft",
                  !isCorrect && !isWrongPick && !isSelected && "border-line hover:border-line-strong",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl font-display font-black",
                    isCorrect ? "bg-mint text-white" : isWrongPick ? "bg-coral text-white" : isSelected ? "bg-course text-white" : "bg-canvas text-muted",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-semibold">{o.body}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {state.error ? <p className="font-semibold text-coral">{state.error}</p> : null}

      {result ? (
        <div className={cn("flex flex-col gap-3 rounded-2xl p-5", result.isCorrect ? "bg-mint-soft" : "bg-coral-soft")}>
          <p className={cn("font-display text-xl font-black", result.isCorrect ? "text-mint-dark" : "text-coral")}>
            {result.isCorrect
              ? result.xpGained > 0
                ? `Acertou! +${result.xpGained} XP`
                : "Acertou! (XP já ganho antes)"
              : "Quase! A correta está em verde."}
          </p>
          {result.explanation ? <p className="whitespace-pre-line text-ink">{result.explanation}</p> : null}
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
