"use client";

import { useActionState, useState } from "react";
import { CourseIllustration } from "@/components/icons/flat-icons";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { COURSE_ICONS, type ActionState, type Course, type CourseIcon } from "@/lib/types";
import { cn, courseThemeVars } from "@/lib/utils";
import { createCourse, updateCourse } from "./actions";

export const THEME_SWATCHES = [
  "#3B5BFD",
  "#7C4DFF",
  "#E5458B",
  "#FF6B4A",
  "#F2A818",
  "#1DB27A",
  "#12A4C6",
  "#14161C",
];

const ICON_LABELS: Record<CourseIcon, string> = {
  abacus: "Matemática",
  book: "Leitura",
  bulb: "Ideias",
  flask: "Ciências",
  globe: "Idiomas",
  palette: "Arte",
  code: "Programação",
  music: "Música",
  chart: "Negócios",
  rocket: "Carreira",
};

export function CourseForm({ course }: { course?: Course }) {
  const editing = Boolean(course);
  const [state, action] = useActionState<ActionState, FormData>(editing ? updateCourse : createCourse, {});
  const [color, setColor] = useState(course?.theme_color ?? THEME_SWATCHES[0]);
  const [icon, setIcon] = useState<CourseIcon>(course?.icon ?? "abacus");
  const [title, setTitle] = useState(course?.title ?? "");
  const err = (k: string) => state.fieldErrors?.[k]?.[0];

  return (
    <form action={action} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {course ? <input type="hidden" name="courseId" value={course.id} /> : null}
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="themeColor" value={color} />

      <div className="flex flex-col gap-6">
        <Field label="Título do curso" htmlFor="title" error={err("title")}>
          <Input
            id="title"
            name="title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Matemática Básica"
            aria-invalid={Boolean(err("title"))}
          />
        </Field>
        <Field label="Subtítulo" htmlFor="subtitle" hint="Uma frase curta que aparece no card do curso." error={err("subtitle")}>
          <Input id="subtitle" name="subtitle" maxLength={200} defaultValue={course?.subtitle} placeholder="Do zero às frações, no seu ritmo." />
        </Field>
        {editing ? (
          <Field label="Descrição" htmlFor="description" hint="O que o aluno vai aprender? Aparece na página de venda." error={err("description")}>
            <Textarea id="description" name="description" rows={6} maxLength={5000} defaultValue={course?.description} />
          </Field>
        ) : null}
        <Field label="Preço (R$)" htmlFor="price" hint="Use 0 para um curso gratuito." error={err("price")}>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={course ? (course.price_cents / 100).toFixed(2).replace(".", ",") : "0"}
            className="max-w-48"
          />
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-display text-sm font-bold">Ícone do curso</legend>
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
            {COURSE_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                aria-pressed={icon === i}
                title={ICON_LABELS[i]}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-2xl border-2 bg-white transition",
                  icon === i ? "border-course bg-course-soft" : "border-line hover:border-line-strong",
                )}
                style={courseThemeVars(color)}
              >
                <CourseIllustration icon={i} size={44} />
                <span className="sr-only">{ICON_LABELS[i]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-display text-sm font-bold">Cor do curso</legend>
          <div className="flex flex-wrap items-center gap-3">
            {THEME_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color.toUpperCase() === c}
                aria-label={`Cor ${c}`}
                className={cn(
                  "size-11 rounded-full border-4 transition",
                  color.toUpperCase() === c ? "border-white ring-4 ring-ink/80" : "border-white ring-1 ring-line",
                )}
                style={{ background: c }}
              />
            ))}
            <label className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-semibold text-muted">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Personalizada
            </label>
          </div>
          {err("themeColor") ? <p className="text-sm font-semibold text-coral">{err("themeColor")}</p> : null}
        </fieldset>

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
            <CourseIllustration icon={icon} size={112} />
          </div>
          <div className="flex flex-col gap-3 p-6">
            <span className="w-fit rounded-full bg-course-soft px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wide text-course">
              {ICON_LABELS[icon]}
            </span>
            <p className="font-display text-xl font-black leading-tight">{title || "Seu curso incrível"}</p>
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
