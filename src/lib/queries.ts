import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import type { Course, Lesson, Module, ModuleWithLessons, Question, QuestionOption } from "@/lib/types";

// All reads go through the user-scoped client: RLS decides what is visible.

const COURSE_COLS =
  "id, owner_id, slug, title, subtitle, description, theme_color, icon, subject, level, status, created_at, updated_at";
const MODULE_COLS = "id, course_id, title, description, icon, position";
const LESSON_COLS = "id, module_id, course_id, title, summary, duration_minutes, position, is_preview, xp_reward";

export const getCourseBySlug = cache(async (slug: string): Promise<Course | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_COLS).eq("slug", slug).maybeSingle();
  return (data as Course | null) ?? null;
});

export async function getPublishedCourses(): Promise<Course[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_COLS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);
  return (data as Course[] | null) ?? [];
}

export const getCourseOutline = cache(async (courseId: string): Promise<ModuleWithLessons[]> => {
  const supabase = await createClient();
  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("modules").select(MODULE_COLS).eq("course_id", courseId).order("position"),
    supabase.from("lessons").select(LESSON_COLS).eq("course_id", courseId).order("position"),
  ]);
  const byModule = new Map<string, Lesson[]>();
  for (const l of (lessons as Lesson[] | null) ?? []) {
    byModule.set(l.module_id, [...(byModule.get(l.module_id) ?? []), l]);
  }
  return ((modules as Module[] | null) ?? []).map((m) => ({ ...m, lessons: byModule.get(m.id) ?? [] }));
});

export const isEnrolled = cache(async (courseId: string): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
});

export async function getCompletedLessonIds(courseId: string): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("course_id", courseId)
    .eq("user_id", user.id);
  return new Set(((data as { lesson_id: string }[] | null) ?? []).map((r) => r.lesson_id));
}

export async function getMyEnrolledCourses() {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select(`created_at, course:courses (${COURSE_COLS})`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (data as unknown as { course: Course | null }[] | null) ?? [];
  const courses = rows.map((r) => r.course).filter((c): c is Course => Boolean(c));

  // Progress per course: completed lessons / total lessons.
  const ids = courses.map((c) => c.id);
  if (ids.length === 0) return [];
  const [{ data: lessons }, { data: done }] = await Promise.all([
    supabase.from("lessons").select("id, course_id").in("course_id", ids),
    supabase.from("lesson_progress").select("course_id").eq("user_id", user.id).in("course_id", ids),
  ]);
  const total = new Map<string, number>();
  for (const l of (lessons as { course_id: string }[] | null) ?? []) total.set(l.course_id, (total.get(l.course_id) ?? 0) + 1);
  const completed = new Map<string, number>();
  for (const p of (done as { course_id: string }[] | null) ?? []) completed.set(p.course_id, (completed.get(p.course_id) ?? 0) + 1);

  return courses.map((c) => ({
    course: c,
    totalLessons: total.get(c.id) ?? 0,
    completedLessons: completed.get(c.id) ?? 0,
  }));
}

export async function getTodayXp() {
  const user = await getCurrentUser();
  if (!user) return 0;
  const supabase = await createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("xp_events")
    .select("amount")
    .eq("user_id", user.id)
    .gte("created_at", start.toISOString());
  return ((data as { amount: number }[] | null) ?? []).reduce((s, r) => s + r.amount, 0);
}

export async function getStudyDaysThisWeek(): Promise<Set<number>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const { data } = await supabase
    .from("xp_events")
    .select("created_at")
    .eq("user_id", user.id)
    .gte("created_at", monday.toISOString());
  return new Set(((data as { created_at: string }[] | null) ?? []).map((r) => (new Date(r.created_at).getDay() + 6) % 7));
}

export async function getLeaderboard(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("course_leaderboard", { p_course: courseId, p_limit: 5 });
  return (data as { user_id: string; full_name: string; xp: number }[] | null) ?? [];
}

