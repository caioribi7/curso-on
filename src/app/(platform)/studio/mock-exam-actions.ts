"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

// Teacher-built simulados. RLS only lets the course owner write, and only
// with questions from the same course.

const uuid = z.string().uuid();

const examFields = z.object({
  courseId: uuid,
  title: z.string().trim().min(3, "O nome precisa de pelo menos 3 letras.").max(120),
  description: z.string().trim().max(1000).default(""),
  duration: z.coerce.number().int().min(5, "Mínimo de 5 minutos.").max(330, "Máximo de 5h30."),
});

export async function createMockExam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = examFields.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: "",
    duration: formData.get("duration"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("mock_exams")
    .insert({ course_id: parsed.data.courseId, title: parsed.data.title, duration_minutes: parsed.data.duration });
  if (error) return { error: "Não foi possível criar o simulado." };
  revalidatePath(`/studio/cursos/${parsed.data.courseId}`);
  return { ok: true, message: "Simulado criado. Escolha as questões abaixo." };
}

export async function saveMockExam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const examId = uuid.safeParse(formData.get("examId"));
  const parsed = examFields.safeParse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    duration: formData.get("duration"),
  });
  const status = z.enum(["draft", "published"]).safeParse(formData.get("status"));
  const questionIds = z.array(uuid).max(180).safeParse(formData.getAll("questionId"));
  if (!examId.success || !status.success || !questionIds.success) return { error: "Dados inválidos." };
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (status.data === "published" && questionIds.data.length === 0) return { error: "Escolha pelo menos uma questão antes de publicar." };
  await requireUser();
  const supabase = await createClient();
  const d = parsed.data;

  const { error } = await supabase
    .from("mock_exams")
    .update({ title: d.title, description: d.description, duration_minutes: d.duration, status: status.data })
    .eq("id", examId.data)
    .eq("course_id", d.courseId);
  if (error) return { error: "Não foi possível salvar." };

  await supabase.from("mock_exam_questions").delete().eq("mock_exam_id", examId.data);
  if (questionIds.data.length) {
    const { error: qErr } = await supabase
      .from("mock_exam_questions")
      .insert(questionIds.data.map((question_id, position) => ({ mock_exam_id: examId.data, question_id, position })));
    if (qErr) return { error: "Não foi possível salvar as questões." };
  }
  revalidatePath(`/studio/cursos/${d.courseId}`);
  revalidatePath("/app/simulados");
  return { ok: true, message: status.data === "published" ? "Salvo e publicado para os alunos." : "Rascunho salvo." };
}

export async function deleteMockExam(formData: FormData) {
  const examId = uuid.parse(formData.get("examId"));
  const courseId = uuid.parse(formData.get("courseId"));
  await requireUser();
  const supabase = await createClient();
  await supabase.from("mock_exams").delete().eq("id", examId).eq("course_id", courseId);
  revalidatePath(`/studio/cursos/${courseId}`);
}
