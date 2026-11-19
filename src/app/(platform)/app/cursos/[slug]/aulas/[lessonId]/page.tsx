import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/icons/flat-icons";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCompletedLessonIds, getCourseOutline } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { courseThemeVars, toEmbedUrl } from "@/lib/utils";
import { completeLesson } from "../../../../actions";
import { requireCourseAccess } from "../../access";

export const metadata: Metadata = { title: "Aula" };

/** Minimal, safe text renderer: React escapes everything; no HTML from authors. */
function LessonBody({ body }: { body: string }) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-4 text-[17px] leading-[1.7] text-ink">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h3 key={i} className="mt-2 text-xl font-black">{b.slice(3)}</h3>;
        if (b.startsWith("# ")) return <h2 key={i} className="mt-2 text-2xl font-black">{b.slice(2)}</h2>;
        const lines = b.split("\n");
        if (lines.every((line) => /^[-*] /.test(line))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1.5 pl-6">
              {lines.map((line, j) => (
                <li key={j}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {b}
          </p>
        );
      })}
    </div>
  );
}

export default async function LessonPage({ params, searchParams }: PageProps<"/app/cursos/[slug]/aulas/[lessonId]">) {
  const { slug, lessonId } = await params;
  const sp = await searchParams;
  const { course } = await requireCourseAccess(slug, `/app/cursos/${slug}/aulas/${lessonId}`);
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();

  const [outline, done] = await Promise.all([getCourseOutline(course.id), getCompletedLessonIds(course.id)]);
  const lessons = outline.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index < 0) notFound();
  const lesson = lessons[index];
  const prev = lessons[index - 1];
  const next = lessons[index + 1];
  const isDone = done.has(lesson.id);

  const supabase = await createClient();
  const { data: content } = await supabase
    .from("lesson_contents")
    .select("body, video_url")
    .eq("lesson_id", lesson.id)
    .maybeSingle();
  const embed = toEmbedUrl(content?.video_url);
  const gained = Number(sp.xp ?? 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6" style={courseThemeVars(course.theme_color)}>
      {gained > 0 ? (
        <p role="status" className="rounded-2xl bg-mint-soft px-5 py-3 font-display font-extrabold text-mint-dark">
          +{gained} XP pela aula anterior. Segue o ritmo!
        </p>
      ) : null}
      <header className="flex flex-col gap-3">
        <Link href={`/app/cursos/${slug}`} className="font-display text-sm font-bold text-muted hover:text-ink">
          ← {course.title}
        </Link>
        <p className="font-display text-sm font-extrabold uppercase tracking-wide text-course">
          {lesson.moduleTitle} · Aula {index + 1} de {lessons.length}
        </p>
        <h1 className="text-[36px] font-black leading-tight tracking-[-0.02em]">{lesson.title}</h1>
        <div className="h-2.5 rounded-full bg-course-soft">
          <div className="h-2.5 rounded-full bg-course" style={{ width: `${((index + 1) / lessons.length) * 100}%` }} />
        </div>
      </header>

      {embed ? (
        <div className="aspect-video overflow-hidden rounded-[24px] bg-ink">
          <iframe
            src={embed}
            title={lesson.title}
            className="size-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        </div>
      ) : null}

      <article className="rounded-[28px] border border-line bg-white p-6 sm:p-10">
        {content?.body ? (
          <LessonBody body={content.body} />
        ) : (
          <p className="text-muted">{embed ? lesson.summary || "Assista ao vídeo acima." : "O conteúdo desta aula ainda não foi publicado."}</p>
        )}
      </article>

      <footer className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-line bg-white p-5">
        {prev ? (
          <ButtonLink href={`/app/cursos/${slug}/aulas/${prev.id}`} variant="ghost">
            ← Anterior
          </ButtonLink>
        ) : (
          <span />
        )}
        {isDone ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-mint-soft px-4 py-2 font-display font-black text-mint-dark">
              <CheckIcon /> Concluída
            </span>
            <ButtonLink href={next ? `/app/cursos/${slug}/aulas/${next.id}` : `/app/cursos/${slug}/questoes`}>
              {next ? "Próxima aula →" : "Praticar questões →"}
            </ButtonLink>
          </div>
        ) : (
          <form action={completeLesson}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="nextLessonId" value={next?.id ?? ""} />
            <SubmitButton size="lg" pendingText="Salvando…">
              Concluir aula · +{lesson.xp_reward} XP
            </SubmitButton>
          </form>
        )}
      </footer>
    </div>
  );
}
