import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SCORE_STEPS } from "@/lib/redacao-shared";

// Pré-correção opcional por IA. Só roda no servidor e só com uma chave
// configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY). É uma sugestão: o
// professor revisa e decide cada nota e comentário.

export type AiProvider = "anthropic" | "openai";

export function aiProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

// Esquema simples (sem limites de tamanho), aceito no modo estrito dos dois
// provedores. Os limites e a grade de 40 em 40 são aplicados depois, em normalize().
const Schema = z.strictObject({
  competencies: z.array(z.strictObject({ competency: z.number(), score: z.number(), comment: z.string() })),
  comments: z.array(z.strictObject({ quote: z.string(), body: z.string(), competency: z.number() })),
  final_comment: z.string(),
});
type Raw = z.infer<typeof Schema>;

export type AiSuggestion = {
  scores: number[]; // c1..c5
  notes: string[]; // comentário por competência
  comments: { quote: string; body: string; competency: number }[];
  final_comment: string;
};

function snap(score: number) {
  return SCORE_STEPS.reduce((best, s) => (Math.abs(s - score) < Math.abs(best - score) ? s : best), 0 as number);
}

function normalize(raw: Raw): AiSuggestion {
  const scores = [0, 0, 0, 0, 0];
  const notes = ["", "", "", "", ""];
  for (const c of raw.competencies) {
    if (c.competency < 1 || c.competency > 5) continue;
    scores[c.competency - 1] = snap(c.score);
    notes[c.competency - 1] = c.comment.slice(0, 2000);
  }
  return {
    scores,
    notes,
    comments: raw.comments
      .filter((c) => c.quote.trim() && c.body.trim())
      .slice(0, 12)
      .map((c) => ({ quote: c.quote, body: c.body.slice(0, 1000), competency: Math.min(5, Math.max(1, c.competency)) })),
    final_comment: raw.final_comment.slice(0, 4000),
  };
}

const SYSTEM = `Você é um corretor experiente da redação do ENEM. Avalie o texto do aluno pelas 5 competências oficiais:
C1 domínio da escrita formal; C2 compreensão da proposta e repertório; C3 seleção e organização dos argumentos;
C4 mecanismos de coesão; C5 proposta de intervenção que respeite os direitos humanos.
Cada competência vale 0, 40, 80, 120, 160 ou 200. Seja justo e calibrado com a grade do INEP.
Em "comments", cite trechos copiados EXATAMENTE do texto (campo quote, até 120 caracteres) e explique o problema ou acerto.
Escreva em português do Brasil, com tom acolhedor e direto, falando com o aluno. O comentário final resume o que melhorar primeiro.`;

function userPrompt(theme: string, motivating: string, body: string) {
  return `Tema: ${theme}\n\nTextos motivadores:\n${motivating || "(sem textos motivadores)"}\n\nRedação do aluno:\n"""\n${body}\n"""`;
}

export async function suggestCorrection(input: { theme: string; motivating: string; body: string }): Promise<AiSuggestion> {
  const provider = aiProvider();
  if (provider === "anthropic") {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(Schema) },
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(input.theme, input.motivating, input.body) }],
    });
    if (response.stop_reason === "refusal") throw new Error("A IA não quis avaliar este texto.");
    if (!response.parsed_output) throw new Error("A IA respondeu num formato inesperado.");
    return normalize(response.parsed_output);
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        response_format: { type: "json_schema", json_schema: { name: "correcao_enem", strict: true, schema: z.toJSONSchema(Schema, { target: "draft-7" }) } },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt(input.theme, input.motivating, input.body) },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`OpenAI respondeu ${res.status}.`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = Schema.safeParse(JSON.parse(json.choices?.[0]?.message?.content ?? "null"));
    if (!parsed.success) throw new Error("A IA respondeu num formato inesperado.");
    return normalize(parsed.data);
  }
  throw new Error("Nenhuma chave de IA configurada.");
}
