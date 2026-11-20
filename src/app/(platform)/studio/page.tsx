import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon } from "@/components/icons/flat-icons";
import { CourseBadge } from "@/components/icons/subject-icon";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/dal";
import { getOwnedCourses } from "@/lib/queries";
import { courseThemeVars } from "@/lib/utils";

export const metadata: Metadata = { title: "Estúdio" };

export default async function StudioPage() {
  await requireUser("/studio");
  const rows = await getOwnedCourses();
  const totalStudents = rows.reduce((s, r) => s + r.students, 0);
  const published = rows.filter((r) => r.course.status === "published").length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide text-brand">Estúdio do criador</p>
          <h1 className="text-[40px] font-black leading-tight tracking-[-0.03em]">Seus cursos</h1>
          <p className="text-muted">Crie, organize em módulos e aulas, monte o banco de questões e publique.</p>
        </div>
        <ButtonLink href="/studio/cursos/novo" size="lg">
          + Novo curso
        </ButtonLink>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Cursos", value: rows.length, tone: "bg-brand-soft text-brand" },
          { label: "Publicados", value: published, tone: "bg-mint-soft text-mint-dark" },
          { label: "Alunos", value: totalStudents, tone: "bg-sun-soft text-[#B87C00]" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-[24px] border border-line bg-white p-5">
            <span className={`flex size-14 items-center justify-center rounded-2xl font-display text-2xl font-black ${s.tone}`}>{s.value}</span>
            <span className="font-display text-lg font-extrabold">{s.label}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[32px] border-2 border-dashed border-line-strong bg-white px-6 py-16 text-center">
          <PencilIcon size={96} />
          <h2 className="text-2xl font-black">Seu primeiro curso começa aqui</h2>
          <p className="max-w-md text-muted">Dê um nome, escolha um ícone e uma cor. Depois é só adicionar módulos, aulas e questões.</p>
          <ButtonLink href="/studio/cursos/novo">Criar meu primeiro curso</ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ course, students, lessons }) => (
            <li key={course.id} style={courseThemeVars(course.theme_color)}>
              <Link
                href={`/studio/cursos/${course.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative flex h-36 items-center justify-center bg-course-soft">
                  <CourseBadge course={course} size={96} />
                  <span
                    className={`absolute left-4 top-4 rounded-full px-3 py-1 font-display text-xs font-extrabold ${
                      course.status === "published" ? "bg-mint text-white" : "bg-white text-muted"
                    }`}
                  >
                    {course.status === "published" ? "Publicado" : "Rascunho"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="text-xl font-black leading-tight">{course.title}</h2>
                  <p className="line-clamp-2 text-sm text-muted">{course.subtitle || "Sem subtítulo"}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-3 text-sm font-semibold text-muted">
                    <span className="rounded-full bg-canvas px-3 py-1">{lessons} aulas</span>
                    <span className="rounded-full bg-canvas px-3 py-1">{students} alunos</span>
                    {course.level ? <span className="rounded-full bg-course-soft px-3 py-1 text-course">Nível {course.level}</span> : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
