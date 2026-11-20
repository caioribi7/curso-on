"use client";

import { useRef } from "react";
import { segmentText, type EssayComment } from "@/lib/redacao-shared";
import { cn } from "@/lib/utils";
import "@/styles/redacao.css";

/**
 * Texto da redação com os trechos comentados marcados. Com `onSelectRange`,
 * o professor seleciona um trecho com o mouse para comentar; os offsets são
 * contados no texto puro (mesma conta do banco).
 */
export function EssayText({
  body,
  comments,
  active,
  onActivate,
  onSelectRange,
  className,
}: {
  body: string;
  comments: EssayComment[];
  active?: number | null;
  onActivate?: (index: number) => void;
  onSelectRange?: (range: { start: number; end: number } | null) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleSelection() {
    if (!onSelectRange || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return onSelectRange(null);
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.startContainer) || !ref.current.contains(range.endContainer)) return onSelectRange(null);
    const pre = document.createRange();
    pre.selectNodeContents(ref.current);
    pre.setEnd(range.startContainer, range.startOffset);
    let start = pre.toString().length;
    let end = start + range.toString().length;
    // Ignora espaços nas pontas da seleção.
    while (start < end && /\s/.test(body[start])) start++;
    while (end > start && /\s/.test(body[end - 1])) end--;
    onSelectRange(end > start ? { start, end } : null);
  }

  return (
    <div
      ref={ref}
      onMouseUp={handleSelection}
      onKeyUp={handleSelection}
      className={cn("essay-sheet text-[16px] whitespace-pre-wrap break-words text-ink", className)}
    >
      {segmentText(body, comments).map((seg) =>
        seg.index === null ? (
          <span key={seg.start}>{seg.text}</span>
        ) : (
          <mark
            key={seg.start}
            data-n={seg.index + 1}
            onClick={() => onActivate?.(seg.index!)}
            className={cn(
              // O número vem de ::after, que não entra na contagem dos offsets.
              "cursor-pointer rounded-[4px] px-0.5 transition-colors after:ml-0.5 after:align-super after:font-display after:text-[10px] after:font-black after:content-[attr(data-n)]",
              active === seg.index
                ? "bg-sun text-on-sun ring-2 ring-sun-dark after:text-on-sun"
                : "bg-sun/30 text-ink after:text-sun-ink hover:bg-sun/50",
            )}
          >
            {seg.text}
          </mark>
        ),
      )}
    </div>
  );
}
