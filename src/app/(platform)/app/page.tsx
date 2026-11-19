import type { Metadata } from "next";
import Link from "next/link";
import { BoltIcon, CourseIllustration, FlameIcon, TrophyIcon } from "@/components/icons/flat-icons";
import { CourseBadge } from "@/components/icons/subject-icon";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { effectiveStreak, getProfile, levelFromXp, requireUser } from "@/lib/dal";
import { getMyEnrolledCourses, getStudyDaysThisWeek, getTodayXp } from "@/lib/queries";
import { AREAS, getSubject } from "@/lib/subjects";
import { courseThemeVars } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

const DAILY_GOAL = 50;

type Enrolled = Awaited<ReturnType<typeof getMyEnrolledCourses>>;

function groupByArea(rows: Enrolled) {
  const groups = AREAS.map((a) => ({
    key: a.key as string,
    name: a.name,
    color: a.color,
    items: rows.filter((r) => getSubject(r.course.subject)?.area === a.key),
  }));
  groups.push({ key: "outros", name: "Outros cursos", color: "#8A8F9C", items: rows.filter((r) => !getSubject(r.course.subject)) });
  return groups.filter((g) => g.items.length > 0);
}
const WEEK = ["S", "T", "Q", "Q", "S", "S", "D"];

export default async function DashboardPage() {
  await requireUser("/app");
  const [profile, courses, todayXp, studyDays] = await Promise.all([
    getProfile(),
    getMyEnrolledCourses(),
    getTodayXp(),
    getStudyDaysThisWeek(),
  ]);
  const xp = profile?.xp ?? 0;
  const lvl = levelFromXp(xp);
  const streak = profile ? effectiveStreak(profile) : 0;
  const firstName = (profile?.full_name || "estudante").split(" ")[0];
  const todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[40px] font-black leading-tight tracking-[-0.03em]">Oi, {firstName}! 👋</h1>
        <p className="text-lg text-muted">
          {todayXp >= DAILY_GOAL ? "Meta do dia batida. Mandou bem!" : `Faltam ${DAILY_GOAL - todayXp} XP para a meta de hoje.`}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="flex flex-col gap-4 rounded-[28px] bg-brand p-6 text-white shadow-[0_8px_0_#2A44D4]">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-3 py-1 font-display text-sm font-extrabold">Nível {lvl.level}</span>
            <BoltIcon size={28} />
          </div>
          <p className="font-display text-[44px] font-black leading-none">{xp.toLocaleString("pt-BR")} XP</p>
          <div className="h-3 rounded-full bg-white/25">
            <div className="h-3 rounded-full bg-sun" style={{ width: `${(lvl.current / lvl.next) * 100}%` }} />
          </div>
          <p className="text-sm text-[#DCE3FF]">
            {lvl.next - lvl.current} XP para o nível {lvl.level + 1}
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] border border-line bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-coral-soft">
              <FlameIcon size={28} />
            </span>
            <div>
              <p className="font-display text-2xl font-black leading-none">{streak} dias</p>
              <p className="text-sm text-muted">de sequência</p>
            </div>
          </div>
          <ol className="flex justify-between">
            {WEEK.map((d, i) => (
              <li key={i} className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex size-9 items-center justify-center rounded-full font-display text-sm font-black ${
                    studyDays.has(i) ? "bg-coral text-white" : i === todayIndex ? "border-2 border-coral text-coral" : "bg-canvas text-subtle"
                  }`}
                >
                  {studyDays.has(i) ? "✓" : d}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-4 rounded-[28px] border border-line bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-sun-soft">
              <TrophyIcon size={30} />
            </span>
            <div>
              <p className="font-display text-2xl font-black leading-none">
                {Math.min(todayXp, DAILY_GOAL)}/{DAILY_GOAL} XP
              </p>
              <p className="text-sm text-muted">meta de hoje</p>
            </div>
          </div>
          <ProgressBar value={(todayXp / DAILY_GOAL) * 100} tone="sun" className="bg-sun-soft" />
        </section>
      </div>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black">Meus cursos</h2>
          <Link href="/cursos" className="font-display font-bold text-brand hover:underline">
            Explorar catálogo →
          </Link>
        </div>
        {courses.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[32px] border-2 border-dashed border-line-strong bg-white px-6 py-14 text-center">
            <CourseIllustration icon="rocket" size={96} />
            <h3 className="text-xl font-black">Nenhum curso por aqui ainda</h3>
            <p className="max-w-md text-muted">Escolha um curso no catálogo — ou crie o seu no Estúdio.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/cursos">Ver cursos</ButtonLink>
              <ButtonLink href="/studio" variant="secondary">
                Abrir Estúdio
              </ButtonLink>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groupByArea(courses).map((group) => (
              <div key={group.key} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-muted">
                  <span className="size-2.5 rounded-full" style={{ background: group.color }} />
                  {group.name}
                </h3>
                <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map(({ course, totalLessons, completedLessons }) => {
                    const pct = totalLessons ? (completedLessons / totalLessons) * 100 : 0;
                    return (
                      <li key={course.id} style={courseThemeVars(course.theme_color)}>
                        <Link
                          href={`/app/cursos/${course.slug}`}
                          className="flex h-full items-center gap-5 rounded-[28px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          <span className="flex size-20 shrink-0 items-center justify-center rounded-[20px] bg-course-soft">
                            <CourseBadge course={course} size={60} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-2">
                            <span className="truncate font-display text-lg font-black">{course.title}</span>
                            <ProgressBar value={pct} />
                            <span className="text-sm font-semibold text-muted">
                              {completedLessons}/{totalLessons} aulas
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
