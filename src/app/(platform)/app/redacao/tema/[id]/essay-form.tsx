"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  ESSAY_FILE_MAX_BYTES,
  ESSAY_FILE_TYPES,
  ESSAY_MAX_CHARS,
  ESSAY_MAX_LINES,
  ESSAY_MIN_LINES,
  countLines,
  countWords,
} from "@/lib/redacao-shared";
import type { ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";
import "@/styles/redacao.css";
import { submitEssay } from "../../actions";

type Mode = "texto" | "arquivo";
const MODES: { key: Mode; label: string }[] = [
  { key: "texto", label: "Digitar" },
  { key: "arquivo", label: "Foto ou PDF" },
];

function readDraft(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function EssayForm({ themeId }: { themeId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(submitEssay, {});
  const [mode, setMode] = useState<Mode>("texto");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<{ name: string; size: number; preview: string | null } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const draftKey = `curso-on:redacao:${themeId}`;
  const restored = useRef(false);

  // Rascunho local: volta o texto se a página for recarregada antes do envio.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readDraft(draftKey);
    if (saved) queueMicrotask(() => setBody(saved));
  }, [draftKey]);

  function onBody(v: string) {
    setBody(v);
    try {
      localStorage.setItem(draftKey, v);
    } catch {}
  }

  function onFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    setFileError(null);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    if (!f) return setFile(null);
    if (!(ESSAY_FILE_TYPES as readonly string[]).includes(f.type)) {
      input.value = "";
      setFile(null);
      return setFileError("Use JPG, PNG, WEBP ou PDF.");
    }
    if (f.size > ESSAY_FILE_MAX_BYTES) {
      input.value = "";
      setFile(null);
      return setFileError("O arquivo passou de 5 MB.");
    }
    setFile({ name: f.name, size: f.size, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
  }

  const lines = countLines(body);
  const words = countWords(body);
  const over = lines > ESSAY_MAX_LINES;
  const short = lines > 0 && lines < ESSAY_MIN_LINES;
  const bodyError = state.fieldErrors?.body?.[0];
  const serverFileError = state.fieldErrors?.file?.[0];

  return (
    <form
      action={action}
      onSubmit={() => {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }}
      className="flex flex-col gap-5 rounded-card border border-line bg-surface p-card"
    >
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="mode" value={mode} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">Sua redação</h1>
        {/* Concêntrico: barra --r-panel com --pad-panel; itens e indicador --r-inner. */}
        <div role="tablist" aria-label="Como enviar" className="relative inline-grid grid-cols-2 rounded-panel bg-canvas p-panel">
          <span
            aria-hidden
            className="absolute inset-y-[var(--pad-panel)] left-[var(--pad-panel)] w-[calc(50%-var(--pad-panel))] rounded-inner bg-course shadow-sm transition-transform duration-[var(--dur-move)] ease-[var(--ease-ui)]"
            style={{ transform: `translateX(${mode === "texto" ? 0 : 100}%)` }}
          />
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "relative rounded-inner px-4 py-2 font-display text-sm font-extrabold whitespace-nowrap active:scale-[0.97]",
                mode === m.key ? "text-white" : "text-muted hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-display text-sm font-bold">Título (opcional)</span>
        <input
          name="title"
          maxLength={150}
          placeholder="Dê um título, se quiser"
          className="h-12 w-full rounded-inner border-[1.5px] border-line-strong bg-surface px-4 text-[15px] outline-none focus:border-course focus:ring-4 focus:ring-course/15"
        />
      </label>

      {mode === "texto" ? (
        <div key="texto" className="anim-in flex flex-col gap-3">
          <label htmlFor="body" className="font-display text-sm font-bold">
            Texto
          </label>
          <div className="rounded-inner border-[1.5px] border-line-strong bg-surface px-4 py-2 focus-within:border-course focus-within:ring-4 focus-within:ring-course/15">
            <textarea
              id="body"
              name="body"
              value={body}
              onChange={(e) => onBody(e.target.value)}
              maxLength={ESSAY_MAX_CHARS}
              spellCheck
              lang="pt-BR"
              aria-invalid={Boolean(bodyError) || over}
              aria-describedby="body-count"
              placeholder="Comece pela introdução: apresente o tema e a sua tese."
              className="essay-sheet w-full max-w-[68ch] bg-transparent text-[16px] outline-none placeholder:text-subtle"
            />
          </div>
          <div id="body-count" className="flex flex-col gap-2" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <span className={cn("font-display font-extrabold", over ? "text-coral" : short ? "text-sun-ink" : "text-ink")}>
                {lines}/{ESSAY_MAX_LINES} linhas
              </span>
              <span className="text-muted">
                {words} {words === 1 ? "palavra" : "palavras"} · {body.length}/{ESSAY_MAX_CHARS} caracteres
              </span>
            </div>
            <span className="h-2 overflow-hidden rounded-full bg-canvas">
              <span
                className={cn("bar-fill block h-full rounded-full", over ? "bg-coral" : short ? "bg-sun" : "bg-course")}
                style={{ width: `${Math.min(100, (lines / ESSAY_MAX_LINES) * 100)}%` }}
              />
            </span>
            <p className="text-sm text-subtle">
              {over
                ? "Passou de 30 linhas: no ENEM, o que vem depois da linha 30 não é lido. Corte antes de enviar."
                : short
                  ? `No ENEM, textos com até 7 linhas recebem nota zero. Escreva pelo menos ${ESSAY_MIN_LINES}.`
                  : "As linhas são estimadas pela folha do ENEM (cerca de 72 letras por linha)."}
            </p>
            {bodyError ? <p className="anim-in text-sm font-semibold text-coral">{bodyError}</p> : null}
          </div>
        </div>
      ) : (
        <div key="arquivo" className="anim-in flex flex-col gap-3">
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-inner border-2 border-dashed border-line-strong bg-canvas px-6 py-10 text-center hover:border-course hover:bg-course-soft"
          >
            <span className="font-display font-extrabold">{file ? "Trocar arquivo" : "Escolher foto ou PDF"}</span>
            <span className="text-sm text-muted">Foto da folha escrita à mão ou PDF, até 5 MB.</span>
            <input id="file" name="file" type="file" accept={ESSAY_FILE_TYPES.join(",")} className="sr-only" onChange={(e) => onFile(e.currentTarget)} />
          </label>
          {file ? (
            <div className="anim-in flex items-center gap-3 rounded-inner bg-canvas p-3">
              {file.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:)
                <img src={file.preview} alt="" className="size-16 rounded-[8px] object-cover" />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-[8px] bg-coral-soft font-display text-sm font-black text-coral">PDF</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{file.name}</span>
                <span className="text-sm text-muted">
                  {file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                </span>
              </span>
            </div>
          ) : null}
          {fileError || serverFileError ? <p className="anim-in text-sm font-semibold text-coral">{fileError || serverFileError}</p> : null}
        </div>
      )}

      <FormMessage state={{ error: state.error }} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">Depois de enviar, o professor corrige e você recebe a nota aqui.</p>
        <SubmitButton size="lg" pendingText="Enviando…" disabled={mode === "texto" ? lines === 0 || over : !file}>
          Enviar redação
        </SubmitButton>
      </div>
    </form>
  );
}
