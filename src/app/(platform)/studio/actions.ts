"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { SUBJECT_KEYS } from "@/lib/subjects";
import { MODULE_ICONS, type ActionState, type CourseIcon } from "@/lib/types";
import { randomSuffix, slugify } from "@/lib/utils";

// Every action re-checks identity + ownership server-side. RLS enforces the
// same rules in Postgres, so a forged form can never touch someone else's data.

const uuid = z.string().uuid();

async function ownerContext(courseId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, status")
    .eq("id", courseId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) throw new Error("Curso não encontrado ou sem permissão.");
  return { user, supabase, course: data as { id: string; status: string } };
}

// Legacy illustration kept in `icon` for courses without a subject.
const FALLBACK_ICON: Record<string, CourseIcon> = {
  matematica: "abacus",
  fisica: "flask",
  quimica: "flask",
  biologia: "flask",
  geografia: "globe",
  historia: "book",
  filosofia: "bulb",
  sociologia: "bulb",
  ingles: "globe",
  espanhol: "globe",
};

const courseFields = z.object({
  title: z.string().trim().min(3, "O título precisa de pelo menos 3 letras.").max(120),
  subtitle: z.string().trim().max(200).default(""),
  subject: z.enum(SUBJECT_KEYS, { error: "Escolha uma matéria." }),
  level: z.coerce.number().int().min(1, "Escolha o nível.").max(2, "Escolha o nível."),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma cor válida."),
});

export async function createCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = courseFields.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") ?? "",
    subject: formData.get("subject"),
    level: formData.get("level"),
    themeColor: formData.get("themeColor"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const supabase = await createClient();
  const slug = `${slugify(parsed.data.title) || "curso"}-${randomSuffix()}`;
  const { data, error } = await supabase
    .from("courses")
    .insert({
      owner_id: user.id,
      slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      icon: FALLBACK_ICON[parsed.data.subject] ?? "book",
      subject: parsed.data.subject,
      level: parsed.data.level,
      theme_color: parsed.data.themeColor.toUpperCase(),
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o curso. Tente novamente." };

  // Starter module so the creator lands on a non-empty structure.
  await supabase.from("modules").insert({ course_id: data.id, title: "Módulo 1 — Boas-vindas", icon: "blocks", position: 0 });

  revalidatePath("/studio");
  redirect(`/studio/cursos/${data.id}`);
}

export async function updateCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("courseId"));
  if (!id.success) return { error: "Curso inválido." };
  const parsed = courseFields
    .extend({ description: z.string().trim().max(5000).default("") })
    .safeParse({
      title: formData.get("title"),
      subtitle: formData.get("subtitle") ?? "",
      subject: formData.get("subject"),
      level: formData.get("level"),
      themeColor: formData.get("themeColor"),
      description: formData.get("description") ?? "",
    });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { supabase } = await ownerContext(id.data);
  const { error } = await supabase
    .from("courses")
    .update({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      description: parsed.data.description,
      icon: FALLBACK_ICON[parsed.data.subject] ?? "book",
      subject: parsed.data.subject,
      level: parsed.data.level,
      theme_color: parsed.data.themeColor.toUpperCase(),
    })
    .eq("id", id.data);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath(`/studio/cursos/${id.data}`);
  return { ok: true, message: "Alterações salvas." };
}

export async function setCourseStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("courseId"));
  const status = z.enum(["draft", "published"]).safeParse(formData.get("status"));
  if (!id.success || !status.success) return { error: "Requisição inválida." };
  const { supabase } = await ownerContext(id.data);

  if (status.data === "published") {
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", id.data);
    if (!count) return { error: "Adicione pelo menos uma aula antes de publicar." };
  }

  const { error } = await supabase.from("courses").update({ status: status.data }).eq("id", id.data);
  if (error) return { error: "Não foi possível alterar o status." };
  revalidatePath(`/studio/cursos/${id.data}`);
  revalidatePath("/studio");
  return { ok: true, message: status.data === "published" ? "Curso publicado! Já está no catálogo." : "Curso voltou para rascunho." };
}

export async function deleteCourse(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("courseId"));
  if (!id.success) return { error: "Curso inválido." };
  if (formData.get("confirm") !== "EXCLUIR") return { error: 'Digite EXCLUIR para confirmar.' };
  const { supabase } = await ownerContext(id.data);
  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", id.data);
  if (count) return { error: "Este curso tem alunos matriculados. Despublique em vez de excluir." };
  const { error } = await supabase.from("courses").delete().eq("id", id.data);
  if (error) return { error: "Não foi possível excluir." };
  revalidatePath("/studio");
  redirect("/studio");
}

