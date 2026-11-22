// Fórmulas viram HTML via dangerouslySetInnerHTML (src/components/math/math-text.tsx).
// Este teste garante que nada que um autor escreva numa questão vire script, link ou evento.
// Roda com: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMath, renderTex } from "../src/lib/math.ts";

const ATTACKS = [
  String.raw`\href{javascript:alert(1)}{clique}`,
  String.raw`\url{javascript:alert(1)}`,
  String.raw`\htmlData{onclick=alert(1)}{x}`,
  String.raw`\htmlClass{x}{y}`,
  String.raw`\htmlStyle{background:url(javascript:alert(1))}{x}`,
  String.raw`\includegraphics{https://exemplo.com/x.png}`,
  String.raw`\text{<script>alert(1)</script>}`,
  String.raw`\text{"><svg onload=alert(1)>}`,
  `<img src=x onerror=alert(1)>`,
  `</annotation><script>alert(1)</script>`,
];

// Tags que o KaTeX gera sozinho. Qualquer outra (script, a, img, svg com evento…) é falha.
const ALLOWED_TAGS = new Set(["span", "math", "semantics", "mrow", "mi", "mn", "mo", "mtext", "mstyle", "mspace", "annotation", "msup", "msub", "mfrac", "svg", "path", "line"]);

function realTags(html) {
  return [...html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)].map(([, tag, attrs]) => ({ tag: tag.toLowerCase(), attrs }));
}

for (const tex of ATTACKS) {
  test(`fórmula inofensiva: ${tex}`, () => {
    for (const block of [false, true]) {
      for (const { tag, attrs } of realTags(renderTex(tex, block))) {
        assert.ok(ALLOWED_TAGS.has(tag), `tag inesperada <${tag}>`);
        assert.doesNotMatch(attrs, /\son\w+\s*=|href\s*=|src\s*=|javascript:/i, `atributo perigoso em <${tag}${attrs}>`);
      }
    }
  });
}

test("fórmula gigante é cortada e não trava", () => {
  const started = Date.now();
  renderTex(String.raw`\def\a{\a\a}\a` + "x".repeat(50_000), false);
  assert.ok(Date.now() - started < 2000);
});

test("dinheiro continua texto", () => {
  assert.deepEqual(parseMath("Custa R$ 10,00 e R$ 5,00."), [{ kind: "text", value: "Custa R$ 10,00 e R$ 5,00." }]);
});
