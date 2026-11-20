import type { Metadata } from "next";
import Link from "next/link";
import { CourseIllustration } from "@/components/icons/flat-icons";
import { CourseBadge, SubjectIcon } from "@/components/icons/subject-icon";
import { getPublishedCourses } from "@/lib/queries";
import { AREAS, SUBJECTS, type AreaKey, type Level } from "@/lib/subjects";
import type { Course } from "@/lib/types";
import { cn, courseThemeVars } from "@/lib/utils";
import { SwapTransition } from "@/components/motion/page-transition";
import { Segmented } from "@/components/motion/segmented";

export const metadata: Metadata = { title: "Cursos", description: "Preparatório para o ENEM por matéria, em dois níveis." };

/** Inside a subject row (p-3) the card radius is the row's minus 12px, so the corners stay concentric. */
const NESTED = "rounded-[calc(var(--r-card)-12px)]";

function CourseCard({ course, nested = false }: { course: Course; nested?: boolean }) {
  return (
    <Link
      href={`/cursos/${course.slug}`}
      style={courseThemeVars(course.theme_color)}
      className={cn(
        "flex items-center gap-4 border border-line bg-surface p-4 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-none",
        nested ? NESTED : "rounded-card",
      )}
    >
      <CourseBadge course={course} size={64} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-display text-lg font-black leading-tight">{course.title}</span>
        <span className="line-clamp-1 text-sm text-muted">{course.subtitle}</span>
        <span className="w-fit rounded-full bg-course-soft px-2.5 py-0.5 font-display text-xs font-black text-course">
          Nível {course.level ?? "livre"}
        </span>
      </span>
    </Link>
  );
}

function EmptySlot({ subject, level }: { subject: string; level: Level }) {
  return (
    <div className={cn("flex items-center gap-4 border-2 border-dashed border-line p-4 opacity-60", NESTED)}>
      <SubjectIcon subject={subject} level={level} size={64} />
      <span className="text-sm font-semibold text-muted">Em breve</span>
    </div>
  );
}

export default async function CatalogPage({ searchParams }: PageProps<"/cursos">) {
  const sp = await searchParams;
  const courses = await getPublishedCourses();
  const area = AREAS.some((a) => a.key === sp.area) ? (sp.area as AreaKey) : null;

  const bySubject = new Map<string, Course[]>();
  for (const c of courses) {
    if (!c.subject) continue;
    bySubject.set(c.subject, [...(bySubject.get(c.subject) ?? []), c]);
  }
  const others = courses.filter((c) => !c.subject);
  const visibleAreas = area ? AREAS.filter((a) => a.key === area) : AREAS;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-display text-sm font-extrabold uppercase tracking-wide text-brand">Preparatório ENEM</p>
        <h1 className="text-[40px] font-black leading-tight tracking-[-0.03em]">Explorar cursos</h1>
        <p className="text-lg text-muted">Cada matéria em dois níveis: 1 para a base, 2 para o aprofundamento.</p>
      </header>

      <Segmented
        name="catalog-area"
        label="Áreas do ENEM"
        active={area ?? "todas"}
        items={[
          { key: "todas", href: "/cursos", label: "Todas" },
          ...AREAS.map((a) => ({ key: a.key, href: `/cursos?area=${a.key}`, label: a.name, color: a.color })),
        ]}
      />

      <SwapTransition id={area ?? "todas"} className="flex flex-col gap-8">

      {visibleAreas.map((a) => (
        <section key={a.key} className="flex flex-col gap-4">
          <h2 className="flex items-center gap-3 text-2xl font-black">
            <span className="size-3 rounded-full" style={{ background: a.color }} />
            {a.name}
          </h2>
          <div className="flex flex-col gap-4">
            {SUBJECTS.filter((s) => s.area === a.key).map((s) => {
              const list = bySubject.get(s.key) ?? [];
              return (
                <div key={s.key} className="grid gap-3 rounded-card bg-surface/60 p-3 md:grid-cols-[180px_1fr_1fr] md:items-center">
                  <p className="px-2 font-display text-lg font-black">{s.name}</p>
                  {([1, 2] as const).map((lvl) => {
                    const items = list.filter((c) => c.level === lvl);
                    return items.length ? (
                      <div key={lvl} className="flex flex-col gap-2">
                        {items.map((c) => (
                          <CourseCard key={c.id} course={c} nested />
                        ))}
                      </div>
                    ) : (
                      <EmptySlot key={lvl} subject={s.key} level={lvl} />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!area && others.length ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-black">Outros cursos</h2>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {others.map((c) => (
              <li key={c.id}>
                <CourseCard course={c} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </SwapTransition>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <CourseIllustration icon="bulb" size={80} />
          <p className="max-w-md text-muted">
            Ainda não há cursos publicados. Rode <code className="rounded bg-canvas px-1.5 py-0.5">curso-on</code> e escolha
            “Importar cursos ENEM”, ou crie um no Estúdio.
          </p>
        </div>
      ) : null}
    </div>
  );
}
