import type { CourseIcon, ModuleIcon } from "@/lib/types";

/*
 * Flat icon set from the Curso On design (Paper file "curso on").
 * Colored, friendly, no generic line icons. Brand colors are fixed here on
 * purpose: illustrations keep their palette regardless of the course accent.
 */

type IconProps = { size?: number; className?: string };

const B = "#3B5BFD";
const BD = "#2A44D4";
const Y = "#FFC93C";
const YD = "#F2A818";
const C = "#FF6B5B";
const G = "#2BC48A";
const INK = "#14161C";

export function CourseIllustration({ icon, size = 120, className }: IconProps & { icon: CourseIcon }) {
  const common = { width: size, height: size, viewBox: "0 0 120 120", className, "aria-hidden": true };
  switch (icon) {
    case "abacus":
      return (
        <svg {...common}>
          <rect x="14" y="20" width="92" height="84" rx="12" fill={BD} />
          <rect x="22" y="28" width="76" height="68" rx="6" fill="#E8ECFF" />
          <rect x="14" y="20" width="92" height="10" rx="5" fill={B} />
          <rect x="14" y="94" width="92" height="10" rx="5" fill={B} />
          {[45, 62, 79].map((y) => (
            <rect key={y} x="22" y={y} width="76" height="3" fill="#AEB5C4" />
          ))}
          {[26, 41, 80].map((x) => <rect key={`r${x}`} x={x} y="39" width="13" height="15" rx="6.5" fill={C} />)}
          {[26, 65, 80].map((x) => <rect key={`y${x}`} x={x} y="56" width="13" height="15" rx="6.5" fill={Y} />)}
          {[26, 41, 56].map((x) => <rect key={`g${x}`} x={x} y="73" width="13" height="15" rx="6.5" fill={G} />)}
          <path d="M104 10 L106.5 16.5 L113 19 L106.5 21.5 L104 28 L101.5 21.5 L95 19 L101.5 16.5 Z" fill={Y} />
        </svg>
      );
    case "book":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <path d="M5 21 L32 25 L59 21 L59 53 L32 57 L5 53 Z" fill={BD} />
          <path d="M8 17 Q20.5 14.5 32 21 L32 53 Q20.5 46.5 8 49.5 Z" fill="#FFFFFF" />
          <path d="M56 17 Q43.5 14.5 32 21 L32 53 Q43.5 46.5 56 49.5 Z" fill="#E8ECFF" />
          <path d="M13 25 Q20.5 24 27 27 M13 31 Q20.5 30 27 33 M13 37 Q20.5 36 27 39" stroke="#C9D2FF" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M44 17 L44 32 L47.5 29 L51 32 L51 16.5 Z" fill={C} />
        </svg>
      );
    case "bulb":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <path d="M32 2 L32 6 M10 25 L6 25 M58 25 L54 25 M16.5 9.5 L13.7 6.7 M47.5 9.5 L50.3 6.7" stroke={B} strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="25" r="15" fill={Y} />
          <path d="M22 32 L42 32 L39 42 L25 42 Z" fill={Y} />
          <path d="M24.5 21 A8.5 8.5 0 0 1 31 14.5" stroke="#FFF3C4" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M28 39 L28 31 L32 34 L36 31 L36 39" stroke={YD} strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <rect x="24" y="43" width="16" height="5" rx="2.5" fill={B} />
          <rect x="25.5" y="49" width="13" height="5" rx="2.5" fill={BD} />
          <rect x="28.5" y="55" width="7" height="3" rx="1.5" fill={INK} />
        </svg>
      );
    case "flask":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <rect x="24" y="4" width="16" height="6" rx="3" fill={BD} />
          <path d="M26 10 L38 10 L38 24 L54 50 Q57 58 48 58 L16 58 Q7 58 10 50 L26 24 Z" fill="#E8ECFF" />
          <path d="M19 38 L45 38 L54 50 Q57 58 48 58 L16 58 Q7 58 10 50 Z" fill={G} />
          <circle cx="26" cy="48" r="3.5" fill="#FFFFFF" />
          <circle cx="36" cy="44" r="2.5" fill="#FFFFFF" />
          <circle cx="40" cy="52" r="2" fill="#FFFFFF" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <circle cx="32" cy="30" r="24" fill={B} />
          <path d="M18 16 Q26 18 24 26 Q20 30 26 36 Q30 40 26 48 Q16 42 12 32 Q11 22 18 16 Z" fill={G} />
          <path d="M38 10 Q46 14 44 22 Q40 26 46 30 Q52 32 54 38 Q56 26 50 18 Q46 12 38 10 Z" fill={G} />
          <rect x="22" y="56" width="20" height="5" rx="2.5" fill={Y} />
        </svg>
      );
    case "palette":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <path d="M32 6 Q58 6 58 30 Q58 42 46 42 L40 42 Q34 42 36 48 Q38 56 30 58 Q6 56 6 32 Q6 6 32 6 Z" fill={Y} />
          <circle cx="20" cy="26" r="5" fill={C} />
          <circle cx="32" cy="17" r="5" fill={B} />
          <circle cx="45" cy="24" r="5" fill={G} />
          <circle cx="20" cy="42" r="5" fill="#FFFFFF" />
        </svg>
      );
    case "code":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <rect x="4" y="8" width="56" height="48" rx="10" fill={INK} />
          <rect x="4" y="8" width="56" height="10" rx="5" fill="#2A2E3A" />
          <circle cx="12" cy="13" r="2" fill={C} />
          <circle cx="19" cy="13" r="2" fill={Y} />
          <circle cx="26" cy="13" r="2" fill={G} />
          <path d="M22 28 L14 36 L22 44 M42 28 L50 36 L42 44" stroke={Y} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 26 L28 46" stroke="#8FA2FF" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "music":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <path d="M24 12 L54 6 L54 44" stroke={B} strokeWidth="5" fill="none" strokeLinejoin="round" />
          <path d="M24 12 L24 50" stroke={B} strokeWidth="5" />
          <ellipse cx="16" cy="50" rx="9" ry="7" fill={C} />
          <ellipse cx="46" cy="44" rx="9" ry="7" fill={Y} />
        </svg>
      );
    case "chart":
      return (
        <svg {...common} viewBox="0 0 64 64">
          <rect x="4" y="6" width="56" height="52" rx="10" fill="#FFFFFF" />
          <rect x="12" y="34" width="9" height="16" rx="3" fill={Y} />
          <rect x="27" y="24" width="9" height="26" rx="3" fill={C} />
          <rect x="42" y="14" width="9" height="36" rx="3" fill={B} />
          <path d="M10 52 L54 52" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "rocket":
    default:
      return (
        <svg {...common} viewBox="0 0 64 64">
          <g transform="rotate(45 32 32)">
            <path d="M26 40 L38 40 Q36 51 32 58 Q28 51 26 40 Z" fill={Y} />
            <path d="M32 5 Q45 18 42 41 L22 41 Q19 18 32 5 Z" fill="#E8ECFF" />
            <path d="M32 5 Q38 10.5 40.7 18 L23.3 18 Q26 10.5 32 5 Z" fill={C} />
            <circle cx="32" cy="27" r="5.5" fill={B} />
            <path d="M22.5 29 L13 43 L22 41 Z" fill={C} />
            <path d="M41.5 29 L51 43 L42 41 Z" fill={C} />
          </g>
        </svg>
      );
  }
}

