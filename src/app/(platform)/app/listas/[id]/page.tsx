import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MathText } from "@/components/math/math-text";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { requireUser } from "@/lib/dal";
import { getList, getStudyCourses, searchBank, type BankQuestion } from "@/lib/simulados";
import { AREAS, getSubject, SUBJECTS } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { addQuestions, deleteList, moveQuestion, removeQuestion } from "../actions";
import { ListDetailsForm, RandomAddForm } from "../list-forms";

export const metadata: Metadata = { title: "Editar lista" };

const DIFF = { easy: "Fácil", medium: "Média", hard: "Difícil" } as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ListEditorPage({ params, searchParams }: PageProps<"/app/listas/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/app/listas/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, courses] = await Promise.all([getList(id), getStudyCourses()]);
  if (!data) notFound();
  const { list, questions } = data;

  // Bank picker filters (GET form, so the URL keeps them).
  const f = { course: one(sp.curso), area: one(sp.area), subject: one(sp.materia), level: one(sp.nivel), diff: one(sp.dif), q: one(sp.q) };
  const courseIds = courses
    .filter(
      (c) =>
        (!f.course || c.id === f.course) &&
        (!f.subject || c.subject === f.subject) &&
        (!f.level || String(c.level) === f.level) &&
        (!f.area || getSubject(c.subject)?.area === f.area),
    )
    .map((c) => c.id);
  const bank = await searchBank({ courseIds, difficulty: f.diff, search: f.q });
  const inList = new Set(questions.map((q) => q.id));
  const subjects = SUBJECTS.filter((s) => courses.some((c) => c.subject === s.key));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link href="/app/listas" className="font-display text-sm font-bold text-muted hover:text-ink">
            ← Listas
          </Link>
          <h1 className="truncate text-[32px] font-black leading-tight tracking-[-0.02em]">{list.title}</h1>
          <p className="text-sm font-semibold text-muted">{questions.length === 1 ? "1 questão" : `${questions.length} questões`}</p>
        </div>
        <ButtonLink href={`/imprimir/listas/${list.id}`} variant="sun" className={cn(questions.length === 0 && "pointer-events-none opacity-50")}>
          Imprimir / PDF
        </ButtonLink>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="flex min-w-0 flex-col gap-3">
          {questions.length === 0 ? (
            <p className="rounded-card border-2 border-dashed border-line-strong bg-surface p-10 text-center text-muted">
              Lista vazia. Sorteie questões ou escolha no banco ao lado.
            </p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <li key={q.id} className="anim-in flex gap-4 rounded-card border border-line bg-surface p-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-inner bg-brand-soft font-display font-black text-brand">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <QuestionMeta q={q} />
                  <p className="line-clamp-4 whitespace-pre-line font-semibold">
                    <MathText text={q.statement} />
                  </p>
                  <ol className="flex flex-col gap-0.5 text-sm text-muted">
                    {q.options.map((o, oi) => (
                      <li key={o.id} className="truncate">
                        <span className="font-display font-black">{String.fromCharCode(65 + oi)})</span> <MathText text={o.body} />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveQuestion}>
                      <input type="hidden" name="listId" value={list.id} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <input type="hidden" name="direction" value={dir} />
                      <button
                        disabled={dir === "up" ? i === 0 : i === questions.length - 1}
                        aria-label={`Mover questão ${i + 1} para ${dir === "up" ? "cima" : "baixo"}`}
                        className="flex size-9 items-center justify-center rounded-inner font-black text-muted hover:bg-canvas hover:text-ink active:scale-90 disabled:opacity-30"
                      >
                        {dir === "up" ? "↑" : "↓"}
                      </button>
                    </form>
                  ))}
                  <form action={removeQuestion}>
                    <input type="hidden" name="listId" value={list.id} />
                    <input type="hidden" name="questionId" value={q.id} />
                    <button
                      aria-label={`Tirar a questão ${i + 1} da lista`}
                      className="flex size-9 items-center justify-center rounded-inner font-black text-coral hover:bg-coral-soft active:scale-90"
                    >
                      ×
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-6">
          <ListDetailsForm listId={list.id} title={list.title} instructions={list.instructions} />

          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
            <h2 className="text-xl font-black">Sortear questões</h2>
            {courses.length === 0 ? (
              <p className="text-sm text-muted">Matricule-se em um curso (ou crie um no Estúdio) para usar o banco de questões.</p>
            ) : (
              <RandomAddForm listId={list.id} courses={courses} />
            )}
          </section>

          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card">
            <h2 className="text-xl font-black">Escolher no banco</h2>
            <form className="grid grid-cols-2 gap-2" action={`/app/listas/${list.id}`}>
              <Input name="q" defaultValue={f.q} placeholder="Buscar no enunciado" aria-label="Buscar" className="col-span-2" />
              <Select name="area" defaultValue={f.area} aria-label="Área">
                <option value="">Todas as áreas</option>
                {AREAS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </Select>
              <Select name="materia" defaultValue={f.subject} aria-label="Matéria">
                <option value="">Todas as matérias</option>
                {subjects.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select name="nivel" defaultValue={f.level} aria-label="Nível">
                <option value="">Níveis 1 e 2</option>
                <option value="1">Nível 1</option>
                <option value="2">Nível 2</option>
              </Select>
              <Select name="dif" defaultValue={f.diff} aria-label="Dificuldade">
                <option value="">Qualquer dificuldade</option>
                <option value="easy">Fácil</option>
                <option value="medium">Média</option>
                <option value="hard">Difícil</option>
              </Select>
              <Select name="curso" defaultValue={f.course} aria-label="Curso" className="col-span-2">
                <option value="">Todos os cursos</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
              <button className="col-span-2 h-11 rounded-inner border-[1.5px] border-line-strong font-display font-extrabold hover:bg-canvas active:scale-[0.98]">
                Filtrar
              </button>
            </form>

            <form action={addQuestions} className="flex flex-col gap-3">
              <input type="hidden" name="listId" value={list.id} />
              {bank.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma questão com esses filtros.</p>
              ) : (
                <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
                  {bank.map((q) => {
                    const added = inList.has(q.id);
                    return (
                      <li key={q.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-inner p-3 ring-[1.5px] ring-line ring-inset hover:bg-canvas has-checked:bg-brand-soft has-checked:ring-brand",
                            added && "pointer-events-none opacity-50",
                          )}
                        >
                          <input type="checkbox" name="questionId" value={q.id} disabled={added} className="mt-1 size-4 shrink-0 accent-[#3b5bfd]" />
                          <span className="flex min-w-0 flex-col gap-1">
                            <QuestionMeta q={q} />
                            <span className="line-clamp-3 text-sm font-semibold">
                              <MathText text={q.statement} />
                            </span>
                            {added ? <span className="font-display text-xs font-black text-muted">Já está na lista</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {bank.length > 0 ? (
                <button className="h-12 rounded-inner bg-brand font-display font-extrabold text-white shadow-[0_4px_0_#2A44D4] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#2A44D4]">
                  Adicionar marcadas
                </button>
              ) : null}
            </form>
          </section>

          <form action={deleteList} className="flex justify-center">
            <input type="hidden" name="listId" value={list.id} />
            <button className="text-sm font-semibold text-coral hover:underline">Excluir esta lista</button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function QuestionMeta({ q }: { q: BankQuestion }) {
  const subject = getSubject(q.course.subject);
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
      {subject ? (
        <span className="rounded-full px-2 py-0.5 text-white" style={{ background: subject.colors[0] }}>
          {subject.name}
          {q.course.level ? ` ${q.course.level}` : ""}
        </span>
      ) : null}
      <span className="rounded-full bg-canvas px-2 py-0.5 text-muted">{DIFF[q.difficulty]}</span>
      <span className="truncate text-muted">{q.course.title}</span>
    </span>
  );
}
