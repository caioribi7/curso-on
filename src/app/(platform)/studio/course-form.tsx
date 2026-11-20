"use client";

import { useActionState, useState } from "react";
import { SubjectIcon } from "@/components/icons/subject-icon";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { AREAS, SUBJECTS, getSubject, subjectColor, subjectTitle, type Level } from "@/lib/subjects";
import type { ActionState, Course } from "@/lib/types";
import { cn, courseThemeVars } from "@/lib/utils";
import { createCourse, updateCourse } from "./actions";

export function CourseForm({ course }: { course?: Course }) {
  const editing = Boolean(course);
  const [state, action] = useActionState<ActionState, FormData>(editing ? updateCourse : createCourse, {});
  const [subject, setSubject] = useState(course?.subject ?? "matematica");
  const [level, setLevel] = useState<Level>((course?.level as Level) ?? 1);
  const [color, setColor] = useState(course?.theme_color ?? subjectColor("matematica", 1));
  const [title, setTitle] = useState(course?.title ?? subjectTitle("matematica", 1));
  const [titleTouched, setTitleTouched] = useState(editing);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  function pick(nextSubject: string, nextLevel: Level) {
    setSubject(nextSubject);
    setLevel(nextLevel);
    setColor(subjectColor(nextSubject, nextLevel));
    if (!titleTouched) setTitle(subjectTitle(nextSubject, nextLevel));
  }

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {course ? <input type="hidden" name="courseId" value={course.id} /> : null}
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="themeColor" value={color} />

      <div className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-display text-sm font-bold">1. Matéria do ENEM</legend>
          {AREAS.map((area) => (
            <div key={area.key} className="flex flex-col gap-2">
              <p className="font-display text-xs font-extrabold uppercase tracking-wide" style={{ color: area.color }}>
                {area.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.filter((s) => s.area === area.key).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => pick(s.key, level)}
                    aria-pressed={subject === s.key}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border-2 bg-white py-1.5 pl-1.5 pr-4 font-display text-sm font-extrabold transition",
                      subject === s.key ? "border-ink" : "border-line hover:border-line-strong",
                    )}
                  >
                    <SubjectIcon subject={s.key} level={level} size={34} showLevel={false} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-sm font-bold">2. Nível</legend>
          <div className="flex flex-wrap gap-3">
            {([1, 2] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => pick(subject, l)}
                aria-pressed={level === l}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 bg-white p-2 pr-5 text-left transition",
                  level === l ? "border-ink" : "border-line hover:border-line-strong",
                )}
              >
                <SubjectIcon subject={subject} level={l} size={48} />
                <span>
                  <span className="block font-display font-black">
                    {getSubject(subject)?.name} {l}
                  </span>
                  <span className="block text-xs text-muted">{l === 1 ? "Base e conteúdos iniciais" : "Aprofundamento e ENEM"}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="3. Título do curso" htmlFor="title" error={err("title")}>
          <Input
            id="title"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            aria-invalid={Boolean(err("title"))}
          />
        </Field>
        <Field label="Subtítulo" htmlFor="subtitle" hint="Uma frase curta que aparece no card do curso." error={err("subtitle")}>
          <Input id="subtitle" name="subtitle" maxLength={200} defaultValue={course?.subtitle} placeholder="Do zero ao ENEM, no seu ritmo." />
        </Field>
        {editing ? (
          <Field label="Descrição" htmlFor="description" hint="O que o aluno vai aprender? Aparece na página do curso." error={err("description")}>
            <Textarea id="description" name="description" rows={6} maxLength={5000} defaultValue={course?.description} />
          </Field>
        ) : null}

        <label className="flex w-fit items-center gap-3 rounded-full border border-line bg-white py-1 pl-1 pr-4 text-sm font-semibold text-muted">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value.toUpperCase())}
            className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          Cor da página do curso (opcional)
        </label>
        {err("themeColor") || err("subject") || err("level") ? (
          <p className="text-sm font-semibold text-coral">{err("themeColor") ?? err("subject") ?? err("level")}</p>
        ) : null}

        <FormMessage state={state} />
        <div>
          <SubmitButton pendingText={editing ? "Salvando…" : "Criando…"}>{editing ? "Salvar alterações" : "Criar curso"}</SubmitButton>
        </div>
      </div>

      {/* Live preview — the course palette re-themes the whole card. */}
      <aside className="lg:sticky lg:top-28 lg:self-start" style={courseThemeVars(color)}>
        <p className="mb-3 font-display text-sm font-bold text-muted">Pré-visualização</p>
        <div className="overflow-hidden rounded-[28px] border border-line bg-white">
          <div className="flex h-40 items-center justify-center bg-course-soft">
            <SubjectIcon subject={subject} level={level} size={112} />
          </div>
          <div className="flex flex-col gap-3 p-6">
            <span className="w-fit rounded-full bg-course-soft px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wide text-course">
              ENEM · {AREAS.find((a) => a.key === getSubject(subject)?.area)?.name}
            </span>
            <p className="font-display text-xl font-black leading-tight">{title || "Seu curso"}</p>
            <div className="h-3 rounded-full bg-course-soft">
              <div className="h-3 w-2/5 rounded-full bg-course" />
            </div>
            <span className="mt-1 inline-flex h-11 items-center justify-center rounded-2xl bg-course font-display font-extrabold text-white shadow-[0_4px_0_var(--course-primary-dark)]">
              Continuar
            </span>
          </div>
        </div>
      </aside>
    </form>
  );
}