const MODULE_BG: Record<ModuleIcon, string> = {
  blocks: "bg-sun-soft",
  pie: "bg-brand-soft",
  percent: "bg-mint-soft",
  scale: "bg-coral-soft",
  shapes: "bg-brand-soft",
  graph: "bg-mint-soft",
  book: "bg-sun-soft",
  bulb: "bg-brand-soft",
  flask: "bg-mint-soft",
  globe: "bg-brand-soft",
  target: "bg-coral-soft",
  trophy: "bg-sun-soft",
};

export function moduleIconBg(icon: ModuleIcon) {
  return MODULE_BG[icon] ?? "bg-brand-soft";
}

export function ModuleGlyph({ icon, size = 56, className }: IconProps & { icon: ModuleIcon }) {
  const common = { width: size, height: size, viewBox: "0 0 64 64", className, "aria-hidden": true };
  switch (icon) {
    case "blocks":
      return (
        <svg {...common}>
          <rect x="6" y="32" width="25" height="25" rx="6" fill={B} />
          <rect x="6" y="32" width="25" height="7" rx="3.5" fill="#5B78FF" />
          <rect x="34" y="32" width="25" height="25" rx="6" fill={C} />
          <rect x="34" y="32" width="25" height="7" rx="3.5" fill="#FF8A7E" />
          <rect x="20" y="5" width="25" height="25" rx="6" fill={Y} />
          <rect x="20" y="5" width="25" height="7" rx="3.5" fill="#FFD966" />
        </svg>
      );
    case "pie":
      return (
        <svg {...common}>
          <path d="M30 34 L30 12 A22 22 0 1 0 52 34 Z" fill={Y} stroke={YD} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M36 28 L36 6 A22 22 0 0 1 58 28 Z" fill={C} />
          <circle cx="22" cy="40" r="2.6" fill={C} />
          <circle cx="32" cy="46" r="2.6" fill={C} />
          <circle cx="20" cy="27" r="2.6" fill={C} />
        </svg>
      );
    case "percent":
      return (
        <svg {...common}>
          <path d="M8 14 Q8 8 14 8 L36 8 L58 30 Q61 33 58 36 L36 58 Q33 61 30 58 L8 36 Z" fill={G} />
          <circle cx="19" cy="19" r="4.5" fill="#E6F8F0" />
          <circle cx="31" cy="31" r="4" fill="#FFFFFF" />
          <circle cx="43" cy="43" r="4" fill="#FFFFFF" />
          <path d="M44 30 L30 44" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "scale":
      return (
        <svg {...common}>
          <path d="M32 14 L32 52" stroke={BD} strokeWidth="4" />
          <path d="M22 58 L42 58 L38 50 L26 50 Z" fill={B} />
          <path d="M8 18 L56 18" stroke={B} strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="32" cy="14" r="5" fill={Y} />
          <path d="M14 18 L6 34 M14 18 L22 34 M50 18 L42 34 M50 18 L58 34" stroke="#AEB5C4" strokeWidth="1.8" />
          <path d="M3 34 L25 34 Q25 42 14 42 Q3 42 3 34 Z" fill={C} />
          <path d="M39 34 L61 34 Q61 42 50 42 Q39 42 39 34 Z" fill={C} />
          <rect x="9" y="25" width="10" height="9" rx="2" fill={B} />
          <rect x="45" y="25" width="10" height="9" rx="2" fill={Y} />
        </svg>
      );
    case "shapes":
      return (
        <svg {...common}>
          <rect x="30" y="30" width="28" height="28" rx="5" fill={C} />
          <circle cx="20" cy="40" r="15" fill={Y} />
          <path d="M32 4 L52 38 L12 38 Z" fill={B} stroke={B} strokeWidth="4" strokeLinejoin="round" />
          <path d="M32 4 L52 38 L32 38 Z" fill={BD} stroke={BD} strokeWidth="4" strokeLinejoin="round" />
        </svg>
      );
    case "graph":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="56" height="52" rx="10" fill="#FFFFFF" />
          <path d="M14 14 L14 48 L54 48" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 44 Q28 44 34 32 Q40 18 52 16" stroke={G} strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="34" cy="32" r="4.5" fill={Y} stroke="#FFFFFF" strokeWidth="2" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="30" cy="34" r="25" fill={C} />
          <circle cx="30" cy="34" r="17.5" fill="#FFFFFF" />
          <circle cx="30" cy="34" r="10.5" fill={C} />
          <circle cx="30" cy="34" r="4" fill="#FFFFFF" />
          <path d="M30 34 L52 12" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M50 7 L52 12 L57 14 L60 9 L55 7 L53 2 Z" fill={B} />
        </svg>
      );
    case "trophy":
      return <TrophyIcon size={size} className={className} />;
    case "book":
    case "bulb":
    case "flask":
    case "globe":
      return <CourseIllustration icon={icon} size={size} className={className} />;
  }
}

