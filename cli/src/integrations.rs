//! Integrações do Curso On: que chaves cada uma pede, como conseguir cada
//! chave (passo a passo), como conferir o formato e como testar a conexão.

use crate::form::Validator;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Id {
    Supabase,
    Masterbase,
    Stripe,
    Resend,
    Storage,
    Video,
    Analytics,
    Ai,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Vis {
    /// Aparece na tela (URL, nome do bucket, domínio).
    Plain,
    /// Escondida na tela, mas fica no `.env.local` porque o site precisa dela ao montar.
    Masked,
    /// Segredo de verdade: escondida e pode ir para o chaveiro do sistema.
    Secret,
}

pub struct Key {
    pub env: &'static str,
    pub label: &'static str,
    pub hint: &'static str,
    pub vis: Vis,
    pub required: bool,
    pub validate: Validator,
}

pub struct Integration {
    pub id: Id,
    pub name: &'static str,
    pub summary: &'static str,
    pub required: bool,
    /// Basta preencher uma das chaves (ex.: Plausible OU Google Analytics).
    pub any_of: bool,
    pub keys: &'static [Key],
    pub tutorial: &'static [&'static str],
}

impl Integration {
    pub fn has_secrets(&self) -> bool {
        self.keys.iter().any(|k| k.vis == Vis::Secret)
    }
    pub fn testable(&self) -> bool {
        !self.keys.is_empty()
    }

    /// Está configurada, olhando só para quais chaves existem.
    pub fn configured(&self, has: impl Fn(&str) -> bool) -> bool {
        if self.keys.is_empty() {
            return true;
        }
        if self.any_of {
            self.keys.iter().any(|k| has(k.env))
        } else {
            self.keys.iter().filter(|k| k.required).all(|k| has(k.env))
        }
    }

    /// Confere todas as chaves preenchidas; devolve o primeiro problema.
    pub fn check(&self, get: impl Fn(&str) -> String) -> Result<(), String> {
        let mut any = false;
        for k in self.keys {
            let v = get(k.env);
            if v.is_empty() {
                if k.required && !self.any_of {
                    return Err(format!("Preencha: {}.", k.label));
                }
                continue;
            }
            any = true;
            (k.validate)(&v).map_err(|e| format!("{}: {e}", k.label))?;
        }
        if self.any_of && !any {
            return Err("Preencha pelo menos uma das chaves.".into());
        }
        Ok(())
    }
}

/// Mostra que há um valor sem revelar nada dele (nem o tamanho).
pub fn mask(value: &str) -> String {
    if value.is_empty() { String::new() } else { "•".repeat(12) }
}

// ---------- formatos ----------

fn no_spaces(v: &str) -> Result<(), String> {
    if v.chars().any(char::is_whitespace) { Err("tem espaço no meio; copie de novo".into()) } else { Ok(()) }
}

fn prefixed(v: &str, prefixes: &[&str], min: usize) -> Result<(), String> {
    no_spaces(v)?;
    if !prefixes.iter().any(|p| v.starts_with(p)) {
        return Err(format!("deveria começar com {}", prefixes.join(" ou ")));
    }
    if v.len() < min {
        return Err("parece cortada; copie a chave inteira".into());
    }
    Ok(())
}

fn host_of(url: &str) -> Option<&str> {
    let rest = url.split_once("://")?.1;
    let host = rest.split(['/', '?', '#']).next()?;
    let host = host.rsplit_once('@').map_or(host, |(_, h)| h);
    (!host.is_empty()).then_some(host)
}

fn is_local(url: &str) -> bool {
    host_of(url).is_some_and(|h| {
        let name = h.rsplit_once(':').map_or(h, |(n, _)| n);
        name == "localhost" || name == "127.0.0.1" || name == "[::1]"
    })
}

fn https_url(v: &str) -> Result<(), String> {
    no_spaces(v)?;
    let https = v.starts_with("https://") && host_of(v).is_some_and(|h| h.contains('.'));
    if https || (v.starts_with("http://") && is_local(v)) {
        Ok(())
    } else {
        Err("deveria ser um endereço https://".into())
    }
}

fn supabase_url(v: &str) -> Result<(), String> {
    https_url(v)?;
    if v.trim_end_matches('/').matches('/').count() > 2 {
        return Err("use só o endereço do projeto, sem /rest/v1 ou outro caminho".into());
    }
    Ok(())
}

