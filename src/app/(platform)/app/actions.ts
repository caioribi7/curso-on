"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

const uuid = z.string().uuid();

export async function enrollFree(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const slug = z.string().regex(/^[a-z0-9-]+$/).parse(formData.get("slug"));
  await requireUser(`/cursos/${slug}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_free", { p_course: courseId });
  if (error) redirect(`/cursos/${slug}?erro=matricula`);
  revalidatePath("/app");
  redirect(`/app/cursos/${slug}`);
}

export async function completeLesson(formData: FormData) {
  const lessonId = uuid.parse(formData.get("lessonId"));
  const slug = z.string().regex(/^[a-z0-9-]+$/).parse(formData.get("slug"));
  const nextLesson = z.union([uuid, z.literal("")]).parse(formData.get("nextLessonId") ?? "");
  await requireUser();
  const supabase = await createClient();
  const { data: gained, error } = await supabase.rpc("complete_lesson", { p_lesson: lessonId });
  if (error) redirect(`/app/cursos/${slug}`);
  revalidatePath(`/app/cursos/${slug}`);
  revalidatePath("/app");
  const xp = typeof gained === "number" ? gained : 0;
  redirect(
    nextLesson
      ? `/app/cursos/${slug}/aulas/${nextLesson}?xp=${xp}`
      : `/app/cursos/${slug}?concluida=1&xp=${xp}`,
  );
}

export type AnswerState = {
  error?: string;
  result?: { isCorrect: boolean; correctOptionId: string; explanation: string; xpGained: number; chosen: string };
};

export async function answerQuestion(_prev: AnswerState, formData: FormData): Promise<AnswerState> {
  const q = uuid.safeParse(formData.get("questionId"));
  const o = uuid.safeParse(formData.get("optionId"));
  if (!q.success) return { error: "Questão inválida." };
  if (!o.success) return { error: "Escolha uma alternativa." };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("answer_question", { p_question: q.data, p_option: o.data });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { error: "Não foi possível registrar sua resposta." };
  revalidatePath("/app");
  return {
    result: {
      isCorrect: row.is_correct,
      correctOptionId: row.correct_option_id,
      explanation: row.explanation ?? "",
      xpGained: row.xp_gained ?? 0,
      chosen: o.data,
    },
  };
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Digite seu nome.").max(80) })
    .safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil atualizado." };
}