export async function getCourseQuestions(courseId: string) {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("questions")
    .select("id, course_id, module_id, statement, explanation, difficulty, xp_reward")
    .eq("course_id", courseId)
    .order("created_at");
  const qs = (questions as Question[] | null) ?? [];
  if (qs.length === 0) return [];
  const { data: options } = await supabase
    .from("question_options")
    .select("id, question_id, body, position")
    .in(
      "question_id",
      qs.map((q) => q.id),
    )
    .order("position");
  const byQ = new Map<string, QuestionOption[]>();
  for (const o of (options as QuestionOption[] | null) ?? []) byQ.set(o.question_id, [...(byQ.get(o.question_id) ?? []), o]);
  return qs.map((q) => ({ ...q, options: byQ.get(q.id) ?? [] }));
}

/** Owner-only: course + guarantees the caller owns it (RLS also enforces). */
export async function getOwnedCourse(courseId: string): Promise<Course | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_COLS)
    .eq("id", courseId)
    .eq("owner_id", user.id)
    .maybeSingle();
  return (data as Course | null) ?? null;
}

export async function getOwnedCourses() {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(COURSE_COLS)
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  const courses = (data as Course[] | null) ?? [];
  if (courses.length === 0) return [];
  const ids = courses.map((c) => c.id);
  const [{ data: enr }, { data: les }] = await Promise.all([
    supabase.from("enrollments").select("course_id").in("course_id", ids),
    supabase.from("lessons").select("course_id").in("course_id", ids),
  ]);
  const count = (rows: { course_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.course_id, (m.get(r.course_id) ?? 0) + 1);
    return m;
  };
  const students = count(enr as { course_id: string }[] | null);
  const lessons = count(les as { course_id: string }[] | null);
  return courses.map((c) => ({ course: c, students: students.get(c.id) ?? 0, lessons: lessons.get(c.id) ?? 0 }));
}

/** Owner-only answer key for the studio question editor. */
export async function getAnswerKey(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("question_answers").select("question_id, correct_option_id").eq("course_id", courseId);
  return new Map(((data as { question_id: string; correct_option_id: string }[] | null) ?? []).map((r) => [r.question_id, r.correct_option_id]));
}

// ---------------------------------------------------------------------------
// Conquistas, perfil público e ranking geral
// ---------------------------------------------------------------------------

export type AchievementView = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  position: number;
  unlockedAt: string | null;
};

/** The 12 achievements in order, with the date `userId` unlocked each one (null if locked). */
export async function getAchievements(userId: string): Promise<AchievementView[]> {
  const supabase = await createClient();
  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from("achievements").select("slug, name, description, icon, position").order("position"),
    supabase.from("user_achievements").select("achievement_slug, unlocked_at").eq("user_id", userId),
  ]);
  const unlocked = new Map(
    ((mine as { achievement_slug: string; unlocked_at: string }[] | null) ?? []).map((r) => [r.achievement_slug, r.unlocked_at]),
  );
  return ((all as Omit<AchievementView, "unlockedAt">[] | null) ?? []).map((a) => ({ ...a, unlockedAt: unlocked.get(a.slug) ?? null }));
}

export type PublicProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  xp: number;
  streak_days: number;
  last_study_date: string | null;
  created_at: string;
};

/** Public fields only (works for visitors too). */
export const getPublicProfile = cache(async (userId: string): Promise<PublicProfile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_profile", { p_user: userId });
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicProfile | undefined) ?? null;
});

export type RankingRow = { pos: number; user_id: string; full_name: string; xp: number; is_me: boolean };

export async function getGlobalRanking(period: "all" | "week"): Promise<RankingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("global_ranking", { p_period: period, p_limit: 50 });
  if (error) console.error("[getGlobalRanking]", error.message);
  return ((data as RankingRow[] | null) ?? []).map((r) => ({ ...r, pos: Number(r.pos), xp: Number(r.xp) }));
}
