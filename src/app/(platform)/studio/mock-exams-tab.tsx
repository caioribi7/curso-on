import { getCourseQuestions } from "@/lib/queries";
import { getCourseMockExams } from "@/lib/simulados";
import { formatMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteMockExam } from "./mock-exam-actions";
import { MockExamEditor, NewMockExamForm } from "./mock-exam-forms";

/** Studio → Simulados: teacher-built exams from this course's question bank. */
export async function MockExamsTab({ courseId }: { courseId: string }) {
  const [exams, questions] = await Promise.all([getCourseMockExams(courseId), getCourseQuestions(courseId)]);
  const qs = questions.map((q) => ({ id: q.id, statement: q.statement, difficulty: q.difficulty }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-black">Simulados do curso ({exams.length})</h2>
        <p className="text-muted">
          Monte provas com tempo usando o banco de questões. Publicados aparecem para os alunos em Simulados; o gabarito só é mostrado depois que eles entregam.
        </p>
        {exams.length === 0 ? (
          <p className="rounded-card border-2 border-dashed border-line-strong bg-surface p-8 text-center text-muted">Nenhum simulado ainda.</p>
        ) : null}
        {exams.map((e) => (
          <section key={e.id} className="rounded-card border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-3 p-5">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-black">{e.title}</h3>
                <p className="text-sm font-semibold text-muted">
                  {e.questionIds.length} questões · {formatMinutes(e.duration_minutes)}
                </p>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-sm font-bold", e.status === "published" ? "bg-mint-soft text-mint-dark" : "bg-canvas text-muted")}>
                {e.status === "published" ? "Publicado" : "Rascunho"}
              </span>
              <form action={deleteMockExam}>
                <input type="hidden" name="courseId" value={courseId} />
                <input type="hidden" name="examId" value={e.id} />
                <button className="text-sm font-semibold text-coral hover:underline">Excluir</button>
              </form>
            </div>
            <details className="accordion group border-t border-line" open={e.questionIds.length === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 font-display text-sm font-bold text-muted hover:text-ink">
                <span aria-hidden className="chevron inline-block">›</span> Editar simulado
              </summary>
              <MockExamEditor courseId={courseId} exam={e} questions={qs} />
            </details>
          </section>
        ))}
      </div>
      <div className="xl:sticky xl:top-28 xl:self-start">
        <NewMockExamForm courseId={courseId} />
      </div>
    </div>
  );
}
