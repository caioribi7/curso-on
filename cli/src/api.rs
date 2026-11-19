//! Cliente mínimo do Supabase (Auth + REST). Usa só a chave pública e o token do
//! professor: tudo passa pelas regras de RLS, igual ao site.

use anyhow::{anyhow, bail, Result};
use reqwest::blocking::{Client, RequestBuilder, Response};
use serde_json::{json, Value};

#[derive(Clone)]
pub struct Session {
    pub token: String,
    pub user_id: String,
    pub email: String,
}

#[derive(Clone)]
pub struct Api {
    url: String,
    key: String,
    http: Client,
    pub session: Option<Session>,
}

impl Api {
    pub fn new(url: &str, publishable_key: &str) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .build()
            .expect("cliente HTTP");
        Self { url: url.trim_end_matches('/').to_owned(), key: publishable_key.to_owned(), http, session: None }
    }

    fn auth(&self, req: RequestBuilder) -> RequestBuilder {
        let token = self.session.as_ref().map_or(self.key.as_str(), |s| s.token.as_str());
        req.header("apikey", &self.key).bearer_auth(token)
    }

    pub fn login(&mut self, email: &str, password: &str) -> Result<()> {
        let res = self
            .http
            .post(format!("{}/auth/v1/token?grant_type=password", self.url))
            .header("apikey", &self.key)
            .json(&json!({ "email": email, "password": password }))
            .send()?;
        let body = check(res)?;
        self.session = Some(session_from(&body, email)?);
        Ok(())
    }

    /// Cria a conta. Devolve `false` se o Supabase pediu confirmação por e-mail.
    pub fn signup(&mut self, name: &str, email: &str, password: &str) -> Result<bool> {
        let res = self
            .http
            .post(format!("{}/auth/v1/signup", self.url))
            .header("apikey", &self.key)
            .json(&json!({ "email": email, "password": password, "data": { "full_name": name } }))
            .send()?;
        let body = check(res)?;
        if body.get("access_token").is_some() {
            self.session = Some(session_from(&body, email)?);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub fn user_id(&self) -> Result<&str> {
        self.session.as_ref().map(|s| s.user_id.as_str()).ok_or_else(|| anyhow!("Entre como professor primeiro."))
    }

    /// `GET /rest/v1/<query>`, por exemplo `courses?select=id,title&order=title`.
    pub fn select(&self, query: &str) -> Result<Vec<Value>> {
        let res = self.auth(self.http.get(format!("{}/rest/v1/{query}", self.url))).send()?;
        as_rows(check(res)?)
    }

    pub fn insert(&self, table: &str, rows: Value) -> Result<Vec<Value>> {
        let res = self
            .auth(self.http.post(format!("{}/rest/v1/{table}", self.url)))
            .header("Prefer", "return=representation")
            .json(&rows)
            .send()?;
        as_rows(check(res)?)
    }

    pub fn insert_one(&self, table: &str, row: Value) -> Result<Value> {
        self.insert(table, row)?.into_iter().next().ok_or_else(|| anyhow!("{table}: nada foi salvo (permissão?)"))
    }

    pub fn update(&self, table: &str, filter: &str, patch: Value) -> Result<()> {
        let res = self
            .auth(self.http.patch(format!("{}/rest/v1/{table}?{filter}", self.url)))
            .header("Prefer", "return=minimal")
            .json(&patch)
            .send()?;
        check(res).map(drop)
    }

    pub fn upsert(&self, table: &str, row: Value) -> Result<()> {
        let res = self
            .auth(self.http.post(format!("{}/rest/v1/{table}", self.url)))
            .header("Prefer", "resolution=merge-duplicates,return=minimal")
            .json(&row)
            .send()?;
        check(res).map(drop)
    }

    pub fn delete(&self, table: &str, filter: &str) -> Result<()> {
        let res = self.auth(self.http.delete(format!("{}/rest/v1/{table}?{filter}", self.url))).send()?;
        check(res).map(drop)
    }
}

fn session_from(body: &Value, email: &str) -> Result<Session> {
    Ok(Session {
        token: body["access_token"].as_str().ok_or_else(|| anyhow!("resposta sem token"))?.to_owned(),
        user_id: body["user"]["id"].as_str().ok_or_else(|| anyhow!("resposta sem usuário"))?.to_owned(),
        email: email.to_owned(),
    })
}

fn as_rows(v: Value) -> Result<Vec<Value>> {
    match v {
        Value::Array(rows) => Ok(rows),
        Value::Null => Ok(vec![]),
        other => Ok(vec![other]),
    }
}

/// Transforma erros do Supabase em mensagens curtas em português.
fn check(res: Response) -> Result<Value> {
    let status = res.status();
    let text = res.text().unwrap_or_default();
    let body: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
    if status.is_success() {
        return Ok(body);
    }
    let msg = ["msg", "message", "error_description", "error"]
        .iter()
        .find_map(|k| body.get(*k).and_then(Value::as_str))
        .unwrap_or(text.as_str())
        .to_owned();
    let friendly = match msg.as_str() {
        m if m.contains("Invalid login credentials") => "E-mail ou senha incorretos.".to_owned(),
        m if m.contains("Email not confirmed") => "Confirme o e-mail antes de entrar (veja sua caixa de entrada).".to_owned(),
        m if m.contains("already registered") => "Já existe uma conta com esse e-mail. Use “Entrar”.".to_owned(),
        m if m.contains("Password should be") => "A senha precisa ter pelo menos 6 caracteres.".to_owned(),
        m if m.contains("row-level security") => "Sem permissão: este conteúdo não é seu.".to_owned(),
        m if m.contains("duplicate key") => "Já existe um registro igual (por exemplo, um curso com o mesmo endereço).".to_owned(),
        m if m.contains("JWT expired") => "Sua sessão expirou. Entre de novo.".to_owned(),
        m => format!("{m} (HTTP {})", status.as_u16()),
    };
    bail!(friendly)
}
