import { MathText } from "@/components/math/math-text";

/** Minimal, safe text renderer: React escapes everything; no HTML from authors. Formulas: $…$ and $$…$$ (KaTeX). */
export function LessonBody({ body }: { body: string }) {
  const blocks = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="flex flex-col gap-4 text-[17px] leading-[1.7] text-ink">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h3 key={i} className="mt-2 text-xl font-black"><MathText text={b.slice(3)} /></h3>;
        if (b.startsWith("# ")) return <h2 key={i} className="mt-2 text-2xl font-black"><MathText text={b.slice(2)} /></h2>;
        const lines = b.split("\n");
        if (lines.every((line) => /^[-*] /.test(line))) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1.5 pl-6">
              {lines.map((line, j) => (
                <li key={j}><MathText text={line.slice(2)} /></li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            <MathText text={b} />
          </p>
        );
      })}
    </div>
  );
}
