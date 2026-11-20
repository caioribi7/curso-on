//! Onde as chaves secretas ficam: no `.env.local` (ignorado pelo git) ou no
//! chaveiro do sistema (Keychain no macOS, Credential Manager no Windows,
//! Secret Service no Linux). Valores nunca vão para logs nem para a tela.

use crate::project::EnvFile;
use std::path::Path;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Storage {
    EnvFile,
    Keychain,
}

impl Storage {
    pub fn from_key(s: &str) -> Self {
        if s == "keychain" { Self::Keychain } else { Self::EnvFile }
    }
}

/// Um projeto, uma "pasta" no chaveiro: dois projetos podem ter chaves diferentes.
fn service(root: &Path) -> String {
    let path = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    format!("curso-on:{}", path.display())
}

fn entry(root: &Path, key: &str) -> anyhow::Result<keyring::Entry> {
    keyring::Entry::new(&service(root), key).map_err(|e| anyhow::anyhow!("chaveiro indisponível: {e}"))
}

/// Valor de uma chave, venha de onde vier.
pub fn read(root: &Path, env: &EnvFile, key: &str) -> Option<String> {
    if env.in_keychain(key) {
        return entry(root, key).ok()?.get_password().ok();
    }
    env.real(key)
}

/// Uma alteração a gravar. `secret` = pode ir para o chaveiro; as públicas
/// (`NEXT_PUBLIC_*`, nome do bucket…) sempre vão para o `.env.local`,
/// porque o Next precisa delas ao montar o site.
pub struct Change<'a> {
    pub key: &'a str,
    pub value: &'a str,
    pub secret: bool,
}

/// Aplica as mudanças: valor vazio apaga a chave dos dois lugares.
pub fn write(root: &Path, changes: &[Change], storage: Storage) -> anyhow::Result<()> {
    let mut env = EnvFile::load(root);
    for c in changes {
        let to_keychain = c.secret && storage == Storage::Keychain && !c.value.is_empty();
        if to_keychain {
            entry(root, c.key)?.set_password(c.value).map_err(|_| {
                anyhow::anyhow!("O chaveiro do sistema não está disponível aqui (no Linux, precisa do GNOME Keyring ou KWallet). Escolha .env.local.")
            })?;
            env.remove(c.key);
        } else {
            if env.in_keychain(c.key) {
                if let Ok(e) = entry(root, c.key) {
                    let _ = e.delete_credential();
                }
            }
            if c.value.is_empty() {
                env.remove(c.key);
            } else {
                env.set(c.key, c.value);
            }
        }
        env.mark_keychain(c.key, to_keychain);
    }
    env.save()?;
    Ok(())
}

/// Chaves do chaveiro para passar ao `npm run dev` como variáveis de ambiente.
pub fn keychain_env(root: &Path, env: &EnvFile) -> Vec<(String, String)> {
    env.keychain_keys().into_iter().filter_map(|k| read(root, env, &k).map(|v| (k, v))).collect()
}
