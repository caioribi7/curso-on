//! Matérias do ENEM e o pacote de conteúdo, embutidos no binário
//! (a mesma fonte que o site usa: `content/*.json`).

use serde::Deserialize;
use std::sync::OnceLock;

const SUBJECTS_JSON: &str = include_str!("../../content/subjects.json");
const ENEM_JSON: &str = include_str!("../../content/enem.json");

#[derive(Deserialize)]
pub struct Area {
    pub key: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct Subject {
    pub key: String,
    pub name: String,
    pub area: String,
    pub colors: [String; 2],
}

#[derive(Deserialize)]
pub struct Subjects {
    pub areas: Vec<Area>,
    pub subjects: Vec<Subject>,
}

#[derive(Deserialize)]
pub struct Pack {
    pub courses: Vec<PackCourse>,
}

#[derive(Deserialize)]
pub struct PackCourse {
    pub subject: String,
    pub level: u8,
    pub subtitle: String,
    pub description: String,
    pub modules: Vec<PackModule>,
    pub questions: Vec<PackQuestion>,
}

#[derive(Deserialize)]
pub struct PackModule {
    pub title: String,
    pub icon: String,
    pub lessons: Vec<PackLesson>,
}

#[derive(Deserialize)]
pub struct PackLesson {
    pub title: String,
    pub summary: String,
    pub minutes: u32,
    pub xp: u32,
    pub body: String,
}

#[derive(Deserialize)]
pub struct PackQuestion {
    pub statement: String,
    pub options: Vec<String>,
    pub correct: usize,
    pub difficulty: String,
    pub explanation: String,
}

pub fn subjects() -> &'static Subjects {
    static S: OnceLock<Subjects> = OnceLock::new();
    S.get_or_init(|| serde_json::from_str(SUBJECTS_JSON).expect("content/subjects.json inválido"))
}

pub fn pack() -> Pack {
    serde_json::from_str(ENEM_JSON).expect("content/enem.json inválido")
}

pub fn subject(key: &str) -> Option<&'static Subject> {
    subjects().subjects.iter().find(|s| s.key == key)
}

pub fn area_name(key: &str) -> &'static str {
    subjects().areas.iter().find(|a| a.key == key).map_or("", |a| a.name.as_str())
}

pub fn title(key: &str, level: u8) -> String {
    format!("{} {level}", subject(key).map_or(key, |s| s.name.as_str()))
}

pub fn color(key: &str, level: u8) -> String {
    subject(key).map_or("#3B5BFD".into(), |s| s.colors[usize::from(level.clamp(1, 2) - 1)].clone())
}

/// Ícone antigo do curso (`courses.icon`), usado quando não há matéria.
pub fn fallback_icon(key: &str) -> &'static str {
    match key {
        "matematica" => "abacus",
        "fisica" | "quimica" | "biologia" => "flask",
        "geografia" | "ingles" | "espanhol" => "globe",
        "historia" => "book",
        "filosofia" | "sociologia" => "bulb",
        _ => "book",
    }
}

pub fn slug(key: &str, level: u8) -> String {
    format!("enem-{key}-{level}")
}

/// Cor `#RRGGBB` para o terminal.
pub fn rgb(hex: &str) -> ratatui::style::Color {
    let h = hex.trim_start_matches('#');
    let p = |i: usize| u8::from_str_radix(h.get(i..i + 2).unwrap_or("80"), 16).unwrap_or(128);
    ratatui::style::Color::Rgb(p(0), p(2), p(4))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MODULE_ICONS: [&str; 12] =
        ["blocks", "pie", "percent", "scale", "shapes", "graph", "book", "bulb", "flask", "globe", "target", "trophy"];

    #[test]
    fn pack_covers_every_subject_in_both_levels() {
        let pack = pack();
        for s in &subjects().subjects {
            for lvl in [1, 2] {
                assert!(pack.courses.iter().any(|c| c.subject == s.key && c.level == lvl), "falta {} {lvl}", s.key);
            }
        }
    }

    #[test]
    fn pack_respects_database_limits() {
        for c in pack().courses {
            assert!(subject(&c.subject).is_some(), "matéria desconhecida: {}", c.subject);
            assert!(c.subtitle.chars().count() <= 200 && c.description.chars().count() <= 5000);
            assert!(!c.modules.is_empty());
            for m in &c.modules {
                assert!(MODULE_ICONS.contains(&m.icon.as_str()), "ícone inválido: {}", m.icon);
                for l in &m.lessons {
                    assert!(l.title.chars().count() <= 160 && l.summary.chars().count() <= 500);
                    assert!(l.minutes <= 600 && l.xp <= 500);
                }
            }
            for q in &c.questions {
                assert!(q.options.len() >= 2 && q.correct < q.options.len(), "{}", q.statement);
                assert!(["easy", "medium", "hard"].contains(&q.difficulty.as_str()));
            }
        }
    }

    #[test]
    fn titles_and_colors() {
        assert_eq!(title("matematica", 2), "Matemática 2");
        assert_eq!(color("matematica", 1), "#3B5BFD");
        assert_eq!(slug("fisica", 1), "enem-fisica-1");
    }
}
