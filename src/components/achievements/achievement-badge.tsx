/** Medalha 3D da conquista, feita com o GPT Image (public/achievements/medalhas-moderno/<slug>.png, 256x256, fundo transparente). O estilo patch de time antigo está em public/achievements/medalhas/. */
export function AchievementBadge({ slug, unlocked, size = 72 }: { slug: string; icon?: string; unlocked: boolean; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG estático já no tamanho certo, sem ganho com next/image
    <img
      src={`/achievements/medalhas-moderno/${slug}.png`}
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
