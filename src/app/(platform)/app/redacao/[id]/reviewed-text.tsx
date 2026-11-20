"use client";

import { useState } from "react";
import { EssayText } from "@/components/redacao/essay-text";
import type { EssayComment } from "@/lib/redacao-shared";
import { cn } from "@/lib/utils";

/** Texto corrigido com os comentários ao lado: clicar num lado destaca o outro. */
export function ReviewedText({ body, comments }: { body: string; comments: EssayComment[] }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
      <h2 className="text-lg font-black">Seu texto corrigido</h2>
      <EssayText body={body} comments={comments} active={active} onActivate={setActive} />
      {comments.length ? (
        <ol className="flex flex-col gap-2 border-t border-line pt-4">
          {comments.map((c, i) => (
            <li key={c.id ?? i}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full gap-3 rounded-inner px-4 py-3 text-left text-[15px]",
                  active === i ? "bg-sun-soft ring-2 ring-sun ring-inset" : "bg-canvas hover:bg-sun-soft",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sun font-display text-xs font-black text-on-sun">{i + 1}</span>
                <span className="flex flex-col gap-1">
                  {c.quote ? <span className="text-sm text-muted italic">“{c.quote}”</span> : null}
                  <span>
                    {c.competency ? <span className="mr-2 font-display text-xs font-black text-brand">C{c.competency}</span> : null}
                    {c.body}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
