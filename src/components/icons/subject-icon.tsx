import type { ReactNode } from "react";
import { CourseIllustration } from "@/components/icons/flat-icons";
import type { Course } from "@/lib/types";
import { getSubject, subjectColor, type Level } from "@/lib/subjects";

/*
 * One flat symbol per ENEM subject. Level 1 and level 2 share the symbol and
 * differ only by color (from content/subjects.json), so the catalog stays
 * readable: 13 symbols, never 26.
 */

const W = "#FFFFFF";
const INK = "#14161C";
const SUN = "#FFC93C";

function shade(hex: string, amount = 0.22) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** White glyph drawn on a 120×120 canvas; `c` is the tile color for accents. */
function glyph(subject: string, c: string): ReactNode {
  switch (subject) {
    case "matematica":
      return (
        <g>
          {[
            [24, 24],
            [62, 24],
            [24, 62],
            [62, 62],
          ].map(([x, y]) => (
            <rect key={`${x}${y}`} x={x} y={y} width="34" height="34" rx="9" fill={W} />
          ))}
          {/* + */}
          <rect x="31" y="38.5" width="20" height="5" rx="2.5" fill={c} />
          <rect x="38.5" y="31" width="5" height="20" rx="2.5" fill={c} />
          {/* − */}
          <rect x="69" y="38.5" width="20" height="5" rx="2.5" fill={c} />
          {/* × */}
          <g transform="rotate(45 41 79)">
            <rect x="31" y="76.5" width="20" height="5" rx="2.5" fill={c} />
            <rect x="38.5" y="69" width="5" height="20" rx="2.5" fill={c} />
          </g>
          {/* ÷ */}
          <rect x="69" y="76.5" width="20" height="5" rx="2.5" fill={c} />
          <circle cx="79" cy="70" r="3.2" fill={c} />
          <circle cx="79" cy="88" r="3.2" fill={c} />
        </g>
      );
    case "portugues":
      return (
        <g>
          <rect x="24" y="22" width="72" height="76" rx="14" fill={W} />
          <text x="60" y="76" textAnchor="middle" fontFamily="var(--font-nunito), sans-serif" fontWeight="900" fontSize="40" fill={c}>
            Aa
          </text>
          <rect x="36" y="84" width="48" height="5" rx="2.5" fill={SUN} />
        </g>
      );
    case "literatura":
      return (
        <g>
          <path d="M60 36 C48 28 32 28 20 32 V88 C32 84 48 84 60 92 Z" fill={W} />
          <path d="M60 36 C72 28 88 28 100 32 V88 C88 84 72 84 60 92 Z" fill="#EEF1FF" />
          <rect x="57.5" y="36" width="5" height="56" rx="2.5" fill={shade(c, 0.1)} />
          {[46, 56, 66].map((y) => (
            <rect key={y} x="29" y={y} width="22" height="4" rx="2" fill={c} opacity="0.55" />
          ))}
          {[46, 56, 66].map((y) => (
            <rect key={y} x="69" y={y} width="22" height="4" rx="2" fill={c} opacity="0.55" />
          ))}
          <path d="M80 28 V48 L86 43 L92 48 V28 Z" fill={SUN} />
        </g>
      );
    case "redacao":
      return (
        <g>
          <rect x="22" y="22" width="60" height="76" rx="10" fill={W} />
          {[38, 50, 62, 74].map((y, i) => (
            <rect key={y} x="32" y={y} width={i === 3 ? 26 : 40} height="5" rx="2.5" fill={c} opacity="0.5" />
          ))}
          <g transform="rotate(35 80 66)">
            <rect x="72" y="30" width="16" height="56" rx="4" fill={SUN} />
            <rect x="72" y="30" width="16" height="10" rx="4" fill="#FF8A7E" />
            <path d="M72 86 H88 L80 100 Z" fill="#F6D9B0" />
            <path d="M77.5 95 H82.5 L80 100 Z" fill={INK} />
          </g>
        </g>
      );
    case "ingles":
      return (
        <g>
          <path d="M22 34 a14 14 0 0 1 14 -14 h48 a14 14 0 0 1 14 14 v32 a14 14 0 0 1 -14 14 H52 L36 96 V80 a14 14 0 0 1 -14 -14 Z" fill={W} />
          <text x="60" y="63" textAnchor="middle" fontFamily="var(--font-nunito), sans-serif" fontWeight="900" fontSize="30" fill={c}>
            Hi!
          </text>
        </g>
      );
    case "espanhol":
      return (
        <g>
          <path d="M98 34 a14 14 0 0 0 -14 -14 H36 a14 14 0 0 0 -14 14 v32 a14 14 0 0 0 14 14 h32 l16 16 V80 a14 14 0 0 0 14 -14 Z" fill={W} />
          <text x="60" y="66" textAnchor="middle" fontFamily="var(--font-nunito), sans-serif" fontWeight="900" fontSize="36" fill={c}>
            Ñ
          </text>
        </g>
      );
    case "historia":
      return (
        <g>
          <rect x="30" y="20" width="60" height="10" rx="5" fill={W} />
          <rect x="30" y="90" width="60" height="10" rx="5" fill={W} />
          <path d="M36 30 H84 C84 48 66 54 66 60 C66 66 84 72 84 90 H36 C36 72 54 66 54 60 C54 54 36 48 36 30 Z" fill={W} />
          <path d="M46 38 H74 C72 46 62 50 60 54 C58 50 48 46 46 38 Z" fill={SUN} />
          <path d="M60 66 C62 72 76 78 76 86 H44 C44 78 58 72 60 66 Z" fill={SUN} />
        </g>
      );
    case "geografia":
      return (
        <g>
          <circle cx="60" cy="60" r="38" fill={W} />
          <path d="M40 38 C50 34 56 44 50 50 C44 56 50 64 42 70 C36 64 32 50 40 38 Z" fill={c} opacity="0.85" />
          <path d="M66 28 C78 30 90 42 92 54 C84 52 78 60 72 56 C66 52 72 44 66 40 Z" fill={c} opacity="0.85" />
          <path d="M62 72 C70 68 82 72 84 80 C76 90 66 94 58 94 C60 86 56 78 62 72 Z" fill={c} opacity="0.85" />
          <path d="M88 18 C80 18 74 24 74 32 C74 42 88 52 88 52 C88 52 102 42 102 32 C102 24 96 18 88 18 Z" fill={SUN} />
          <circle cx="88" cy="32" r="5" fill={INK} />
        </g>
      );
    case "filosofia":
      return (
        <g>
          <path d="M26 30 L60 18 L94 30 Z" fill={W} />
          <rect x="26" y="32" width="68" height="8" rx="3" fill={W} />
          {[34, 50, 66, 82].map((x) => (
            <rect key={x} x={x - 4} y="44" width="8" height="40" rx="3" fill={W} />
          ))}
          <rect x="22" y="88" width="76" height="10" rx="4" fill={W} />
          <circle cx="60" cy="27" r="4" fill={SUN} />
        </g>
      );
    case "sociologia":
      return (
        <g>
          <circle cx="36" cy="46" r="11" fill={W} opacity="0.85" />
          <path d="M18 88 C18 72 26 64 36 64 C46 64 54 72 54 88 Z" fill={W} opacity="0.85" />
          <circle cx="84" cy="46" r="11" fill={W} opacity="0.85" />
          <path d="M66 88 C66 72 74 64 84 64 C94 64 102 72 102 88 Z" fill={W} opacity="0.85" />
          <circle cx="60" cy="40" r="14" fill={W} />
          <path d="M36 96 C36 76 46 64 60 64 C74 64 84 76 84 96 Z" fill={W} />
          <circle cx="60" cy="40" r="5" fill={SUN} />
        </g>
      );
    case "biologia":
      return (
        <g>
          <path d="M42 18 C42 42 78 50 78 74 C78 86 70 94 62 102" stroke={W} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M78 18 C78 42 42 50 42 74 C42 86 50 94 58 102" stroke={W} strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.8" />
          {[
            [48, 30, 72],
            [52, 46, 68],
            [50, 74, 70],
            [54, 88, 66],
          ].map(([x1, y, x2]) => (
            <rect key={y} x={x1} y={y - 3} width={x2 - x1} height="6" rx="3" fill={SUN} />
          ))}
        </g>
      );
    case "quimica":
      return (
        <g>
          <rect x="46" y="16" width="28" height="10" rx="5" fill={W} />
          <path d="M50 26 H70 V46 L94 88 C97 94 93 100 86 100 H34 C27 100 23 94 26 88 L50 46 Z" fill={W} />
          <path d="M36 80 H84 L91 92 C92 95 90 96 87 96 H33 C30 96 28 95 29 92 Z" fill={c} opacity="0.75" />
          <circle cx="52" cy="70" r="5" fill={SUN} />
          <circle cx="66" cy="60" r="3.5" fill={SUN} />
          <circle cx="70" cy="74" r="4" fill={SUN} />
        </g>
      );
    case "fisica":
      return (
        <g>
          <ellipse cx="60" cy="60" rx="42" ry="15" fill="none" stroke={W} strokeWidth="7" />
          <ellipse cx="60" cy="60" rx="42" ry="15" fill="none" stroke={W} strokeWidth="7" transform="rotate(60 60 60)" />
          <ellipse cx="60" cy="60" rx="42" ry="15" fill="none" stroke={W} strokeWidth="7" transform="rotate(-60 60 60)" />
          <circle cx="60" cy="60" r="10" fill={SUN} />
          <circle cx="102" cy="60" r="5" fill={SUN} />
        </g>
      );
    default:
      return <circle cx="60" cy="60" r="30" fill={W} />;
  }
}

