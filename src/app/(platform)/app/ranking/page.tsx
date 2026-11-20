import type { Metadata } from "next";
import Link from "next/link";
import { TrophyIcon } from "@/components/icons/flat-icons";
import { requireUser } from "@/lib/dal";
import { getGlobalRanking, type RankingRow } from "@/lib/queries";
import { cn, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Ranking geral" };

const MEDALS = ["bg-sun text-on-sun", "bg-[#C9D1E0] text-[#14161c]", "bg-[#E8A86B] text-[#14161c]"];

function Row({ r }: { r: RankingRow }) {
  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-2xl px-4 py-3",
        r.is_me ? "bg-brand-soft ring-2 ring-brand" : "bg-surface",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full font-display font-black",
          r.pos <= 3 ? MEDALS[r.pos - 1] : "bg-canvas text-muted",
        )}
      >
        {r.pos}
      </span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sun font-display text-sm font-black text-on-sun">
        {initials(r.full_name || "?")}
      </span>
      <Link href={`/u/${r.user_id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
        {r.is_me ? "Você" : r.full_name || "Aluno"}
      </Link>
      <span className="font-display font-black text-brand">{r.xp.toLocaleString("pt-BR")}&nbsp;XP</span>
    </li>
  );
}

export default async function RankingPage({ searchParams }: PageProps<"/app/ranking">) {
  await requireUser("/app/ranking");
  const sp = await searchParams;
  const period = sp.periodo === "semana" ? "week" : "all";
  const rows = await getGlobalRanking(period);
  const top = rows.filter((r) => r.pos <= 50);
  const me = rows.find((r) => r.is_me);
  const meOutside = me && me.pos > 50 ? me : null;

  const tabs = [
    { key: "all", label: "Total", href: "/app/ranking" },
    { key: "week", label: "Esta semana", href: "/app/ranking?periodo=semana" },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrophyIcon size={40} />
          <div>
            <h1 className="text-[32px] font-black leading-tight">Ranking geral</h1>
            <p className="text-muted">XP de todos os cursos. A semana começa na segunda-feira.</p>
          </div>
        </div>
        <nav aria-label="Período" className="flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.key === period ? "page" : undefined}
              className={cn(
                "rounded-2xl px-4 py-2.5 font-display font-extrabold",
                t.key === period ? "bg-brand text-white" : "bg-surface text-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>

      {me ? (
        <p className="rounded-2xl bg-sun-soft px-5 py-3 font-display font-extrabold text-sun-ink">
          Você está em {me.pos}º lugar com {me.xp.toLocaleString("pt-BR")} XP{period === "week" ? " nesta semana" : ""}.
        </p>
      ) : (
        <p className="rounded-2xl bg-canvas px-5 py-3 font-semibold text-muted">
          Você ainda não pontuou{period === "week" ? " nesta semana" : ""}. Conclua uma aula para entrar no ranking.
        </p>
      )}

      {top.length === 0 ? (
        <p className="rounded-[28px] border-2 border-dashed border-line-strong bg-surface p-8 text-center text-muted">
          Ninguém pontuou ainda. Seja o primeiro!
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {top.map((r) => (
            <Row key={r.user_id} r={r} />
          ))}
        </ol>
      )}

      {meOutside ? (
        <ol className="flex flex-col gap-2 border-t border-dashed border-line-strong pt-4">
          <Row r={meOutside} />
        </ol>
      ) : null}
    </div>
  );
}
