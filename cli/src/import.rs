//! Importa o pacote ENEM (`content/enem.json`) para a conta do professor.

use crate::api::Api;
use crate::content::{self, PackCourse};
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::sync::mpsc::Sender;

pub enum Progress {
    Line(String),
    Done { created: usize, skipped: usize, failed: usize },
}

/// Roda numa thread separada e manda o andamento pelo canal.
pub fn run(api: Api, tx: Sender<Progress>) {
    let pack = content::pack();
    let (mut created, mut skipped, mut failed) = (0, 0, 0);
    for course in &pack.courses {
        let name = content::title(&course.subject, course.level);
        match import_course(&api, course) {
            Ok(true) => {
                created += 1;
                let lessons: usize = course.modules.iter().map(|m| m.lessons.len()).sum();
                let _ = tx.send(Progress::Line(format!("✓ {name}: {} módulos, {lessons} aulas, {} questões", course.modules.len(), course.questions.len())));
            }
            Ok(false) => {
                skipped += 1;
                let _ = tx.send(Progress::Line(format!("· {name}: já existe, pulei")));
            }
            Err(e) => {
                failed += 1;
                let _ = tx.send(Progress::Line(format!("✗ {name}: {e}")));
            }
        }
    }
    let _ = tx.send(Progress::Done { created, skipped, failed });
}

fn id(v: &Value) -> Result<String> {
    v["id"].as_str().map(str::to_owned).ok_or_else(|| anyhow!("resposta sem id"))
}

/// `Ok(false)` quando o curso já existe (o endereço é o mesmo).
fn import_course(api: &Api, c: &PackCourse) -> Result<bool> {
    let owner = api.user_id()?.to_owned();
    let slug = content::slug(&c.subject, c.level);
    if !api.select(&format!("courses?select=id&slug=eq.{slug}"))?.is_empty() {
        return Ok(false);
    }
    let course = api.insert_one(
        "courses",
        json!({
            "owner_id": owner,
            "slug": slug,
            "title": content::title(&c.subject, c.level),
            "subtitle": c.subtitle,
            "description": c.description,
            "theme_color": content::color(&c.subject, c.level),
            "icon": content::fallback_icon(&c.subject),
            "subject": c.subject,
            "level": c.level,
            "price_cents": 0,
            "status": "draft",
        }),
    )?;
    let course_id = id(&course)?;

    let result = (|| -> Result<()> {
        for (mi, m) in c.modules.iter().enumerate() {
            let module = api.insert_one("modules", json!({ "course_id": course_id, "title": m.title, "icon": m.icon, "position": mi }))?;
            let module_id = id(&module)?;
            let rows: Vec<Value> = m
                .lessons
                .iter()
                .enumerate()
                .map(|(li, l)| {
                    json!({
                        "module_id": module_id, "course_id": course_id, "title": l.title, "summary": l.summary,
                        "duration_minutes": l.minutes, "xp_reward": l.xp, "position": li,
                        "is_preview": mi == 0 && li == 0,
                    })
                })
                .collect();
            let inserted = api.insert("lessons", Value::Array(rows))?;
            let contents: Vec<Value> = inserted
                .iter()
                .filter_map(|row| {
                    let pos = row["position"].as_u64()? as usize;
                    Some(json!({ "lesson_id": row["id"], "course_id": course_id, "body": m.lessons.get(pos)?.body }))
                })
                .collect();
            api.insert("lesson_contents", Value::Array(contents))?;
        }
        for q in &c.questions {
            add_question(api, &course_id, None, &q.statement, &q.options, q.correct, &q.difficulty, &q.explanation)?;
        }
        // Publica só no fim, para nunca deixar um curso pela metade visível aos alunos.
        api.update("courses", &format!("id=eq.{course_id}"), json!({ "status": "published" }))
    })();

    if let Err(e) = result {
        let _ = api.delete("courses", &format!("id=eq.{course_id}"));
        return Err(e);
    }
    Ok(true)
}

/// Questão + alternativas + gabarito (o gabarito fica numa tabela que aluno não lê).
#[allow(clippy::too_many_arguments)]
pub fn add_question(
    api: &Api,
    course_id: &str,
    module_id: Option<&str>,
    statement: &str,
    options: &[String],
    correct: usize,
    difficulty: &str,
    explanation: &str,
) -> Result<()> {
    let xp = match difficulty {
        "easy" => 5,
        "hard" => 20,
        _ => 10,
    };
    let q = api.insert_one(
        "questions",
        json!({ "course_id": course_id, "module_id": module_id, "statement": statement,
                "explanation": explanation, "difficulty": difficulty, "xp_reward": xp }),
    )?;
    let qid = id(&q)?;
    let saved = (|| -> Result<()> {
        let rows: Vec<Value> = options.iter().enumerate().map(|(i, o)| json!({ "question_id": qid, "body": o, "position": i })).collect();
        let inserted = api.insert("question_options", Value::Array(rows))?;
        let correct_id = inserted
            .iter()
            .find(|r| r["position"].as_u64() == Some(correct as u64))
            .and_then(|r| r["id"].as_str())
            .ok_or_else(|| anyhow!("alternativa correta não encontrada"))?;
        api.insert("question_answers", json!({ "question_id": qid, "course_id": course_id, "correct_option_id": correct_id }))?;
        Ok(())
    })();
    if saved.is_err() {
        let _ = api.delete("questions", &format!("id=eq.{qid}"));
    }
    saved
}
