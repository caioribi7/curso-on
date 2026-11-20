import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BoltIcon, FlameIcon, NavIcon } from "@/components/icons/flat-icons";
import { CountUp } from "@/components/motion/count-up";
import { effectiveStreak, getProfile } from "@/lib/dal";
import { initials } from "@/lib/utils";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AccountMenu } from "./account-menu";
import { MenuLink, NavLink } from "./nav-link";

const LINKS = [
  { href: "/app", label: "Início", icon: "home" as const, exact: true },
  { href: "/cursos", label: "Explorar", icon: "lessons" as const },
  { href: "/app/simulados", label: "Simulados", icon: "questions" as const },
  { href: "/app/ranking", label: "Ranking", icon: "ranking" as const },
  { href: "/studio", label: "Estúdio", icon: "studio" as const },
];

export async function Navbar() {
  const profile = await getProfile();
  const streak = profile ? effectiveStreak(profile) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-8 lg:px-12">
        <Logo size="sm" href="/app" />

        {/* Pill: items and indicator are rounded-full, so they stay concentric with it. */}
        <nav aria-label="Principal" className="hidden items-center gap-1 rounded-full bg-canvas p-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} href={l.href} exact={l.exact}>
              <NavIcon name={l.icon} />
              {/* Icons only until xl, so five items fit; the label stays for screen readers. */}
              <span className="max-xl:sr-only">{l.label}</span>
            </NavLink>
          ))}
        </nav>

        {!profile ? (
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="rounded-inner px-4 py-2.5 font-display font-bold text-muted hover:bg-canvas hover:text-ink">
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-inner bg-brand px-4 py-2.5 font-display font-extrabold text-white shadow-[0_4px_0_#2A44D4] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_2px_0_#2A44D4]"
            >
              Criar conta
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <span className="flex items-center gap-1.5 rounded-full bg-coral-soft px-3.5 py-2 font-display text-[15px] font-black text-coral" title="Dias seguidos estudando">
              <FlameIcon /> <CountUp value={streak} />
            </span>
            <span className="hidden items-center gap-1.5 rounded-full bg-sun-soft px-3.5 py-2 font-display text-[15px] font-black text-sun-ink sm:flex md:hidden xl:flex" title="XP total">
              <BoltIcon /> <CountUp value={profile?.xp ?? 0} /> XP
            </span>
            <AccountMenu label={initials(profile?.full_name || "Você")}>
              <p className="truncate px-3 py-2 font-display text-sm font-extrabold">{profile?.full_name || "Sua conta"}</p>
              {/* The main links live here on small screens, where the pill is hidden. */}
              <div className="flex flex-col border-b border-line pb-1.5 mb-1.5 md:hidden">
                {LINKS.map((l) => (
                  <MenuLink key={l.href} href={l.href} exact={l.exact}>
                    <NavIcon name={l.icon} />
                    {l.label}
                  </MenuLink>
                ))}
              </div>
              <MenuLink href="/app/perfil">Meu perfil</MenuLink>
              <form action={signOut}>
                <button className="w-full rounded-inner px-3 py-2.5 text-left text-sm font-semibold text-coral hover:bg-coral-soft active:scale-[0.98]">
                  Sair
                </button>
              </form>
            </AccountMenu>
          </div>
        )}
      </div>
    </header>
  );
}