export function TrophyIcon({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M18 14 L11 14 Q8 14 8 18 Q8 28 19 30" stroke={YD} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M46 14 L53 14 Q56 14 56 18 Q56 28 45 30" stroke={YD} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M18 8 L46 8 L46 22 Q46 37 32 39 Q18 37 18 22 Z" fill={Y} />
      <polygon points="32,14 34.1,18.9 39.4,19.3 35.4,22.7 36.6,27.8 32,25.1 27.4,27.8 28.6,22.7 24.6,19.3 29.9,18.9" fill="#FFFFFF" />
      <rect x="28" y="39" width="8" height="8" fill={YD} />
      <rect x="19" y="47" width="26" height="9" rx="3.5" fill={B} />
    </svg>
  );
}

export function FlameIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 2 Q19 9 24 13 Q28 17 27 22 Q26 30 16 30 Q6 30 5 22 Q4.5 16 9.5 12 Q9.5 17 13 18 Q11 9 16 2 Z" fill={C} />
      <path d="M16 15 Q19 19 20.5 22 Q21.5 27 16 27.5 Q10.5 27 11.5 22.5 Q12.5 19.5 16 15 Z" fill={Y} />
    </svg>
  );
}

export function BoltIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M13.5 2 L5 13.5 L11 13.5 L10 22 L19 10 L13 10 Z" fill={Y} stroke={YD} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function PencilIcon({ size = 120, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <g transform="rotate(-45 32 32)">
        <rect x="4" y="23" width="11" height="18" rx="4.5" fill={C} />
        <rect x="12" y="23" width="6" height="18" fill="#C9CFDB" />
        <rect x="18" y="23" width="27" height="18" fill={Y} />
        <rect x="18" y="23" width="27" height="6" fill="#FFD966" />
        <rect x="18" y="35" width="27" height="6" fill={YD} />
        <path d="M45 23 L59 32 L45 41 Z" fill="#F7D9A8" />
        <path d="M53.6 28.5 L59 32 L53.6 35.5 Z" fill={INK} />
      </g>
    </svg>
  );
}