fn supabase_publishable(v: &str) -> Result<(), String> {
    if v.starts_with("sb_secret_") {
        return Err("essa é a chave SECRETA; aqui vai a publishable (sb_publishable_…)".into());
    }
    if v.starts_with("eyJ") && v.matches('.').count() == 2 {
        return Ok(()); // chave anon antiga (JWT), ainda aceita
    }
    prefixed(v, &["sb_publishable_"], 30)
}

fn postgres_url(v: &str) -> Result<(), String> {
    no_spaces(v)?;
    if !(v.starts_with("postgres://") || v.starts_with("postgresql://")) {
        return Err("deveria começar com postgresql://".into());
    }
    if !v.contains('@') || host_of(v).is_none() {
        return Err("faltou usuário@servidor (ex.: postgres:senha@host:5432/postgres)".into());
    }
    if v.contains("[YOUR-PASSWORD]") {
        return Err("troque [YOUR-PASSWORD] pela senha do banco".into());
    }
    Ok(())
}

fn stripe_secret(v: &str) -> Result<(), String> {
    if v.starts_with("pk_") {
        return Err("essa é a chave publicável (pk_); aqui vai a secreta (sk_…)".into());
    }
    prefixed(v, &["sk_test_", "sk_live_", "rk_test_", "rk_live_"], 30)?;
    if !v.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("tem caracteres estranhos; copie de novo".into());
    }
    Ok(())
}

fn stripe_webhook(v: &str) -> Result<(), String> {
    prefixed(v, &["whsec_"], 30)
}

fn resend_key(v: &str) -> Result<(), String> {
    prefixed(v, &["re_"], 20)
}

fn email_from(v: &str) -> Result<(), String> {
    let addr = match (v.find('<'), v.ends_with('>')) {
        (Some(i), true) => &v[i + 1..v.len() - 1],
        (None, _) => v,
        _ => return Err("use Nome <email@dominio> ou só email@dominio".into()),
    };
    match addr.split_once('@') {
        Some((user, domain)) if !user.is_empty() && domain.contains('.') && !addr.contains(' ') => Ok(()),
        _ => Err("e-mail inválido".into()),
    }
}

fn bucket(v: &str) -> Result<(), String> {
    let ok = (3..=63).contains(&v.len())
        && v.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
        && !v.starts_with('-')
        && !v.ends_with('-');
    if ok { Ok(()) } else { Err("3 a 63 letras minúsculas, números, - ou .".into()) }
}

fn access_key_id(v: &str) -> Result<(), String> {
    no_spaces(v)?;
    if (16..=128).contains(&v.len()) && v.chars().all(|c| c.is_ascii_alphanumeric()) {
        Ok(())
    } else {
        Err("deveria ter só letras e números (R2: 32 caracteres)".into())
    }
}

fn secret_access_key(v: &str) -> Result<(), String> {
    no_spaces(v)?;
    if v.len() >= 30 { Ok(()) } else { Err("parece cortada; copie a chave inteira".into()) }
}

fn region(v: &str) -> Result<(), String> {
    if !v.is_empty() && v.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        Ok(())
    } else {
        Err("ex.: auto (R2) ou sa-east-1 (AWS)".into())
    }
}

fn domain(v: &str) -> Result<(), String> {
    if v.contains("://") || v.contains('/') {
        return Err("só o domínio, sem https:// (ex.: meucurso.com.br)".into());
    }
    let ok = v.contains('.') && v.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || c == '-'));
    if ok { Ok(()) } else { Err("domínio inválido (ex.: meucurso.com.br)".into()) }
}

fn ga_id(v: &str) -> Result<(), String> {
    match v.strip_prefix("G-") {
        Some(rest) if rest.len() >= 4 && rest.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) => Ok(()),
        _ if v.starts_with("UA-") => Err("IDs UA- são do Analytics antigo, que já foi desligado; crie uma propriedade GA4 (G-…)".into()),
        _ => Err("deveria ser G- seguido de letras e números".into()),
    }
}

fn openai_key(v: &str) -> Result<(), String> {
    if v.starts_with("sk-ant-") {
        return Err("essa chave é da Anthropic; cole no campo de baixo".into());
    }
    prefixed(v, &["sk-"], 40)
}

fn anthropic_key(v: &str) -> Result<(), String> {
    prefixed(v, &["sk-ant-"], 40)
}

// ---------- catálogo ----------

const fn key(env: &'static str, label: &'static str, hint: &'static str, vis: Vis, required: bool, validate: Validator) -> Key {
    Key { env, label, hint, vis, required, validate }
}