// ---------------------------------------------------------------- Modules

export async function createModule(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const title = z.string().trim().min(1).max(120).parse(formData.get("title"));
  const icon = z.enum(MODULE_ICONS).catch("blocks").parse(formData.get("icon"));
  const { supabase } = await ownerContext(courseId);
  const { data: last } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("modules").insert({
    course_id: courseId,
    title,
    icon,
    position: ((last as { position: number } | null)?.position ?? -1) + 1,
  });
  revalidatePath(`/studio/cursos/${courseId}`);
}

export async function updateModule(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const moduleId = uuid.parse(formData.get("moduleId"));
  const title = z.string().trim().min(1).max(120).parse(formData.get("title"));
  const description = z.string().trim().max(500).parse(formData.get("description") ?? "");
  const icon = z.enum(MODULE_ICONS).parse(formData.get("icon"));
  const { supabase } = await ownerContext(courseId);
  await supabase.from("modules").update({ title, description, icon }).eq("id", moduleId).eq("course_id", courseId);
  revalidatePath(`/studio/cursos/${courseId}`);
}

export async function deleteModule(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const moduleId = uuid.parse(formData.get("moduleId"));
  const { supabase } = await ownerContext(courseId);
  await supabase.from("modules").delete().eq("id", moduleId).eq("course_id", courseId);
  revalidatePath(`/studio/cursos/${courseId}`);
}

async function swapPositions(
  table: "modules" | "lessons",
  scope: { column: "course_id" | "module_id"; value: string },
  id: string,
  direction: "up" | "down",
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data } = await supabase.from(table).select("id, position").eq(scope.column, scope.value).order("position");
  const rows = (data as { id: string; position: number }[] | null) ?? [];
  const index = rows.findIndex((r) => r.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  // Normalize to 0..n then swap, so duplicated positions never get stuck.
  const ordered = rows.map((r) => r.id);
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  await Promise.all(ordered.map((rowId, position) => supabase.from(table).update({ position }).eq("id", rowId)));
}

export async function moveModule(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const moduleId = uuid.parse(formData.get("moduleId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const { supabase } = await ownerContext(courseId);
  await swapPositions("modules", { column: "course_id", value: courseId }, moduleId, direction, supabase);
  revalidatePath(`/studio/cursos/${courseId}`);
}

// ---------------------------------------------------------------- Lessons

export async function createLesson(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const moduleId = uuid.parse(formData.get("moduleId"));
  const title = z.string().trim().min(1).max(160).parse(formData.get("title"));
  const { supabase } = await ownerContext(courseId);
  const { data: last } = await supabase
    .from("lessons")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      module_id: moduleId,
      title,
      position: ((last as { position: number } | null)?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível criar a aula.");
  await supabase.from("lesson_contents").insert({ lesson_id: data.id, course_id: courseId });
  revalidatePath(`/studio/cursos/${courseId}`);
  redirect(`/studio/cursos/${courseId}/aulas/${data.id}`);
}

export async function updateLesson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      courseId: uuid,
      lessonId: uuid,
      title: z.string().trim().min(1, "Dê um título para a aula.").max(160),
      summary: z.string().trim().max(500).default(""),
      duration: z.coerce.number().int().min(0).max(600),
      xpReward: z.coerce.number().int().min(0).max(500),
      isPreview: z.boolean(),
      body: z.string().max(50000).default(""),
      videoUrl: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === "" || /^https:\/\//.test(v), "Use um link https (YouTube ou Vimeo)."),
    })
    .safeParse({
      courseId: formData.get("courseId"),
      lessonId: formData.get("lessonId"),
      title: formData.get("title"),
      summary: formData.get("summary") ?? "",
      duration: formData.get("duration") || 0,
      xpReward: formData.get("xpReward") || 0,
      isPreview: formData.get("isPreview") === "on",
      body: formData.get("body") ?? "",
      videoUrl: formData.get("videoUrl") ?? "",
    });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const { supabase } = await ownerContext(d.courseId);

  const { error } = await supabase
    .from("lessons")
    .update({ title: d.title, summary: d.summary, duration_minutes: d.duration, xp_reward: d.xpReward, is_preview: d.isPreview })
    .eq("id", d.lessonId)
    .eq("course_id", d.courseId);
  if (error) return { error: "Não foi possível salvar a aula." };

  const { error: contentError } = await supabase
    .from("lesson_contents")
    .upsert({ lesson_id: d.lessonId, course_id: d.courseId, body: d.body, video_url: d.videoUrl || null });
  if (contentError) return { error: "Não foi possível salvar o conteúdo." };

  revalidatePath(`/studio/cursos/${d.courseId}`);
  return { ok: true, message: "Aula salva." };
}

