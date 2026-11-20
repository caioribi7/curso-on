import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MathText } from "@/components/math/math-text";
import { requireUser } from "@/lib/dal";
import { getList, getOwnedAnswerKey } from "@/lib/simulados";
import { getSubject } from "@/lib/subjects";
import { courseThemeVars } from "@/lib/utils";
import { PrintToolbar } from "./toolbar";

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// The tab title becomes the default PDF file name.
export async function generateMetadata({ params }: PageProps<"/imprimir/listas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = isUuid(id) ? await getList(id) : null;
  return { title: data?.list.title ?? "Lista", robots: { index: false } };
}

export default async function PrintListPage({ params, searchParams }: PageProps<"/imprimir/listas/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/imprimir/listas/${id}`);
  if (!isUuid(id)) notFound();
  const data = await getList(id);
  if (!data) notFound();
  const { list, questions } = data;

  // Answer key: only for questions whose course the caller owns (RLS).
  const key = await getOwnedAnswerKey(questions.map((q) => q.id));
  const keyAvailable = key.size > 0;
  const withKey = keyAvailable && sp.gabarito === "1";

  const courses = [...new Map(questions.map((q) => [q.course.id, q.course])).values()];
  const single = courses.length === 1 ? courses[0] : null;
  const subjects = [...new Set(courses.map((c) => getSubject(c.subject)?.name).filter(Boolean))];
  const eyebrow = single ? single.title : subjects.length ? subjects.join(" · ") : "Banco de questões";

  return (
    <>
      <PrintToolbar
        backHref={`/app/listas/${list.id}`}
        withKey={withKey}
        keyAvailable={keyAvailable}
        keyHref={`/imprimir/listas/${list.id}${withKey ? "" : "?gabarito=1"}`}
      />
      <div className="px-3 py-8 print:p-0">
        <article className="sheet" style={single ? courseThemeVars(single.theme_color) : undefined}>
          <header className="flex flex-col gap-[5mm] border-b-[2px] border-[var(--accent)] pb-[5mm]">
            <div className="flex items-start justify-between gap-6">
              <div className="flex min-w-0 flex-col gap-[1mm]">
                <p className="font-display text-[9pt] font-extrabold uppercase tracking-[0.08em] text-[var(--accent)]">{eyebrow}</p>
                <h1 className="text-[20pt] font-black leading-tight">{list.title}</h1>
              </div>
              <p className="shrink-0 pt-[1mm] font-display text-[9pt] font-extrabold text-[var(--muted)]">
                Curso On · {questions.length} {questions.length === 1 ? "questão" : "questões"}
              </p>
            </div>
            <div className="grid grid-cols-[1fr_32mm_36mm] gap-[4mm] text-[9.5pt]">
              {["Nome", "Turma", "Data"].map((label) => (
                <div key={label} className="flex items-end gap-[2mm]">
                  <span className="font-display font-extrabold">{label}:</span>
                  <span className="h-[6mm] flex-1 border-b border-[var(--ink)]">
                    {label === "Data" ? <span className="block pt-[1mm] text-center tracking-[0.3em] text-[var(--muted)]">/&nbsp;&nbsp;/</span> : null}
                  </span>
                </div>
              ))}
            </div>
            {list.instructions ? (
              <p className="whitespace-pre-line text-[10pt] text-[var(--muted)]">
                <MathText text={list.instructions} />
              </p>
            ) : null}
          </header>

          <ol className="mt-[6mm] flex flex-col">
            {questions.map((q, i) => (
              <li key={q.id} className="q border-b border-[var(--line)] py-[4.5mm] last:border-b-0">
                <div className="flex gap-[3mm]">
                  <span className="flex h-[7mm] min-w-[7mm] shrink-0 items-center justify-center rounded-[2mm] bg-[var(--accent)] px-[1.5mm] font-display text-[10pt] font-black text-white">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-[2.5mm]">
                    <p className="whitespace-pre-line">
                      <MathText text={q.statement} />
                    </p>
                    <ol className="flex flex-col gap-[1.5mm]">
                      {q.options.map((o, oi) => (
                        <li key={o.id} className="flex gap-[2.5mm]">
                          <span className="flex size-[5.5mm] shrink-0 items-center justify-center rounded-full border-[1.2px] border-[var(--ink)] font-display text-[8.5pt] font-black">
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="min-w-0 pt-[0.2mm]">
                            <MathText text={o.body} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {withKey ? (
            <section className="page-break">
              <h2 className="text-[16pt] font-black">Gabarito</h2>
              <p className="mt-[1mm] text-[9.5pt] text-[var(--muted)]">{list.title}</p>
              <ol className="mt-[5mm] grid grid-cols-5 gap-x-[4mm] gap-y-[2.5mm]">
                {questions.map((q, i) => {
                  const correct = key.get(q.id);
                  const idx = q.options.findIndex((o) => o.id === correct);
                  return (
                    <li key={q.id} className="flex items-center gap-[2mm] rounded-[2mm] border border-[var(--line)] px-[2.5mm] py-[1.5mm]">
                      <span className="font-display text-[9pt] font-extrabold text-[var(--muted)]">{i + 1}.</span>
                      <span className="font-display text-[12pt] font-black">{idx >= 0 ? String.fromCharCode(65 + idx) : "—"}</span>
                    </li>
                  );
                })}
              </ol>
              {questions.some((q) => !key.has(q.id)) ? (
                <p className="mt-[4mm] text-[9pt] text-[var(--muted)]">— : questão de um curso de outro professor; o gabarito fica com quem criou.</p>
              ) : null}
              {questions.some((q) => key.has(q.id) && q.explanation) ? (
                <div className="mt-[7mm] flex flex-col gap-[3mm]">
                  <h3 className="font-display text-[11pt] font-black">Resoluções</h3>
                  {questions.map((q, i) =>
                    key.has(q.id) && q.explanation ? (
                      <p key={q.id} className="q whitespace-pre-line text-[10pt]">
                        <strong className="font-display">{i + 1}.</strong> <MathText text={q.explanation} />
                      </p>
                    ) : null,
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
        </article>
      </div>
    </>
  );
}
