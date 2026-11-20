import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MotivatingText, StatusChip, StatusSteps } from "@/components/redacao/essay-ui";
import { EssayFile } from "@/components/redacao/essay-file";
import { aiProvider } from "@/lib/ai-correction";
import { requireUser } from "@/lib/dal";
import { formatDate, getEssay, getEssayComments, getEssayFileUrl, getOwnedCourseOptions } from "@/lib/redacao";
import { claimEssay } from "../actions";
import { CorrectionForm } from "./correction-form";

export const metadata: Metadata = { title: "Corrigir redação · Estúdio" };

export default async function CorrectPage({ params }: PageProps<"/studio/redacao/[id]">) {
  const { id } = await params;
  await requireUser(`/studio/redacao/${id}`);
  const essay = /^[0-9a-f-]{36}$/i.test(id) ? await getEssay(id) : null;
  const owned = await getOwnedCourseOptions();
  if (!essay || !owned.some((c) => c.id === essay.course_id)) notFound();

  const [comments, fileUrl] = await Promise.all([getEssayComments(essay.id), getEssayFileUrl(essay.file_path)]);
  const r = essay.review;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/studio/redacao" className="self-start rounded-full px-3 py-1.5 font-display text-sm font-extrabold text-muted hover:bg-surface hover:text-ink">
        ← Fila de correção
      </Link>

      <header className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-brand">{essay.theme?.title}</p>
            <h1 className="text-[28px] font-black leading-tight">{essay.student?.full_name || "Aluno"}</h1>
            <p className="text-sm text-muted">
              {essay.title ? `“${essay.title}” · ` : ""}Enviada em {formatDate(essay.submitted_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusChip status={essay.status} />
            {essay.status === "enviada" ? (
              <form action={claimEssay}>
                <input type="hidden" name="essayId" value={essay.id} />
                <button className="h-9 rounded-inner bg-brand px-3.5 font-display text-sm font-extrabold text-white shadow-[0_3px_0_var(--color-brand-dark)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_var(--color-brand-dark)]">
                  Começar correção
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <StatusSteps status={essay.status} />
      </header>

      {essay.file_path ? <EssayFile url={fileUrl} type={essay.file_type} title="Redação enviada" /> : null}

      <CorrectionForm
        essayId={essay.id}
        body={essay.body}
        returned={essay.status === "corrigida"}
        aiEnabled={Boolean(aiProvider()) && Boolean(essay.body)}
        initial={{
          scores: [r?.c1 ?? null, r?.c2 ?? null, r?.c3 ?? null, r?.c4 ?? null, r?.c5 ?? null],
          notes: [r?.c1_comment ?? "", r?.c2_comment ?? "", r?.c3_comment ?? "", r?.c4_comment ?? "", r?.c5_comment ?? ""],
          finalComment: r?.final_comment ?? "",
          comments,
        }}
      />

      {essay.theme ? (
        <details className="group rounded-card border border-line bg-surface p-card">
          <summary className="cursor-pointer font-display font-extrabold">Ver a proposta e os textos motivadores</summary>
          <div className="pt-4">
            <MotivatingText title={essay.theme.title} text={essay.theme.motivating_text} instructions={essay.theme.instructions} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
