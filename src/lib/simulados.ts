import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/dal";
import { getSubject, type AreaKey } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/server";
import type { Question, QuestionOption } from "@/lib/types";

// Simulados e listas. Reads use the user-scoped client, so RLS decides what is
// visible; the answer key only arrives through mock_attempt_review() (after
// submitting) or, for course owners, straight from question_answers.

export type CourseRef = { id: string; slug: string; title: string; subject: string | null; level: number | null; theme_color: string };

export type BankQuestion = Question & {
  options: QuestionOption[];
  course: CourseRef;
};

export type MockAttempt = {
  id: string;
  mock_exam_id: string | null;
  title: string;
  duration_minutes: number;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  total_count: number;
  correct_count: number | null;
  xp_gained: number;
};

export type AttemptItem = { position: number; question_id: string; option_id: string | null };

export type ReviewRow = {
  position: number;
  question_id: string;
  course_id: string;
  subject: string | null;
  area: AreaKey | null;
  option_id: string | null;
  correct_option_id: string | null;
  is_correct: boolean;
  explanation: string;
};

export type MockExam = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  duration_minutes: number;
  status: "draft" | "published";
};

export type QuestionList = { id: string; title: string; instructions: string; updated_at: string; count?: number };

const COURSE_REF = "id, slug, title, subject, level, theme_color";
const Q_COLS = "id, course_id, module_id, statement, explanation, difficulty, xp_reward";
const ATTEMPT_COLS = "id, mock_exam_id, title, duration_minutes, started_at, deadline_at, submitted_at, total_count, correct_count, xp_gained";

/** Courses whose questions the user can use: enrolled or owned. */
export async function getStudyCourses(): Promise<CourseRef[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const [{ data: enrolled }, { data: owned }] = await Promise.all([
    supabase.from("enrollments").select(`course:courses (${COURSE_REF})`).eq("user_id", user.id),
    supabase.from("courses").select(COURSE_REF).eq("owner_id", user.id),
  ]);
  const all = [
    ...((enrolled as unknown as { course: CourseRef | null }[] | null) ?? []).map((r) => r.course),
    ...((owned as CourseRef[] | null) ?? []),
  ].filter((c): c is CourseRef => Boolean(c));
  return [...new Map(all.map((c) => [c.id, c])).values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

/** Questions with options and course, in the order of `ids`. */
export async function loadQuestions(ids: string[]): Promise<BankQuestion[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const [{ data: qs }, { data: opts }] = await Promise.all([
    supabase.from("questions").select(`${Q_COLS}, course:courses (${COURSE_REF})`).in("id", ids),
    supabase.from("question_options").select("id, question_id, body, position").in("question_id", ids).order("position"),
  ]);
  const byQ = new Map<string, QuestionOption[]>();
  for (const o of (opts as QuestionOption[] | null) ?? []) byQ.set(o.question_id, [...(byQ.get(o.question_id) ?? []), o]);
  const map = new Map(
    ((qs as unknown as (Question & { course: CourseRef })[] | null) ?? []).map((q) => [q.id, { ...q, options: byQ.get(q.id) ?? [] }]),
  );
  return ids.map((id) => map.get(id)).filter((q): q is BankQuestion => Boolean(q));
}

export type BankFilters = { courseIds: string[]; difficulty?: string; search?: string; limit?: number };

/** Question bank search for the list builder (RLS limits it to visible courses). */
export async function searchBank({ courseIds, difficulty, search, limit = 40 }: BankFilters): Promise<BankQuestion[]> {
  if (courseIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase.from("questions").select("id").in("course_id", courseIds).order("created_at", { ascending: false }).limit(limit);
  if (difficulty && ["easy", "medium", "hard"].includes(difficulty)) query = query.eq("difficulty", difficulty);
  const term = search?.trim().replace(/[%_,()]/g, " ").slice(0, 80);
  if (term) query = query.ilike("statement", `%${term}%`);
  const { data } = await query;
  return loadQuestions(((data as { id: string }[] | null) ?? []).map((r) => r.id));
}

// ---------------------------------------------------------------- Simulados

export async function getMyAttempts(limit = 20): Promise<MockAttempt[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("mock_attempts")
    .select(ATTEMPT_COLS)
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data as MockAttempt[] | null) ?? [];
}

export async function getAttempt(id: string) {
  const supabase = await createClient();
  const { data: attempt } = await supabase.from("mock_attempts").select(ATTEMPT_COLS).eq("id", id).maybeSingle();
  if (!attempt) return null;
  const { data: items } = await supabase
    .from("mock_attempt_items")
    .select("position, question_id, option_id")
    .eq("attempt_id", id)
    .order("position");
  const rows = (items as AttemptItem[] | null) ?? [];
  const questions = await loadQuestions(rows.map((r) => r.question_id));
  return { attempt: attempt as MockAttempt, items: rows, questions };
}

export async function getAttemptReview(id: string): Promise<ReviewRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mock_attempt_review", { p_attempt: id });
  if (error) return [];
  return (data as ReviewRow[] | null) ?? [];
}

/** Published teacher exams from the user's courses (plus drafts of their own courses). */
export async function getAvailableMockExams() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mock_exams")
    .select(`id, course_id, title, description, duration_minutes, status, course:courses (${COURSE_REF}), mock_exam_questions (count)`)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(30);
  type Row = MockExam & { course: CourseRef | null; mock_exam_questions: { count: number }[] };
  return ((data as unknown as Row[] | null) ?? []).map((r) => ({ ...r, questionCount: r.mock_exam_questions?.[0]?.count ?? 0 }));
}

