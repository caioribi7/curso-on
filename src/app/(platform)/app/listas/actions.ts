"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { AREAS, SUBJECT_KEYS } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

// RLS does the real checks: a list only accepts questions the caller can see,
// and only its owner can touch it. These actions validate input and keep
// positions tidy.

const uuid = z.string().uuid();
const MAX_ITEMS = 200;
const AREA_KEYS = AREAS.map((a) => a.key) as [string, ...string[]];

const listFields = z.object({
  title: z.string().trim().min(1, "Dê um nome para a lista.").max(120),
  instructions: z.string().trim().max(1000).default(""),
});

export async function createList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/app/listas");
  const parsed = listFields.safeParse({ title: formData.get("title"), instructions: "" });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_lists")
    .insert({ owner_id: user.id, title: parsed.data.title })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar a lista." };
  redirect(`/app/listas/${data.id}`);
}

export async function updateList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(formData.get("listId"));
  const parsed = listFields.safeParse({ title: formData.get("title"), instructions: formData.get("instructions") ?? "" });
  if (!id.success) return { error: "Lista inválida." };
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("question_lists").update(parsed.data).eq("id", id.data);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath(`/app/listas/${id.data}`);
  return { ok: true, message: "Lista salva." };
}

export async function deleteList(formData: FormData) {
  const id = uuid.parse(formData.get("listId"));
  await requireUser();
  const supabase = await createClient();
  await supabase.from("question_lists").delete().eq("id", id);
  revalidatePath("/app/listas");
  redirect("/app/listas");
}

async function currentItems(listId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("question_list_items")
    .select("question_id, position")
    .eq("list_id", listId)
    .order("position")
    .order("question_id");
  return { supabase, ids: ((data as { question_id: string }[] | null) ?? []).map((r) => r.question_id) };
}

async function touch(listId: string) {
  const supabase = await createClient();
  await supabase.from("question_lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
}

async function append(listId: string, questionIds: string[]) {
  const { supabase, ids } = await currentItems(listId);
  const fresh = [...new Set(questionIds)].filter((q) => !ids.includes(q)).slice(0, Math.max(0, MAX_ITEMS - ids.length));
  if (fresh.length === 0) return 0;
  const { error } = await supabase
    .from("question_list_items")
    .insert(fresh.map((question_id, i) => ({ list_id: listId, question_id, position: ids.length + i })));
  if (error) return -1;
  await touch(listId);
  return fresh.length;
}

/** Adds the questions ticked in the bank picker. */
export async function addQuestions(formData: FormData) {
  const listId = uuid.parse(formData.get("listId"));
  const ids = z.array(uuid).max(MAX_ITEMS).parse(formData.getAll("questionId"));
  await requireUser();
  await append(listId, ids);
  revalidatePath(`/app/listas/${listId}`);
}

/** Draws questions at random with the same filters as the simulados. */
export async function addRandom(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      listId: uuid,
      courseId: z.union([uuid, z.literal("")]),
      subject: z.union([z.enum(SUBJECT_KEYS), z.literal("")]),
      area: z.union([z.enum(AREA_KEYS), z.literal("")]),
      level: z.union([z.coerce.number().int().min(1).max(2), z.literal("")]),
      count: z.coerce.number().int().min(1).max(50),
    })
    .safeParse({
      listId: formData.get("listId"),
      courseId: formData.get("courseId") ?? "",
      subject: formData.get("subject") ?? "",
      area: formData.get("area") ?? "",
      level: formData.get("level") ?? "",
      count: formData.get("count"),
    });
  if (!parsed.success) return { error: "Confira os filtros." };
  const f = parsed.data;
  await requireUser();
  const { supabase, ids } = await currentItems(f.listId);
  const { data, error } = await supabase.rpc("pick_questions", {
    p_subjects: f.subject ? [f.subject] : null,
    p_areas: f.area ? [f.area] : null,
    p_levels: f.level ? [f.level] : null,
    p_course: f.courseId || null,
    p_count: f.count,
    p_exclude: ids.length ? ids : null,
  });
  if (error) return { error: "Não foi possível sortear." };
  const picked = ((data as string[] | null) ?? []).map(String);
  if (picked.length === 0) return { error: "Nenhuma questão nova com esses filtros." };
  const added = await append(f.listId, picked);
  if (added < 0) return { error: "Não foi possível adicionar." };
  revalidatePath(`/app/listas/${f.listId}`);
  return { ok: true, message: added === 1 ? "1 questão adicionada." : `${added} questões adicionadas.` };
}

export async function removeQuestion(formData: FormData) {
  const listId = uuid.parse(formData.get("listId"));
  const questionId = uuid.parse(formData.get("questionId"));
  await requireUser();
  const supabase = await createClient();
  await supabase.from("question_list_items").delete().eq("list_id", listId).eq("question_id", questionId);
  await touch(listId);
  revalidatePath(`/app/listas/${listId}`);
}

/** Moves one question up/down (or to the top/bottom) and renumbers the list. */
export async function moveQuestion(formData: FormData) {
  const listId = uuid.parse(formData.get("listId"));
  const questionId = uuid.parse(formData.get("questionId"));
  const direction = z.enum(["up", "down", "top", "bottom"]).parse(formData.get("direction"));
  await requireUser();
  const { supabase, ids } = await currentItems(listId);
  const from = ids.indexOf(questionId);
  if (from < 0) return;
  const to = direction === "up" ? from - 1 : direction === "down" ? from + 1 : direction === "top" ? 0 : ids.length - 1;
  if (to < 0 || to >= ids.length || to === from) return;
  const order = [...ids];
  order.splice(to, 0, order.splice(from, 1)[0]);
  await Promise.all(
    order.map((q, position) => supabase.from("question_list_items").update({ position }).eq("list_id", listId).eq("question_id", q)),
  );
  await touch(listId);
  revalidatePath(`/app/listas/${listId}`);
}
