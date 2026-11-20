//! Onde está o projeto Curso On e o arquivo `.env.local` dele.

use std::fs;
use std::path::{Path, PathBuf};

pub const LOCAL_DB_URL: &str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/// Linha que marca uma chave guardada no chaveiro do sistema (sem o valor).
pub const KEYCHAIN_MARK: &str = "# curso-on:chaveiro ";

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

    #[cfg(test)]
    pub fn from_text(text: &str) -> Self {
        Self { path: PathBuf::from("x"), lines: text.lines().map(str::to_owned).collect() }
    }

    fn is_key(line: &str, key: &str) -> bool {
        !line.trim_start().starts_with('#') && line.split_once('=').is_some_and(|(k, _)| k.trim() == key)
    }

    pub fn get(&self, key: &str) -> Option<String> {
        let line = self.lines.iter().find(|l| Self::is_key(l, key))?;
        Some(unquote(line.split_once('=')?.1))
    }

    /// Valor preenchido de verdade (não o exemplo `xxx` do `.env.example`).
    pub fn real(&self, key: &str) -> Option<String> {
        self.get(key).filter(|v| !v.is_empty() && !v.contains("xxx") && !v.contains("SEU-PROJETO"))
    }

    pub fn set(&mut self, key: &str, value: &str) {
        let line = format!("{key}={}", quote(value));
        match self.lines.iter_mut().find(|l| Self::is_key(l, key)) {
            Some(l) => *l = line,
            None => self.lines.push(line),
        }
    }

    pub fn remove(&mut self, key: &str) {
        self.lines.retain(|l| !Self::is_key(l, key));
    }

    /// A chave está no chaveiro do sistema (o arquivo só guarda o nome dela).
    pub fn in_keychain(&self, key: &str) -> bool {
        self.lines.iter().any(|l| l.strip_prefix(KEYCHAIN_MARK).is_some_and(|k| k.trim() == key))
    }

    pub fn keychain_keys(&self) -> Vec<String> {
        self.lines.iter().filter_map(|l| l.strip_prefix(KEYCHAIN_MARK)).map(|k| k.trim().to_owned()).collect()
    }

    pub fn mark_keychain(&mut self, key: &str, on: bool) {
        self.lines.retain(|l| !l.strip_prefix(KEYCHAIN_MARK).is_some_and(|k| k.trim() == key));
        if on {
            self.lines.push(format!("{KEYCHAIN_MARK}{key}"));
        }
    }

    /// Grava num arquivo temporário e troca de uma vez, para não deixar o
    /// `.env.local` pela metade. No Linux/macOS só o dono lê (0600).
    pub fn save(&self) -> std::io::Result<()> {
        let mut text = self.lines.join("\n");
        text.push('\n');
        let tmp = self.path.with_extension("local.tmp");
        write_private(&tmp, text.as_bytes())?;
        fs::rename(&tmp, &self.path).inspect_err(|_| {
            let _ = fs::remove_file(&tmp);
        })
    }
}

#[cfg(unix)]
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
    let mut f = fs::OpenOptions::new().write(true).create(true).truncate(true).mode(0o600).open(path)?;
    f.set_permissions(fs::Permissions::from_mode(0o600))?;
    f.write_all(bytes)
}

/// No Windows o arquivo fica dentro da pasta do usuário, que já é só dele.
#[cfg(not(unix))]
fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    fs::write(path, bytes)
}

/// Aspas só quando o valor precisa (espaço, `#`, aspas, `<`…), no formato do dotenv.
fn quote(v: &str) -> String {
    if v.chars().all(|c| c.is_ascii_alphanumeric() || "_-.:/@+=,%~?&".contains(c)) {
        v.to_owned()
    } else {
        format!("\"{}\"", v.replace('\\', "\\\\").replace('"', "\\\""))
    }
}

fn unquote(v: &str) -> String {
    let v = v.trim();
    let Some(inner) = v.strip_prefix('"').and_then(|x| x.strip_suffix('"')) else {
        return v.trim_matches('\'').to_owned();
    };
    let mut out = String::new();
    let mut chars = inner.chars();
    while let Some(c) = chars.next() {
        match (c, c == '\\') {
            (_, true) => match chars.next() {
                Some('n') => out.push('\n'),
                Some(n) => out.push(n),
                None => {}
            },
            (c, false) => out.push(c),
        }
    }
    out
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
        let mut env = EnvFile::from_text("# c\nA=1");
        env.set("A", "2");
        env.set("B", "3");
        assert_eq!(env.lines, vec!["# c", "A=2", "B=3"]);
        assert_eq!(env.get("A").as_deref(), Some("2"));
    }

    #[test]
    fn quotes_round_trip_and_comments_are_not_keys() {
        let mut env = EnvFile::from_text("# A=comentario");
        env.set("FROM", "Curso On <oi@curso.com>");
        env.set("Q", r#"a"b\c"#);
        env.set("PLAIN", "sk_test_123");
        assert_eq!(env.lines[1], r#"FROM="Curso On <oi@curso.com>""#);
        assert_eq!(env.lines[3], "PLAIN=sk_test_123");
        assert_eq!(env.get("FROM").as_deref(), Some("Curso On <oi@curso.com>"));
        assert_eq!(env.get("Q").as_deref(), Some(r#"a"b\c"#));
        assert_eq!(env.get("A"), None);
        env.remove("Q");
        assert_eq!(env.get("Q"), None);
        assert_eq!(env.lines.len(), 3);
    }

    #[test]
    fn keychain_marks_hold_only_the_name() {
        let mut env = EnvFile::from_text("A=1");
        env.mark_keychain("STRIPE_SECRET_KEY", true);
        env.mark_keychain("STRIPE_SECRET_KEY", true);
        assert!(env.in_keychain("STRIPE_SECRET_KEY"));
        assert_eq!(env.keychain_keys(), vec!["STRIPE_SECRET_KEY"]);
        assert_eq!(env.get("STRIPE_SECRET_KEY"), None);
        env.mark_keychain("STRIPE_SECRET_KEY", false);
        assert!(!env.in_keychain("STRIPE_SECRET_KEY"));
        assert_eq!(env.lines, vec!["A=1"]);
    }

    #[test]
    fn save_replaces_the_whole_file_privately() {
        let dir = std::env::temp_dir().join(format!("curso-on-env-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let mut env = EnvFile::load(&dir);
        env.set("RESEND_API_KEY", "re_abc");
        env.save().unwrap();
        env.set("RESEND_API_KEY", "re_def");
        env.save().unwrap();
        assert_eq!(fs::read_to_string(dir.join(".env.local")).unwrap(), "RESEND_API_KEY=re_def\n");
        assert!(!dir.join(".env.local.tmp").exists());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(dir.join(".env.local")).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn real_ignores_placeholders() {
        let env = EnvFile::from_text("K=sb_publishable_xxx\nU=https://a.supabase.co");
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
