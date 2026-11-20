"use client";

import { useActionState, useState } from "react";
import { Chip } from "@/components/simulados/filter-chips";
import { FormMessage, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { AREAS, SUBJECTS, type AreaKey } from "@/lib/subjects";
import { formatMinutes } from "@/lib/time";
import type { ActionState } from "@/lib/types";
import { startMock } from "./actions";

const COUNTS = [5, 10, 20, 45, 90];
const PACES = [
  { value: 3, label: "Ritmo do ENEM (3 min por questão)" },
  { value: 4, label: "Com folga (4 min por questão)" },
  { value: 2, label: "Contra o relógio (2 min por questão)" },
];

/** Filters for a new mock exam. `available` = subjects the student has courses in. */
export function SetupForm({ available, levels }: { available: string[]; levels: number[] }) {
  const [state, action] = useActionState<ActionState, FormData>(startMock, {});
  const [areas, setAreas] = useState<AreaKey[]>([]);
  const [count, setCount] = useState(10);
  const [pace, setPace] = useState(3);
  const minutes = count * pace;
  const subjects = SUBJECTS.filter((s) => available.includes(s.key) && (areas.length === 0 || areas.includes(s.area)));
  const areasWithCourses = AREAS.filter((a) => SUBJECTS.some((s) => s.area === a.key && available.includes(s.key)));

  return (
    <form action={action} className="flex flex-col gap-6 rounded-card border border-line bg-surface p-card">
      <input type="hidden" name="minutes" value={minutes} />
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black">Monte seu simulado</h2>
        <p className="text-muted">Questões sorteadas do banco dos seus cursos. Deixe tudo em branco para misturar tudo.</p>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 font-display text-sm font-bold">Área do ENEM</legend>
        <div className="flex flex-wrap gap-2">
          {areasWithCourses.map((a) => (
            <Chip
              key={a.key}
              name="area"
              value={a.key}
              label={a.name}
              color={a.color}
              checked={areas.includes(a.key)}
              onChange={(on) => setAreas((cur) => (on ? [...cur, a.key] : cur.filter((k) => k !== a.key)))}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 font-display text-sm font-bold">Matérias</legend>
        {subjects.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma matéria dos seus cursos nessa área.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <Chip key={s.key} name="subject" value={s.key} label={s.name} color={s.colors[0]} />
            ))}
          </div>
        )}
      </fieldset>

      {levels.length > 1 ? (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 font-display text-sm font-bold">Nível</legend>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <Chip key={l} name="level" value={String(l)} label={`Nível ${l}`} />
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2 font-display text-sm font-bold">Quantas questões</legend>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((c) => (
              <Chip key={c} type="radio" name="count" value={String(c)} label={c} checked={count === c} onChange={() => setCount(c)} />
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2.5">
          <label htmlFor="pace" className="font-display text-sm font-bold">
            Tempo
          </label>
          <Select id="pace" value={pace} onChange={(e) => setPace(Number(e.target.value))}>
            {PACES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton size="lg" pendingText="Sorteando questões…">
          Começar simulado
        </SubmitButton>
        <p className="font-display font-bold text-muted">
          {count} questões · {formatMinutes(minutes)}
        </p>
      </div>
    </form>
  );
}
