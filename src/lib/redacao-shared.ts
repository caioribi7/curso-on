// Redação: tipos e regras usados no servidor e no navegador.

export const ESSAY_MAX_LINES = 30;
export const ESSAY_MIN_LINES = 8; // até 7 linhas, o ENEM zera a redação
export const ESSAY_MAX_CHARS = 5000;
/** Caracteres numa linha da folha de redação do ENEM (letra de tamanho médio). */
export const CHARS_PER_LINE = 72;
export const ESSAY_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const ESSAY_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const SCORE_STEPS = [0, 40, 80, 120, 160, 200] as const;
export const ESSAY_XP = 50;

export const COMPETENCIES = [
  { n: 1, short: "Norma culta", text: "Domínio da escrita formal da língua portuguesa." },
  { n: 2, short: "Tema e repertório", text: "Compreender a proposta e desenvolver o tema no texto dissertativo-argumentativo." },
  { n: 3, short: "Argumentação", text: "Selecionar, relacionar e organizar informações e argumentos em defesa de um ponto de vista." },
  { n: 4, short: "Coesão", text: "Usar os mecanismos linguísticos que constroem a argumentação." },
  { n: 5, short: "Proposta de intervenção", text: "Elaborar proposta de intervenção que respeite os direitos humanos." },
] as const;

export type EssayStatus = "enviada" | "em_correcao" | "corrigida";

export const STATUS_LABEL: Record<EssayStatus, string> = {
  enviada: "Enviada",
  em_correcao: "Em correção",
  corrigida: "Corrigida",
};

export const STATUS_TONE: Record<EssayStatus, string> = {
  enviada: "bg-brand-soft text-brand",
  em_correcao: "bg-sun-soft text-sun-ink",
  corrigida: "bg-mint-soft text-mint-dark",
};

export type EssayComment = {
  id?: string;
  start_offset: number | null;
  end_offset: number | null;
  quote: string;
  body: string;
  competency: number | null;
};

/** Linhas que o texto ocupa na folha: cada parágrafo quebra a cada CHARS_PER_LINE. */
export function countLines(text: string) {
  if (!text.trim()) return 0;
  return text
    .replace(/\s+$/, "")
    .split("\n")
    .reduce((sum, p) => sum + Math.max(1, Math.ceil(p.trimEnd().length / CHARS_PER_LINE)), 0);
}

export function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Corta o texto em pedaços, marcando os trechos comentados (sem sobreposição). */
export function segmentText(body: string, comments: EssayComment[]) {
  const ranges = comments
    .map((c, index) => ({ c, index }))
    .filter((r) => r.c.start_offset !== null && r.c.end_offset !== null)
    .sort((a, b) => a.c.start_offset! - b.c.start_offset!);
  const out: { text: string; index: number | null; start: number }[] = [];
  let pos = 0;
  for (const { c, index } of ranges) {
    const s = Math.max(c.start_offset!, pos);
    const e = Math.min(c.end_offset!, body.length);
    if (e <= s) continue;
    if (s > pos) out.push({ text: body.slice(pos, s), index: null, start: pos });
    out.push({ text: body.slice(s, e), index, start: s });
    pos = e;
  }
  if (pos < body.length) out.push({ text: body.slice(pos), index: null, start: pos });
  return out;
}
