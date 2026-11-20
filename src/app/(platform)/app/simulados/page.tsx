import type { Metadata } from "next";
import Link from "next/link";
import { HubTabs } from "@/components/simulados/hub-tabs";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/dal";
import { formatMinutes } from "@/lib/time";
import { getAvailableMockExams, getMyAttempts, getStudyCourses } from "@/lib/simulados";
import { cn, courseThemeVars } from "@/lib/utils";
import { startCourseMock } from "./actions";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Simulados" };

export default async function SimuladosPage({ searchParams }: PageProps<"/app/simulados">) {
  await requireUser("/app/simulados");
  const sp = await searchParams;
  const [courses, exams, attempts] = await Promise.all([getStudyCourses(), getAvailableMockExams(), getMyAttempts()]);
  const subjects = [...new Set(courses.map((c) => c.subject).filter((s): s is string => Boolean(s)))];
  const levels = [...new Set(courses.map((c) => c.level).filter((l): l is number => Boolean(l)))].sort();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[36px] font-black leading-tight tracking-[-0.02em]">Simulados</h1>
        <p className="text-muted">Prova com tempo, como no ENEM. Suas respostas ficam salvas enquanto você faz; o gabarito aparece quando você entrega.</p>
      </header>
      <HubTabs active="simulados" />

      {sp.erro ? (
        <p role="alert" className="anim-in rounded-inner bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">
          Não foi possível começar esse simulado.
        </p>
      ) : null}

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-card border-2 border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="text-lg font-semibold">Matricule-se em um curso para fazer simulados com as questões dele.</p>
          <ButtonLink href="/cursos">Explorar cursos</ButtonLink>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <SetupForm available={subjects} levels={levels} />

          <aside className="flex flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
              <h2 className="text-xl font-black">Dos seus professores</h2>
              {exams.length === 0 ? (
                <p className="text-sm text-muted">Quando um professor publicar um simulado nos seus cursos, ele aparece aqui.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {exams.map((e) => (
                    <li
                      key={e.id}
                      style={courseThemeVars(e.course?.theme_color ?? "#3B5BFD")}
                      className="flex items-center gap-3 rounded-inner bg-course-soft p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-extrabold">{e.title}</p>
                        <p className="truncate text-xs font-semibold text-muted">
                          {e.course?.title} · {e.questionCount} questões · {formatMinutes(e.duration_minutes)}
                        </p>
                      </div>
                      <form action={startCourseMock}>
                        <input type="hidden" name="examId" value={e.id} />
                        <button className="h-9 rounded-inner bg-course px-3.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_var(--course-primary-dark)] active:translate-y-[2px] active:shadow-none">
                          Fazer
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
              <h2 className="text-xl font-black">Seus simulados</h2>
              {attempts.length === 0 ? (
                <p className="text-sm text-muted">Nenhum ainda. O primeiro do dia com 5+ questões vale 10 XP de bônus.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {attempts.map((a) => {
                    const pct = a.submitted_at && a.total_count ? Math.round(((a.correct_count ?? 0) / a.total_count) * 100) : null;
                    return (
                      <li key={a.id}>
                        <Link href={`/app/simulados/${a.id}`} className="flex items-center gap-3 rounded-inner p-2.5 hover:bg-canvas">
                          <span
                            className={cn(
                              "flex size-11 shrink-0 items-center justify-center rounded-inner font-display text-sm font-black",
                              pct === null ? "bg-sun-soft text-sun-ink" : pct >= 60 ? "bg-mint-soft text-mint-dark" : "bg-coral-soft text-coral",
                            )}
                          >
                            {pct === null ? "…" : `${pct}%`}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-sm font-extrabold">{a.title}</span>
                            <span className="block text-xs font-semibold text-muted">
                              {a.submitted_at
                                ? `${a.correct_count}/${a.total_count} acertos · +${a.xp_gained} XP`
                                : "Em andamento — continuar"}
                              {" · "}
                              {new Date(a.started_at).toLocaleDateString("pt-BR")}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
