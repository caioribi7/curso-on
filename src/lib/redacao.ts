import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import type { EssayComment, EssayStatus } from "@/lib/redacao-shared";

// Leituras da área de redação. Tudo pelo cliente do usuário: o RLS decide.

export type EssayTheme = {
  id: string;
  course_id: string;
  title: string;
  motivating_text: string;
  instructions: string;
  is_open: boolean;
  created_at: string;
  course: { title: string; theme_color: string; status: string } | null;
};

export type EssayReview = {
  c1: number | null;
  c2: number | null;
  c3: number | null;
  c4: number | null;
  c5: number | null;
  c1_comment: string;
  c2_comment: string;
  c3_comment: string;
  c4_comment: string;
  c5_comment: string;
  final_comment: string;
  total: number;
};

export type Essay = {
  id: string;
  theme_id: string;
  course_id: string;
  student_id: string;
  title: string;
  body: string | null;
  file_path: string | null;
  file_type: string | null;
  status: EssayStatus;
  submitted_at: string;
  started_at: string | null;
  corrected_at: string | null;
  theme: { title: string; motivating_text: string; instructions: string } | null;
  student: { full_name: string } | null;
  review: EssayReview | null;
};

const THEME_COLS = "id, course_id, title, motivating_text, instructions, is_open, created_at, course:courses (title, theme_color, status)";
const ESSAY_COLS =
  "id, theme_id, course_id, student_id, title, body, file_path, file_type, status, submitted_at, started_at, corrected_at, " +
  "theme:essay_themes (title, motivating_text, instructions), student:profiles!essays_student_id_fkey (full_name), " +
  "review:essay_reviews (c1, c2, c3, c4, c5, c1_comment, c2_comment, c3_comment, c4_comment, c5_comment, final_comment, total)";

/** Temas abertos de cursos publicados (lado do aluno). */
export async function getOpenThemes(): Promise<EssayTheme[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("essay_themes")
    .select(THEME_COLS.replace("course:courses (", "course:courses!inner ("))
    .eq("is_open", true)
    .eq("course.status", "published")
    .order("created_at", { ascending: false })
    .limit(60);
  return (data as unknown as EssayTheme[] | null) ?? [];
}

export async function getTheme(id: string): Promise<EssayTheme | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("essay_themes").select(THEME_COLS).eq("id", id).maybeSingle();
  return (data as unknown as EssayTheme | null) ?? null;
}

export async function getMyEssays(): Promise<Essay[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("essays")
    .select(ESSAY_COLS)
    .eq("student_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(100);
  return (data as unknown as Essay[] | null) ?? [];
}

export async function getEssay(id: string): Promise<Essay | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("essays").select(ESSAY_COLS).eq("id", id).maybeSingle();
  return (data as unknown as Essay | null) ?? null;
}

export async function getEssayComments(essayId: string): Promise<EssayComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("essay_comments")
    .select("id, start_offset, end_offset, quote, body, competency")
    .eq("essay_id", essayId)
    .order("position");
  return (data as EssayComment[] | null) ?? [];
}

/** Link temporário (10 min) para o anexo; o RLS do storage decide quem pode. */
export async function getEssayFileUrl(path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("redacoes").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------- Professor

async function ownedCourseIds() {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id").eq("owner_id", user.id);
  return ((data as { id: string }[] | null) ?? []).map((c) => c.id);
}

export async function getOwnedCourseOptions() {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, title, subject, status")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  return (data as { id: string; title: string; subject: string | null; status: string }[] | null) ?? [];
}

export async function getOwnedThemes(): Promise<(EssayTheme & { essays: number })[]> {
  const ids = await ownedCourseIds();
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("essay_themes")
    .select(`${THEME_COLS}, essays (count)`)
    .in("course_id", ids)
    .order("created_at", { ascending: false });
  return ((data as unknown as (EssayTheme & { essays: { count: number }[] })[] | null) ?? []).map((t) => ({
    ...t,
    essays: t.essays?.[0]?.count ?? 0,
  }));
}

/** Fila de correção: redações dos cursos do professor, as mais antigas primeiro. */
export async function getCorrectionQueue(done: boolean): Promise<Essay[]> {
  const ids = await ownedCourseIds();
  if (ids.length === 0) return [];
  const supabase = await createClient();
  let q = supabase.from("essays").select(ESSAY_COLS).in("course_id", ids);
  q = done
    ? q.eq("status", "corrigida").order("corrected_at", { ascending: false })
    : q.in("status", ["enviada", "em_correcao"]).order("submitted_at", { ascending: true });
  const { data } = await q.limit(100);
  return (data as unknown as Essay[] | null) ?? [];
}

export async function getQueueCount(): Promise<number> {
  const ids = await ownedCourseIds();
  if (ids.length === 0) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("essays")
    .select("id", { count: "exact", head: true })
    .in("course_id", ids)
    .in("status", ["enviada", "em_correcao"]);
  return count ?? 0;
}

export function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
