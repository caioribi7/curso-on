//! Onde está o projeto Curso On e o arquivo `.env.local` dele.

use std::fs;
use std::path::{Path, PathBuf};

pub const LOCAL_DB_URL: &str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/// Procura a pasta do Curso On: `CURSO_ON_DIR`, depois a pasta atual e as de cima,
/// depois `./curso-on` (onde o assistente clona o projeto).
pub fn find_root() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("CURSO_ON_DIR") {
        let p = PathBuf::from(dir);
        if is_root(&p) {
            return Some(p);
        }
    }
    let cwd = std::env::current_dir().ok()?;
    for dir in cwd.ancestors() {
        if is_root(dir) {
            return Some(dir.to_path_buf());
        }
    }
    let child = cwd.join("curso-on");
    is_root(&child).then_some(child)
}

fn is_root(dir: &Path) -> bool {
    fs::read_to_string(dir.join("package.json"))
        .map(|s| s.contains("\"name\": \"curso-on\""))
        .unwrap_or(false)
}

/// Arquivo `KEY=valor` que preserva comentários e a ordem das linhas.
pub struct EnvFile {
    path: PathBuf,
    lines: Vec<String>,
}

impl EnvFile {
    pub fn load(root: &Path) -> Self {
        let path = root.join(".env.local");
        let text = fs::read_to_string(&path)
            .or_else(|_| fs::read_to_string(root.join(".env.example")))
            .unwrap_or_default();
        Self { path, lines: text.lines().map(str::to_owned).collect() }
    }

    pub fn get(&self, key: &str) -> Option<String> {
        self.lines.iter().find_map(|l| {
            let (k, v) = l.split_once('=')?;
            (k.trim() == key).then(|| v.trim().trim_matches('"').to_owned())
        })
    }

    /// Valor preenchido de verdade (não o exemplo `xxx` do `.env.example`).
    pub fn real(&self, key: &str) -> Option<String> {
        self.get(key).filter(|v| !v.is_empty() && !v.contains("xxx") && !v.contains("SEU-PROJETO"))
    }

    pub fn set(&mut self, key: &str, value: &str) {
        let line = format!("{key}={value}");
        match self.lines.iter_mut().find(|l| l.split_once('=').is_some_and(|(k, _)| k.trim() == key)) {
            Some(l) => *l = line,
            None => self.lines.push(line),
        }
    }

    pub fn save(&self) -> std::io::Result<()> {
        let mut text = self.lines.join("\n");
        text.push('\n');
        fs::write(&self.path, text)
    }
}

/// Lê a saída de `supabase status -o env` (linhas `NOME="valor"`).
pub fn parse_status_env(text: &str) -> Vec<(String, String)> {
    text.lines()
        .filter_map(|l| {
            let (k, v) = l.split_once('=')?;
            let k = k.trim();
            if k.is_empty() || !k.chars().all(|c| c.is_ascii_uppercase() || c == '_') {
                return None;
            }
            Some((k.to_owned(), v.trim().trim_matches('"').to_owned()))
        })
        .collect()
}

/// Esconde a senha de uma connection string para mostrar na tela.
pub fn mask_db_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else { return url.to_owned() };
    let Some((creds, host)) = rest.rsplit_once('@') else { return url.to_owned() };
    let user = creds.split(':').next().unwrap_or("");
    format!("{scheme}://{user}:•••@{host}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_set_replaces_and_appends() {
        let mut env = EnvFile { path: PathBuf::from("x"), lines: vec!["# c".into(), "A=1".into()] };
        env.set("A", "2");
        env.set("B", "3");
        assert_eq!(env.lines, vec!["# c", "A=2", "B=3"]);
        assert_eq!(env.get("A").as_deref(), Some("2"));
    }

    #[test]
    fn real_ignores_placeholders() {
        let env = EnvFile { path: PathBuf::from("x"), lines: vec!["K=sb_publishable_xxx".into(), "U=https://a.supabase.co".into()] };
        assert!(env.real("K").is_none());
        assert!(env.real("U").is_some());
    }

    #[test]
    fn parses_supabase_status() {
        let out = "API_URL=\"http://127.0.0.1:54321\"\nANON_KEY=\"abc\"\nStopped services: x\n";
        let v = parse_status_env(out);
        assert_eq!(v, vec![("API_URL".into(), "http://127.0.0.1:54321".into()), ("ANON_KEY".into(), "abc".into())]);
    }

    #[test]
    fn masks_password() {
        assert_eq!(mask_db_url(LOCAL_DB_URL), "postgresql://postgres:•••@127.0.0.1:54322/postgres");
    }
}
