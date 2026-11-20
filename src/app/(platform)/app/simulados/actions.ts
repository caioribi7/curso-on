"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { AREAS, getSubject, SUBJECT_KEYS } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const uuid = z.string().uuid();
const AREA_KEYS = AREAS.map((a) => a.key) as [string, ...string[]];

const filters = z.object({
  subjects: z.array(z.enum(SUBJECT_KEYS)).max(13),
  areas: z.array(z.enum(AREA_KEYS)).max(4),
  levels: z.array(z.coerce.number().int().min(1).max(2)).max(2),
  count: z.coerce.number().int().min(1).max(90),
  minutes: z.coerce.number().int().min(0).max(330),
});

function titleFor(subjects: string[], areas: string[]) {
  const names = subjects.length
    ? subjects.map((s) => getSubject(s)?.name ?? s)
    : areas.map((a) => AREAS.find((x) => x.key === a)?.name ?? a);
  const what = names.length === 0 ? "Simulado geral" : names.length > 3 ? `${names.slice(0, 3).join(", ")} e mais` : names.join(", ");
  return what;
}

export async function startMock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/app/simulados");
  const parsed = filters.safeParse({
    subjects: formData.getAll("subject"),
    areas: formData.getAll("area"),
    levels: formData.getAll("level"),
    count: formData.get("count"),
    minutes: formData.get("minutes") ?? 0,
  });
  if (!parsed.success) return { error: "Confira os filtros do simulado." };
  const f = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_mock_exam", {
    p_subjects: f.subjects.length ? f.subjects : null,
    p_areas: f.areas.length ? f.areas : null,
    p_levels: f.levels.length ? f.levels : null,
    p_count: f.count,
    p_minutes: f.minutes > 0 ? f.minutes : null,
    p_title: titleFor(f.subjects, f.areas),
  });
  if (error || typeof data !== "string") {
    if (error?.message.includes("no_questions")) {
      return { error: "Nenhuma questão com esses filtros nos seus cursos. Tente outra matéria ou se matricule em mais cursos." };
    }
    return { error: "Não foi possível montar o simulado." };
  }
  redirect(`/app/simulados/${data}`);
}

export async function startCourseMock(formData: FormData) {
  const examId = uuid.parse(formData.get("examId"));
  await requireUser("/app/simulados");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_course_mock_exam", { p_exam: examId });
  if (error || typeof data !== "string") redirect("/app/simulados?erro=simulado");
  redirect(`/app/simulados/${data}`);
}

/** Saves one answer while the exam is open. Called straight from the runner. */
export async function saveMockAnswer(attemptId: string, questionId: string, optionId: string | null): Promise<{ ok: boolean; error?: string }> {
  const ids = z.object({ a: uuid, q: uuid, o: uuid.nullable() }).safeParse({ a: attemptId, q: questionId, o: optionId });
  if (!ids.success) return { ok: false, error: "Resposta inválida." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_mock_answer", { p_attempt: ids.data.a, p_question: ids.data.q, p_option: ids.data.o });
  if (error) {
    console.error("[saveMockAnswer]", error.message);
    if (error.message.includes("time_over")) return { ok: false, error: "O tempo acabou." };
    if (error.message.includes("already_submitted")) return { ok: false, error: "Este simulado já foi entregue." };
    return { ok: false, error: "Não foi possível salvar." };
  }
  return { ok: true };
}

export async function submitMock(attemptId: string) {
  const id = uuid.parse(attemptId);
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_mock_exam", { p_attempt: id });
  if (error) console.error("[submitMock]", error.message);
  if (error) return { ok: false, error: "Não foi possível entregar. Tente de novo." };
  revalidatePath("/app");
  redirect(`/app/simulados/${id}?entregue=1`);
}
