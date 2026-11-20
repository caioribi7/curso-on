import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MotivatingText, ScoreBoard, StatusChip, StatusSteps } from "@/components/redacao/essay-ui";
import { EssayFile } from "@/components/redacao/essay-file";
import { getCurrentUser, requireUser } from "@/lib/dal";
import { formatDate, getEssay, getEssayComments, getEssayFileUrl } from "@/lib/redacao";
import { ESSAY_XP } from "@/lib/redacao-shared";
import { ReviewedText } from "./reviewed-text";
import "@/styles/redacao.css";

export const metadata: Metadata = { title: "Minha redação" };

export default async function EssayPage({ params, searchParams }: PageProps<"/app/redacao/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/app/redacao/${id}`);
  const user = await getCurrentUser();
  const essay = /^[0-9a-f-]{36}$/i.test(id) ? await getEssay(id) : null;
  if (!essay || essay.student_id !== user?.id) notFound();

  const done = essay.status === "corrigida" && essay.review;
  const [comments, fileUrl] = await Promise.all([done ? getEssayComments(essay.id) : [], getEssayFileUrl(essay.file_path)]);
  const r = essay.review;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link href="/app/redacao" className="self-start rounded-full px-3 py-1.5 font-display text-sm font-extrabold text-muted hover:bg-surface hover:text-ink">
        ← Redação
      </Link>

      {sp.enviada ? (
        <p role="status" className="anim-in rounded-inner bg-mint-soft px-5 py-3 font-display font-extrabold text-mint-dark">
          Redação enviada! Você ganha {ESSAY_XP} XP quando a correção voltar.
        </p>
      ) : null}

      <header className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-brand">{essay.theme?.title}</p>
            <h1 className="text-[28px] font-black leading-tight">{essay.title || "Minha redação"}</h1>
            <p className="text-sm text-muted">
              Enviada em {formatDate(essay.submitted_at)}
              {essay.corrected_at ? ` · corrigida em ${formatDate(essay.corrected_at)}` : ""}
            </p>
          </div>
          <StatusChip status={essay.status} />
        </div>
        <StatusSteps status={essay.status} />
      </header>

      {done && r ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex flex-col gap-6">
            {essay.body ? (
              <ReviewedText body={essay.body} comments={comments} />
            ) : (
              <>
                <EssayFile url={fileUrl} type={essay.file_type} />
                {comments.length ? (
                  <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-card">
                    <h2 className="text-lg font-black">Comentários do professor</h2>
                    <ol className="flex flex-col gap-2">
                      {comments.map((c, i) => (
                        <li key={c.id ?? i} className="rounded-inner bg-canvas px-4 py-3 text-[15px]">
                          {c.competency ? <span className="mr-2 font-display text-xs font-black text-brand">C{c.competency}</span> : null}
                          {c.body}
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </>
            )}
            {r.final_comment ? (
              <section className="anim-in flex flex-col gap-2 rounded-card bg-brand-soft p-card">
                <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-brand">Comentário final</h2>
                <p className="leading-relaxed whitespace-pre-wrap">{r.final_comment}</p>
              </section>
            ) : null}
          </div>
          <div className="lg:sticky lg:top-[100px]">
            <ScoreBoard
              scores={[r.c1, r.c2, r.c3, r.c4, r.c5]}
              notes={[r.c1_comment, r.c2_comment, r.c3_comment, r.c4_comment, r.c5_comment]}
            />
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
            <h2 className="text-lg font-black">Seu texto</h2>
            {essay.body ? (
              <div className="essay-sheet text-[16px] whitespace-pre-wrap break-words">{essay.body}</div>
            ) : (
              <EssayFile url={fileUrl} type={essay.file_type} bare />
            )}
          </section>
          <div className="flex flex-col gap-4">
            <p className="rounded-inner bg-sun-soft px-5 py-4 font-semibold text-sun-ink">
              {essay.status === "enviada"
                ? "Sua redação está na fila. Assim que o professor começar, o status muda para “Em correção”."
                : "O professor está corrigindo sua redação. A nota aparece aqui quando ela for devolvida."}
            </p>
            {essay.theme ? <MotivatingText title={essay.theme.title} text={essay.theme.motivating_text} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
