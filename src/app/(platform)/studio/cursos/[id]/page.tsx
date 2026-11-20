import type { Metadata } from "next";
import Link from "next/link";
import { SwapTransition } from "@/components/motion/page-transition";
import { Segmented } from "@/components/motion/segmented";
import { notFound } from "next/navigation";
import { CheckIcon, ModuleGlyph, moduleIconBg } from "@/components/icons/flat-icons";
import { CourseBadge } from "@/components/icons/subject-icon";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { requireUser } from "@/lib/dal";
import { getAnswerKey, getCourseOutline, getCourseQuestions, getOwnedCourse } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { MODULE_ICONS, type ModuleWithLessons } from "@/lib/types";
import { cn, courseThemeVars } from "@/lib/utils";
import { createLesson, createModule, deleteModule, deleteQuestion, moveLesson, moveModule, updateModule } from "../../actions";
import { CourseForm } from "../../course-form";
import { DeleteCourseForm, QuestionForm, StatusForm } from "../../editor-forms";

export const metadata: Metadata = { title: "Editar curso" };

const TABS = [
  { id: "conteudo", label: "Conteúdo" },
  { id: "questoes", label: "Questões" },
  { id: "configuracoes", label: "Configurações" },
  { id: "alunos", label: "Alunos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const MODULE_ICON_LABELS: Record<(typeof MODULE_ICONS)[number], string> = {
  blocks: "Blocos",
  pie: "Pizza",
  percent: "Porcentagem",
  scale: "Balança",
  shapes: "Formas",
  graph: "Gráfico",
  book: "Livro",
  bulb: "Lâmpada",
  flask: "Frasco",
  globe: "Globo",
  target: "Alvo",
  trophy: "Troféu",
};

export default async function CourseEditorPage({ params, searchParams }: PageProps<"/studio/cursos/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(`/studio/cursos/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const course = await getOwnedCourse(id);
  if (!course) notFound();

  const tab: Tab = TABS.some((t) => t.id === sp.aba) ? (sp.aba as Tab) : "conteudo";
  const outline = await getCourseOutline(course.id);
  const lessonCount = outline.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <div className="flex flex-col gap-8" style={courseThemeVars(course.theme_color)}>
      <header className="flex flex-wrap items-center gap-6 rounded-card border border-line bg-surface p-card">
        <div className="flex size-24 items-center justify-center rounded-inner bg-course-soft">
          <CourseBadge course={course} size={72} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link href="/studio" className="font-display text-sm font-bold text-muted hover:text-ink">
            ← Estúdio
          </Link>
          <h1 className="truncate text-[32px] font-black leading-tight tracking-[-0.02em]">{course.title}</h1>
          <div className="flex flex-wrap gap-2 text-sm font-semibold text-muted">
            <span className={cn("rounded-full px-3 py-1", course.status === "published" ? "bg-mint-soft text-mint-dark" : "bg-canvas")}>
              {course.status === "published" ? "Publicado" : "Rascunho"}
            </span>
            <span className="rounded-full bg-canvas px-3 py-1">
              {outline.length} módulos · {lessonCount} aulas
            </span>
            {course.level ? <span className="rounded-full bg-course-soft px-3 py-1 text-course">Nível {course.level}</span> : null}
          </div>
        </div>
        <div className="flex gap-3">
          {course.status === "published" ? (
            <ButtonLink href={`/cursos/${course.slug}`} variant="secondary">
              Ver página do curso
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/app/cursos/${course.slug}`} variant="secondary">
            Ver como aluno
          </ButtonLink>
        </div>
      </header>

      <Segmented
        name="studio-tab"
        label="Seções do editor"
        tone="course"
        active={tab}
        items={TABS.map((t) => ({ key: t.id, href: `/studio/cursos/${course.id}?aba=${t.id}`, label: t.label }))}
      />

      <SwapTransition id={tab} className="flex flex-col gap-6">

      {tab === "conteudo" ? <ContentTab courseId={course.id} outline={outline} /> : null}
      {tab === "questoes" ? <QuestionsTab courseId={course.id} outline={outline} /> : null}
      {tab === "configuracoes" ? (
        <div className="flex flex-col gap-8">
          <CourseForm course={course} />
          <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
            <h2 className="text-xl font-black">Publicação</h2>
            <p className="text-muted">
              {course.status === "published"
                ? "Seu curso está no catálogo e pode receber alunos."
                : "Rascunhos só aparecem para você. Publique quando tiver pelo menos uma aula."}
            </p>
            <StatusForm courseId={course.id} status={course.status} />
          </section>
          <section className="flex flex-col gap-3 rounded-card border border-coral/30 bg-surface p-card">
            <h2 className="text-xl font-black text-coral">Zona de perigo</h2>
            <p className="text-muted">Excluir apaga módulos, aulas e questões. Cursos com alunos não podem ser excluídos.</p>
            <DeleteCourseForm courseId={course.id} />
          </section>
        </div>
      ) : null}
      {tab === "alunos" ? <StudentsTab courseId={course.id} /> : null}
      </SwapTransition>
    </div>
  );
}

function ContentTab({ courseId, outline }: { courseId: string; outline: ModuleWithLessons[] }) {
  return (
    <div className="flex flex-col gap-5">
      {outline.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-line-strong bg-surface p-8 text-center text-muted">
          Nenhum módulo ainda. Crie o primeiro abaixo.
        </p>
      ) : null}

      {outline.map((m, mi) => (
        <section key={m.id} className="rounded-card border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-4 border-b border-line p-5">
            <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-inner", moduleIconBg(m.icon))}>
              <ModuleGlyph icon={m.icon} size={40} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-extrabold uppercase tracking-wide text-course">Módulo {mi + 1}</p>
              <h2 className="truncate text-xl font-black">{m.title}</h2>
            </div>
            <div className="flex items-center gap-1">
              {(["up", "down"] as const).map((dir) => (
                <form key={dir} action={moveModule}>
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="moduleId" value={m.id} />
                  <input type="hidden" name="direction" value={dir} />
                  <button
                    disabled={dir === "up" ? mi === 0 : mi === outline.length - 1}
                    aria-label={dir === "up" ? "Mover módulo para cima" : "Mover módulo para baixo"}
                    className="flex size-9 items-center justify-center rounded-inner font-black text-muted hover:bg-canvas disabled:opacity-30"
                  >
                    {dir === "up" ? "↑" : "↓"}
                  </button>
                </form>
              ))}
            </div>
          </div>

          <details className="accordion group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 font-display text-sm font-bold text-muted hover:text-ink">
              <span aria-hidden className="chevron inline-block">›</span> Editar módulo
            </summary>
            <div className="flex flex-col gap-4 px-5 pb-5">
              <form action={updateModule} className="grid gap-3 md:grid-cols-[1fr_1fr_200px_auto]">
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="moduleId" value={m.id} />
                <Input name="title" defaultValue={m.title} required maxLength={120} aria-label="Título do módulo" />
                <Input name="description" defaultValue={m.description} maxLength={500} placeholder="Descrição curta" aria-label="Descrição" />
                <Select name="icon" defaultValue={m.icon} aria-label="Ícone">
                  {MODULE_ICONS.map((i) => (
                    <option key={i} value={i}>
                      {MODULE_ICON_LABELS[i]}
                    </option>
                  ))}
                </Select>
                <button className="h-[52px] rounded-inner bg-course px-5 font-display font-extrabold text-white">Salvar</button>
              </form>
              <form action={deleteModule}>
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="moduleId" value={m.id} />
                <button className="text-sm font-semibold text-coral hover:underline">Excluir módulo e suas aulas</button>
              </form>
            </div>
          </details>

          <ol className="flex flex-col">
            {m.lessons.map((l, li) => (
              <li key={l.id} className="flex items-center gap-4 border-b border-line px-5 py-3 last:border-b-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-course-soft font-display text-sm font-black text-course">
                  {li + 1}
                </span>
                <Link href={`/studio/cursos/${courseId}/aulas/${l.id}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate font-display font-extrabold">{l.title}</p>
                  <p className="truncate text-sm text-muted">
                    {l.duration_minutes} min · {l.xp_reward} XP{l.is_preview ? " · Prévia grátis" : ""}
                  </p>
                </Link>
                <div className="flex items-center gap-1">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveLesson}>
                      <input type="hidden" name="courseId" value={courseId} />
                      <input type="hidden" name="moduleId" value={m.id} />
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input type="hidden" name="direction" value={dir} />
                      <button
                        disabled={dir === "up" ? li === 0 : li === m.lessons.length - 1}
                        aria-label={dir === "up" ? "Mover aula para cima" : "Mover aula para baixo"}
                        className="flex size-9 items-center justify-center rounded-inner font-black text-muted hover:bg-canvas disabled:opacity-30"
                      >
                        {dir === "up" ? "↑" : "↓"}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <form action={createLesson} className="flex gap-3 p-5">
            <input type="hidden" name="courseId" value={courseId} />
            <input type="hidden" name="moduleId" value={m.id} />
            <Input name="title" required maxLength={160} placeholder="Título da nova aula" aria-label="Título da nova aula" />
            <button className="h-[52px] shrink-0 rounded-inner border-[1.5px] border-line-strong bg-surface px-5 font-display font-extrabold hover:bg-canvas">
              + Aula
            </button>
          </form>
        </section>
      ))}

      <form action={createModule} className="flex flex-col gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface p-card sm:flex-row">
        <input type="hidden" name="courseId" value={courseId} />
        <Input name="title" required maxLength={120} placeholder="Nome do novo módulo" aria-label="Nome do novo módulo" />
        <Select name="icon" defaultValue="blocks" aria-label="Ícone do módulo" className="sm:max-w-52">
          {MODULE_ICONS.map((i) => (
            <option key={i} value={i}>
              {MODULE_ICON_LABELS[i]}
            </option>
          ))}
        </Select>
        <button className="h-[52px] shrink-0 rounded-inner bg-course px-6 font-display font-extrabold text-white shadow-[0_4px_0_var(--course-primary-dark)]">
          + Módulo
        </button>
      </form>
    </div>
  );
}

