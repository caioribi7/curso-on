"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import type { CourseRef } from "@/lib/simulados";
import { AREAS, SUBJECTS } from "@/lib/subjects";
import type { ActionState } from "@/lib/types";
import { addRandom, createList, updateList } from "./actions";

export function NewListForm() {
  const [state, action] = useActionState<ActionState, FormData>(createList, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface p-card">
      <h2 className="text-xl font-black">Nova lista</h2>
      <Input name="title" required maxLength={120} placeholder="Ex.: Lista 3 — Funções" aria-label="Nome da lista" />
      {state.fieldErrors?.title ? <p className="text-sm font-semibold text-coral">{state.fieldErrors.title[0]}</p> : null}
      <FormMessage state={{ error: state.error }} />
      <div className="mt-auto">
        <SubmitButton pendingText="Criando…">Criar lista</SubmitButton>
      </div>
    </form>
  );
}

export function ListDetailsForm({ listId, title, instructions }: { listId: string; title: string; instructions: string }) {
  const [state, action] = useActionState<ActionState, FormData>(updateList, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
      <input type="hidden" name="listId" value={listId} />
      <Field label="Nome da lista" htmlFor="title" error={state.fieldErrors?.title?.[0]}>
        <Input id="title" name="title" required maxLength={120} defaultValue={title} />
      </Field>
      <Field label="Instruções (opcional)" htmlFor="instructions" hint="Aparecem no topo da folha impressa. Aceita fórmulas em $...$.">
        <Textarea id="instructions" name="instructions" rows={2} maxLength={1000} defaultValue={instructions} className="min-h-20" />
      </Field>
      <FormMessage state={state} />
      <div>
        <SubmitButton size="sm" pendingText="Salvando…">
          Salvar
        </SubmitButton>
      </div>
    </form>
  );
}

export function RandomAddForm({ listId, courses }: { listId: string; courses: CourseRef[] }) {
  const [state, action] = useActionState<ActionState, FormData>(addRandom, {});
  const subjects = SUBJECTS.filter((s) => courses.some((c) => c.subject === s.key));
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="listId" value={listId} />
      <div className="grid grid-cols-2 gap-2">
        <Select name="area" defaultValue="" aria-label="Área do ENEM">
          <option value="">Todas as áreas</option>
          {AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select name="subject" defaultValue="" aria-label="Matéria">
          <option value="">Todas as matérias</option>
          {subjects.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="level" defaultValue="" aria-label="Nível">
          <option value="">Níveis 1 e 2</option>
          <option value="1">Nível 1</option>
          <option value="2">Nível 2</option>
        </Select>
        <Select name="courseId" defaultValue="" aria-label="Curso">
          <option value="">Todos os cursos</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Input name="count" type="number" min={1} max={50} defaultValue={5} aria-label="Quantidade" className="w-24" />
        <SubmitButton pendingText="Sorteando…" className="flex-1 whitespace-nowrap">
          Sortear
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