pub static ALL: &[Integration] = &[
    Integration {
        id: Id::Supabase,
        name: "Supabase",
        summary: "Banco de dados e login. Obrigatório: sem ele o site não abre.",
        required: true,
        any_of: false,
        keys: &[
            key("NEXT_PUBLIC_SUPABASE_URL", "Project URL", "https://abcd1234.supabase.co", Vis::Plain, true, supabase_url),
            key("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "Publishable key", "começa com sb_publishable_", Vis::Masked, true, supabase_publishable),
        ],
        tutorial: &[
            "Testando no seu computador? Use Configurar → “Supabase no meu computador”: preenche tudo sozinho.",
            "Para colocar no ar (grátis):",
            "1. Crie a conta em https://supabase.com (dá para entrar com o GitHub).",
            "2. New project → nome “curso-on”, região São Paulo, senha forte do banco (guarde-a).",
            "3. Project Settings → Data API → copie a “Project URL”.",
            "4. Project Settings → API Keys → copie a “Publishable key”.",
            "5. Depois rode Configurar → “Criar as tabelas na nuvem”.",
            "A publishable key é pública por natureza: a segurança vem das regras RLS.",
        ],
    },
    Integration {
        id: Id::Masterbase,
        name: "Masterbase",
        summary: "Veja e edite o banco do Curso On numa tela visual, sem SQL. Opcional.",
        required: false,
        any_of: false,
        keys: &[key("MASTERBASE_DATABASE_URL", "Connection string", "postgresql://… (vazio = Supabase local)", Vis::Secret, true, postgres_url)],
        tutorial: &[
            "Masterbase é outro projeto open source do Caio: https://github.com/caioribi7/masterbase",
            "Com o Supabase local, nem precisa preencher: o painel usa o banco local.",
            "Supabase na nuvem:",
            "1. No painel do projeto, clique em “Connect” (topo da página).",
            "2. Aba “Connection string” → URI → modo “Session pooler”.",
            "3. Copie e troque [YOUR-PASSWORD] pela senha do banco.",
            "Atenção: com o usuário postgres o Masterbase ignora as regras RLS do site.",
            "Ctrl+O abre a tela do Masterbase (instalar, ligar, abrir no navegador).",
        ],
    },
    Integration {
        id: Id::Stripe,
        name: "Stripe",
        summary: "Cobrança opcional para quem quer vender cursos. Sem chave, tudo continua grátis.",
        required: false,
        any_of: false,
        keys: &[
            key("STRIPE_SECRET_KEY", "Secret key", "sk_test_… (teste) ou sk_live_… (real)", Vis::Secret, true, stripe_secret),
            key("STRIPE_WEBHOOK_SECRET", "Webhook signing secret", "whsec_…", Vis::Secret, true, stripe_webhook),
        ],
        tutorial: &[
            "O Curso On é grátis e open source. A Stripe só serve se VOCÊ quiser cobrar.",
            "1. Crie a conta em https://dashboard.stripe.com/register",
            "2. Ligue o “Modo de teste” (Test mode) no topo. Comece sempre por ele.",
            "3. Developers → API keys: https://dashboard.stripe.com/test/apikeys",
            "   Copie a “Secret key” (sk_test_…). Melhor ainda: crie uma Restricted key.",
            "4. Webhook no seu computador: instale a Stripe CLI e rode",
            "   stripe listen --forward-to localhost:3000/api/webhooks/stripe",
            "   Ela mostra o “webhook signing secret” (whsec_…).",
            "5. Em produção: Developers → Webhooks → Add endpoint → evento",
            "   checkout.session.completed → copie o “Signing secret”.",
            "Hoje o painel guarda e testa as chaves. O checkout no site",
            "é o próximo passo (veja docs/integracoes.md).",
        ],
    },
    Integration {
        id: Id::Resend,
        name: "Resend (e-mail)",
        summary: "E-mails do site (boas-vindas, avisos) com 3.000 envios grátis por mês.",
        required: false,
        any_of: false,
        keys: &[
            key("RESEND_API_KEY", "API key", "começa com re_", Vis::Secret, true, resend_key),
            key("EMAIL_FROM", "Remetente", "Curso On <oi@seudominio.com.br>", Vis::Plain, true, email_from),
        ],
        tutorial: &[
            "1. Crie a conta em https://resend.com/signup",
            "2. API Keys → Create API Key → permissão “Sending access” basta.",
            "   https://resend.com/api-keys  (a chave só aparece uma vez)",
            "3. Domains → Add domain → copie os registros DNS para o seu domínio.",
            "4. Remetente: um e-mail desse domínio, ex.: Curso On <oi@meucurso.com.br>",
            "Só testando? Use onboarding@resend.dev (só envia para o seu próprio e-mail).",
        ],
    },
    Integration {
        id: Id::Storage,
        name: "Cloudflare R2 / S3",
        summary: "Arquivos e vídeos próprios (PDFs, imagens). R2 tem 10 GB grátis e não cobra download.",
        required: false,
        any_of: false,
        keys: &[
            key("S3_ENDPOINT", "Endpoint", "https://ID-DA-CONTA.r2.cloudflarestorage.com", Vis::Plain, true, https_url),
            key("S3_REGION", "Região", "auto (R2) · sa-east-1 (AWS São Paulo)", Vis::Plain, true, region),
            key("S3_BUCKET", "Bucket", "ex.: curso-on-arquivos", Vis::Plain, true, bucket),
            key("S3_ACCESS_KEY_ID", "Access Key ID", "", Vis::Secret, true, access_key_id),
            key("S3_SECRET_ACCESS_KEY", "Secret Access Key", "", Vis::Secret, true, secret_access_key),
            key("S3_PUBLIC_URL", "URL pública (opcional)", "https://pub-….r2.dev ou seu domínio", Vis::Plain, false, https_url),
        ],
        tutorial: &[
            "Cloudflare R2 (recomendado):",
            "1. Crie a conta em https://dash.cloudflare.com/sign-up e abra “R2 Object Storage”.",
            "2. Create bucket → nome (ex.: curso-on-arquivos). Região: auto.",
            "3. Copie o Account ID da página do R2. Endpoint:",
            "   https://ACCOUNT_ID.r2.cloudflarestorage.com",
            "4. “Manage API tokens” → Create API token → Object Read & Write,",
            "   só neste bucket → copie Access Key ID e Secret Access Key (aparecem uma vez).",
            "5. Opcional: bucket → Settings → Public access → r2.dev ou domínio próprio.",
            "AWS S3: IAM → usuário com acesso só ao bucket → Access keys;",
            "endpoint https://s3.sa-east-1.amazonaws.com e região sa-east-1.",
        ],
    },
    Integration {
        id: Id::Video,
        name: "YouTube / Vimeo",
        summary: "Vídeos das aulas. Não precisa de chave: cole o link no editor da aula.",
        required: false,
        any_of: false,
        keys: &[],
        tutorial: &[
            "Nada para configurar. No estúdio do site, cada aula tem o campo “Vídeo”.",
            "YouTube: envie o vídeo como “Não listado” e cole o link (youtu.be/…).",
            "  O site usa youtube-nocookie.com, que não coloca cookies de rastreio.",
            "Vimeo: Privacidade → “Ocultar do Vimeo” e, em Incorporar,",
            "  permita só o seu domínio. Cole o link vimeo.com/123456.",
            "Vídeo próprio? Use Cloudflare R2 / S3 e cole a URL pública.",
        ],
    },
    Integration {
        id: Id::Analytics,
        name: "Plausible / Google Analytics",
        summary: "Quantas pessoas visitam o site. Preencha um dos dois.",
        required: false,
        any_of: true,
        keys: &[
            key("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "Plausible: domínio", "meucurso.com.br", Vis::Plain, false, domain),
            key("NEXT_PUBLIC_GA_ID", "Google Analytics: ID", "G-XXXXXXXXXX", Vis::Plain, false, ga_id),
        ],
        tutorial: &[
            "Plausible (recomendado: open source, sem cookies, mais simples com a LGPD):",
            "1. https://plausible.io/register (pago, com teste grátis) ou hospede o",
            "   Community Edition: https://github.com/plausible/community-edition",
            "2. Add website → digite o domínio do seu site, sem https://.",
            "Google Analytics (grátis):",
            "1. https://analytics.google.com → Administrador → Criar → Propriedade.",
            "2. Fluxos de dados → Web → URL do site → copie o “ID da métrica” (G-…).",
            "O ID é público (vai no HTML), por isso aparece na tela.",
        ],
    },
    Integration {
        id: Id::Ai,
        name: "OpenAI / Anthropic",
        summary: "Chave de IA para a pré-correção de redações (em breve). Preencha uma das duas.",
        required: false,
        any_of: true,
        keys: &[
            key("OPENAI_API_KEY", "OpenAI API key", "sk-proj-…", Vis::Secret, false, openai_key),
            key("ANTHROPIC_API_KEY", "Anthropic API key", "sk-ant-…", Vis::Secret, false, anthropic_key),
        ],
        tutorial: &[
            "As duas cobram por uso. Defina um limite de gastos antes de usar!",
            "OpenAI:",
            "1. https://platform.openai.com/api-keys → Create new secret key.",
            "2. Billing → adicione créditos e um limite mensal.",
            "Anthropic (Claude):",
            "1. https://console.anthropic.com/settings/keys → Create Key.",
            "2. Settings → Limits → defina o limite de gastos.",
            "A chave fica só no servidor. Nunca coloque em NEXT_PUBLIC_*.",
        ],
    },
];

pub fn get(id: Id) -> &'static Integration {
    ALL.iter().find(|i| i.id == id).expect("integração no catálogo")
}

// ---------- testar conexão ----------

fn client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent(concat!("curso-on-cli/", env!("CARGO_PKG_VERSION")))
        .build()
        .unwrap_or_default()
}