export function SubjectIcon({
  subject,
  level,
  size = 96,
  showLevel = true,
  className,
}: {
  subject: string;
  level: Level;
  size?: number;
  showLevel?: boolean;
  className?: string;
}) {
  const color = subjectColor(subject, level);
  const name = getSubject(subject)?.name ?? subject;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label={`${name} ${level}`}>
      <rect x="2" y="6" width="116" height="112" rx="30" fill={shade(color)} />
      <rect x="2" y="2" width="116" height="110" rx="30" fill={color} />
      {glyph(subject, color)}
      {showLevel ? (
        <g>
          <circle cx="100" cy="100" r="17" fill={SUN} stroke={W} strokeWidth="4" />
          <text x="100" y="107" textAnchor="middle" fontFamily="var(--font-nunito), sans-serif" fontWeight="900" fontSize="20" fill={INK}>
            {level}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

/** Course artwork: ENEM subject symbol when set, otherwise the free-form illustration. */
export function CourseBadge({ course, size = 96, className }: { course: Pick<Course, "icon" | "subject" | "level">; size?: number; className?: string }) {
  if (course.subject && course.level) {
    return <SubjectIcon subject={course.subject} level={course.level as Level} size={size} className={className} />;
  }
  return <CourseIllustration icon={course.icon} size={size} className={className} />;
}