export function CheckIcon({ size = 14, className, color = "currentColor" }: IconProps & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M3 8.5 L6.5 12 L13 4.5" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="3" y="7" width="10" height="7.5" rx="2" fill="currentColor" />
      <path d="M5.2 7 L5.2 5 Q5.2 2 8 2 Q10.8 2 10.8 5 L10.8 7" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

export function ChevronRight({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M7.5 4.5 L13 10 L7.5 15.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <path d="M4 2.5 Q4 1.3 5.1 1.9 L13 7 Q14 7.7 13 8.4 L5.1 13.5 Q4 14.1 4 12.9 Z" fill="currentColor" />
    </svg>
  );
}

export function NavIcon({ name, size = 22 }: { name: "home" | "lessons" | "questions" | "ranking" | "studio"; size?: number }) {
  switch (name) {
    case "home":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path d="M3 11 L12 3.5 L21 11 L21 20 Q21 21 20 21 L4 21 Q3 21 3 20 Z" fill={B} />
          <rect x="9.5" y="14" width="5" height="7" rx="1" fill={Y} />
        </svg>
      );
    case "lessons":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="5" fill={C} />
          <path d="M10 9 L15.5 12 L10 15 Z" fill="#FFFFFF" />
        </svg>
      );
    case "questions":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path d="M5 3 L19 3 Q22 3 22 6 L22 14 Q22 17 19 17 L10 17 L5 21 L5.5 17 Q2 17 2 14 L2 6 Q2 3 5 3 Z" fill={G} />
          <path d="M7.5 10 L10.5 13 L16.5 7" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "ranking":
      return <TrophyIcon size={size} />;
    case "studio":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <rect x="2" y="3" width="20" height="18" rx="5" fill={Y} />
          <path d="M7 15 L11 11 L13.5 13.5 L17 9" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
