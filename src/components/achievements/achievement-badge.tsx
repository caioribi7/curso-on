// PROVISÓRIO: emblemas simples até os desenhos finais (feitos no Paper) chegarem.
// Ao trocar os desenhos, mantenha a mesma assinatura do componente.

const COLORS: Record<string, string> = {
  calouro: "#3B5BFD",
  "primeira-aula": "#2BC48A",
  maratonista: "#16A9A0",
  "na-mosca": "#FF6B5B",
  artilheiro: "#E53950",
  gabarito: "#9B59D6",
  "sequencia-de-fogo": "#F2A818",
  imparavel: "#E0892B",
  "curso-zerado": "#E8B007",
  "sobe-de-nivel": "#12A4E0",
  polimata: "#6CBF3A",
  podio: "#E5458B",
};

const stroke = { fill: "none", stroke: "#fff", strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** White glyph drawn on the colored medal, one per icon key. */
function Glyph({ icon }: { icon: string }) {
  switch (icon) {
    case "play":
      return <path d="M26 20 L46 32 L26 44 Z" fill="#fff" />;
    case "target":
      return (
        <g {...stroke}>
          <circle cx="32" cy="32" r="12" />
          <circle cx="32" cy="32" r="3" fill="#fff" />
        </g>
      );
    case "check":
      return <path d="M21 33 L29 41 L44 24" {...stroke} strokeWidth={5} />;
    case "flame":
      return <path d="M32 18 C40 27 42 32 42 37 A10 10 0 0 1 22 37 C22 31 27 28 28 23 C31 27 32 29 32 18 Z" fill="#fff" />;
    case "bolt":
      return <path d="M35 16 L23 35 L31 35 L28 48 L41 28 L33 28 Z" fill="#fff" />;
    case "trophy":
      return (
        <g fill="#fff">
          <path d="M23 19 H41 V28 A9 9 0 0 1 23 28 Z" />
          <rect x="29" y="36" width="6" height="6" />
          <rect x="24" y="42" width="16" height="4" rx="2" />
        </g>
      );
    case "stairs":
      return <path d="M20 44 H28 V36 H36 V28 H44 V20" {...stroke} />;
    case "compass":
      return (
        <g>
          <circle cx="32" cy="32" r="13" {...stroke} />
          <path d="M37 27 L34 34 L27 37 L30 30 Z" fill="#fff" />
        </g>
      );
    case "podium":
      return (
        <g fill="#fff">
          <rect x="27" y="22" width="10" height="22" rx="1.5" />
          <rect x="17" y="30" width="10" height="14" rx="1.5" />
          <rect x="37" y="34" width="10" height="10" rx="1.5" />
        </g>
      );
    case "runner":
      return (
        <g>
          <path d="M20 42 L28 34 L35 38 L43 27" {...stroke} />
          <circle cx="36" cy="21" r="3.5" fill="#fff" />
        </g>
      );
    case "ball":
      return (
        <g>
          <circle cx="32" cy="32" r="13" {...stroke} />
          <path d="M32 26 L37 30 L35 36 H29 L27 30 Z" fill="#fff" />
        </g>
      );
    case "cap":
      return (
        <g fill="#fff">
          <path d="M16 28 L32 20 L48 28 L32 36 Z" />
          <path d="M23 32 V39 C27 43 37 43 41 39 V32 L32 37 Z" />
        </g>
      );
    default:
      return <path d="M32 18 L36 28 L47 28 L38 35 L41 46 L32 39 L23 46 L26 35 L17 28 L28 28 Z" fill="#fff" />;
  }
}

export function AchievementBadge({ slug, icon, unlocked, size = 64 }: { slug: string; icon: string; unlocked: boolean; size?: number }) {
  const color = unlocked ? (COLORS[slug] ?? "#3B5BFD") : "#A3A9B8";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={unlocked ? undefined : "opacity-45"}>
      <circle cx="32" cy="34" r="28" fill="rgba(0,0,0,0.18)" />
      <circle cx="32" cy="31" r="28" fill={color} />
      <circle cx="32" cy="31" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <g transform="translate(0,-1)">
        <Glyph icon={icon} />
      </g>
    </svg>
  );
}
