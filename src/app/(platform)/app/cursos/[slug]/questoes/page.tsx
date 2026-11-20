import type { Metadata } from "next";
import Link from "next/link";
import { getCourseQuestions } from "@/lib/queries";
import { courseThemeVars } from "@/lib/utils";
import { requireCourseAccess } from "../access";
import { Practice } from "./practice";

export const metadata: Metadata = { title: "Questões" };

export default async function QuestionsPage({ params }: PageProps<"/app/cursos/[slug]/questoes">) {
  const { slug } = await params;
  const { course } = await requireCourseAccess(slug, `/app/cursos/${slug}/questoes`);
  const questions = await getCourseQuestions(course.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" style={courseThemeVars(course.theme_color)}>
      <header className="flex flex-col gap-2">
        <Link href={`/app/cursos/${slug}`} className="font-display text-sm font-bold text-muted hover:text-ink">
          ← {course.title}
        </Link>
        <h1 className="text-[36px] font-black leading-tight tracking-[-0.02em]">Banco de questões</h1>
        <p className="text-muted">Cada acerto na primeira vez vale XP. Errou? Tente de novo depois, sem penalidade.</p>
      </header>
      {questions.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line-strong bg-surface p-10 text-center text-muted">
          O professor ainda não adicionou questões.
        </p>
      ) : (
        <Practice questions={questions} />
      )}
    </div>
  );
}
