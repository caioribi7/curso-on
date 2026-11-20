"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/dal";
import { aiProvider, suggestCorrection, type AiSuggestion } from "@/lib/ai-correction";
import { SCORE_STEPS } from "@/lib/redacao-shared";
import type { ActionState } from "@/lib/types";

// Cada ação confere quem chama; o RLS e as funções do banco conferem de novo.

const uuid = z.string().uuid();

export async function createTheme(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z
    .object({
      courseId: uuid,
      title: z.string().trim().min(3, "Dê um tema com pelo menos 3 letras.").max(200),
      motivating: z.string().trim().max(8000).default(""),
      instructions: z.string().trim().max(2000).default(""),
    })
    .safeParse({
      courseId: formData.get("courseId"),
      title: formData.get("title"),
      motivating: formData.get("motivating") ?? "",
      instructions: formData.get("instructions") ?? "",
    });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("essay_themes").insert({
    course_id: parsed.data.courseId,
    title: parsed.data.title,
    motivating_text: parsed.data.motivating,
    instructions: parsed.data.instructions,
  });
  if (error) return { error: "Não foi possível criar o tema. Confira se o curso é seu." };
  revalidatePath("/studio/redacao");
  return { ok: true, message: "Tema criado. Se o curso estiver publicado, os alunos já podem escrever." };
}

export async function toggleTheme(formData: FormData) {
  await requireUser();
  const id = uuid.parse(formData.get("themeId"));
  const open = formData.get("open") === "true";
  const supabase = await createClient();
  await supabase.from("essay_themes").update({ is_open: open }).eq("id", id);
  revalidatePath("/studio/redacao");
}

export async function deleteTheme(formData: FormData) {
  await requireUser();
  const id = uuid.parse(formData.get("themeId"));
  const supabase = await createClient();
  const { count } = await supabase.from("essays").select("id", { count: "exact", head: true }).eq("theme_id", id);
  if (count) return; // tema com redações só pode ser fechado
  await supabase.from("essay_themes").delete().eq("id", id);
  revalidatePath("/studio/redacao");
}

export async function claimEssay(formData: FormData) {
  await requireUser();
  const id = uuid.parse(formData.get("essayId"));
  const supabase = await createClient();
  await supabase.rpc("claim_essay", { p_essay: id });
  revalidatePath(`/studio/redacao/${id}`);
  revalidatePath("/studio/redacao");
}

const Review = z.object({
  essayId: uuid,
  scores: z.array(z.union([z.null(), z.number().refine((n) => (SCORE_STEPS as readonly number[]).includes(n))])).length(5),
  notes: z.array(z.string().max(2000)).length(5),
  finalComment: z.string().max(4000),
  comments: z
    .array(
      z.object({
        start_offset: z.number().int().min(0).nullable(),
        end_offset: z.number().int().min(1).nullable(),
        body: z.string().trim().min(1).max(1000),
        competency: z.number().int().min(1).max(5).nullable(),
      }),
    )
    .max(100),
  giveBack: z.boolean(),
});

export async function saveReview(input: z.input<typeof Review>): Promise<ActionState> {
  await requireUser();
  const parsed = Review.safeParse(input);
  if (!parsed.success) return { error: "Confira as notas e os comentários." };
  const d = parsed.data;
  if (d.giveBack && d.scores.some((s) => s === null)) return { error: "Dê nota às 5 competências antes de devolver." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_essay_review", {
    p_essay: d.essayId,
    p_scores: d.scores,
    p_notes: d.notes,
    p_final: d.finalComment,
    p_comments: d.comments.map((c) => ({ start: c.start_offset, end: c.end_offset, body: c.body, competency: c.competency })),
    p_return: d.giveBack,
  });
  if (error) {
    console.error("[saveReview]", error.message);
    if (error.message.includes("already_returned")) return { error: "Esta redação já foi devolvida." };
    return { error: "Não foi possível salvar a correção." };
  }
  revalidatePath(`/studio/redacao/${d.essayId}`);
  revalidatePath("/studio/redacao");
  revalidatePath(`/app/redacao/${d.essayId}`);
  return { ok: true, message: d.giveBack ? "Correção devolvida ao aluno." : "Rascunho salvo." };
}

export async function aiSuggest(essayId: string): Promise<{ suggestion?: AiSuggestion; error?: string }> {
  await requireUser();
  if (!aiProvider()) return { error: "IA não configurada." };
  const id = uuid.safeParse(essayId);
  if (!id.success) return { error: "Redação inválida." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("essays")
    .select("body, course_id, theme:essay_themes (title, motivating_text)")
    .eq("id", id.data)
    .maybeSingle();
  const essay = data as unknown as { body: string | null; course_id: string; theme: { title: string; motivating_text: string } | null } | null;
  if (!essay) return { error: "Redação não encontrada." };
  // Só o dono do curso pede sugestão (o aluno também lê a própria redação).
  const { data: owner } = await supabase.rpc("is_course_owner", { p_course: essay.course_id });
  if (!owner) return { error: "Sem permissão." };
  if (!essay.body) return { error: "A sugestão da IA funciona com redações digitadas." };
  try {
    const suggestion = await suggestCorrection({ theme: essay.theme?.title ?? "", motivating: essay.theme?.motivating_text ?? "", body: essay.body });
    return { suggestion };
  } catch (e) {
    console.error("[aiSuggest]", e);
    return { error: e instanceof Error ? e.message : "A IA não respondeu. Tente de novo." };
  }
}
