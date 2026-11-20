"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Screen-only bar above the sheet. Both buttons open the browser print dialog. */
export function PrintToolbar({
  backHref,
  withKey,
  keyHref,
  keyAvailable,
}: {
  backHref: string;
  withKey: boolean;
  keyHref: string;
  keyAvailable: boolean;
}) {
  const [pdfHint, setPdfHint] = useState(false);
  return (
    <div className="no-print sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-2 px-4 py-3">
        <Link href={backHref} className="mr-auto font-display text-sm font-bold text-muted hover:text-ink">
          ← Voltar para a lista
        </Link>
        {keyAvailable ? (
          <Link
            href={keyHref}
            replace
            scroll={false}
            aria-pressed={withKey}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full px-3.5 font-display text-sm font-extrabold ring-[1.5px] ring-inset active:scale-[0.97]",
              withKey ? "bg-mint-soft text-mint-dark ring-mint" : "text-muted ring-line-strong hover:bg-canvas hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className={cn("relative h-4 w-7 rounded-full transition", withKey ? "bg-mint" : "bg-line-strong")}
            >
              <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-[left] duration-[var(--dur)]", withKey ? "left-3.5" : "left-0.5")} />
            </span>
            Gabarito na última página
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setPdfHint(true);
            window.print();
          }}
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          Baixar PDF
        </button>
        <button type="button" onClick={() => window.print()} className={buttonClass({ variant: "primary", size: "sm" })}>
          Imprimir
        </button>
      </div>
      {pdfHint ? (
        <p role="status" className="anim-in mx-auto max-w-[210mm] px-4 pb-3 text-sm font-semibold text-muted">
          Na janela que abriu, escolha <strong className="text-ink">Salvar como PDF</strong> em &quot;Destino&quot;.
        </p>
      ) : null}
    </div>
  );
}