async function QuestionsTab({ courseId, outline }: { courseId: string; outline: ModuleWithLessons[] }) {
  const [questions, key] = await Promise.all([getCourseQuestions(courseId), getAnswerKey(courseId)]);
  const moduleName = new Map(outline.map((m) => [m.id, m.title]));
  const diff = { easy: "Fácil", medium: "Média", hard: "Difícil" } as const;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_480px]">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-black">Banco de questões ({questions.length})</h2>
        {questions.length === 0 ? (
          <p className="rounded-card border-2 border-dashed border-line-strong bg-surface p-8 text-center text-muted">
            Nenhuma questão ainda. Questões viram prática com XP para os alunos.
          </p>
        ) : null}
        {questions.map((q, qi) => (
          <article key={q.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card">
            <div className="flex items-start justify-between gap-4">
              <p className="font-display font-extrabold">
                {qi + 1}. {q.statement}
              </p>
              <form action={deleteQuestion}>
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="questionId" value={q.id} />
                <button className="text-sm font-semibold text-coral hover:underline">Excluir</button>
              </form>
            </div>
            <ul className="flex flex-col gap-1.5">
              {q.options.map((o, oi) => {
                const ok = key.get(q.id) === o.id;
                return (
                  <li key={o.id} className={cn("flex items-center gap-2 rounded-inner px-3 py-2 text-sm", ok ? "bg-mint-soft font-semibold text-mint-dark" : "bg-canvas")}>
                    <span className="font-display font-black">{String.fromCharCode(65 + oi)}</span> {o.body}
                    {ok ? <CheckIcon className="ml-auto" /> : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs font-semibold text-muted">
              {diff[q.difficulty]} · {q.xp_reward} XP · {q.module_id ? moduleName.get(q.module_id) ?? "Módulo" : "Curso inteiro"}
            </p>
          </article>
        ))}
      </div>
      <div className="xl:sticky xl:top-28 xl:self-start">
        <QuestionForm courseId={courseId} modules={outline.map((m) => ({ id: m.id, title: m.title }))} />
      </div>
    </div>
  );
}

async function StudentsTab({ courseId }: { courseId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("created_at, source, profile:profiles (full_name, xp)")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data as unknown as { created_at: string; source: string; profile: { full_name: string; xp: number } | null }[] | null) ?? [];
  const sourceLabel: Record<string, string> = { free: "Matrícula", stripe: "Compra (antiga)", manual: "Manual" };

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <h2 className="border-b border-line p-5 text-xl font-black">Alunos matriculados ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-muted">Ainda sem alunos. Publique o curso e compartilhe o link da página do curso.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas font-display text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Aluno</th>
              <th className="px-5 py-3">Origem</th>
              <th className="px-5 py-3">XP total</th>
              <th className="px-5 py-3">Desde</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                <td className="px-5 py-3 font-semibold">{r.profile?.full_name || "Aluno"}</td>
                <td className="px-5 py-3">{sourceLabel[r.source] ?? r.source}</td>
                <td className="px-5 py-3">{r.profile?.xp ?? 0}</td>
                <td className="px-5 py-3">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
