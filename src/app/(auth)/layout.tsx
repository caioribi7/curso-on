import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FlameIcon, PencilIcon, TrophyIcon, CourseIllustration } from "@/components/icons/flat-icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-surface p-4">
      <div className="flex w-full flex-col justify-between px-4 py-6 sm:px-10 lg:w-[640px] lg:shrink-0 lg:px-20 lg:py-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <main className="mx-auto w-full max-w-[460px] py-10 lg:mx-0">{children}</main>
        <p className="text-[13px] text-subtle">© {new Date().getFullYear()} Curso On · Termos · Privacidade</p>
      </div>
      <AuthPanel />
    </div>
  );
}

function AuthPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden flex-1 overflow-hidden rounded-hero bg-brand lg:block"
    >
      <div className="absolute -top-40 left-[55%] size-[520px] rounded-full bg-[#4A68FF]" />
      <div className="absolute -left-36 top-[60%] size-[360px] rounded-full bg-[#3352F0]" />

      <div className="absolute left-[8%] top-[15%] w-[260px] -rotate-[5deg] rounded-[calc(var(--r-inner)+12px)] bg-surface px-5 py-4 shadow-[0_8px_0_#2A44D4]">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-brand px-2.5 py-1 font-display text-[13px] font-extrabold text-white">Nível 6</span>
          <span className="font-display text-sm font-extrabold">63/130 XP</span>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-brand-soft">
          <div className="h-full w-[48%] rounded-full bg-sun text-on-sun" />
        </div>
      </div>

      <div className="absolute right-[8%] top-[17%] flex rotate-6 items-center gap-3 rounded-[calc(var(--r-inner)+12px)] bg-surface py-3 pl-3 pr-5 shadow-[0_8px_0_#2A44D4]">
        <div className="flex size-12 items-center justify-center rounded-inner bg-coral-soft">
          <FlameIcon size={30} />
        </div>
        <div>
          <p className="font-display text-[22px] font-black leading-6">12 dias</p>
          <p className="text-[13px] text-muted">de sequência</p>
        </div>
      </div>

      <div className="absolute left-1/2 top-[38%] flex h-40 w-80 -translate-x-1/2 items-center justify-between rounded-full bg-surface pl-10 pr-4 shadow-[0_12px_0_#2A44D4]">
        <span className="font-display text-[56px] font-black tracking-[-0.03em] text-brand">on</span>
        <span className="size-32 rounded-full bg-sun shadow-[inset_-10px_-10px_0_#F2A818] text-on-sun" />
      </div>

      <PencilIcon size={120} className="absolute left-[12%] top-[50%]" />
      <CourseIllustration icon="book" size={104} className="absolute left-[44%] top-[61%] -rotate-[8deg]" />
      <TrophyIcon size={110} className="absolute right-[12%] top-[59%] rotate-[10deg]" />

      <div className="absolute bottom-16 left-[10%] right-[10%]">
        <p className="font-display text-[40px] font-black leading-[44px] tracking-[-0.03em] text-white">
          Ligue o modo estudo.
        </p>
        <p className="mt-2.5 text-[17px] leading-[26px] text-[#DCE3FF]">
          Aulas curtas, questões com XP e uma turma inteira subindo de nível com você.
        </p>
      </div>
    </aside>
  );
}
