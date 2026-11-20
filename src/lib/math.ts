import katex from "katex";

/**
 * LaTeX in plain text: `$...$` inline and `$$...$$` block.
 *
 * Safety: authors never send HTML. Text between formulas is rendered by React
 * (escaped). Formulas go through KaTeX with `trust: false` (no \href, \url,
 * \includegraphics, \htmlClass…), so its output is markup KaTeX generated
 * itself from TeX, with every character of the input escaped. Size and macro
 * expansion are capped so a formula can't freeze the page.
 *
 * Money stays text: `R$ 10,00` is not a formula because an inline `$` only
 * opens when followed by a non-space and not preceded by a letter/digit, and
 * only closes when preceded by a non-space and not followed by a digit.
 * `\$` is always a literal dollar sign.
 */

export type MathSegment = { kind: "text" | "inline" | "block"; value: string };

const MAX_FORMULA = 2000;

export function parseMath(src: string): MathSegment[] {
  const out: MathSegment[] = [];
  let text = "";
  const pushText = () => {
    if (text) out.push({ kind: "text", value: text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && src[i + 1] === "$") {
      text += "$";
      i += 2;
      continue;
    }
    if (ch !== "$") {
      text += ch;
      i++;
      continue;
    }
    if (src[i + 1] === "$") {
      const end = findClose(src, i + 2, "$$");
      if (end > i + 2) {
        pushText();
        out.push({ kind: "block", value: src.slice(i + 2, end).trim() });
        i = end + 2;
        continue;
      }
      text += "$$";
      i += 2;
      continue;
    }
    const prev = src[i - 1] ?? "";
    const next = src[i + 1] ?? "";
    if (next && !/\s/.test(next) && !/[\p{L}\p{N}]/u.test(prev)) {
      const end = findInlineClose(src, i + 1);
      if (end > 0) {
        pushText();
        out.push({ kind: "inline", value: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    text += "$";
    i++;
  }
  pushText();
  return out;
}

function findClose(src: string, from: number, token: string) {
  for (let j = from; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src.startsWith(token, j)) return j;
  }
  return -1;
}

function findInlineClose(src: string, from: number) {
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "\n" && src[j + 1] === "\n") return -1; // never across paragraphs
    // The first unescaped `$` decides: a valid closer, or this was not a formula.
    if (c === "$") {
      if (src[j + 1] === "$" || /\s/.test(src[j - 1]) || /\d/.test(src[j + 1] ?? "")) return -1;
      return j;
    }
  }
  return -1;
}

export function hasMath(src: string) {
  return parseMath(src).some((s) => s.kind !== "text");
}

/** KaTeX → HTML string (safe to inject; see header). */
export function renderTex(tex: string, displayMode: boolean) {
  return katex.renderToString(tex.slice(0, MAX_FORMULA), {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 200,
    output: "htmlAndMathml",
  });
}
