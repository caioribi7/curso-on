import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BoltIcon, CourseIllustration, FlameIcon, ModuleGlyph, PencilIcon, TrophyIcon } from "@/components/icons/flat-icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { isSupabaseConfigured } from "@/lib/env";

const FEATURES = [
  {
    title: "Monte em minutos",
    text: "Módulos, aulas com vídeo e texto, tudo arrastando para a ordem certa. Seu curso, sua cor.",
    icon: <ModuleGlyph icon="blocks" size={56} />,
    bg: "bg-brand-soft",
  },
  {
    title: "Banco de questões",
    text: "Alternativas, gabarito protegido e explicação. Cada acerto vira XP para o aluno.",
    icon: <ModuleGlyph icon="target" size={56} />,
    bg: "bg-coral-soft",
  },
  {
    title: "Gamificação de verdade",
    text: "Níveis, sequência de dias, meta diária e ranking da turma. Estudar vira hábito.",
    icon: <TrophyIcon size={56} />,
    bg: "bg-sun-soft",
  },
  {
    title: "Grátis e open source",
    text: "Sem pagamento, sem assinatura. Clone do GitHub, crie seus cursos e os alunos se matriculam com um clique.",
    icon: <BoltIcon size={48} />,
    bg: "bg-mint-soft",
  },
];

export default async function Home() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-8">
        <Logo size="sm" href="/" />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/cursos" className="hidden rounded-xl px-4 py-2.5 font-display font-bold text-muted hover:text-ink sm:block">
            Cursos
          </Link>
          {user ? (
            <ButtonLink href="/app" size="sm">
              Abrir app
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="rounded-xl px-4 py-2.5 font-display font-bold text-muted hover:text-ink">
                Entrar
              </Link>
              <ButtonLink href="/cadastro" size="sm">
                Criar conta
              </ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1280px] items-center gap-12 px-4 pb-20 pt-10 sm:px-8 lg:grid-cols-2 lg:pt-16">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full bg-sun-soft px-4 py-1.5 font-display text-sm font-extrabold text-sun-ink">
              Plataforma de cursos gamificada
            </span>
            <h1 className="text-[48px] font-black leading-[1.02] tracking-[-0.035em] sm:text-[68px]">
              Crie cursos que dá <span className="text-brand">vontade</span> de terminar.
            </h1>
            <p className="max-w-xl text-xl leading-relaxed text-muted">
              Aulas curtas, questões com XP, sequência de estudos e ranking. Você ensina, o Curso On deixa viciante.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={user ? "/studio/cursos/novo" : "/cadastro?next=/studio/cursos/novo"} size="lg">
                Criar meu curso
              </ButtonLink>
              <ButtonLink href="/cursos" variant="secondary" size="lg">
                Explorar cursos
              </ButtonLink>
            </div>
          </div>

          <div aria-hidden className="relative h-[460px] overflow-hidden rounded-[40px] bg-brand">
            <div className="absolute -right-24 -top-32 size-[420px] rounded-full bg-[#4A68FF]" />
            <div className="absolute -bottom-24 -left-20 size-72 rounded-full bg-[#3352F0]" />
            <div className="absolute left-[8%] top-[12%] w-60 -rotate-[5deg] rounded-[20px] bg-surface px-5 py-4 shadow-[0_8px_0_#2A44D4]">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-brand px-2.5 py-1 font-display text-xs font-extrabold text-white">Nível 6</span>
                <span className="font-display text-sm font-extrabold">63/130 XP</span>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-brand-soft">
                <div className="h-full w-[48%] rounded-full bg-sun text-on-sun" />
              </div>
            </div>
            <div className="absolute right-[8%] top-[16%] flex rotate-6 items-center gap-3 rounded-[20px] bg-surface py-3 pl-3 pr-5 shadow-[0_8px_0_#2A44D4]">
              <span className="flex size-11 items-center justify-center rounded-[14px] bg-coral-soft">
                <FlameIcon size={26} />
              </span>
              <span>
                <span className="block font-display text-xl font-black leading-6">12 dias</span>
                <span className="block text-xs text-muted">de sequência</span>
              </span>
            </div>
            <div className="absolute left-1/2 top-[42%] flex h-32 w-64 -translate-x-1/2 items-center justify-between rounded-full bg-surface pl-8 pr-3 shadow-[0_10px_0_#2A44D4]">
              <span className="font-display text-[48px] font-black tracking-[-0.03em] text-brand">on</span>
              <span className="size-[104px] rounded-full bg-sun shadow-[inset_-8px_-8px_0_#F2A818] text-on-sun" />
            </div>
            <PencilIcon size={100} className="absolute bottom-[8%] left-[10%]" />
            <CourseIllustration icon="book" size={96} className="absolute bottom-[6%] left-[42%] -rotate-[8deg]" />
            <TrophyIcon size={96} className="absolute bottom-[8%] right-[10%] rotate-[10deg]" />
          </div>
        </section>

        <section className="bg-canvas py-20">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 sm:px-8">
            <h2 className="max-w-2xl text-[40px] font-black leading-tight tracking-[-0.03em]">Tudo para criar e organizar seu curso.</h2>
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex flex-col gap-4 rounded-[28px] border border-line bg-surface p-6">
                  <span className={`flex size-20 items-center justify-center rounded-[22px] ${f.bg}`}>{f.icon}</span>
                  <h3 className="text-xl font-black">{f.title}</h3>
                  <p className="text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-4 py-20 sm:px-8">
          <div className="flex flex-col items-start gap-6 rounded-[40px] bg-sun p-10 shadow-[0_8px_0_#F2A818] sm:p-14 lg:flex-row lg:items-center lg:justify-between text-on-sun">
            <div className="flex flex-col gap-3">
              <h2 className="text-[36px] font-black leading-tight tracking-[-0.03em]">Ligue o modo estudo.</h2>
              <p className="max-w-lg text-lg text-on-sun/75">Crie sua conta grátis e publique seu primeiro curso hoje.</p>
            </div>
            <ButtonLink href="/cadastro" size="lg">
              Começar agora
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-subtle sm:px-8">
          <Logo size="sm" href={null} />
          <p>© {new Date().getFullYear()} Curso On</p>
        </div>
      </footer>
    </div>
  );
}
