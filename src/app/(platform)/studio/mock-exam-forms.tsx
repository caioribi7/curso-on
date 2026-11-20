"use client";

import { useActionState } from "react";
import { MathText } from "@/components/math/math-text";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createMockExam, saveMockExam } from "./mock-exam-actions";

type Exam = { id: string; title: string; description: string; duration_minutes: number; status: "draft" | "published"; questionIds: string[] };
type Q = { id: string; statement: string; difficulty: "easy" | "medium" | "hard" };
const DIFF = { easy: "Fácil", medium: "Média", hard: "Difícil" } as const;

export function NewMockExamForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createMockExam, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border-2 border-dashed border-line-strong bg-surface p-card">
      <input type="hidden" name="courseId" value={courseId} />
      <h3 className="text-xl font-black">Novo simulado</h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Nome" htmlFor="mock-title" error={state.fieldErrors?.title?.[0]}>
          <Input id="mock-title" name="title" required maxLength={120} placeholder="Simulado 1 — Funções" />
        </Field>
        <Field label="Duração (min)" htmlFor="mock-duration" error={state.fieldErrors?.duration?.[0]}>
          <Input id="mock-duration" name="duration" type="number" min={5} max={330} defaultValue={60} required />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Criando…">Criar simulado</SubmitButton>
      </div>
    </form>
  );
}

export function MockExamEditor({ courseId, exam, questions }: { courseId: string; exam: Exam; questions: Q[] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveMockExam, {});
  const chosen = new Set(exam.questionIds);
  // Chosen questions first, in their saved order; the rest after.
  const ordered = [...exam.questionIds.map((id) => questions.find((q) => q.id === id)).filter((q): q is Q => Boolean(q)), ...questions.filter((q) => !chosen.has(q.id))];

  return (
    <form action={action} className="flex flex-col gap-5 px-5 pb-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="examId" value={exam.id} />
      <div className="grid gap-3 md:grid-cols-[1fr_140px_180px]">
        <Field label="Nome" htmlFor={`t-${exam.id}`} error={state.fieldErrors?.title?.[0]}>
          <Input id={`t-${exam.id}`} name="title" required maxLength={120} defaultValue={exam.title} />
        </Field>
        <Field label="Duração (min)" htmlFor={`d-${exam.id}`} error={state.fieldErrors?.duration?.[0]}>
          <Input id={`d-${exam.id}`} name="duration" type="number" min={5} max={330} defaultValue={exam.duration_minutes} />
        </Field>
        <Field label="Situação" htmlFor={`s-${exam.id}`}>
          <Select id={`s-${exam.id}`} name="status" defaultValue={exam.status}>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
          </Select>
        </Field>
      </div>
      <Field label="Descrição (opcional)" htmlFor={`desc-${exam.id}`}>
        <Textarea id={`desc-${exam.id}`} name="description" rows={2} maxLength={1000} defaultValue={exam.description} className="min-h-20" />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-display text-sm font-bold">Questões (na ordem do banco; as marcadas entram no simulado)</legend>
        {questions.length === 0 ? <p className="text-sm text-muted">Crie questões na aba Questões primeiro.</p> : null}
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {ordered.map((q) => (
            <li key={q.id}>
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-inner p-3 ring-[1.5px] ring-line ring-inset hover:bg-canvas",
                  "has-checked:bg-course-soft has-checked:ring-course",
                )}
              >
                <input type="checkbox" name="questionId" value={q.id} defaultChecked={chosen.has(q.id)} className="mt-1 size-4 shrink-0 accent-[var(--course-primary)]" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="line-clamp-2 text-sm font-semibold">
                    <MathText text={q.statement} />
                  </span>
                  <span className="text-xs font-bold text-muted">{DIFF[q.difficulty]}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Salvando…">Salvar simulado</SubmitButton>
      </div>
    </form>
  );
}
