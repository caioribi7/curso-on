/** Medalha da conquista (arte final em public/achievements/medalhas/<slug>.png, 256x256, fundo transparente). */
export function AchievementBadge({ slug, unlocked, size = 72 }: { slug: string; icon?: string; unlocked: boolean; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG estático já no tamanho certo, sem ganho com next/image
    <img
      src={`/achievements/medalhas/${slug}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={unlocked ? "drop-shadow-sm" : "opacity-35 grayscale"}
    />
  );
}