export async function deleteLesson(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const lessonId = uuid.parse(formData.get("lessonId"));
  const { supabase } = await ownerContext(courseId);
  await supabase.from("lessons").delete().eq("id", lessonId).eq("course_id", courseId);
  revalidatePath(`/studio/cursos/${courseId}`);
  redirect(`/studio/cursos/${courseId}`);
}

export async function moveLesson(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const moduleId = uuid.parse(formData.get("moduleId"));
  const lessonId = uuid.parse(formData.get("lessonId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const { supabase } = await ownerContext(courseId);
  await swapPositions("lessons", { column: "module_id", value: moduleId }, lessonId, direction, supabase);
  revalidatePath(`/studio/cursos/${courseId}`);
}

// ---------------------------------------------------------------- Questions

export async function createQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const options = [0, 1, 2, 3, 4]
    .map((i) => String(formData.get(`option_${i}`) ?? "").trim())
    .map((body, index) => ({ body, index }))
    .filter((o) => o.body.length > 0);

  const parsed = z
    .object({
      courseId: uuid,
      moduleId: z.union([uuid, z.literal("")]),
      statement: z.string().trim().min(3, "Escreva o enunciado.").max(4000),
      explanation: z.string().trim().max(4000).default(""),
      difficulty: z.enum(["easy", "medium", "hard"]),
      correct: z.coerce.number().int().min(0).max(4),
    })
    .safeParse({
      courseId: formData.get("courseId"),
      moduleId: formData.get("moduleId") ?? "",
      statement: formData.get("statement"),
      explanation: formData.get("explanation") ?? "",
      difficulty: formData.get("difficulty"),
      correct: formData.get("correct"),
    });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (options.length < 2) return { fieldErrors: { options: ["Preencha pelo menos 2 alternativas."] } };
  const correctOption = options.find((o) => o.index === parsed.data.correct);
  if (!correctOption) return { fieldErrors: { correct: ["Marque uma alternativa preenchida como correta."] } };

  const d = parsed.data;
  const { supabase } = await ownerContext(d.courseId);
  const xp = d.difficulty === "easy" ? 5 : d.difficulty === "medium" ? 10 : 20;

  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      course_id: d.courseId,
      module_id: d.moduleId || null,
      statement: d.statement,
      explanation: d.explanation,
      difficulty: d.difficulty,
      xp_reward: xp,
    })
    .select("id")
    .single();
  if (error || !question) return { error: "Não foi possível salvar a questão." };

  const { data: inserted, error: optError } = await supabase
    .from("question_options")
    .insert(options.map((o, position) => ({ question_id: question.id, body: o.body, position })))
    .select("id, position");
  if (optError || !inserted) {
    await supabase.from("questions").delete().eq("id", question.id);
    return { error: "Não foi possível salvar as alternativas." };
  }
  const correctPosition = options.indexOf(correctOption);
  const correctId = (inserted as { id: string; position: number }[]).find((o) => o.position === correctPosition)?.id;
  const { error: keyError } = await supabase
    .from("question_answers")
    .insert({ question_id: question.id, course_id: d.courseId, correct_option_id: correctId });
  if (keyError) {
    await supabase.from("questions").delete().eq("id", question.id);
    return { error: "Não foi possível salvar o gabarito." };
  }

  revalidatePath(`/studio/cursos/${d.courseId}`);
  return { ok: true, message: "Questão adicionada ao banco." };
}

export async function deleteQuestion(formData: FormData) {
  const courseId = uuid.parse(formData.get("courseId"));
  const questionId = uuid.parse(formData.get("questionId"));
  const { supabase } = await ownerContext(courseId);
  await supabase.from("questions").delete().eq("id", questionId).eq("course_id", courseId);
  revalidatePath(`/studio/cursos/${courseId}`);
}
