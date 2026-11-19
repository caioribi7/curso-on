import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Minhas compras" };

const STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: "Pago", tone: "bg-mint-soft text-mint-dark" },
  refunded: { label: "Reembolsado", tone: "bg-canvas text-muted" },
  failed: { label: "Falhou", tone: "bg-coral-soft text-coral" },
};

export default async function PurchasesPage() {
  const user = await requireUser("/app/compras");
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, amount_cents, currency, status, created_at, course:courses (title, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows =
    (data as unknown as {
      id: string;
      amount_cents: number;
      currency: string;
      status: string;
      created_at: string;
      course: { title: string; slug: string } | null;
    }[] | null) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-[36px] font-black leading-tight tracking-[-0.02em]">Minhas compras</h1>
      {rows.length === 0 ? (
        <p className="rounded-[28px] border-2 border-dashed border-line-strong bg-white p-10 text-center text-muted">
          Nenhuma compra por enquanto.{" "}
          <Link href="/cursos" className="font-semibold text-brand underline">
            Ver cursos
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((p) => {
            const s = STATUS[p.status] ?? STATUS.failed;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-[24px] border border-line bg-white p-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-black">{p.course?.title ?? "Curso removido"}</p>
                  <p className="text-sm text-muted">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="font-display font-black">{formatPrice(p.amount_cents, p.currency)}</span>
                <span className={`rounded-full px-3 py-1 font-display text-sm font-extrabold ${s.tone}`}>{s.label}</span>
                {p.course && p.status === "paid" ? (
                  <Link href={`/app/cursos/${p.course.slug}`} className="font-display font-bold text-brand hover:underline">
                    Acessar →
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
