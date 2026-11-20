import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckIcon,
  ChevronRight,
  FlameIcon,
  ModuleGlyph,
  PlayIcon,
  TrophyIcon,
  moduleIconBg,
} from "@/components/icons/flat-icons";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { CourseBadge } from "@/components/icons/subject-icon";
import { Toast } from "@/components/motion/toast";
import { ButtonLink } from "@/components/ui/button";
import { ProgressBar, Ring } from "@/components/ui/progress";
import { effectiveStreak, getProfile } from "@/lib/dal";
import { getCompletedLessonIds, getFreshAchievements, getCourseBySlug, getCourseOutline, getLeaderboard, getStudyDaysThisWeek, getTodayXp } from "@/lib/queries";
import { cn, courseThemeVars, initials } from "@/lib/utils";
import { requireCourseAccess } from "./access";

export async function generateMetadata({ params }: PageProps<"/app/cursos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  return { title: course?.title ?? "Curso" };
}

const DAILY_GOAL = 50;
const WEEK = ["S", "T", "Q", "Q", "S", "S", "D"];

export default async function CourseHomePage({ params, searchParams }: PageProps<"/app/cursos/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { user, course, isOwner } = await requireCourseAccess(slug, `/app/cursos/${slug}`);

  const [outline, done, leaderboard, todayXp, studyDays, profile] = await Promise.all([
    getCourseOutline(course.id),
    getCompletedLessonIds(course.id),
    getLeaderboard(course.id),
    getTodayXp(),
    getStudyDaysThisWeek(),
    getProfile(),
  ]);

  const lessons = outline.flatMap((m) => m.lessons);
  const total = lessons.length;
  const completed = lessons.filter((l) => done.has(l.id)).length;
  const current = lessons.find((l) => !done.has(l.id)) ?? null;
  const streak = profile ? effectiveStreak(profile) : 0;
  const todayIndex = (new Date().getDay() + 6) % 7;
  const justCompleted = sp.concluida === "1";
  const gained = Number(sp.xp ?? 0);
  // Achievements the lesson just unlocked (granted by the database trigger a moment ago).
  const fresh = justCompleted
    ? await getFreshAchievements(user.id)
    : [];

  return (
    <div className="flex flex-col gap-8" style={courseThemeVars(course.theme_color)}>
      {justCompleted ? (
        <Toast clearParams tone={fresh.length ? "sun" : "mint"}>
          <span className="block">🎉 Aula concluída{gained > 0 ? ` · +${gained} XP` : ""}!</span>
          {fresh.map((a) => (
            <span key={a.slug} className="mt-2 flex items-center gap-3">
              <span className="anim-pop shrink-0">
                <AchievementBadge slug={a.slug} unlocked size={40} />
              </span>
              <span className="text-sm">
                Conquista desbloqueada: <strong>{a.name}</strong>
              </span>
            </span>
          ))}
        </Toast>
      ) : null}
      {isOwner ? (
        <p className="rounded-inner bg-sun-soft px-5 py-3 text-sm font-semibold text-sun-ink">
          Você está vendo o curso como aluno.{" "}
          <Link href={`/studio/cursos/${course.id}`} className="underline">
            Voltar ao Estúdio
          </Link>
        </p>
      ) : null}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-hero bg-course p-8 text-white shadow-[0_8px_0_var(--course-primary-dark)] sm:p-10">
        <div className="absolute -right-16 -top-24 size-80 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="flex size-36 shrink-0 items-center justify-center rounded-card bg-surface">
            <CourseBadge course={course} size={108} />
          </div>
          {/* basis-72: without a base width the title shrinks under the button instead of the button wrapping. */}
          <div className="flex min-w-0 flex-1 basis-72 flex-col gap-3">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide text-white/80">
              {outline.length} módulos · {total} aulas
            </p>
            <h1 className="text-[40px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[48px]">{course.title}</h1>
            {course.subtitle ? <p className="text-lg text-white/85">{course.subtitle}</p> : null}
            <div className="flex max-w-md items-center gap-3">
              <ProgressBar value={total ? (completed / total) * 100 : 0} tone="sun" className="flex-1 bg-white/25" label="Progresso no curso" />
              <span className="font-display font-black">
                {completed}/{total}
              </span>
            </div>
          </div>
          {current ? (
            <ButtonLink href={`/app/cursos/${slug}/aulas/${current.id}`} variant="sun" size="lg">
              <PlayIcon /> {completed === 0 ? "Começar" : "Continuar"}
            </ButtonLink>
          ) : total > 0 ? (
            <span className="anim-pop rounded-inner bg-surface px-5 py-3 font-display font-black text-course">Curso concluído! 🏆</span>
          ) : null}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Module trail */}
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Trilha do curso</h2>
            <ButtonLink href={`/app/cursos/${slug}/questoes`} variant="secondary" size="sm">
              Praticar questões
            </ButtonLink>
          </div>
          {outline.length === 0 ? (
            <p className="rounded-card border-2 border-dashed border-line-strong bg-surface p-8 text-center text-muted">
              Este curso ainda não tem aulas.
            </p>
          ) : null}
          {outline.map((m, mi) => {
            const mDone = m.lessons.filter((l) => done.has(l.id)).length;
            const complete = m.lessons.length > 0 && mDone === m.lessons.length;
            return (
              <article key={m.id} className="rounded-card border border-line bg-surface">
                <header className="flex items-center gap-4 p-5">
                  <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-inner", moduleIconBg(m.icon))}>
                    <ModuleGlyph icon={m.icon} size={44} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs font-extrabold uppercase tracking-wide text-course">Módulo {mi + 1}</p>
                    <h3 className="truncate text-xl font-black">{m.title}</h3>
                    {m.description ? <p className="truncate text-sm text-muted">{m.description}</p> : null}
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 font-display text-sm font-black",
                      complete ? "bg-mint text-white" : "bg-course-soft text-course",
                    )}
                  >
                    {complete ? "Completo" : `${mDone}/${m.lessons.length}`}
                  </span>
                </header>
                <ol className="flex flex-col border-t border-line">
                  {m.lessons.map((l) => {
                    const isDone = done.has(l.id);
                    const isCurrent = current?.id === l.id;
                    return (
                      <li key={l.id}>
                        <Link
                          href={`/app/cursos/${slug}/aulas/${l.id}`}
                          className={cn(
                            "flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0 hover:bg-canvas active:bg-line",
                            isCurrent && "bg-course-soft hover:bg-course-soft",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-full",
                              isDone ? "bg-mint text-white" : isCurrent ? "bg-course text-white" : "border-2 border-line-strong text-subtle",
                            )}
                          >
                            {isDone ? <CheckIcon size={16} /> : <PlayIcon size={14} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display font-extrabold">{l.title}</span>
                            <span className="block truncate text-sm text-muted">
                              {l.duration_minutes} min · +{l.xp_reward} XP
                            </span>
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full bg-course px-3 py-1 font-display text-xs font-black text-white">Agora</span>
                          ) : (
                            <ChevronRight className="text-subtle" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </section>

        {/* Side column */}
        <aside className="flex flex-col gap-5">
          <section className="flex items-center gap-5 rounded-card border border-line bg-surface p-card">
            <Ring value={todayXp / DAILY_GOAL} size={104} stroke={12}>
              <span className="font-display text-xl font-black leading-none">{Math.min(todayXp, DAILY_GOAL)}</span>
              <span className="text-xs font-semibold text-muted">/{DAILY_GOAL} XP</span>
            </Ring>
            <div>
              <p className="font-display text-lg font-black">Meta de hoje</p>
              <p className="text-sm text-muted">{todayXp >= DAILY_GOAL ? "Batida! Bora além?" : "Uma aula já ajuda muito."}</p>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
            <div className="flex items-center gap-2">
              <FlameIcon size={24} />
              <p className="font-display text-lg font-black">{streak} dias de sequência</p>
            </div>
            <ol className="flex justify-between">
              {WEEK.map((d, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full font-display text-sm font-black",
                    studyDays.has(i) ? "bg-coral text-white" : i === todayIndex ? "border-2 border-coral text-coral" : "bg-canvas text-subtle",
                  )}
                >
                  {studyDays.has(i) ? "✓" : d}
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
            <div className="flex items-center gap-2">
              <TrophyIcon size={26} />
              <p className="font-display text-lg font-black">Ranking da turma</p>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted">Ninguém pontuou ainda. Seja o primeiro!</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {leaderboard.map((r, i) => (
                  <li
                    key={r.user_id}
                    className={cn("flex items-center gap-3 rounded-full p-1.5 pr-4", r.user_id === user.id ? "bg-course-soft" : "bg-canvas")}
                  >
                    <span className="w-7 text-center font-display font-black text-muted">{i + 1}</span>
                    <span className="flex size-9 items-center justify-center rounded-full bg-sun font-display text-sm font-black text-on-sun">
                      {initials(r.full_name || "?")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.user_id === user.id ? "Você" : r.full_name || "Aluno"}</span>
                    <span className="font-display font-black text-course">{Number(r.xp).toLocaleString("pt-BR")}&nbsp;XP</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
            <p className="font-display text-lg font-black">Seu progresso</p>
            <ProgressBar value={total ? (completed / total) * 100 : 0} />
            <p className="text-sm text-muted">
              {completed} de {total} aulas concluídas
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
