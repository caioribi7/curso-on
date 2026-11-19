import data from "../../content/subjects.json";

// Single source of truth for ENEM areas and subjects, shared with the
// `curso-on` terminal app (it embeds the same JSON file).

export type AreaKey = "linguagens" | "humanas" | "natureza" | "matematica";
export type Area = { key: AreaKey; name: string; color: string };
export type Subject = { key: string; name: string; area: AreaKey; colors: [string, string] };
export type Level = 1 | 2;

export const AREAS = data.areas as Area[];
export const SUBJECTS = data.subjects as Subject[];
export const SUBJECT_KEYS = SUBJECTS.map((s) => s.key) as [string, ...string[]];

const byKey = new Map(SUBJECTS.map((s) => [s.key, s]));

export function getSubject(key: string | null | undefined): Subject | null {
  return key ? (byKey.get(key) ?? null) : null;
}

export function subjectColor(key: string, level: Level) {
  return getSubject(key)?.colors[level - 1] ?? "#3B5BFD";
}

export function subjectTitle(key: string, level: Level) {
  return `${getSubject(key)?.name ?? "Curso"} ${level}`;
}
