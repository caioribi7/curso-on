//! Integração opcional com o Masterbase (github.com/caioribi7/masterbase):
//! abre o banco do Curso On numa tela visual, sem SQL.

use crate::sys;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Stdio};

pub const REPO: &str = "https://github.com/caioribi7/masterbase";
pub const INSTALL_SH: &str = "curl -fsSL https://raw.githubusercontent.com/caioribi7/masterbase/main/install.sh | sh";

pub struct Masterbase {
    child: Option<Child>,
    pub url: Option<String>,
    pub log: Option<PathBuf>,
}

impl Masterbase {
    pub fn new() -> Self {
        Self { child: None, url: None, log: None }
    }

    pub fn binary() -> Option<PathBuf> {
        sys::which("masterbase")
    }

    pub fn running(&mut self) -> bool {
        match &mut self.child {
            Some(c) => match c.try_wait() {
                Ok(None) => true,
                _ => {
                    self.child = None;
                    self.url = None;
                    false
                }
            },
            None => false,
        }
    }

    /// Sobe o Masterbase com configuração própria do Curso On (não mexe na do usuário).
    pub fn start(&mut self, root: &Path, database_url: &str) -> anyhow::Result<String> {
        let bin = Self::binary().ok_or_else(|| anyhow::anyhow!("Masterbase não está instalado."))?;
        let dir = root.join(".masterbase");
        fs::create_dir_all(&dir)?;
        let log_path = dir.join("masterbase.log");
        let log = fs::File::create(&log_path)?;
        let port = sys::free_port(8090);
        let addr = format!("127.0.0.1:{port}");
        let url = format!("http://{addr}");
        let child = std::process::Command::new(bin)
            .current_dir(&dir)
            .env("DATABASE_URL", database_url)
            .env("MB_ADDR", &addr)
            .env("MB_URL", &url)
            .env("MB_CONFIG", dir.join("config.toml"))
            .env("MB_INSECURE_COOKIE", "1") // só localhost, sem HTTPS
            .stdin(Stdio::null())
            .stdout(log.try_clone()?)
            .stderr(log)
            .spawn()?;
        self.child = Some(child);
        self.url = Some(url.clone());
        self.log = Some(log_path);
        Ok(url)
    }

    pub fn stop(&mut self) {
        if let Some(mut c) = self.child.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
        self.url = None;
    }

    /// Últimas linhas do log, para mostrar erros de conexão na tela.
    pub fn tail(&self, n: usize) -> Vec<String> {
        let Some(p) = &self.log else { return vec![] };
        let text = fs::read_to_string(p).unwrap_or_default();
        let lines: Vec<String> = text.lines().map(str::to_owned).collect();
        lines[lines.len().saturating_sub(n)..].to_vec()
    }
}

impl Drop for Masterbase {
    fn drop(&mut self) {
        self.stop();
    }
}
