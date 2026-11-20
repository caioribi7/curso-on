import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, PencilIcon } from "@/components/icons/flat-icons";
import { StatusChip } from "@/components/redacao/essay-ui";
import { requireUser } from "@/lib/dal";
import { formatDate, getMyEssays, getOpenThemes } from "@/lib/redacao";
import { courseThemeVars } from "@/lib/utils";

export const metadata: Metadata = { title: "Redação" };

export default async function RedacaoPage() {
  await requireUser("/app/redacao");
  const [themes, essays] = await Promise.all([getOpenThemes(), getMyEssays()]);
  const pendingThemes = new Set(essays.filter((e) => e.status !== "corrigida").map((e) => e.theme_id));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex items-center gap-4">
        <PencilIcon size={56} />
        <div>
          <h1 className="text-[32px] font-black leading-tight">Redação</h1>
          <p className="text-muted">Escolha um tema, escreva até 30 linhas e receba a correção pelas 5 competências do ENEM.</p>
        </div>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="temas">
        <h2 id="temas" className="text-xl font-black">Temas abertos</h2>
        {themes.length === 0 ? (
          <p className="rounded-card border-2 border-dashed border-line-strong bg-surface px-6 py-10 text-center text-muted">
            Nenhum tema aberto agora. Quando um professor publicar um tema, ele aparece aqui.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {themes.map((t) => (
              <li key={t.id} style={courseThemeVars(t.course?.theme_color ?? "#3B5BFD")}>
                <Link
                  href={`/app/redacao/tema/${t.id}`}
                  className="group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-card hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-none"
                >
                  <span className="self-start rounded-full bg-course-soft px-3 py-1 font-display text-xs font-extrabold text-course">{t.course?.title}</span>
                  <h3 className="text-lg font-black leading-snug">{t.title}</h3>
                  {t.motivating_text ? <p className="line-clamp-2 text-sm text-muted">{t.motivating_text}</p> : null}
                  <span className="mt-auto flex items-center justify-between rounded-inner bg-canvas px-4 py-2.5 font-display text-sm font-extrabold group-hover:bg-course group-hover:text-white">
                    {pendingThemes.has(t.id) ? "Aguardando correção" : "Escrever redação"}
                    <ChevronRight size={18} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="minhas">
        <h2 id="minhas" className="text-xl font-black">Minhas redações</h2>
        {essays.length === 0 ? (
          <p className="rounded-inner bg-canvas px-5 py-3 font-semibold text-muted">Você ainda não enviou nenhuma redação.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {essays.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/app/redacao/${e.id}`}
                  className="flex items-center gap-4 rounded-panel bg-surface p-panel pr-4 ring-1 ring-line ring-inset hover:-translate-y-px hover:ring-line-strong"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-inner bg-brand-soft font-display text-sm font-black text-brand">
                    {e.status === "corrigida" && e.review ? e.review.total : "—"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display font-extrabold">{e.title || e.theme?.title}</span>
                    <span className="truncate text-sm text-muted">
                      {e.title ? `${e.theme?.title} · ` : ""}Enviada em {formatDate(e.submitted_at)}
                    </span>
                  </span>
                  <StatusChip status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
