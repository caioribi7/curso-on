/** Emblema da conquista (desenhos finais em public/achievements/<slug>.svg, viewBox 170x180). */
export function AchievementBadge({ slug, unlocked, size = 64 }: { slug: string; icon?: string; unlocked: boolean; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático, sem ganho com next/image
    <img
      src={`/achievements/${slug}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={Math.round((size * 180) / 170)}
      loading="lazy"
      className={unlocked ? undefined : "opacity-40 grayscale"}
    />
  );
}
