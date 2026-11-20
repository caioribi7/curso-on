"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EssayText } from "@/components/redacao/essay-text";
import { ScoreBoard } from "@/components/redacao/essay-ui";
import { FormMessage } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import type { AiSuggestion } from "@/lib/ai-correction";
import { COMPETENCIES, SCORE_STEPS, type EssayComment } from "@/lib/redacao-shared";
import type { ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { aiSuggest, saveReview } from "../actions";

type Initial = { scores: (number | null)[]; notes: string[]; finalComment: string; comments: EssayComment[] };

const control =
  "w-full rounded-inner border-[1.5px] border-line-strong bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-subtle outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";

function overlaps(list: EssayComment[], start: number, end: number) {
  return list.some((c) => c.start_offset !== null && c.end_offset !== null && start < c.end_offset && end > c.start_offset);
}

export function CorrectionForm({
  essayId,
  body,
  returned,
  aiEnabled,
  initial,
}: {
  essayId: string;
  body: string | null;
  returned: boolean;
  aiEnabled: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [scores, setScores] = useState(initial.scores);
  const [notes, setNotes] = useState(initial.notes);
  const [finalComment, setFinal] = useState(initial.finalComment);
  const [comments, setComments] = useState<EssayComment[]>(initial.comments);
  const [active, setActive] = useState<number | null>(null);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [draft, setDraft] = useState({ body: "", competency: "" });
  const [state, setState] = useState<ActionState>({});
  const [confirming, setConfirming] = useState(false);
  const [ai, setAi] = useState<{ suggestion?: AiSuggestion; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const [aiPending, startAi] = useTransition();

  const total = scores.reduce<number>((s, v) => s + (v ?? 0), 0);
  const complete = scores.every((s) => s !== null);

  if (returned) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
          <h2 className="text-lg font-black">Correção devolvida</h2>
          {body ? <EssayText body={body} comments={comments} active={active} onActivate={setActive} /> : null}
          <CommentList comments={comments} active={active} onActivate={setActive} />
          {finalComment ? <p className="rounded-inner bg-brand-soft px-4 py-3 whitespace-pre-wrap">{finalComment}</p> : null}
        </section>
        <ScoreBoard scores={scores} notes={notes} title="Nota devolvida" />
      </div>
    );
  }

  function addComment() {
    const text = draft.body.trim();
    if (!text) return;
    const competency = draft.competency ? Number(draft.competency) : null;
    const c: EssayComment = range
      ? { start_offset: range.start, end_offset: range.end, quote: body!.slice(range.start, range.end), body: text, competency }
      : { start_offset: null, end_offset: null, quote: "", body: text, competency };
    if (range && overlaps(comments, range.start, range.end)) {
      setState({ error: "Esse trecho já tem comentário. Selecione outro trecho." });
      return;
    }
    const next = [...comments, c].sort((a, b) => (a.start_offset ?? Infinity) - (b.start_offset ?? Infinity));
    setComments(next);
    setActive(next.indexOf(c));
    setDraft({ body: "", competency: draft.competency });
    setRange(null);
    setState({});
    window.getSelection()?.removeAllRanges();
  }

  function save(giveBack: boolean) {
    setConfirming(false);
    start(async () => {
      const res = await saveReview({
        essayId,
        scores,
        notes,
        finalComment,
        comments: comments.map((c) => ({ start_offset: c.start_offset, end_offset: c.end_offset, body: c.body, competency: c.competency })),
        giveBack,
      });
      setState(res);
      if (res.ok) router.refresh();
    });
  }

  function askAi() {
    startAi(async () => setAi(await aiSuggest(essayId)));
  }

  function applyAiScores(s: AiSuggestion) {
    setScores(s.scores);
    setNotes(s.notes);
    if (!finalComment.trim()) setFinal(s.final_comment);
  }

  function applyAiComment(c: AiSuggestion["comments"][number]) {
    if (!body) return;
    const startAt = body.indexOf(c.quote);
    const next =
      startAt >= 0 && !overlaps(comments, startAt, startAt + c.quote.length)
        ? { start_offset: startAt, end_offset: startAt + c.quote.length, quote: c.quote, body: c.body, competency: c.competency }
        : { start_offset: null, end_offset: null, quote: "", body: `“${c.quote}” ${c.body}`.slice(0, 1000), competency: c.competency };
    setComments((list) => [...list, next].sort((a, b) => (a.start_offset ?? Infinity) - (b.start_offset ?? Infinity)));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="flex flex-col gap-6">
        {body ? (
          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black">Texto do aluno</h2>
              <p className="text-sm text-muted">Selecione um trecho para comentar.</p>
            </div>
            <EssayText body={body} comments={comments} active={active} onActivate={setActive} onSelectRange={setRange} />
          </section>
        ) : null}

        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card" aria-label="Comentários no texto">
          <h2 className="text-lg font-black">Comentários {comments.length ? `(${comments.length})` : ""}</h2>
          <div className="flex flex-col gap-3 rounded-inner bg-canvas p-3">
            <p className="text-sm font-semibold text-muted">
              {range ? (
                <>
                  Trecho: <span className="rounded-[4px] bg-sun/40 px-1 text-ink">“{body!.slice(range.start, Math.min(range.end, range.start + 80))}{range.end - range.start > 80 ? "…" : ""}”</span>
                </>
              ) : body ? (
                "Sem trecho selecionado: o comentário fica geral."
              ) : (
                "Redação por foto/PDF: os comentários ficam gerais."
              )}
            </p>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              maxLength={1000}
              rows={2}
              placeholder="Escreva o comentário"
              aria-label="Novo comentário"
              className={control}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={draft.competency}
                onChange={(e) => setDraft({ ...draft, competency: e.target.value })}
                aria-label="Competência"
                className="h-9 rounded-inner border-[1.5px] border-line-strong bg-surface px-3 text-sm font-semibold text-ink"
              >
                <option value="">Sem competência</option>
                {COMPETENCIES.map((c) => (
                  <option key={c.n} value={c.n}>
                    C{c.n} · {c.short}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addComment} disabled={!draft.body.trim()} className={buttonClass({ variant: "secondary", size: "sm" })}>
                Adicionar comentário
              </button>
            </div>
          </div>
          <CommentList
            comments={comments}
            active={active}
            onActivate={setActive}
            onRemove={(i) => {
              setComments((list) => list.filter((_, j) => j !== i));
              setActive(null);
            }}
          />
        </section>
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-[100px]">
        {aiEnabled ? (
          <section className="flex flex-col gap-3 rounded-card border-2 border-dashed border-sun bg-sun-soft/60 p-card" aria-label="Sugestão da IA">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-black text-sun-ink">Sugestão da IA</h2>
              <button type="button" onClick={askAi} disabled={aiPending} className={buttonClass({ variant: "sun", size: "sm" })}>
                {aiPending ? "Analisando…" : ai?.suggestion ? "Pedir de novo" : "Pré-corrigir com IA"}
              </button>
            </div>
            <p className="text-sm text-sun-ink">É só uma sugestão. Você confere e decide cada nota e comentário.</p>
            {ai?.error ? <p className="anim-in rounded-inner bg-coral-soft px-4 py-3 text-sm font-semibold text-coral">{ai.error}</p> : null}
            {ai?.suggestion ? (
              <div className="anim-in flex flex-col gap-3">
                <ul className="flex flex-col gap-1.5">
                  {COMPETENCIES.map((c, i) => (
                    <li key={c.n} className="rounded-inner bg-surface px-3 py-2 text-sm">
                      <span className="font-display font-extrabold">
                        C{c.n}: {ai.suggestion!.scores[i]}
                      </span>{" "}
                      <span className="text-muted">{ai.suggestion!.notes[i]}</span>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => applyAiScores(ai.suggestion!)} className={buttonClass({ variant: "secondary", size: "sm" }, "self-start")}>
                  Usar estas notas (total {ai.suggestion.scores.reduce((a, b) => a + b, 0)})
                </button>
                {ai.suggestion.comments.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {ai.suggestion.comments.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 rounded-inner bg-surface px-3 py-2 text-sm">
                        <span className="flex-1">
                          <span className="text-muted italic">“{c.quote}”</span> {c.body}
                        </span>
                        <button type="button" onClick={() => applyAiComment(c)} className="shrink-0 rounded-full px-2 py-1 font-display text-xs font-extrabold text-brand hover:bg-brand-soft">
                          Adicionar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card" aria-label="Notas">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Notas</h2>
            <span className={cn("rounded-full px-3 py-1 font-display font-black", complete ? "bg-brand text-white" : "bg-canvas text-muted")}>{total} / 1000</span>
          </div>
          {COMPETENCIES.map((c, i) => (
            <fieldset key={c.n} className="flex flex-col gap-2">
              <legend className="mb-2 font-display text-sm font-extrabold">
                <span className="text-brand">C{c.n}</span> · {c.short}
                <span className="block text-xs font-semibold text-subtle">{c.text}</span>
              </legend>
              {/* Concêntrico: grupo --r-panel com --pad-panel, botões --r-inner. */}
              <div className="grid grid-cols-6 gap-1 rounded-panel bg-canvas p-panel">
                {SCORE_STEPS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={scores[i] === s}
                    onClick={() => setScores((list) => list.map((v, j) => (j === i ? s : v)))}
                    className={cn(
                      "h-9 rounded-inner font-display text-sm font-extrabold active:scale-[0.95]",
                      scores[i] === s ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <textarea
                value={notes[i]}
                onChange={(e) => setNotes((list) => list.map((v, j) => (j === i ? e.target.value : v)))}
                maxLength={2000}
                rows={1}
                placeholder={`Comentário sobre C${c.n} (opcional)`}
                aria-label={`Comentário sobre a competência ${c.n}`}
                className={cn(control, "[field-sizing:content] py-2 text-sm")}
              />
            </fieldset>
          ))}
          <label className="flex flex-col gap-2">
            <span className="font-display text-sm font-extrabold">Comentário final</span>
            <textarea value={finalComment} onChange={(e) => setFinal(e.target.value)} maxLength={4000} rows={4} className={control} placeholder="O que o aluno deve melhorar primeiro?" />
          </label>

          <FormMessage state={state} />

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => save(false)} disabled={pending} className={buttonClass({ variant: "secondary" })}>
              {pending ? "Salvando…" : "Salvar rascunho"}
            </button>
            {confirming ? (
              <button type="button" onClick={() => save(true)} disabled={pending} className={buttonClass({ variant: "sun" }, "anim-pop")}>
                Confirmar: devolver com {total}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (complete ? setConfirming(true) : setState({ error: "Dê nota às 5 competências antes de devolver." }))}
                disabled={pending}
                className={buttonClass({ variant: "primary" }, "bg-brand shadow-[0_4px_0_var(--color-brand-dark)]")}
              >
                Devolver ao aluno
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CommentList({
  comments,
  active,
  onActivate,
  onRemove,
}: {
  comments: EssayComment[];
  active: number | null;
  onActivate: (i: number) => void;
  onRemove?: (i: number) => void;
}) {
  if (!comments.length) return null;
  return (
    <ol className="flex flex-col gap-2">
      {comments.map((c, i) => (
        <li
          key={`${c.start_offset}-${i}`}
          className={cn("anim-in flex items-start gap-3 rounded-inner px-4 py-3 text-[15px]", active === i ? "bg-sun-soft ring-2 ring-sun ring-inset" : "bg-canvas")}
        >
          <button
            type="button"
            onClick={() => onActivate(i)}
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sun font-display text-xs font-black text-on-sun"
            aria-label={`Destacar comentário ${i + 1}`}
          >
            {i + 1}
          </button>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {c.quote ? <span className="truncate text-sm text-muted italic">“{c.quote}”</span> : null}
            <span>
              {c.competency ? <span className="mr-2 font-display text-xs font-black text-brand">C{c.competency}</span> : null}
              {c.body}
            </span>
          </span>
          {onRemove ? (
            <button type="button" onClick={() => onRemove(i)} className="shrink-0 rounded-full px-2 py-1 font-display text-xs font-extrabold text-coral hover:bg-coral-soft">
              Remover
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
