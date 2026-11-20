import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, PencilIcon } from "@/components/icons/flat-icons";
import { SwapTransition } from "@/components/motion/page-transition";
import { Segmented } from "@/components/motion/segmented";
import { StatusChip } from "@/components/redacao/essay-ui";
import { requireUser } from "@/lib/dal";
import { formatDate, getCorrectionQueue, getOwnedCourseOptions, getOwnedThemes, type Essay } from "@/lib/redacao";
import { courseThemeVars } from "@/lib/utils";
import { deleteTheme, toggleTheme } from "./actions";
import { ThemeForm } from "./theme-form";

export const metadata: Metadata = { title: "Redações · Estúdio" };

function EssayRow({ e }: { e: Essay }) {
  return (
    <li>
      <Link
        href={`/studio/redacao/${e.id}`}
        className="flex items-center gap-4 rounded-panel bg-surface p-panel pr-4 ring-1 ring-line ring-inset hover:-translate-y-px hover:ring-line-strong"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-inner bg-canvas font-display text-sm font-black text-muted">
          {e.status === "corrigida" && e.review ? e.review.total : e.file_path ? "Foto" : "Texto"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display font-extrabold">{e.student?.full_name || "Aluno"}</span>
          <span className="truncate text-sm text-muted">
            {e.theme?.title} · {formatDate(e.status === "corrigida" ? e.corrected_at : e.submitted_at)}
          </span>
        </span>
        <StatusChip status={e.status} />
        <ChevronRight size={18} className="shrink-0 text-subtle" />
      </Link>
    </li>
  );
}

export default async function StudioRedacaoPage({ searchParams }: PageProps<"/studio/redacao">) {
  await requireUser("/studio/redacao");
  const sp = await searchParams;
  const tab = sp.aba === "temas" ? "temas" : sp.aba === "corrigidas" ? "corrigidas" : "fila";

  const [queue, themes, courses] = await Promise.all([
    tab === "temas" ? Promise.resolve([] as Essay[]) : getCorrectionQueue(tab === "corrigidas"),
    tab === "temas" ? getOwnedThemes() : Promise.resolve([]),
    tab === "temas" ? getOwnedCourseOptions() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <PencilIcon size={56} />
          <div className="flex flex-col gap-1">
            <Link href="/studio" className="font-display text-sm font-extrabold uppercase tracking-wide text-brand hover:underline">
              Estúdio do criador
            </Link>
            <h1 className="text-[40px] font-black leading-tight tracking-[-0.03em]">Redações</h1>
          </div>
        </div>
        <Segmented
          name="studio-redacao"
          label="Seções"
          active={tab}
          items={[
            { key: "fila", label: "Fila de correção", href: "/studio/redacao" },
            { key: "corrigidas", label: "Corrigidas", href: "/studio/redacao?aba=corrigidas" },
            { key: "temas", label: "Temas", href: "/studio/redacao?aba=temas" },
          ]}
        />
      </header>

      <SwapTransition id={tab} className="flex flex-col gap-6">
        {tab === "temas" ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ThemeForm courses={courses} />
            <section className="flex flex-col gap-3" aria-label="Seus temas">
              {themes.length === 0 ? (
                <p className="rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-10 text-center text-muted">
                  Nenhum tema ainda. Crie o primeiro ao lado.
                </p>
              ) : (
                themes.map((t) => (
                  <article key={t.id} style={courseThemeVars(t.course?.theme_color ?? "#3B5BFD")} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-course-soft px-3 py-1 font-display text-xs font-extrabold text-course">{t.course?.title}</span>
                      <span className={`rounded-full px-3 py-1 font-display text-xs font-extrabold ${t.is_open ? "bg-mint-soft text-mint-dark" : "bg-canvas text-muted"}`}>
                        {t.is_open ? "Aberto" : "Fechado"}
                      </span>
                      {t.course?.status !== "published" ? (
                        <span className="rounded-full bg-sun-soft px-3 py-1 font-display text-xs font-extrabold text-sun-ink">Curso em rascunho</span>
                      ) : null}
                      <span className="ml-auto text-sm font-semibold text-muted">{t.essays} redações</span>
                    </div>
                    <h2 className="text-lg font-black leading-snug">{t.title}</h2>
                    {t.motivating_text ? <p className="line-clamp-3 text-sm text-muted whitespace-pre-wrap">{t.motivating_text}</p> : null}
                    <div className="flex flex-wrap gap-2">
                      <form action={toggleTheme}>
                        <input type="hidden" name="themeId" value={t.id} />
                        <input type="hidden" name="open" value={String(!t.is_open)} />
                        <button className="h-9 rounded-inner border-[1.5px] border-line-strong bg-surface px-3.5 font-display text-sm font-extrabold hover:bg-canvas active:translate-y-px">
                          {t.is_open ? "Fechar tema" : "Reabrir tema"}
                        </button>
                      </form>
                      {t.essays === 0 ? (
                        <form action={deleteTheme}>
                          <input type="hidden" name="themeId" value={t.id} />
                          <button className="h-9 rounded-inner border-[1.5px] border-coral/40 bg-surface px-3.5 font-display text-sm font-extrabold text-coral hover:bg-coral-soft active:translate-y-px">
                            Excluir
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-14 text-center">
            <h2 className="text-2xl font-black">{tab === "fila" ? "Fila vazia" : "Nada corrigido ainda"}</h2>
            <p className="max-w-md text-muted">
              {tab === "fila"
                ? "Quando um aluno enviar uma redação para um tema seu, ela aparece aqui, da mais antiga para a mais nova."
                : "As redações devolvidas aos alunos ficam guardadas aqui."}
            </p>
            {tab === "fila" ? (
              <Link href="/studio/redacao?aba=temas" className="font-display font-extrabold text-brand hover:underline">
                Criar um tema
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.map((e) => (
              <EssayRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </SwapTransition>
    </div>
  );
}
