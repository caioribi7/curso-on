import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { BoltIcon, FlameIcon } from "@/components/icons/flat-icons";
import { effectiveStreak, levelFromXp } from "@/lib/dal";
import type { AchievementView } from "@/lib/queries";
import { initials } from "@/lib/utils";

type CardProfile = {
  full_name: string;
  xp: number;
  streak_days: number;
  last_study_date: string | null;
};

/** Student card: name, level, XP, streak and the badge grid (locked badges in gray). */
export function StudentCard({ profile, achievements }: { profile: CardProfile; achievements: AchievementView[] }) {
  const lvl = levelFromXp(profile.xp);
  const streak = effectiveStreak(profile);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  const pct = lvl.next ? Math.round((lvl.current / lvl.next) * 100) : 0;

  return (
    <article className="overflow-hidden rounded-[32px] border border-line bg-surface">
      <header className="relative flex flex-wrap items-center gap-5 overflow-hidden bg-brand p-6 text-white sm:p-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10" aria-hidden />
        <span className="relative flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-sun font-display text-2xl font-black text-on-sun">
          {initials(profile.full_name || "Aluno")}
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 className="truncate text-[28px] font-black leading-tight">{profile.full_name || "Aluno"}</h2>
          <p className="font-display font-extrabold text-white/85">Nível {lvl.level}</p>
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-white/25">
              <div className="h-2.5 rounded-full bg-sun" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-white/85">
              {lvl.current}/{lvl.next} XP
            </span>
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-3 border-b border-line">
        <div className="flex flex-col items-center gap-1 p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">XP</dt>
          <dd className="flex items-center gap-1 font-display text-xl font-black">
            <BoltIcon /> {profile.xp.toLocaleString("pt-BR")}
          </dd>
        </div>
        <div className="flex flex-col items-center gap-1 border-x border-line p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Sequência</dt>
          <dd className="flex items-center gap-1 font-display text-xl font-black">
            <FlameIcon /> {streak} {streak === 1 ? "dia" : "dias"}
          </dd>
        </div>
        <div className="flex flex-col items-center gap-1 p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Conquistas</dt>
          <dd className="font-display text-xl font-black">
            {unlocked}/{achievements.length}
          </dd>
        </div>
      </dl>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 p-6 min-[420px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {achievements.map((a) => (
          <li key={a.slug} className="flex flex-col items-center gap-1.5 text-center">
            <AchievementBadge slug={a.slug} icon={a.icon} unlocked={Boolean(a.unlockedAt)} />
            <span className={`font-display text-sm font-extrabold leading-tight ${a.unlockedAt ? "" : "text-subtle"}`}>{a.name}</span>
            <span className="text-[11px] leading-tight text-muted">{a.description}</span>
            <span className="sr-only">{a.unlockedAt ? "Conquistada" : "Bloqueada"}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
