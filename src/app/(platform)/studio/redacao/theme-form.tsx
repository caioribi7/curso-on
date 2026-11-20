"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/lib/types";
import { createTheme } from "./actions";

type CourseOption = { id: string; title: string; subject: string | null; status: string };

export function ThemeForm({ courses }: { courses: CourseOption[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createTheme, {});
  const fe = state.fieldErrors ?? {};
  // Sugere primeiro um curso de Redação.
  const sorted = [...courses].sort((a, b) => Number(b.subject === "redacao") - Number(a.subject === "redacao"));

  if (courses.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-card text-muted">
        Para criar temas, primeiro crie um curso no Estúdio. Os temas ficam ligados a um curso seu.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
      <h2 className="text-xl font-black">Novo tema</h2>
      <Field label="Curso" htmlFor="courseId" hint="Alunos veem temas de cursos publicados." error={fe.courseId?.[0]}>
        <Select id="courseId" name="courseId" defaultValue={sorted[0]?.id}>
          {sorted.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.status !== "published" ? " (rascunho)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tema" htmlFor="title" error={fe.title?.[0]}>
        <Input id="title" name="title" required minLength={3} maxLength={200} placeholder="Ex.: Desafios para a valorização da herança africana no Brasil" />
      </Field>
      <Field label="Textos motivadores" htmlFor="motivating" hint="Cole os textos de apoio, um por parágrafo." error={fe.motivating?.[0]}>
        <Textarea id="motivating" name="motivating" maxLength={8000} rows={8} />
      </Field>
      <Field label="Instruções (opcional)" htmlFor="instructions" error={fe.instructions?.[0]}>
        <Textarea id="instructions" name="instructions" maxLength={2000} rows={3} placeholder="Ex.: texto dissertativo-argumentativo, até 30 linhas." />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Criando…">Criar tema</SubmitButton>
    </form>
  );
}
