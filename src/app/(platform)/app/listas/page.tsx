import type { Metadata } from "next";
import Link from "next/link";
import { HubTabs } from "@/components/simulados/hub-tabs";
import { requireUser } from "@/lib/dal";
import { getMyLists } from "@/lib/simulados";
import { NewListForm } from "./list-forms";

export const metadata: Metadata = { title: "Listas de questões" };

export default async function ListasPage() {
  await requireUser("/app/listas");
  const lists = await getMyLists();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[36px] font-black leading-tight tracking-[-0.02em]">Listas de questões</h1>
        <p className="text-muted">Junte questões do banco, ponha na ordem que quiser e imprima em A4 (ou salve em PDF), com gabarito opcional.</p>
      </header>
      <HubTabs active="listas" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NewListForm />
        {lists.map((l) => (
          <article key={l.id} className="group flex flex-col gap-4 rounded-card border border-line bg-surface p-card hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-18px_rgba(20,22,28,.35)]">
            <Link href={`/app/listas/${l.id}`} className="flex min-w-0 flex-col gap-1">
              <h2 className="truncate text-xl font-black group-hover:underline">{l.title}</h2>
              <p className="text-sm font-semibold text-muted">
                {l.count === 1 ? "1 questão" : `${l.count} questões`} · editada em {new Date(l.updated_at).toLocaleDateString("pt-BR")}
              </p>
            </Link>
            <div className="mt-auto flex gap-2">
              <Link
                href={`/app/listas/${l.id}`}
                className="flex h-10 flex-1 items-center justify-center rounded-inner bg-canvas font-display text-sm font-extrabold hover:bg-line active:scale-[0.98]"
              >
                Editar
              </Link>
              <Link
                href={`/imprimir/listas/${l.id}`}
                className="flex h-10 flex-1 items-center justify-center rounded-inner bg-brand-soft font-display text-sm font-extrabold text-brand hover:brightness-95 active:scale-[0.98]"
              >
                Imprimir
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
