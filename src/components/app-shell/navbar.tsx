import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BoltIcon, FlameIcon, NavIcon } from "@/components/icons/flat-icons";
import { effectiveStreak, getProfile } from "@/lib/dal";
import { initials } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";
import { NavLink } from "./nav-link";

const LINKS = [
  { href: "/app", label: "Início", icon: "home" as const, exact: true },
  { href: "/cursos", label: "Explorar", icon: "lessons" as const },
  { href: "/studio", label: "Estúdio", icon: "studio" as const },
];

export async function Navbar() {
  const profile = await getProfile();
  const streak = profile ? effectiveStreak(profile) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-8 lg:px-12">
        <Logo size="sm" href="/app" />

        <nav aria-label="Principal" className="hidden items-center gap-1.5 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact}>
              <NavIcon name={l.icon} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        {!profile ? (
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-4 py-2.5 font-display font-bold text-muted hover:text-ink">
              Entrar
            </Link>
            <Link href="/cadastro" className="rounded-2xl bg-brand px-4 py-2.5 font-display font-extrabold text-white shadow-[0_4px_0_#2A44D4]">
              Criar conta
            </Link>
          </div>
        ) : (
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full bg-coral-soft px-3.5 py-2 font-display text-[15px] font-black text-coral" title="Dias seguidos estudando">
            <FlameIcon /> {streak}
          </span>
          <span className="hidden items-center gap-1.5 rounded-full bg-sun-soft px-3.5 py-2 font-display text-[15px] font-black text-[#B87C00] sm:flex" title="XP total">
            <BoltIcon /> {(profile?.xp ?? 0).toLocaleString("pt-BR")} XP
          </span>
          <details className="relative">
            <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border-[3px] border-brand bg-sun font-display text-[16px] font-black text-ink">
              {initials(profile?.full_name || "Você")}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-white p-2 shadow-xl">
              <p className="truncate px-3 py-2 font-display text-sm font-extrabold">{profile?.full_name || "Sua conta"}</p>
              <Link href="/app/perfil" className="block rounded-xl px-3 py-2 text-sm hover:bg-canvas">
                Meu perfil
              </Link>
              <form action={signOut}>
                <button className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-coral hover:bg-coral-soft">Sair</button>
              </form>
            </div>
          </details>
        </div>
        )}
      </div>
    </header>
  );
}
