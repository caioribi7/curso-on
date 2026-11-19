//! Programas do sistema: achar no PATH, rodar e abrir o navegador.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Acha um programa no PATH (no Windows também `.cmd`/`.exe`, como `npm.cmd`).
pub fn which(name: &str) -> Option<PathBuf> {
    let exts: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.CMD;.BAT".into())
            .split(';')
            .map(|e| e.to_ascii_lowercase())
            .chain([String::new()])
            .collect()
    } else {
        vec![String::new()]
    };
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path).find_map(|dir| {
        exts.iter().map(|e| dir.join(format!("{name}{e}"))).find(|p| p.is_file())
    })
}

/// Primeira linha de `programa --version`, se o programa existir.
pub fn version(name: &str) -> Option<String> {
    let bin = which(name)?;
    let out = Command::new(bin).arg("--version").stdin(Stdio::null()).output().ok()?;
    let text = String::from_utf8_lossy(if out.stdout.is_empty() { &out.stderr } else { &out.stdout }).into_owned();
    Some(text.lines().next().unwrap_or("").trim().to_owned())
}

/// Monta um comando já resolvido pelo PATH.
pub fn command(name: &str, args: &[&str], cwd: &Path) -> Option<Command> {
    let mut cmd = Command::new(which(name)?);
    cmd.args(args).current_dir(cwd);
    Some(cmd)
}

/// Roda e captura a saída (para comandos curtos, como `supabase status`).
pub fn capture(name: &str, args: &[&str], cwd: &Path) -> anyhow::Result<String> {
    let mut cmd = command(name, args, cwd).ok_or_else(|| anyhow::anyhow!("`{name}` não foi encontrado"))?;
    let out = cmd.stdin(Stdio::null()).output()?;
    if !out.status.success() {
        anyhow::bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

pub fn open_browser(url: &str) {
    let _ = if cfg!(windows) {
        Command::new("cmd").args(["/C", "start", "", url]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).spawn()
    } else {
        Command::new("xdg-open").arg(url).stdout(Stdio::null()).stderr(Stdio::null()).spawn()
    };
}

/// Primeira porta livre a partir de `start`.
pub fn free_port(start: u16) -> u16 {
    (start..start + 100)
        .find(|p| std::net::TcpListener::bind(("127.0.0.1", *p)).is_ok())
        .unwrap_or(start)
}
