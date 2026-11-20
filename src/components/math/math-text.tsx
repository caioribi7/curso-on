import { parseMath, renderTex } from "@/lib/math";
import { cn } from "@/lib/utils";

/**
 * Text with `$...$` / `$$...$$` formulas. Works in server and client
 * components. Plain text is escaped by React; only KaTeX output is injected
 * (see src/lib/math.ts for why that is safe).
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = parseMath(text);
  if (segments.length === 1 && segments[0].kind === "text") {
    return className ? <span className={className}>{text}</span> : <>{text}</>;
  }
  return (
    <span className={cn("math-text", className)}>
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.value}</span>
        ) : (
          <span
            key={i}
            className={s.kind === "block" ? "math-block" : "math-inline"}
            dangerouslySetInnerHTML={{ __html: renderTex(s.value, s.kind === "block") }}
          />
        ),
      )}
    </span>
  );
}
