"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState, Lesson, LessonContent, Module } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createQuestion, deleteCourse, setCourseStatus, updateLesson } from "./actions";

const LETTERS = ["A", "B", "C", "D", "E"];

export function QuestionForm({ courseId, modules }: { courseId: string; modules: Pick<Module, "id" | "title">[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createQuestion, {});
  const [correct, setCorrect] = useState(0);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  // React 19 resets uncontrolled inputs after a form action completes.
  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-[28px] border border-line bg-white p-6"
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="correct" value={correct} />
      <h3 className="text-xl font-black">Nova questão</h3>

      <Field label="Enunciado" htmlFor="statement" error={err("statement")}>
        <Textarea id="statement" name="statement" rows={3} required placeholder="Quanto é 3/4 de 20?" />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-display text-sm font-bold">Alternativas — clique na letra para marcar a correta</legend>
        {LETTERS.map((letter, i) => (
          <div key={letter} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCorrect(i)}
              aria-pressed={correct === i}
              aria-label={`Marcar ${letter} como correta`}
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border-2 font-display font-black transition",
                correct === i ? "border-mint bg-mint text-white" : "border-line-strong bg-white text-muted hover:border-mint",
              )}
            >
              {letter}
            </button>
            <Input name={`option_${i}`} placeholder={i < 2 ? "Obrigatória" : "Opcional"} required={i < 2} maxLength={1000} />
          </div>
        ))}
        {err("options") || err("correct") ? <p className="text-sm font-semibold text-coral">{err("options") ?? err("correct")}</p> : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dificuldade" htmlFor="difficulty" hint="Fácil 5 XP · Média 10 XP · Difícil 20 XP">
          <Select id="difficulty" name="difficulty" defaultValue="medium">
            <option value="easy">Fácil</option>
            <option value="medium">Média</option>
            <option value="hard">Difícil</option>
          </Select>
        </Field>
        <Field label="Módulo (opcional)" htmlFor="moduleId">
          <Select id="moduleId" name="moduleId" defaultValue="">
            <option value="">Curso inteiro</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Explicação da resposta" htmlFor="explanation" hint="Aparece para o aluno depois que ele responde.">
        <Textarea id="explanation" name="explanation" rows={2} />
      </Field>

      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Salvando…">Adicionar questão</SubmitButton>
      </div>
    </form>
  );
}

export function StatusForm({ courseId, status }: { courseId: string; status: "draft" | "published" }) {
  const [state, action] = useActionState<ActionState, FormData>(setCourseStatus, {});
  const next = status === "published" ? "draft" : "published";
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="status" value={next} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant={status === "published" ? "secondary" : "primary"} pendingText="Atualizando…">
          {status === "published" ? "Voltar para rascunho" : "Publicar curso"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeleteCourseForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteCourse, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label='Digite "EXCLUIR" para confirmar' htmlFor="confirm">
        <Input id="confirm" name="confirm" autoComplete="off" className="max-w-xs" />
      </Field>
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="danger" pendingText="Excluindo…">
          Excluir curso para sempre
        </SubmitButton>
      </div>
    </form>
  );
}

export function LessonForm({ lesson, content }: { lesson: Lesson; content: LessonContent | null }) {
  const [state, action] = useActionState<ActionState, FormData>(updateLesson, {});
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="courseId" value={lesson.course_id} />
      <input type="hidden" name="lessonId" value={lesson.id} />
      <Field label="Título da aula" htmlFor="title" error={err("title")}>
        <Input id="title" name="title" required maxLength={160} defaultValue={lesson.title} />
      </Field>
      <Field label="Resumo" htmlFor="summary" hint="Uma linha que aparece na trilha do curso.">
        <Input id="summary" name="summary" maxLength={500} defaultValue={lesson.summary} />
      </Field>
      <Field label="Vídeo (YouTube ou Vimeo)" htmlFor="videoUrl" error={err("videoUrl")} hint="Opcional. Ex.: https://youtu.be/…">
        <Input id="videoUrl" name="videoUrl" type="url" maxLength={500} defaultValue={content?.video_url ?? ""} placeholder="https://" />
      </Field>
      <Field label="Conteúdo da aula" htmlFor="body" hint="Texto simples. Linhas em branco separam parágrafos; linhas começando com # viram títulos.">
        <Textarea id="body" name="body" rows={14} maxLength={50000} defaultValue={content?.body ?? ""} className="font-mono text-sm" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duração (min)" htmlFor="duration" error={err("duration")}>
          <Input id="duration" name="duration" type="number" min={0} max={600} defaultValue={lesson.duration_minutes} />
        </Field>
        <Field label="XP ao concluir" htmlFor="xpReward" error={err("xpReward")}>
          <Input id="xpReward" name="xpReward" type="number" min={0} max={500} defaultValue={lesson.xp_reward} />
        </Field>
        <label className="flex items-center gap-3 self-end rounded-2xl border border-line bg-white px-4 py-3.5 text-sm font-semibold">
          <input type="checkbox" name="isPreview" defaultChecked={lesson.is_preview} className="size-5 accent-[var(--course-primary)]" />
          Aula grátis (prévia)
        </label>
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Salvando…">Salvar aula</SubmitButton>
      </div>
    </form>
  );
}
