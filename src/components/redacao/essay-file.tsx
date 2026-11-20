import { cn } from "@/lib/utils";

/** Mostra o anexo (foto ou PDF) por um link assinado de curta duração. */
export function EssayFile({ url, type, bare, title = "Sua redação" }: { url: string | null; type: string | null; bare?: boolean; title?: string }) {
  const inner = !url ? (
    <p className="rounded-inner bg-canvas px-4 py-3 text-sm text-muted">Não foi possível abrir o anexo agora. Recarregue a página.</p>
  ) : type === "application/pdf" ? (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-inner bg-canvas p-3 font-display font-extrabold hover:bg-coral-soft">
      <span className="flex size-12 items-center justify-center rounded-[8px] bg-coral-soft text-sm font-black text-coral">PDF</span>
      Abrir a redação em PDF
    </a>
  ) : (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-inner bg-canvas">
      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado do Supabase Storage */}
      <img src={url} alt="Foto da redação" className="mx-auto max-h-[900px] w-auto" />
    </a>
  );
  if (bare) return inner;
  return (
    <section className={cn("flex flex-col gap-3 rounded-card border border-line bg-surface p-card")}>
      <h2 className="text-lg font-black">{title}</h2>
      {inner}
    </section>
  );
}