/// Mensagem a partir do status HTTP. Nunca usa o corpo da resposta, que às vezes
/// repete parte da chave.
fn http_error(service: &str, status: reqwest::StatusCode) -> String {
    match status.as_u16() {
        400 | 401 => format!("{service} recusou a chave ({}). Confira se copiou inteira e do modo certo.", status.as_u16()),
        403 => format!("{service} aceitou a chave, mas ela não tem permissão para isso (403)."),
        404 => format!("{service} não achou o recurso (404). Confira o endereço."),
        429 => format!("{service} pediu para esperar (429). Tente de novo em um minuto."),
        s => format!("{service} respondeu {s}."),
    }
}

fn net_error(service: &str, e: &reqwest::Error) -> String {
    if e.is_timeout() {
        format!("{service} não respondeu a tempo. Confira a internet.")
    } else if e.is_connect() {
        format!("Não consegui conectar ({service}). Confira o endereço e a internet.")
    } else {
        format!("Falha ao falar com {service}.")
    }
}

/// Faz uma chamada real e barata. `Ok` traz a mensagem de sucesso.
pub fn test(id: Id, values: &HashMap<String, String>) -> Result<String, String> {
    let v = |k: &str| values.get(k).map(String::as_str).unwrap_or("").trim().to_owned();
    get(id).check(v)?;
    let http = client();
    match id {
        Id::Supabase => {
            let url = v("NEXT_PUBLIC_SUPABASE_URL");
            let res = http
                .get(format!("{}/auth/v1/settings", url.trim_end_matches('/')))
                .header("apikey", v("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
                .send()
                .map_err(|e| net_error("Supabase", &e))?;
            if !res.status().is_success() {
                return Err(http_error("Supabase", res.status()));
            }
            Ok(format!("Supabase respondeu em {}.", host_of(&url).unwrap_or(&url)))
        }
        Id::Masterbase => {
            let url = v("MASTERBASE_DATABASE_URL");
            let host = host_of(&url).ok_or("Connection string sem servidor.")?;
            let addr = if host.rsplit_once(':').is_some_and(|(_, p)| p.parse::<u16>().is_ok()) { host.to_owned() } else { format!("{host}:5432") };
            let sock = std::net::ToSocketAddrs::to_socket_addrs(&addr)
                .map_err(|_| format!("Não achei o servidor {addr}."))?
                .next()
                .ok_or_else(|| format!("Não achei o servidor {addr}."))?;
            std::net::TcpStream::connect_timeout(&sock, Duration::from_secs(6)).map_err(|_| format!("O banco em {addr} não respondeu."))?;
            let mb = if crate::masterbase::Masterbase::binary().is_some() { "Masterbase instalado." } else { "Falta instalar o Masterbase (Ctrl+O)." };
            Ok(format!("Banco respondendo em {addr}. {mb}"))
        }
        Id::Stripe => {
            let key = v("STRIPE_SECRET_KEY");
            let res = http.get("https://api.stripe.com/v1/balance").bearer_auth(&key).send().map_err(|e| net_error("Stripe", &e))?;
            if !res.status().is_success() {
                return Err(http_error("Stripe", res.status()));
            }
            let mode = if key.contains("_live_") { "modo REAL (cobra de verdade)" } else { "modo de teste" };
            Ok(format!("Stripe aceitou a chave · {mode}. O webhook secret só é conferido quando chega um evento."))
        }
        Id::Resend => {
            let res = http.get("https://api.resend.com/domains").bearer_auth(v("RESEND_API_KEY")).send().map_err(|e| net_error("Resend", &e))?;
            let status = res.status();
            if status.as_u16() == 401 {
                // Chaves "Sending access" não podem listar domínios, mas são válidas.
                let body: serde_json::Value = res.json().unwrap_or_default();
                if body["name"] == "restricted_api_key" {
                    return Ok("Resend aceitou a chave (só envio, como recomendado).".into());
                }
                return Err(http_error("Resend", status));
            }
            if !status.is_success() {
                return Err(http_error("Resend", status));
            }
            let body: serde_json::Value = res.json().unwrap_or_default();
            let from = v("EMAIL_FROM");
            let from_domain = from.rsplit('@').next().unwrap_or("").trim_end_matches('>').to_owned();
            let domains = body["data"].as_array().cloned().unwrap_or_default();
            let found = domains.iter().find(|d| d["name"].as_str() == Some(&from_domain));
            Ok(match found {
                Some(d) => format!("Resend aceitou a chave. Domínio {from_domain}: {}.", d["status"].as_str().unwrap_or("?")),
                None if from_domain == "resend.dev" => "Resend aceitou a chave. Remetente de teste: só envia para o seu e-mail.".into(),
                None => format!("Resend aceitou a chave, mas o domínio {from_domain} ainda não foi adicionado em Domains."),
            })
        }
        Id::Storage => {
            let s3 = S3 {
                endpoint: v("S3_ENDPOINT"),
                region: v("S3_REGION"),
                bucket: v("S3_BUCKET"),
                access_key: v("S3_ACCESS_KEY_ID"),
                secret_key: v("S3_SECRET_ACCESS_KEY"),
            };
            let (url, headers) = s3.head_bucket(std::time::SystemTime::now());
            let mut req = http.head(url);
            for (k, val) in headers {
                req = req.header(k, val);
            }
            let res = req.send().map_err(|e| net_error("R2/S3", &e))?;
            match res.status().as_u16() {
                200 => Ok(format!("Bucket “{}” acessível com essas chaves.", s3.bucket)),
                404 => Err(format!("O bucket “{}” não existe nesse endpoint.", s3.bucket)),
                403 => Err("Chaves recusadas ou sem acesso a esse bucket (403).".into()),
                _ => Err(http_error("R2/S3", res.status())),
            }
        }
        Id::Video => Ok("Nada para testar: é só colar o link na aula.".into()),
        Id::Analytics => {
            let mut done = vec![];
            let plausible = v("NEXT_PUBLIC_PLAUSIBLE_DOMAIN");
            if !plausible.is_empty() {
                let res = http.get("https://plausible.io/js/script.js").send().map_err(|e| net_error("Plausible", &e))?;
                if !res.status().is_success() {
                    return Err(http_error("Plausible", res.status()));
                }
                done.push("Plausible no ar");
            }
            let ga = v("NEXT_PUBLIC_GA_ID");
            if !ga.is_empty() {
                let res = http.get("https://www.googletagmanager.com/gtag/js").query(&[("id", &ga)]).send().map_err(|e| net_error("Google", &e))?;
                if !res.status().is_success() {
                    return Err(format!("O Google não reconheceu o ID {ga} ({}).", res.status().as_u16()));
                }
                done.push("Google Analytics respondeu ao ID");
            }
            Ok(format!("{}. A confirmação final é a primeira visita aparecer no painel deles.", done.join(" · ")))
        }
        Id::Ai => {
            let mut done = vec![];
            let openai = v("OPENAI_API_KEY");
            if !openai.is_empty() {
                let res = http.get("https://api.openai.com/v1/models").bearer_auth(&openai).send().map_err(|e| net_error("OpenAI", &e))?;
                if !res.status().is_success() {
                    return Err(http_error("OpenAI", res.status()));
                }
                done.push("OpenAI aceitou a chave");
            }
            let anthropic = v("ANTHROPIC_API_KEY");
            if !anthropic.is_empty() {
                let res = http
                    .get("https://api.anthropic.com/v1/models")
                    .header("x-api-key", &anthropic)
                    .header("anthropic-version", "2023-06-01")
                    .send()
                    .map_err(|e| net_error("Anthropic", &e))?;
                if !res.status().is_success() {
                    return Err(http_error("Anthropic", res.status()));
                }
                done.push("Anthropic aceitou a chave");
            }
            Ok(format!("{}. Listar modelos não gasta créditos.", done.join(" · ")))
        }
    }
}

// ---------- assinatura S3 (AWS Signature V4), só para o HEAD do bucket ----------

struct S3 {
    endpoint: String,
    region: String,
    bucket: String,
    access_key: String,
    secret_key: String,
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn sha256_hex(data: &[u8]) -> String {
    use sha2::Digest;
    hex(&sha2::Sha256::digest(data))
}

fn hmac(key: &[u8], data: &[u8]) -> Vec<u8> {
    use hmac::Mac;
    let mut mac = hmac::Hmac::<sha2::Sha256>::new_from_slice(key).expect("HMAC aceita qualquer tamanho de chave");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn signing_key(secret: &str, date: &str, region: &str, service: &str) -> Vec<u8> {
    let k = hmac(format!("AWS4{secret}").as_bytes(), date.as_bytes());
    let k = hmac(&k, region.as_bytes());
    let k = hmac(&k, service.as_bytes());
    hmac(&k, b"aws4_request")
}

/// `20261120T134500Z` a partir do relógio, sem depender de crate de datas.
fn amz_date(t: std::time::SystemTime) -> String {
    let secs = t.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) as i64;
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Algoritmo "civil from days" (Howard Hinnant).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}{m:02}{d:02}T{:02}{:02}{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

impl S3 {
    fn head_bucket(&self, now: std::time::SystemTime) -> (String, Vec<(&'static str, String)>) {
        let endpoint = self.endpoint.trim_end_matches('/');
        let host = host_of(endpoint).unwrap_or("");
        let path = format!("/{}", self.bucket);
        let stamp = amz_date(now);
        let auth = self.authorization("HEAD", host, &path, &[], &stamp);
        (format!("{endpoint}{path}"), vec![("x-amz-content-sha256", sha256_hex(b"")), ("x-amz-date", stamp), ("authorization", auth)])
    }

    /// Cabeçalho `Authorization` de um pedido sem corpo. `extra` são outros
    /// cabeçalhos assinados, em minúsculas e em ordem alfabética, entre `host` e `x-amz-*`.
    fn authorization(&self, method: &str, host: &str, path: &str, extra: &[(&str, &str)], stamp: &str) -> String {
        let date = &stamp[..8];
        let empty = sha256_hex(b"");
        let mut headers = vec![("host", host)];
        headers.extend_from_slice(extra);
        headers.extend([("x-amz-content-sha256", empty.as_str()), ("x-amz-date", stamp)]);
        let canonical_headers: String = headers.iter().map(|(k, v)| format!("{k}:{v}\n")).collect();
        let signed = headers.iter().map(|(k, _)| *k).collect::<Vec<_>>().join(";");
        let canonical = format!("{method}\n{path}\n\n{canonical_headers}\n{signed}\n{empty}");
        let scope = format!("{date}/{}/s3/aws4_request", self.region);
        let to_sign = format!("AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{}", sha256_hex(canonical.as_bytes()));
        let signature = hex(&hmac(&signing_key(&self.secret_key, date, &self.region, "s3"), to_sign.as_bytes()));
        format!("AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={signed}, Signature={signature}", self.access_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_never_reveals_the_value_or_its_length() {
        for v in ["sk_test_51Habc", "a", "re_0123456789abcdefghijklmnopqrstuvwxyz"] {
            let m = mask(v);
            assert_eq!(m, mask("x"));
            assert!(!v.chars().any(|c| m.contains(c)));
        }
        assert_eq!(mask(""), "");
    }

    #[test]
    fn validates_key_formats() {
        let long = "a".repeat(40);
        assert!(stripe_secret(&format!("sk_test_{long}")).is_ok());
        assert!(stripe_secret(&format!("rk_live_{long}")).is_ok());
        assert!(stripe_secret(&format!("pk_test_{long}")).unwrap_err().contains("publicável"));
        assert!(stripe_secret("sk_test_curta").unwrap_err().contains("cortada"));
        assert!(stripe_secret(&format!("sk_test_{long} x")).unwrap_err().contains("espaço"));
        assert!(stripe_webhook(&format!("whsec_{long}")).is_ok());
        assert!(resend_key("re_123456789_abcdefghij").is_ok());
        assert!(resend_key("123").is_err());
        assert!(supabase_publishable("sb_publishable_abcdefghijklmnopqrstuv").is_ok());
        assert!(supabase_publishable("eyJhbGc.eyJpc3M.sig").is_ok());
        assert!(supabase_publishable("sb_secret_abcdefghijklmnopqrstuv").unwrap_err().contains("SECRETA"));
        assert!(supabase_url("https://abcd.supabase.co").is_ok());
        assert!(supabase_url("http://127.0.0.1:54321").is_ok());
        assert!(supabase_url("http://abcd.supabase.co").is_err());
        assert!(supabase_url("https://abcd.supabase.co/rest/v1").is_err());
        assert!(postgres_url("postgresql://postgres:pw@db.x.supabase.co:5432/postgres").is_ok());
        assert!(postgres_url("postgresql://postgres:[YOUR-PASSWORD]@h:5432/p").is_err());
        assert!(postgres_url("mysql://x@y").is_err());
        assert!(email_from("Curso On <oi@curso.com.br>").is_ok());
        assert!(email_from("oi@curso.com.br").is_ok());
        assert!(email_from("Curso On oi@curso").is_err());
        assert!(bucket("curso-on-arquivos").is_ok());
        assert!(bucket("Curso_On").is_err());
        assert!(access_key_id(&"0".repeat(32)).is_ok());
        assert!(domain("meucurso.com.br").is_ok());
        assert!(domain("https://meucurso.com.br").is_err());
        assert!(ga_id("G-ABC123XYZ").is_ok());
        assert!(ga_id("UA-1234-1").unwrap_err().contains("GA4"));
        assert!(openai_key(&format!("sk-proj-{long}")).is_ok());
        assert!(openai_key(&format!("sk-ant-{long}")).unwrap_err().contains("Anthropic"));
        assert!(anthropic_key(&format!("sk-ant-api03-{long}")).is_ok());
    }

    #[test]
    fn integration_check_handles_required_and_any_of() {
        let stripe = get(Id::Stripe);
        let long = "a".repeat(40);
        let only_key = |k: &str| if k == "STRIPE_SECRET_KEY" { format!("sk_test_{long}") } else { String::new() };
        assert!(stripe.check(only_key).unwrap_err().contains("Webhook"));
        assert!(!stripe.configured(|k| k == "STRIPE_SECRET_KEY"));
        assert!(stripe.configured(|_| true));

        let ai = get(Id::Ai);
        assert!(ai.check(|_| String::new()).is_err());
        assert!(ai.check(|k| if k == "ANTHROPIC_API_KEY" { format!("sk-ant-{long}") } else { String::new() }).is_ok());
        assert!(ai.check(|k| if k == "OPENAI_API_KEY" { "sk-x".into() } else { String::new() }).unwrap_err().starts_with("OpenAI"));
        assert!(get(Id::Video).configured(|_| false));
    }

    #[test]
    fn secrets_are_never_plain_on_screen() {
        for i in ALL {
            for k in i.keys {
                let looks_secret = k.env.contains("SECRET") || k.env.ends_with("API_KEY") || k.env.ends_with("DATABASE_URL");
                if looks_secret {
                    assert!(k.vis == Vis::Secret, "{} deveria ser Secret", k.env);
                }
                if k.env.starts_with("NEXT_PUBLIC_") {
                    assert!(k.vis != Vis::Secret, "{} é pública e não pode ir para o chaveiro", k.env);
                }
            }
        }
    }

    #[test]
    fn dates_for_s3_signatures() {
        let t = |s: u64| std::time::UNIX_EPOCH + Duration::from_secs(s);
        assert_eq!(amz_date(t(0)), "19700101T000000Z");
        assert_eq!(amz_date(t(951_782_400)), "20000229T000000Z");
        assert_eq!(amz_date(t(1_329_264_000 + 3_723)), "20120215T010203Z");
    }

    #[test]
    fn s3_signing_key_matches_aws_example() {
        // Exemplo da documentação da AWS ("Deriving the signing key").
        let k = signing_key("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20120215", "us-east-1", "iam");
        assert_eq!(hex(&k), "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d");
    }

    #[test]
    fn s3_signature_matches_aws_get_object_example() {
        // Exemplo "GET Object" da documentação do S3 (Signature V4, cabeçalho Authorization).
        let s3 = S3 {
            endpoint: String::new(),
            region: "us-east-1".into(),
            bucket: String::new(),
            access_key: "AKIAIOSFODNN7EXAMPLE".into(),
            secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".into(),
        };
        let auth = s3.authorization("GET", "examplebucket.s3.amazonaws.com", "/test.txt", &[("range", "bytes=0-9")], "20130524T000000Z");
        assert!(auth.ends_with("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"), "{auth}");
        assert!(auth.contains("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date"));
    }

    #[test]
    fn s3_request_never_carries_the_secret() {
        let s3 = S3 {
            endpoint: "https://abc.r2.cloudflarestorage.com/".into(),
            region: "auto".into(),
            bucket: "curso".into(),
            access_key: "AKID".into(),
            secret_key: "SEGREDO-NAO-PODE-VAZAR".into(),
        };
        let (url, headers) = s3.head_bucket(std::time::UNIX_EPOCH);
        assert_eq!(url, "https://abc.r2.cloudflarestorage.com/curso");
        let all = format!("{url} {headers:?}");
        assert!(!all.contains("SEGREDO"));
        assert!(all.contains("Credential=AKID/19700101/auto/s3/aws4_request"));
    }
}
