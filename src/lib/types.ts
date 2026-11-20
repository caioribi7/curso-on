export const COURSE_ICONS = [
  "abacus",
  "book",
  "bulb",
  "flask",
  "globe",
  "palette",
  "code",
  "music",
  "chart",
  "rocket",
] as const;
export type CourseIcon = (typeof COURSE_ICONS)[number];

export const MODULE_ICONS = [
  "blocks",
  "pie",
  "percent",
  "scale",
  "shapes",
  "graph",
  "book",
  "bulb",
  "flask",
  "globe",
  "target",
  "trophy",
] as const;
export type ModuleIcon = (typeof MODULE_ICONS)[number];

export type CourseStatus = "draft" | "published";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  xp: number;
  streak_days: number;
  last_study_date: string | null;
};

export type Course = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  theme_color: string;
  icon: CourseIcon;
  subject: string | null;
  level: number | null;
  status: CourseStatus;
  created_at: string;
  updated_at: string;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  icon: ModuleIcon;
  position: number;
};

export type Lesson = {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  summary: string;
  duration_minutes: number;
  position: number;
  is_preview: boolean;
  xp_reward: number;
};

export type LessonContent = {
  lesson_id: string;
  body: string;
  video_url: string | null;
};

export type Question = {
  id: string;
  course_id: string;
  module_id: string | null;
  statement: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  xp_reward: number;
};

export type QuestionOption = {
  id: string;
  question_id: string;
  body: string;
  position: number;
};

export type ModuleWithLessons = Module & { lessons: Lesson[] };

/** Result shape returned by server actions used with useActionState. */
export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
