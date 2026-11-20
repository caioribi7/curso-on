import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { getOwnedCourse } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, LessonContent } from "@/lib/types";
import { courseThemeVars } from "@/lib/utils";
import { deleteLesson } from "../../../../actions";
import { LessonForm } from "../../../../editor-forms";

export const metadata: Metadata = { title: "Editar aula" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function LessonEditorPage({ params }: PageProps<"/studio/cursos/[id]/aulas/[lessonId]">) {
  const { id, lessonId } = await params;
  await requireUser(`/studio/cursos/${id}/aulas/${lessonId}`);
  if (!UUID.test(id) || !UUID.test(lessonId)) notFound();
  const course = await getOwnedCourse(id);
  if (!course) notFound();

  const supabase = await createClient();
  const [{ data: lesson }, { data: content }] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, module_id, course_id, title, summary, duration_minutes, position, is_preview, xp_reward")
      .eq("id", lessonId)
      .eq("course_id", id)
      .maybeSingle(),
    supabase.from("lesson_contents").select("lesson_id, body, video_url").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  if (!lesson) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8" style={courseThemeVars(course.theme_color)}>
      <header className="flex flex-col gap-2">
        <Link href={`/studio/cursos/${id}`} className="font-display text-sm font-bold text-muted hover:text-ink">
          ← {course.title}
        </Link>
        <h1 className="text-[36px] font-black leading-tight tracking-[-0.02em]">Editar aula</h1>
      </header>
      <div className="rounded-card border border-line bg-surface p-card">
        <LessonForm lesson={lesson as Lesson} content={(content as LessonContent | null) ?? null} />
      </div>
      <form action={deleteLesson} className="flex justify-end">
        <input type="hidden" name="courseId" value={id} />
        <input type="hidden" name="lessonId" value={lessonId} />
        <button className="text-sm font-semibold text-coral hover:underline">Excluir esta aula</button>
      </form>
    </div>
  );
}
