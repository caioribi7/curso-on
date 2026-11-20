"use client";

import { startTransition, useEffect, useRef, useState, ViewTransition } from "react";
import { flushSync } from "react-dom";
import { MathText } from "@/components/math/math-text";
import { Indicator, vtLabel } from "@/components/motion/indicator";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClass } from "@/components/ui/button";
import type { BankQuestion } from "@/lib/simulados";
import { getSubject } from "@/lib/subjects";
import { formatClock } from "@/lib/time";
import { cn } from "@/lib/utils";
import { saveMockAnswer, submitMock } from "../actions";

type SaveState = "saving" | "saved" | "error";

export function Runner({
  attemptId,
  title,
  deadline,
  serverNow,
  questions,
  initialAnswers,
}: {
  attemptId: string;
  title: string;
  deadline: number;
  serverNow: number;
  questions: BankQuestion[];
  initialAnswers: Record<string, string>;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(serverNow);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Option labels get a view-transition name only while a pick can slide, so the
  // "next question" slide moves them with the card (see practice.tsx).
  const [labelsOn, setLabelsOn] = useState(false);
  const skew = useRef(0);
  const autoSubmitted = useRef(false);

  const q = questions[index];
  const left = Math.max(0, (deadline - now) / 1000);
  const answered = questions.filter((x) => answers[x.id]).length;
  const blank = questions.length - answered;

  // Clock: server time minus the client offset, so a wrong PC clock can't add time.
  useEffect(() => {
    skew.current = serverNow - Date.now();
    const t = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(t);
  }, [serverNow]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await submitMock(attemptId); // redirects to the result on success
    if (res && !res.ok) {
      setError(res.error ?? "Não foi possível entregar.");
      setSubmitting(false);
    }
  }

  // Time over: hand in what was saved.
  useEffect(() => {
    if (left > 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submit();
  });

  function pick(questionId: string, optionId: string) {
    if (left <= 0) return;
    const prev = answers[questionId];
    const next = prev === optionId ? null : optionId; // click again to clear
    const update = () => {
      setAnswers((a) => {
        const copy = { ...a };
        if (next) copy[questionId] = next;
        else delete copy[questionId];
        return copy;
      });
      setSaves((s) => ({ ...s, [questionId]: "saving" }));
    };
    if (prev) {
      if (!labelsOn) flushSync(() => setLabelsOn(true));
      startTransition(update);
    } else {
      setLabelsOn(true);
      update();
    }
    void saveMockAnswer(attemptId, questionId, next).then((r) => {
      setSaves((s) => ({ ...s, [questionId]: r.ok ? "saved" : "error" }));
      if (!r.ok) {
        setError(r.error ?? "Não foi possível salvar.");
        setAnswers((a) => {
          const copy = { ...a };
          if (prev) copy[questionId] = prev;
          else delete copy[questionId];
          return copy;
        });
      }
    });
  }

  const go = (i: number) => {
    if (labelsOn) flushSync(() => setLabelsOn(false));
    startTransition(() => setIndex(Math.max(0, Math.min(questions.length - 1, i))));
  };
  const urgent = left < 300;
  const labelProps = (id: string) => {
    const l = vtLabel(`mock-opt-${id}`, labelsOn);
    return { ...l, className: cn(l.className, "flex min-w-0 flex-1 items-center gap-4") };
  };
  const subject = getSubject(q.course.subject);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <ViewTransition key={q.id} enter="q-enter" exit="q-exit" default="none">
          <section className="flex flex-col gap-6 rounded-card border border-line bg-surface p-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-display text-sm font-extrabold uppercase tracking-wide text-course">
                Questão {index + 1} de {questions.length}
              </span>
              <div className="flex items-center gap-2">
                {subject ? (
                  <span className="rounded-full px-3 py-1 font-display text-xs font-black text-white" style={{ background: subject.colors[0] }}>
                    {subject.name}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
                  aria-pressed={Boolean(flags[q.id])}
                  className={cn(
                    "rounded-full px-3 py-1 font-display text-xs font-black active:scale-95",
                    flags[q.id] ? "bg-sun text-on-sun" : "bg-canvas text-muted hover:text-ink",
                  )}
                >
                  {flags[q.id] ? "★ Marcada para revisar" : "☆ Revisar depois"}
                </button>
              </div>
            </div>

            <h2 className="whitespace-pre-line text-xl font-black leading-snug sm:text-2xl">
              <MathText text={q.statement} />
            </h2>

            <ul className="flex flex-col gap-3">
              {q.options.map((o, i) => {
                const on = answers[q.id] === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => pick(q.id, o.id)}
                      aria-pressed={on}
                      disabled={left <= 0 || submitting}
                      className={cn(
                        "relative isolate flex w-full items-center gap-4 rounded-panel p-panel pr-4 text-left ring-2 ring-inset active:scale-[0.99]",
                        on ? "ring-transparent" : "ring-line hover:bg-canvas hover:ring-line-strong",
                      )}
                    >
                      {on ? <Indicator name={`mock-pick-${q.id}`} className="rounded-panel bg-course-soft ring-2 ring-course ring-inset" /> : null}
                      <span {...labelProps(o.id)}>
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-inner font-display font-black",
                            on ? "bg-course text-white" : "bg-canvas text-muted",
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={buttonClass({ variant: "secondary" })}>
                ← Anterior
              </button>
              <p aria-live="polite" className="text-sm font-semibold text-muted">
                {saves[q.id] === "saving" ? "Salvando…" : saves[q.id] === "error" ? "Não salvou" : answers[q.id] ? "Resposta salva ✓" : "Sem resposta"}
              </p>
              {index < questions.length - 1 ? (
                <button type="button" onClick={() => go(index + 1)} className={buttonClass({ variant: "primary" })}>
                  Próxima →
                </button>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className={buttonClass({ variant: "sun" })}>
                  Entregar
                </button>
              )}
            </div>
          </section>
        </ViewTransition>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-extrabold text-muted">{title}</p>
              <p
                role="timer"
                aria-label="Tempo restante"
                className={cn("font-display text-[34px] font-black tabular-nums leading-none", urgent ? "text-coral" : "text-ink", urgent && left > 0 && "timer-urgent")}
              >
                {formatClock(left)}
              </p>
            </div>
            <span className="rounded-full bg-course-soft px-3 py-1.5 font-display text-sm font-black text-course">
              {answered}/{questions.length}
            </span>
          </div>
          <ProgressBar value={(answered / questions.length) * 100} className="h-2.5" label="Questões respondidas" />

          <nav aria-label="Navegar entre questões" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
            {questions.map((x, i) => {
              const done = Boolean(answers[x.id]);
              const current = i === index;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Questão ${i + 1}${done ? ", respondida" : ""}${flags[x.id] ? ", marcada" : ""}`}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-inner font-display text-sm font-black active:scale-90",
                    done ? "bg-course text-white" : "bg-canvas text-muted hover:text-ink",
                    current && "ring-2 ring-ink ring-offset-2 ring-offset-surface",
                  )}
                >
                  {i + 1}
                  {flags[x.id] ? <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-sun ring-2 ring-surface" /> : null}
                </button>
              );
            })}
          </nav>

          {confirming ? (
            <div role="alertdialog" aria-label="Confirmar entrega" className="anim-in flex flex-col gap-3 rounded-panel bg-sun-soft p-panel">
              <p className="px-2 pt-2 font-semibold text-sun-ink">
                {blank > 0 ? `Você deixou ${blank} em branco. ` : "Tudo respondido! "}Depois de entregar, não dá para mudar.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={submit} disabled={submitting} className={buttonClass({ variant: "sun", size: "sm" }, "flex-1")}>
                  {submitting ? "Entregando…" : "Entregar agora"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={buttonClass({ variant: "secondary", size: "sm" })}>
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={buttonClass({ variant: "sun" })}>
              Entregar simulado
            </button>
          )}
          {left <= 0 ? <p className="font-semibold text-coral">Tempo esgotado. Entregando o que foi salvo…</p> : null}
          {error ? (
            <p role="alert" className="anim-in rounded-inner bg-coral-soft px-3 py-2 text-sm font-semibold text-coral">
              {error}
            </p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
