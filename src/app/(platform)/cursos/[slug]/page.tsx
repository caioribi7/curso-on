import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckIcon, ChevronRight, LockIcon, ModuleGlyph, PlayIcon, moduleIconBg } from "@/components/icons/flat-icons";
import { CourseBadge } from "@/components/icons/subject-icon";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/dal";
import { getCourseBySlug, getCourseOutline, isEnrolled } from "@/lib/queries";
import { isSalesEnabled } from "@/lib/env";
import { cn, courseThemeVars, formatPrice } from "@/lib/utils";
import { enrollFree, startCheckout } from "../../app/actions";

export async function generateMetadata({ params }: PageProps<"/cursos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Curso não encontrado" };
  return { title: course.title, description: course.subtitle || undefined };
}

const ERRORS: Record<string, string> = {
  matricula: "Não foi possível concluir a matrícula. Tente novamente.",
  pagamento: "A compra não está disponível agora. Tente de novo em instantes.",
};

export default async function CourseSalesPage({ params, searchParams }: PageProps<"/cursos/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const [user, outline, enrolled] = await Promise.all([getCurrentUser(), getCourseOutline(course.id), isEnrolled(course.id)]);
  const isOwner = user?.id === course.owner_id;
  // Drafts are only visible to their owner (RLS hides them from everyone else).
  const lessons = outline.flatMap((m) => m.lessons);
  const minutes = lessons.reduce((s, l) => s + l.duration_minutes, 0);
  const xp = lessons.reduce((s, l) => s + l.xp_reward, 0);
  const error = typeof sp.erro === "string" ? ERRORS[sp.erro] : undefined;
  const cancelled = sp.checkout === "cancelado";
  const paid = course.price_cents > 0;
  const salesOn = isSalesEnabled();

  const cta = (() => {
    if (enrolled || isOwner) {
      return (
        <ButtonLink href={`/app/cursos/${course.slug}`} size="lg" className="w-full">
          <PlayIcon /> Ir para o curso
        </ButtonLink>
      );
    }
    if (!user) {
      return (
        <ButtonLink href={`/cadastro?next=${encodeURIComponent(`/cursos/${course.slug}`)}`} size="lg" className="w-full">
          {paid ? "Criar conta para comprar" : "Criar conta e começar"}
        </ButtonLink>
      );
    }
    if (paid) {
      return (
        <form action={startCheckout} className="flex flex-col gap-2">
          <input type="hidden" name="courseId" value={course.id} />
          <SubmitButton size="lg" className="w-full" pendingText="Abrindo pagamento…" disabled={!salesOn}>
            Comprar por {formatPrice(course.price_cents, course.currency)}
          </SubmitButton>
          {!salesOn ? <p className="text-center text-sm text-muted">Vendas pausadas no momento.</p> : null}
        </form>
      );
    }
    return (
      <form action={enrollFree}>
        <input type="hidden" name="courseId" value={course.id} />
        <input type="hidden" name="slug" value={course.slug} />
        <SubmitButton size="lg" className="w-full" pendingText="Matriculando…">
          <PlayIcon /> Começar curso
        </SubmitButton>
      </form>
    );
  })();

  return (
    <div className="flex flex-col gap-8" style={courseThemeVars(course.theme_color)}>
      {course.status !== "published" ? (
        <p className="rounded-inner bg-sun-soft px-5 py-3 text-sm font-semibold text-sun-ink">
          Rascunho: só você vê esta página. Publique o curso no Estúdio.
        </p>
      ) : null}
      {error ? <p role="alert" className="anim-in rounded-inner bg-coral-soft px-5 py-3 font-semibold text-coral">{error}</p> : null}
      {cancelled ? (
        <p role="status" className="anim-in rounded-inner bg-canvas px-5 py-3 font-semibold text-muted">Pagamento cancelado. Nada foi cobrado.</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-8">
          <section className="relative overflow-hidden rounded-hero bg-course p-8 text-white shadow-[0_8px_0_var(--course-primary-dark)] sm:p-10">
            <div className="absolute -right-20 -top-24 size-80 rounded-full bg-white/10" />
            <div className="relative flex flex-col gap-4">
              <h1 className="text-[40px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[52px]">{course.title}</h1>
              {course.subtitle ? <p className="max-w-xl text-lg text-white/85">{course.subtitle}</p> : null}
              <div className="flex flex-wrap gap-2 font-display text-sm font-extrabold">
                <span className="rounded-full bg-white/20 px-3 py-1.5">{outline.length} módulos</span>
                <span className="rounded-full bg-white/20 px-3 py-1.5">{lessons.length} aulas</span>
                {minutes ? <span className="rounded-full bg-white/20 px-3 py-1.5">{minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)}h`} de conteúdo</span> : null}
                {xp ? <span className="rounded-full bg-sun px-3 py-1.5 text-on-sun">até {xp} XP</span> : null}
              </div>
            </div>
          </section>

          {course.description ? (
            <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6 sm:p-8">
              <h2 className="text-2xl font-black">Sobre o curso</h2>
              <p className="whitespace-pre-line text-[17px] leading-[1.7] text-ink">{course.description}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-black">O que você vai estudar</h2>
            {outline.map((m, mi) => (
              <details key={m.id} open={mi === 0} className="accordion group rounded-card border border-line bg-surface">
                <summary className="flex cursor-pointer list-none items-center gap-4 rounded-card p-card hover:bg-canvas/60 group-open:rounded-b-none">
                  <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-inner", moduleIconBg(m.icon))}>
                    <ModuleGlyph icon={m.icon} size={38} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xs font-extrabold uppercase tracking-wide text-course">Módulo {mi + 1}</span>
                    <span className="block truncate text-lg font-black">{m.title}</span>
                  </span>
                  <span className="text-sm font-semibold text-muted">{m.lessons.length} aulas</span>
                  <ChevronRight className="chevron text-subtle" />
                </summary>
                <ul className="border-t border-line">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0">
                      <span className="text-subtle">{l.is_preview ? <PlayIcon size={14} /> : <LockIcon size={14} />}</span>
                      <span className="flex-1 font-semibold">{l.title}</span>
                      {l.is_preview ? (
                        <span className="rounded-full bg-mint-soft px-2.5 py-0.5 font-display text-xs font-extrabold text-mint-dark">Prévia</span>
                      ) : null}
                      <span className="text-muted">{l.duration_minutes} min</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col gap-5 overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex h-48 items-center justify-center bg-course-soft">
              <CourseBadge course={course} size={128} />
            </div>
            <div className="flex flex-col gap-5 px-card pb-card">
              <p className="font-display text-[36px] font-black leading-none">{formatPrice(course.price_cents, course.currency)}</p>
              {cta}
              <ul className="flex flex-col gap-2.5 text-sm">
                {[
                  "Acesso a todas as aulas e atualizações",
                  "Banco de questões com XP",
                  "Ranking da turma e sequência de estudos",
                  paid ? "Pagamento seguro pela Stripe (cartão ou Pix)" : "Grátis",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2.5">
                    <span className="flex size-6 items-center justify-center rounded-full bg-mint text-white">
                      <CheckIcon size={12} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
