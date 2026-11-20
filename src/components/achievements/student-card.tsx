import { BadgeGrid } from "@/components/achievements/badge-grid";
import { CountUp } from "@/components/motion/count-up";
import { ProgressBar } from "@/components/ui/progress";
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
export function StudentCard({
  profile,
  achievements,
  celebrateFor,
}: {
  profile: CardProfile;
  achievements: AchievementView[];
  /** Owner id: badges unlocked since the last visit pop once (own profile only). */
  celebrateFor?: string;
}) {
  const lvl = levelFromXp(profile.xp);
  const streak = effectiveStreak(profile);
  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  const pct = lvl.next ? Math.round((lvl.current / lvl.next) * 100) : 0;

  return (
    <article className="overflow-hidden rounded-card border border-line bg-surface">
      <header className="relative flex flex-wrap items-center gap-5 overflow-hidden bg-brand p-card text-white sm:p-8">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10" aria-hidden />
        <span className="relative flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-sun font-display text-2xl font-black text-on-sun">
          {initials(profile.full_name || "Aluno")}
        </span>
        <div className="relative min-w-0 flex-1">
          <h2 className="truncate text-[28px] font-black leading-tight">{profile.full_name || "Aluno"}</h2>
          <p className="font-display font-extrabold text-white/85">Nível {lvl.level}</p>
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <ProgressBar value={pct} tone="sun" className="h-2.5 flex-1 bg-white/25" label="Progresso do nível" />
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
            <BoltIcon /> <CountUp value={profile.xp} />
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

      <BadgeGrid achievements={achievements} celebrateFor={celebrateFor} />
    </article>
  );
}