export async function getCourseMockExams(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mock_exams")
    .select("id, course_id, title, description, duration_minutes, status, mock_exam_questions (question_id, position)")
    .eq("course_id", courseId)
    .order("created_at");
  type Row = MockExam & { mock_exam_questions: { question_id: string; position: number }[] };
  return ((data as unknown as Row[] | null) ?? []).map((r) => ({
    ...r,
    questionIds: [...r.mock_exam_questions].sort((a, b) => a.position - b.position).map((x) => x.question_id),
  }));
}

/** Score grouped by ENEM area and by subject. */
export function scoreBreakdown(review: ReviewRow[]) {
  const group = (key: (r: ReviewRow) => string) => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const r of review) {
      const k = key(r);
      const cur = m.get(k) ?? { correct: 0, total: 0 };
      cur.total++;
      if (r.is_correct) cur.correct++;
      m.set(k, cur);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, ...v }));
  };
  return {
    byArea: group((r) => r.area ?? "outros"),
    bySubject: group((r) => r.subject ?? "outros").map((s) => ({ ...s, name: getSubject(s.key)?.name ?? "Sem matéria" })),
  };
}

// ---------------------------------------------------------------- Listas

export async function getMyLists(): Promise<QuestionList[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("question_lists")
    .select("id, title, instructions, updated_at, question_list_items (count)")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  type Row = QuestionList & { question_list_items: { count: number }[] };
  return ((data as unknown as Row[] | null) ?? []).map((r) => ({ ...r, count: r.question_list_items?.[0]?.count ?? 0 }));
}

export const getList = cache(async (id: string) => {
  const supabase = await createClient();
  const { data: list } = await supabase.from("question_lists").select("id, title, instructions, updated_at").eq("id", id).maybeSingle();
  if (!list) return null;
  const { data: items } = await supabase.from("question_list_items").select("question_id, position").eq("list_id", id).order("position");
  const ids = ((items as { question_id: string }[] | null) ?? []).map((r) => r.question_id);
  return { list: list as QuestionList, questions: await loadQuestions(ids) };
});

/** Answer key for the questions the caller owns (RLS returns nothing else). */
export async function getOwnedAnswerKey(questionIds: string[]) {
  if (questionIds.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("question_answers").select("question_id, correct_option_id").in("question_id", questionIds);
  return new Map(((data as { question_id: string; correct_option_id: string }[] | null) ?? []).map((r) => [r.question_id, r.correct_option_id]));
}
