//! Estado do painel e o que cada tecla faz.

use crate::api::Api;
use crate::content;
use crate::form::{Field, Form, Kind, Outcome};
use crate::import::{self, Progress};
use crate::integrations::{self, Vis};
use crate::masterbase::{self, Masterbase};
use crate::project::{self, EnvFile};
use crate::secrets::{self, Storage};
use crate::sys;
use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::mpsc::Receiver;

pub const SITE: &str = "http://localhost:3000";
const MODULE_ICONS: [(&str, &str); 12] = [
    ("blocks", "Blocos"), ("book", "Livro"), ("bulb", "Ideia"), ("target", "Alvo"), ("graph", "Gráfico"), ("pie", "Pizza"),
    ("percent", "Porcentagem"), ("scale", "Balança"), ("shapes", "Formas"), ("flask", "Laboratório"), ("globe", "Globo"), ("trophy", "Troféu"),
];

#[derive(Clone, Copy, PartialEq)]
pub enum Screen {
    Home,
    Setup,
    Courses,
    Course,
    Import,
    Masterbase,
    Integrations,
    Guide,
}

#[derive(Clone)]
pub enum FormKind {
    Login,
    Signup,
    CloudSupabase,
    ProjectRef,
    NewCourse,
    Module(Option<String>),
    Lesson { id: Option<String>, module_id: String },
    Question,
    MasterbaseUrl,
    Integration(integrations::Id),
}

#[derive(Clone)]
pub enum Confirm {
    DeleteCourse(String),
    Delete { table: &'static str, id: String },
    Import,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Action {
    Setup,
    Platform,
    Login,
    Signup,
    MyCourses,
    Logout,
    Import,
    Integrations,
    Guide,
    Quit,
    // configuração
    Clone,
    LocalSupabase,
    CloudSupabase,
    PushMigrations,
    NpmInstall,
    Back,
    // masterbase
    MbStart,
    MbOpen,
    MbStop,
    MbUrl,
    MbInstall,
}

pub struct Item {
    pub action: Action,
    pub label: String,
    pub desc: String,
}

fn item(action: Action, label: &str, desc: &str) -> Item {
    Item { action, label: label.into(), desc: desc.into() }
}

pub enum Row {
    Module { id: String, title: String, icon: String, lessons: usize },
    Lesson { id: String, module_id: String, title: String, minutes: i64, xp: i64 },
    QuestionsHeader(usize),
    Question { id: String, statement: String, difficulty: String },
}

/// Comando externo, rodado com o painel pausado (o usuário vê a saída).
pub struct Job {
    pub title: String,
    pub steps: Vec<(String, Vec<String>)>,
    pub after: After,
    /// Variáveis extras (chaves do chaveiro). Nunca são impressas.
    pub env: Vec<(String, String)>,
}

pub enum After {
    Nothing,
    SyncLocalSupabase,
    Cloned,
}

pub struct Check {
    pub label: &'static str,
    pub ok: Option<bool>, // None = opcional e ausente
    pub detail: String,
}

pub struct App {
    pub root: Option<PathBuf>,
    pub env: Option<EnvFile>,
    pub api: Option<Api>,
    pub screen: Screen,
    pub selected: usize,
    pub form: Option<(FormKind, Form)>,
    pub confirm: Option<(String, Confirm)>,
    pub status: Option<(String, bool)>,
    pub checks: Vec<Check>,
    pub courses: Vec<Value>,
    pub course: Option<Value>,
    pub rows: Vec<Row>,
    pub import_rx: Option<Receiver<Progress>>,
    pub import_log: Vec<String>,
    pub import_total: usize,
    pub import_done: bool,
    pub mb: Masterbase,
    pub test_rx: Option<Receiver<Result<String, String>>>,
    pub scroll: u16,
    pub job: Option<Job>,
    pub quit: bool,
}

impl App {
    pub fn new() -> Self {
        let mut app = Self {
            root: project::find_root(),
            env: None,
            api: None,
            screen: Screen::Home,
            selected: 0,
            form: None,
            confirm: None,
            status: None,
            checks: vec![],
            courses: vec![],
            course: None,
            rows: vec![],
            import_rx: None,
            import_log: vec![],
            import_total: content::pack().courses.len(),
            import_done: false,
            mb: Masterbase::new(),
            test_rx: None,
            scroll: 0,
            job: None,
            quit: false,
        };
        app.reload_env();
        app
    }

    // ---------- estado derivado ----------

    pub fn reload_env(&mut self) {
        self.env = self.root.as_deref().map(EnvFile::load);
        let session = self.api.as_ref().and_then(|a| a.session.clone());
        self.api = self.env.as_ref().and_then(|e| {
            let url = e.real("NEXT_PUBLIC_SUPABASE_URL")?;
            let key = e.real("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")?;
            let mut api = Api::new(&url, &key);
            api.session = session.clone();
            Some(api)
        });
        self.refresh_checks();
    }

    pub fn refresh_checks(&mut self) {
        let env = self.env.as_ref();
        let supa = env.and_then(|e| e.real("NEXT_PUBLIC_SUPABASE_URL"));
        let node = sys::version("node");
        let docker = sys::version("docker");
        self.checks = vec![
            Check {
                label: "Projeto",
                ok: Some(self.root.is_some()),
                detail: self.root.as_ref().map_or("não encontrado: use “Baixar o Curso On”".into(), |p| p.display().to_string()),
            },
            Check { label: "Node.js", ok: Some(node.is_some()), detail: node.unwrap_or_else(|| "instale em nodejs.org (versão LTS)".into()) },
            Check { label: "Docker", ok: docker.as_ref().map(|_| true), detail: docker.unwrap_or_else(|| "opcional: só para o Supabase local".into()) },
            Check {
                label: "Supabase",
                ok: Some(supa.is_some()),
                detail: supa.map_or("ainda não configurado".into(), |u| if u.contains("127.0.0.1") || u.contains("localhost") { format!("local · {u}") } else { format!("nuvem · {u}") }),
            },
            Check {
                label: "Professor",
                ok: Some(self.logged_in()),
                detail: self.api.as_ref().and_then(|a| a.session.as_ref()).map_or("não entrou".into(), |s| s.email.clone()),
            },
        ];
    }

    pub fn logged_in(&self) -> bool {
        self.api.as_ref().is_some_and(|a| a.session.is_some())
    }

    pub fn items(&mut self) -> Vec<Item> {
        match self.screen {
            Screen::Home => {
                let mut v = vec![
                    item(Action::Setup, "Configurar o Curso On", "Primeira vez? Comece aqui. O assistente prepara o banco (Supabase), as chaves e as dependências."),
                    item(Action::Platform, "Abrir a plataforma", "Liga o site no seu computador e abre o navegador em localhost:3000. Ctrl+C volta para o painel."),
                ];
                if self.logged_in() {
                    v.push(item(Action::MyCourses, "Meus cursos", "Crie cursos, módulos, aulas e questões. Publique quando estiver pronto."));
                    v.push(item(Action::Import, "Importar cursos ENEM", "Cria 26 cursos prontos (13 matérias × níveis 1 e 2) na sua conta, com aulas e questões. Pode editar tudo depois."));
                    v.push(item(Action::Logout, "Sair da conta", "Encerra a sessão de professor neste painel."));
                } else {
                    v.push(item(Action::Login, "Entrar como professor", "Use o e-mail e a senha da sua conta no Curso On."));
                    v.push(item(Action::Signup, "Criar conta de professor", "Não tem conta? Crie em 10 segundos. Qualquer conta pode criar cursos."));
                }
                v.push(item(Action::Integrations, "Integrações", "Supabase, Masterbase, Stripe, e-mail, arquivos, vídeo, analytics e IA. Cole as chaves com segurança e teste a conexão."));
                v.push(item(Action::Guide, "Guia para iniciantes", "Passo a passo do zero: contas, configuração e seu primeiro curso."));
                v.push(item(Action::Quit, "Sair", "Fecha o painel. Nada é perdido."));
                v
            }
            Screen::Setup => {
                let mut v = vec![];
                if self.root.is_none() {
                    v.push(item(Action::Clone, "Baixar o Curso On", "Copia o projeto do GitHub para a pasta ./curso-on (precisa do git)."));
                }
                v.extend([
                    item(Action::LocalSupabase, "Supabase no meu computador", "Mais fácil para testar. Precisa do Docker aberto. Liga o banco local e preenche o .env.local sozinho."),
                    item(Action::CloudSupabase, "Supabase na nuvem (grátis)", "Para colocar no ar. Mostra como criar a conta em supabase.com e onde copiar as chaves."),
                    item(Action::PushMigrations, "Criar as tabelas na nuvem", "Depois de configurar a nuvem: envia as tabelas e regras de segurança para o seu projeto Supabase."),
                    item(Action::NpmInstall, "Instalar dependências do site", "Roda `npm install`. Necessário uma vez, ou depois de atualizar o projeto."),
                    item(Action::Integrations, "Integrações (opcional)", "Stripe, e-mail, arquivos, analytics, IA e Masterbase. Cada uma com passo a passo e “Testar conexão”."),
                    item(Action::Back, "Voltar", ""),
                ]);
                v
            }
            Screen::Masterbase => {
                let installed = Masterbase::binary().is_some();
                let running = self.mb.running();
                let mut v = vec![];
                if !installed {
                    v.push(item(Action::MbInstall, "Instalar o Masterbase", "Mostra como instalar (um comando no Linux/macOS; download no Windows)."));
                } else if running {
                    v.push(item(Action::MbOpen, "Abrir no navegador", "O Masterbase já está ligado."));
                    v.push(item(Action::MbStop, "Desligar o Masterbase", "Para o processo. O banco continua igual."));
                } else {
                    v.push(item(Action::MbStart, "Abrir o banco no Masterbase", "Liga o Masterbase apontando para o banco do Curso On e abre o navegador."));
                }
                v.push(item(Action::MbUrl, "Trocar a conexão do banco", "Use a connection string do Supabase na nuvem, ou deixe a do Supabase local."));
                v.push(item(Action::Back, "Voltar", ""));
                v
            }
            _ => vec![],
        }
    }

    pub fn mb_database_url(&self) -> String {
        self.secret("MASTERBASE_DATABASE_URL")
            .or_else(|| self.env.as_ref().and_then(|e| e.real("CURSO_ON_DATABASE_URL")))
            .unwrap_or_else(|| project::LOCAL_DB_URL.into())
    }

    /// Valor salvo de uma chave, do `.env.local` ou do chaveiro.
    pub fn secret(&self, key: &str) -> Option<String> {
        secrets::read(self.root.as_deref()?, self.env.as_ref()?, key)
    }

    /// A chave existe (sem ler o chaveiro, que pode pedir senha ao sistema).
    pub fn has_key(&self, key: &str) -> bool {
        self.env.as_ref().is_some_and(|e| e.in_keychain(key) || e.real(key).is_some())
    }

    pub fn in_keychain(&self, key: &str) -> bool {
        self.env.as_ref().is_some_and(|e| e.in_keychain(key))
    }

    fn ok(&mut self, msg: impl Into<String>) {
        self.status = Some((msg.into(), false));
    }
    fn err(&mut self, msg: impl Into<String>) {
        self.status = Some((msg.into(), true));
    }

    fn go(&mut self, screen: Screen) {
        self.screen = screen;
        self.selected = 0;
        self.scroll = 0;
    }

    // ---------- teclado ----------

    pub fn on_paste(&mut self, text: &str) {
        if let Some((_, form)) = &mut self.form {
            form.paste(text);
        }
    }

    pub fn on_key(&mut self, key: KeyEvent) {
        if key.code == KeyCode::Char('c') && key.modifiers.contains(KeyModifiers::CONTROL) {
            self.quit = true;
            return;
        }
        if let Some((_, form)) = &mut self.form {
            match form.handle(key) {
                Outcome::Cancel => self.form = None,
                Outcome::Submit => self.submit_form(),
                Outcome::Button(b) => self.form_button(b),
                Outcome::None => {}
            }
            return;
        }
        if let Some((_, action)) = &self.confirm {
            let action = action.clone();
            match key.code {
                KeyCode::Char('s' | 'S' | 'y' | 'Y') | KeyCode::Enter => {
                    self.confirm = None;
                    self.run_confirm(action);
                }
                KeyCode::Char('n' | 'N') | KeyCode::Esc => self.confirm = None,
                _ => {}
            }
            return;
        }
        self.status = None;

        let len = match self.screen {
            Screen::Courses => self.courses.len(),
            Screen::Course => self.rows.len(),
            Screen::Integrations => integrations::ALL.len(),
            Screen::Import | Screen::Guide => 0,
            _ => self.items().len(),
        };
        match key.code {
            KeyCode::Up | KeyCode::Char('k') if len > 0 => self.selected = (self.selected + len - 1) % len,
            KeyCode::Down | KeyCode::Char('j') if len > 0 => self.selected = (self.selected + 1) % len,
            KeyCode::Up | KeyCode::PageUp if self.screen == Screen::Guide => self.scroll = self.scroll.saturating_sub(if key.code == KeyCode::Up { 1 } else { 10 }),
            KeyCode::Down | KeyCode::PageDown if self.screen == Screen::Guide => self.scroll += if key.code == KeyCode::Down { 1 } else { 10 },
            KeyCode::Esc | KeyCode::Char('q') | KeyCode::Backspace => self.back(),
            KeyCode::Enter => self.enter(),
            KeyCode::Char(c) => self.shortcut(c),
            _ => {}
        }
    }

    fn back(&mut self) {
        match self.screen {
            Screen::Home => self.quit = true,
            Screen::Course => {
                self.go(Screen::Courses);
                self.load_courses();
            }
            Screen::Import if !self.import_done && self.import_rx.is_some() => self.err("Espere a importação terminar."),
            Screen::Masterbase => self.go(Screen::Integrations),
            _ => self.go(Screen::Home),
        }
    }

    fn enter(&mut self) {
        match self.screen {
            Screen::Home | Screen::Setup | Screen::Masterbase => {
                if let Some(it) = self.items().get(self.selected) {
                    let a = it.action;
                    self.act(a);
                }
            }
            Screen::Courses => self.open_course(),
            Screen::Integrations => self.integration_form(self.selected),
            Screen::Course => self.edit_row(),
            Screen::Import if self.import_done => self.go(Screen::Home),
            _ => {}
        }
    }

    fn shortcut(&mut self, c: char) {
        match (self.screen, c) {
            (Screen::Courses, 'n') => self.new_course_form(),
            (Screen::Courses, 'p') => self.toggle_publish(),
            (Screen::Courses, 'x') => {
                if let Some(c) = self.courses.get(self.selected) {
                    let msg = format!("Excluir o curso “{}” e tudo dentro dele?", c["title"].as_str().unwrap_or(""));
                    self.confirm = Some((msg, Confirm::DeleteCourse(c["id"].as_str().unwrap_or("").into())));
                }
            }
            (Screen::Courses, 'v') => {
                if let Some(c) = self.courses.get(self.selected) {
                    sys::open_browser(&format!("{SITE}/cursos/{}", c["slug"].as_str().unwrap_or("")));
                }
            }
            (Screen::Courses, 'r') => self.load_courses(),
            (Screen::Course, 'm') => self.module_form(None),
            (Screen::Course, 'a') => match self.current_module() {
                Some(module_id) => self.lesson_form(None, module_id),
                None => self.err("Crie um módulo primeiro (tecla m)."),
            },
            (Screen::Course, 'q') => self.question_form(),
            (Screen::Course, 'p') => self.toggle_publish(),
            (Screen::Course, 'x') => self.ask_delete_row(),
            (Screen::Course, 'v') => {
                if let Some(c) = &self.course {
                    sys::open_browser(&format!("{SITE}/cursos/{}", c["slug"].as_str().unwrap_or("")));
                }
            }
            (Screen::Integrations, 't') => self.test_saved(),
            (Screen::Import, 'v') if self.import_done => sys::open_browser(&format!("{SITE}/cursos")),
            _ => {}
        }
    }

    fn act(&mut self, action: Action) {
        let needs_root = !matches!(action, Action::Setup | Action::Guide | Action::Quit | Action::Back | Action::Clone | Action::MbInstall | Action::Integrations);
        let Some(root) = self.root.clone() else {
            if needs_root {
                self.go(Screen::Setup);
                self.err("Não achei a pasta do Curso On. Rode o painel dentro dela ou use “Baixar o Curso On”.");
                return;
            }
            return self.act_no_root(action);
        };
        let needs_api = matches!(action, Action::Login | Action::Signup | Action::MyCourses | Action::Import);
        if needs_api && self.api.is_none() {
            self.go(Screen::Setup);
            self.err("Configure o Supabase primeiro: escolha “no meu computador” ou “na nuvem”.");
            return;
        }
        match action {
            Action::Setup => {
                self.go(Screen::Setup);
                self.refresh_checks();
            }
            Action::Platform => {
                if self.api.is_none() {
                    self.go(Screen::Setup);
                    return self.err("Configure o Supabase antes de abrir a plataforma.");
                }
                let mut steps = vec![];
                if !root.join("node_modules").exists() {
                    steps.push(("npm".into(), vec!["install".into()]));
                }
                steps.push(("npm".into(), vec!["run".into(), "dev".into()]));
                // Chaves guardadas no chaveiro entram como variáveis de ambiente.
                let env = self.env.as_ref().map(|e| secrets::keychain_env(&root, e)).unwrap_or_default();
                // Abre o navegador assim que o site responder.
                std::thread::spawn(|| {
                    for _ in 0..180 {
                        std::thread::sleep(std::time::Duration::from_secs(1));
                        if std::net::TcpStream::connect(("127.0.0.1", 3000)).is_ok() {
                            std::thread::sleep(std::time::Duration::from_secs(2));
                            sys::open_browser(SITE);
                            return;
                        }
                    }
                });
                self.job = Some(Job { title: "Plataforma ligada em http://localhost:3000 · Ctrl+C desliga e volta ao painel".into(), steps, after: After::Nothing, env });
            }
            Action::Login => {
                self.form = Some((
                    FormKind::Login,
                    Form::new("Entrar como professor", vec![Field::new("email", "E-mail", Kind::Text), Field::new("password", "Senha", Kind::Secret)]),
                ))
            }
            Action::Signup => {
                self.form = Some((
                    FormKind::Signup,
                    Form::new(
                        "Criar conta de professor",
                        vec![
                            Field::new("name", "Seu nome", Kind::Text),
                            Field::new("email", "E-mail", Kind::Text),
                            Field::new("password", "Senha", Kind::Secret).hint("mínimo de 8 caracteres"),
                        ],
                    )
                    .help(&["A conta é criada no Supabase configurado.", "Ela serve para entrar no site e neste painel."]),
                ))
            }
            Action::Logout => {
                if let Some(api) = &mut self.api {
                    api.session = None;
                }
                self.selected = 0;
                self.refresh_checks();
                self.ok("Você saiu da conta.");
            }
            Action::MyCourses => {
                self.go(Screen::Courses);
                self.load_courses();
            }
            Action::Import => {
                self.confirm = Some((
                    format!("Criar {} cursos ENEM na sua conta? Cursos que já existem são pulados.", self.import_total),
                    Confirm::Import,
                ))
            }
            Action::Integrations => self.go(Screen::Integrations),
            Action::Guide => self.go(Screen::Guide),
            Action::Quit => self.quit = true,
            Action::Back => self.go(Screen::Home),
            Action::Clone => self.err("O Curso On já está aqui."),
            Action::LocalSupabase => {
                if sys::which("docker").is_none() {
                    return self.err("Instale e abra o Docker Desktop (docker.com) e tente de novo. Ou use o Supabase na nuvem.");
                }
                self.job = Some(Job {
                    title: "Ligando o Supabase local (a primeira vez baixa as imagens e demora alguns minutos)".into(),
                    steps: vec![("npx".into(), vec!["--yes".into(), "supabase".into(), "start".into()])],
                    after: After::SyncLocalSupabase, env: vec![]
                });
            }
            Action::CloudSupabase => {
                let env = self.env.as_ref();
                let get = |k: &str| env.and_then(|e| e.real(k)).unwrap_or_default();
                self.form = Some((
                    FormKind::CloudSupabase,
                    Form::new(
                        "Supabase na nuvem",
                        vec![
                            Field::new("url", "Project URL", Kind::Text).value(get("NEXT_PUBLIC_SUPABASE_URL")).hint("https://abcd1234.supabase.co"),
                            Field::new("pub", "Publishable key", Kind::Text).value(get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).hint("começa com sb_publishable_"),
                        ],
                    )
                    .help(&[
                        "1. Entre em supabase.com e clique em “Start your project” (dá para usar a conta do GitHub).",
                        "2. Clique em “New project”, dê um nome (ex.: curso-on), crie uma senha forte para o banco e GUARDE essa senha.",
                        "3. Escolha a região mais perto de você (São Paulo) e espere o projeto ficar pronto (~2 min).",
                        "4. Vá em Project Settings → Data API e copie a “Project URL”.",
                        "5. Vá em Project Settings → API Keys e copie a “Publishable key”.",
                        "6. Cole aqui (Ctrl+V funciona). Depois use “Criar as tabelas na nuvem”.",
                    ]),
                ));
            }
            Action::PushMigrations => {
                self.form = Some((
                    FormKind::ProjectRef,
                    Form::new("Criar as tabelas na nuvem", vec![Field::new("ref", "Reference ID do projeto", Kind::Text).hint("Project Settings → General → Project ID")])
                        .help(&[
                            "Vamos rodar 3 comandos do Supabase por você:",
                            "  supabase login  → abre o navegador para autorizar",
                            "  supabase link   → pede a senha do banco que você criou",
                            "  supabase db push → cria as tabelas e as regras de segurança",
                        ]),
                ))
            }
            Action::NpmInstall => {
                self.job = Some(Job { title: "Instalando dependências do site".into(), steps: vec![("npm".into(), vec!["install".into()])], after: After::Nothing, env: vec![] })
            }
            Action::MbStart => match self.mb.start(&root, &self.mb_database_url()) {
                Ok(url) => {
                    let u = url.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        sys::open_browser(&u);
                    });
                    self.selected = 0;
                    self.ok(format!("Masterbase ligado em {url}. A primeira conta criada lá vira administradora."));
                }
                Err(e) => self.err(format!("Não consegui ligar o Masterbase: {e}")),
            },
            Action::MbOpen => {
                if let Some(u) = &self.mb.url {
                    sys::open_browser(u);
                }
            }
            Action::MbStop => {
                self.mb.stop();
                self.selected = 0;
                self.ok("Masterbase desligado.");
            }
            Action::MbUrl => {
                let current = self.mb_database_url();
                self.form = Some((
                    FormKind::MasterbaseUrl,
                    Form::new("Conexão do banco para o Masterbase", vec![Field::new("url", "DATABASE_URL", Kind::Secret).value(current)]).help(&[
                        "Supabase local: postgresql://postgres:postgres@127.0.0.1:54322/postgres",
                        "Supabase na nuvem: Project Settings → Database → Connection string (URI).",
                        "Fica só no seu .env.local (que não vai para o GitHub).",
                    ]),
                ))
            }
            Action::MbInstall => self.act_no_root(action),
        }
    }

    fn act_no_root(&mut self, action: Action) {
        match action {
            Action::Setup => self.go(Screen::Setup),
            Action::Guide => self.go(Screen::Guide),
            Action::Integrations => self.go(Screen::Integrations),
            Action::Back => self.go(Screen::Home),
            Action::Quit => self.quit = true,
            Action::Clone => {
                if sys::which("git").is_none() {
                    return self.err("Instale o git (git-scm.com) e tente de novo.");
                }
                self.job = Some(Job {
                    title: "Baixando o Curso On do GitHub".into(),
                    steps: vec![("git".into(), vec!["clone".into(), "https://github.com/caioribi7/curso-on".into()])],
                    after: After::Cloned, env: vec![]
                });
            }
            Action::MbInstall => {
                if cfg!(windows) {
                    sys::open_browser(&format!("{}/releases/latest", masterbase::REPO));
                    self.ok("Abri a página de downloads do Masterbase. Baixe o arquivo para Windows e coloque o masterbase.exe numa pasta do PATH.");
                } else {
                    self.job = Some(Job {
                        title: "Instalando o Masterbase (script oficial)".into(),
                        steps: vec![("sh".into(), vec!["-c".into(), masterbase::INSTALL_SH.into()])],
                        after: After::Nothing, env: vec![]
                    });
                }
            }
            _ => {}
        }
    }

    fn run_confirm(&mut self, action: Confirm) {
        let Some(api) = self.api.clone() else { return };
        let res = match action {
            Confirm::Import => {
                let (tx, rx) = std::sync::mpsc::channel();
                std::thread::spawn(move || import::run(api, tx));
                self.import_rx = Some(rx);
                self.import_log.clear();
                self.import_done = false;
                self.go(Screen::Import);
                return;
            }
            Confirm::DeleteCourse(id) => api.delete("courses", &format!("id=eq.{id}")).map(|_| {
                self.load_courses();
            }),
            Confirm::Delete { table, id } => api.delete(table, &format!("id=eq.{id}")).map(|_| {
                self.load_course();
            }),
        };
        match res {
            Ok(()) => self.ok("Excluído."),
            Err(e) => self.err(e.to_string()),
        }
    }

    // ---------- cursos ----------

    pub fn load_courses(&mut self) {
        let Some(api) = &self.api else { return };
        let Ok(uid) = api.user_id() else { return };
        match api.select(&format!("courses?select=id,slug,title,subject,level,status&owner_id=eq.{uid}&order=subject.asc.nullslast,level,title")) {
            Ok(rows) => {
                self.courses = rows;
                self.selected = self.selected.min(self.courses.len().saturating_sub(1));
            }
            Err(e) => self.err(e.to_string()),
        }
    }

    fn open_course(&mut self) {
        if let Some(c) = self.courses.get(self.selected).cloned() {
            self.course = Some(c);
            self.go(Screen::Course);
            self.load_course();
        }
    }

    pub fn load_course(&mut self) {
        let (Some(api), Some(course)) = (&self.api, &self.course) else { return };
        let id = course["id"].as_str().unwrap_or("").to_owned();
        let res = (|| -> anyhow::Result<Vec<Row>> {
            let fresh = api.select(&format!("courses?select=id,slug,title,subject,level,status&id=eq.{id}"))?;
            let modules = api.select(&format!("modules?select=id,title,icon&course_id=eq.{id}&order=position"))?;
            let lessons = api.select(&format!("lessons?select=id,module_id,title,duration_minutes,xp_reward&course_id=eq.{id}&order=position"))?;
            let questions = api.select(&format!("questions?select=id,statement,difficulty&course_id=eq.{id}&order=created_at"))?;
            let s = |v: &Value, k: &str| v[k].as_str().unwrap_or("").to_owned();
            let mut rows = vec![];
            for m in &modules {
                let mine: Vec<&Value> = lessons.iter().filter(|l| l["module_id"] == m["id"]).collect();
                rows.push(Row::Module { id: s(m, "id"), title: s(m, "title"), icon: s(m, "icon"), lessons: mine.len() });
                for l in mine {
                    rows.push(Row::Lesson {
                        id: s(l, "id"),
                        module_id: s(l, "module_id"),
                        title: s(l, "title"),
                        minutes: l["duration_minutes"].as_i64().unwrap_or(0),
                        xp: l["xp_reward"].as_i64().unwrap_or(0),
                    });
                }
            }
            rows.push(Row::QuestionsHeader(questions.len()));
            for q in &questions {
                rows.push(Row::Question { id: s(q, "id"), statement: s(q, "statement"), difficulty: s(q, "difficulty") });
            }
            if let Some(c) = fresh.into_iter().next() {
                self.course = Some(c);
            }
            Ok(rows)
        })();
        match res {
            Ok(rows) => {
                self.rows = rows;
                self.selected = self.selected.min(self.rows.len().saturating_sub(1));
            }
            Err(e) => self.err(e.to_string()),
        }
    }

    fn course_id(&self) -> String {
        self.course.as_ref().and_then(|c| c["id"].as_str()).unwrap_or("").to_owned()
    }

    fn current_module(&self) -> Option<String> {
        self.rows[..=self.selected.min(self.rows.len().saturating_sub(1))].iter().rev().find_map(|r| match r {
            Row::Module { id, .. } => Some(id.clone()),
            Row::Lesson { module_id, .. } => Some(module_id.clone()),
            _ => None,
        })
        .or_else(|| self.rows.iter().find_map(|r| if let Row::Module { id, .. } = r { Some(id.clone()) } else { None }))
    }

    fn toggle_publish(&mut self) {
        let target = match self.screen {
            Screen::Courses => self.courses.get(self.selected).cloned(),
            _ => self.course.clone(),
        };
        let (Some(api), Some(c)) = (&self.api, target) else { return };
        let publish = c["status"] != "published";
        let res = api.update("courses", &format!("id=eq.{}", c["id"].as_str().unwrap_or("")), json!({ "status": if publish { "published" } else { "draft" } }));
        match res {
            Ok(()) => {
                self.ok(if publish { "Publicado! Os alunos já podem ver o curso." } else { "Voltou para rascunho." });
                if self.screen == Screen::Courses { self.load_courses() } else { self.load_course() }
            }
            Err(e) => self.err(e.to_string()),
        }
    }

    fn ask_delete_row(&mut self) {
        let Some(row) = self.rows.get(self.selected) else { return };
        let (table, id, what) = match row {
            Row::Module { id, title, .. } => ("modules", id, format!("o módulo “{title}” e as aulas dele")),
            Row::Lesson { id, title, .. } => ("lessons", id, format!("a aula “{title}”")),
            Row::Question { id, .. } => ("questions", id, "esta questão".to_owned()),
            Row::QuestionsHeader(_) => return,
        };
        self.confirm = Some((format!("Excluir {what}?"), Confirm::Delete { table, id: id.clone() }));
    }

    fn edit_row(&mut self) {
        let Some(row) = self.rows.get(self.selected) else { return };
        match row {
            Row::Module { id, title, icon, .. } => {
                let (id, title, icon) = (id.clone(), title.clone(), icon.clone());
                self.module_form(Some((id, title, icon)));
            }
            Row::Lesson { id, module_id, .. } => {
                let (id, module_id) = (id.clone(), module_id.clone());
                self.lesson_form(Some(id), module_id);
            }
            Row::QuestionsHeader(_) => self.question_form(),
            Row::Question { .. } => self.ok("Para mudar uma questão, exclua (x) e crie de novo (q)."),
        }
    }

    fn new_course_form(&mut self) {
        let subjects: Vec<(String, String)> =
            content::subjects().subjects.iter().map(|s| (s.key.clone(), format!("{}  ·  {}", s.name, content::area_name(&s.area)))).collect();
        self.form = Some((
            FormKind::NewCourse,
            Form::new(
                "Novo curso",
                vec![
                    Field::new("subject", "Matéria do ENEM", Kind::Choice(subjects)).pick("matematica"),
                    Field::new("level", "Nível", Kind::Choice(vec![("1".into(), "1 · Base e conteúdos iniciais".into()), ("2".into(), "2 · Aprofundamento e ENEM".into())])),
                    Field::new("title", "Título", Kind::Text).hint("vazio = nome da matéria + nível (ex.: Matemática 1)"),
                    Field::new("subtitle", "Subtítulo", Kind::Text).hint("uma frase sobre o curso"),
                ],
            )
            .help(&["← → escolhe a matéria e o nível.", "A cor e o ícone vêm da matéria."]),
        ));
    }

    fn module_form(&mut self, existing: Option<(String, String, String)>) {
        let icons: Vec<(String, String)> = MODULE_ICONS.iter().map(|(k, l)| (k.to_string(), l.to_string())).collect();
        let (id, title, icon) = existing.map_or((None, String::new(), "blocks".into()), |(i, t, ic)| (Some(i), t, ic));
        self.form = Some((
            FormKind::Module(id.clone()),
            Form::new(
                if id.is_some() { "Editar módulo" } else { "Novo módulo" },
                vec![Field::new("title", "Título do módulo", Kind::Text).value(title).hint("ex.: Funções e gráficos"), Field::new("icon", "Ícone", Kind::Choice(icons)).pick(&icon)],
            ),
        ));
    }

    fn lesson_form(&mut self, id: Option<String>, module_id: String) {
        let mut form = Form::new(
            if id.is_some() { "Editar aula" } else { "Nova aula" },
            vec![
                Field::new("title", "Título", Kind::Text),
                Field::new("summary", "Resumo", Kind::Text).hint("uma linha"),
                Field::new("minutes", "Duração (min)", Kind::Number).value("10"),
                Field::new("xp", "XP ao concluir", Kind::Number).value("20"),
                Field::new("preview", "Prévia grátis?", Kind::Choice(vec![("false".into(), "Não".into()), ("true".into(), "Sim, qualquer um pode ver".into())])),
                Field::new("body", "Conteúdo (Markdown)", Kind::Multiline).hint("Enter quebra linha · Ctrl+S salva"),
            ],
        )
        .help(&["# Título, - lista, **negrito**.", "Ctrl+S salva a aula."]);
        if let (Some(lid), Some(api)) = (&id, &self.api) {
            let lesson = api.select(&format!("lessons?select=title,summary,duration_minutes,xp_reward,is_preview&id=eq.{lid}")).ok().and_then(|v| v.into_iter().next());
            let body = api.select(&format!("lesson_contents?select=body&lesson_id=eq.{lid}")).ok().and_then(|v| v.into_iter().next());
            if let Some(l) = lesson {
                form.set("title", l["title"].as_str().unwrap_or(""));
                form.set("summary", l["summary"].as_str().unwrap_or(""));
                form.set("minutes", &l["duration_minutes"].to_string());
                form.set("xp", &l["xp_reward"].to_string());
                if l["is_preview"] == true {
                    form.fields[4].choice = 1;
                }
            }
            if let Some(b) = body {
                form.set("body", b["body"].as_str().unwrap_or(""));
            }
        }
        self.form = Some((FormKind::Lesson { id, module_id }, form));
    }

    fn question_form(&mut self) {
        let letters = ["A", "B", "C", "D", "E"];
        let mut fields = vec![Field::new("statement", "Enunciado", Kind::Multiline).hint("Enter quebra linha")];
        for l in letters {
            fields.push(Field::new(["oa", "ob", "oc", "od", "oe"][letters.iter().position(|x| *x == l).unwrap()], &format!("Alternativa {l}"), Kind::Text));
        }
        fields.push(Field::new("correct", "Correta", Kind::Choice(letters.iter().map(|l| (l.to_string(), l.to_string())).collect())));
        fields.push(Field::new(
            "difficulty",
            "Dificuldade",
            Kind::Choice(vec![("easy".into(), "Fácil · 5 XP".into()), ("medium".into(), "Média · 10 XP".into()), ("hard".into(), "Difícil · 20 XP".into())]),
        ).pick("medium"));
        fields.push(Field::new("explanation", "Explicação", Kind::Multiline).hint("aparece depois que o aluno responde"));
        self.form = Some((FormKind::Question, Form::new("Nova questão", fields).help(&["Deixe vazias as alternativas que não usar (mínimo 2).", "Ctrl+S salva."])));
    }

    // ---------- envio dos formulários ----------

    fn submit_form(&mut self) {
        let Some((kind, form)) = self.form.take() else { return };
        match self.save(&kind, &form) {
            Ok(msg) => {
                self.ok(msg);
            }
            Err(e) => {
                let mut form = form;
                form.error = Some(e.to_string());
                self.form = Some((kind, form));
            }
        }
    }

    fn save(&mut self, kind: &FormKind, f: &Form) -> anyhow::Result<String> {
        use anyhow::bail;
        let required = |k: &str, label: &str| -> anyhow::Result<String> {
            let v = f.get(k);
            if v.is_empty() {
                bail!("Preencha: {label}.");
            }
            Ok(v)
        };
        match kind {
            FormKind::Login => {
                let (email, pw) = (required("email", "e-mail")?, required("password", "senha")?);
                self.api.as_mut().ok_or_else(|| anyhow::anyhow!("Configure o Supabase primeiro."))?.login(&email, &pw)?;
                self.refresh_checks();
                self.go(Screen::Courses);
                self.load_courses();
                Ok(format!("Bem-vindo! Você entrou como {email}."))
            }
            FormKind::Signup => {
                let (name, email, pw) = (required("name", "nome")?, required("email", "e-mail")?, required("password", "senha")?);
                if pw.chars().count() < 8 {
                    bail!("A senha precisa ter pelo menos 8 caracteres.");
                }
                let api = self.api.as_mut().ok_or_else(|| anyhow::anyhow!("Configure o Supabase primeiro."))?;
                let logged = api.signup(&name, &email, &pw)?;
                self.refresh_checks();
                if logged {
                    self.selected = 0;
                    Ok("Conta criada e você já entrou. Que tal importar os cursos ENEM?".into())
                } else {
                    Ok("Conta criada! Confirme o e-mail que o Supabase mandou e depois use “Entrar”.".into())
                }
            }
            FormKind::CloudSupabase => {
                let url = required("url", "Project URL")?;
                let key = required("pub", "Publishable key")?;
                if !url.starts_with("https://") {
                    bail!("A Project URL começa com https://");
                }
                self.write_env(&[
                    ("NEXT_PUBLIC_SUPABASE_URL", url),
                    ("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key),
                    ("NEXT_PUBLIC_SITE_URL", SITE.into()),
                ])?;
                Ok("Supabase na nuvem salvo no .env.local. Agora: “Criar as tabelas na nuvem”.".into())
            }
            FormKind::ProjectRef => {
                let r = required("ref", "Reference ID")?;
                if !r.chars().all(|c| c.is_ascii_alphanumeric()) {
                    bail!("O Reference ID só tem letras e números.");
                }
                let npx = |args: &[&str]| ("npx".to_owned(), [&["--yes", "supabase"][..], args].concat().iter().map(|s| s.to_string()).collect());
                self.job = Some(Job {
                    title: "Criando as tabelas no Supabase na nuvem".into(),
                    steps: vec![npx(&["login"]), npx(&["link", "--project-ref", &r]), npx(&["db", "push"])],
                    after: After::Nothing, env: vec![]
                });
                Ok("Pronto. Se tudo deu certo, as tabelas já estão no seu projeto.".into())
            }
            FormKind::MasterbaseUrl => {
                let url = required("url", "DATABASE_URL")?;
                if !url.starts_with("postgres") {
                    bail!("A conexão começa com postgresql://");
                }
                self.write_env(&[("MASTERBASE_DATABASE_URL", url)])?;
                Ok("Conexão salva. Se o Masterbase estiver ligado, desligue e ligue de novo.".into())
            }
            FormKind::Integration(id) => {
                let integ = integrations::get(*id);
                integ.check(|k| f.get(k)).map_err(anyhow::Error::msg)?;
                let root = self.root.clone().ok_or_else(|| anyhow::anyhow!("Projeto não encontrado. Use Configurar → “Baixar o Curso On”."))?;
                let storage = Storage::from_key(&f.get("__storage"));
                let values: Vec<String> = integ.keys.iter().map(|k| f.get(k.env)).collect();
                let changes: Vec<secrets::Change> =
                    integ.keys.iter().zip(&values).map(|(k, v)| secrets::Change { key: k.env, value: v, secret: k.vis == Vis::Secret }).collect();
                secrets::write(&root, &changes, storage)?;
                self.reload_env();
                let place = if storage == Storage::Keychain && integ.has_secrets() { "no chaveiro do sistema" } else { "no .env.local" };
                Ok(format!("{} salvo {place}. Reinicie a plataforma para o site usar as chaves novas.", integ.name))
            }
            FormKind::NewCourse => {
                let api = self.api.clone().ok_or_else(|| anyhow::anyhow!("Configure o Supabase primeiro."))?;
                let subject = f.get("subject");
                let level: u8 = f.get("level").parse().unwrap_or(1);
                let title = Some(f.get("title")).filter(|t| !t.is_empty()).unwrap_or_else(|| content::title(&subject, level));
                if title.chars().count() < 3 {
                    bail!("O título precisa ter pelo menos 3 letras.");
                }
                let base = slugify(&title);
                let mut slug = base.clone();
                for n in 2..50 {
                    if api.select(&format!("courses?select=id&slug=eq.{slug}"))?.is_empty() {
                        break;
                    }
                    slug = format!("{base}-{n}");
                }
                let course = api.insert_one(
                    "courses",
                    json!({
                        "owner_id": api.user_id()?, "slug": slug, "title": title, "subtitle": f.get("subtitle"),
                        "theme_color": content::color(&subject, level), "icon": content::fallback_icon(&subject),
                        "subject": subject, "level": level, "status": "draft",
                    }),
                )?;
                self.course = Some(course);
                self.go(Screen::Course);
                self.load_course();
                Ok(format!("Curso “{title}” criado como rascunho. Agora crie um módulo (m)."))
            }
            FormKind::Module(id) => {
                let api = self.api.clone().ok_or_else(|| anyhow::anyhow!("sem conexão"))?;
                let title = required("title", "título")?;
                let icon = f.get("icon");
                match id {
                    Some(id) => api.update("modules", &format!("id=eq.{id}"), json!({ "title": title, "icon": icon }))?,
                    None => {
                        let position = self.rows.iter().filter(|r| matches!(r, Row::Module { .. })).count();
                        api.insert_one("modules", json!({ "course_id": self.course_id(), "title": title, "icon": icon, "position": position }))?;
                    }
                }
                self.load_course();
                Ok(format!("Módulo “{title}” salvo. Adicione aulas com a tecla a."))
            }
            FormKind::Lesson { id, module_id } => {
                let api = self.api.clone().ok_or_else(|| anyhow::anyhow!("sem conexão"))?;
                let title = required("title", "título")?;
                let num = |k: &str, max: i64| -> anyhow::Result<i64> {
                    let n: i64 = f.get(k).parse().map_err(|_| anyhow::anyhow!("Use só números em {k}."))?;
                    if !(0..=max).contains(&n) {
                        bail!("{k} vai de 0 a {max}.");
                    }
                    Ok(n)
                };
                let fields = json!({
                    "title": title, "summary": f.get("summary"), "duration_minutes": num("minutes", 600)?,
                    "xp_reward": num("xp", 500)?, "is_preview": f.get("preview") == "true",
                });
                let course_id = self.course_id();
                let lesson_id = match id {
                    Some(id) => {
                        api.update("lessons", &format!("id=eq.{id}"), fields)?;
                        id.clone()
                    }
                    None => {
                        let position = self.rows.iter().filter(|r| matches!(r, Row::Lesson { module_id: m, .. } if m == module_id)).count();
                        let mut row = fields;
                        row["module_id"] = json!(module_id);
                        row["course_id"] = json!(course_id);
                        row["position"] = json!(position);
                        api.insert_one("lessons", row)?["id"].as_str().unwrap_or("").to_owned()
                    }
                };
                api.upsert("lesson_contents", json!({ "lesson_id": lesson_id, "course_id": course_id, "body": f.get("body") }))?;
                self.load_course();
                Ok(format!("Aula “{title}” salva."))
            }
            FormKind::Question => {
                let api = self.api.clone().ok_or_else(|| anyhow::anyhow!("sem conexão"))?;
                let statement = required("statement", "enunciado")?;
                let letters = ["oa", "ob", "oc", "od", "oe"];
                let correct_letter = ["A", "B", "C", "D", "E"].iter().position(|l| *l == f.get("correct")).unwrap_or(0);
                if f.get(letters[correct_letter]).is_empty() {
                    bail!("A alternativa marcada como correta está vazia.");
                }
                let mut options = vec![];
                let mut correct = 0;
                for (i, k) in letters.iter().enumerate() {
                    let v = f.get(k);
                    if v.is_empty() {
                        continue;
                    }
                    if i == correct_letter {
                        correct = options.len();
                    }
                    options.push(v);
                }
                if options.len() < 2 {
                    bail!("Escreva pelo menos 2 alternativas.");
                }
                let module = self.current_module();
                import::add_question(&api, &self.course_id(), module.as_deref(), &statement, &options, correct, &f.get("difficulty"), &f.get("explanation"))?;
                self.load_course();
                Ok("Questão salva no banco de questões.".into())
            }
        }
    }

    // ---------- integrações ----------

    fn integration_form(&mut self, index: usize) {
        let Some(integ) = integrations::ALL.get(index) else { return };
        if integ.keys.is_empty() {
            return self.ok(format!("{}: nada para configurar. O passo a passo está à direita.", integ.name));
        }
        if self.root.is_none() {
            self.go(Screen::Setup);
            return self.err("Não achei a pasta do Curso On. Rode o painel dentro dela ou use “Baixar o Curso On”.");
        }
        let mut unreadable = vec![];
        let mut fields: Vec<Field> = integ
            .keys
            .iter()
            .map(|k| {
                let value = self.secret(k.env).unwrap_or_default();
                if value.is_empty() && self.in_keychain(k.env) {
                    unreadable.push(k.label);
                }
                let kind = if k.vis == Vis::Plain { Kind::Text } else { Kind::Secret };
                let optional = !k.required || integ.any_of;
                let label = if optional && !k.label.contains("opcional") { format!("{} (opcional)", k.label) } else { k.label.to_owned() };
                Field::new(k.env, &label, kind).hint(k.hint).value(value).check(k.validate)
            })
            .collect();
        if integ.has_secrets() {
            let keychain = integ.keys.iter().any(|k| self.in_keychain(k.env));
            fields.push(
                Field::new(
                    "__storage",
                    "Onde guardar os segredos",
                    Kind::Choice(vec![
                        ("env".into(), ".env.local (arquivo local, fora do git)".into()),
                        ("keychain".into(), "Chaveiro do sistema (mais seguro)".into()),
                    ]),
                )
                .pick(if keychain { "keychain" } else { "env" }),
            );
        }
        if integ.testable() {
            fields.push(Field::new("test", "[ Testar conexão ]  Ctrl+T", Kind::Button));
        }
        if integ.id == integrations::Id::Masterbase {
            fields.push(Field::new("open", "[ Abrir a tela do Masterbase ]  Ctrl+O", Kind::Button));
        }
        fields.push(Field::new("save", "[ Salvar ]  Ctrl+S", Kind::Button));
        let mut form = Form::new(&format!("Integração · {}", integ.name), fields).help(integ.tutorial).wide();
        if !unreadable.is_empty() {
            form.error = Some(format!("Não consegui ler do chaveiro: {}. Cole de novo.", unreadable.join(", ")));
        }
        self.form = Some((FormKind::Integration(integ.id), form));
    }

    fn form_button(&mut self, button: &str) {
        let Some((FormKind::Integration(id), form)) = &mut self.form else { return };
        let id = *id;
        match button {
            "save" => self.submit_form(),
            "open" if id == integrations::Id::Masterbase => {
                self.form = None;
                self.go(Screen::Masterbase);
            }
            "test" => {
                let values: HashMap<String, String> = integrations::get(id).keys.iter().map(|k| (k.env.to_owned(), form.get(k.env))).collect();
                form.notice = Some(("Testando a conexão…".into(), false));
                form.error = None;
                self.start_test(id, values);
            }
            _ => {}
        }
    }

    /// Testa com as chaves já salvas (tecla t na lista).
    fn test_saved(&mut self) {
        let Some(integ) = integrations::ALL.get(self.selected) else { return };
        if !integ.keys.iter().any(|k| self.has_key(k.env)) && integ.id != integrations::Id::Masterbase {
            return self.err(format!("{}: nenhuma chave salva ainda. Enter para configurar.", integ.name));
        }
        let values: HashMap<String, String> = integ.keys.iter().map(|k| (k.env.to_owned(), self.secret(k.env).unwrap_or_default())).collect();
        self.ok(format!("Testando {}…", integ.name));
        self.start_test(integ.id, values);
    }

    fn start_test(&mut self, id: integrations::Id, mut values: HashMap<String, String>) {
        if id == integrations::Id::Masterbase && values.values().all(String::is_empty) {
            values.insert("MASTERBASE_DATABASE_URL".into(), project::LOCAL_DB_URL.into());
        }
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let _ = tx.send(integrations::test(id, &values));
        });
        self.test_rx = Some(rx);
    }

    fn write_env(&mut self, pairs: &[(&str, String)]) -> anyhow::Result<()> {
        let root = self.root.clone().ok_or_else(|| anyhow::anyhow!("Projeto não encontrado."))?;
        let mut env = EnvFile::load(&root);
        for (k, v) in pairs {
            env.set(k, v);
        }
        env.save()?;
        self.reload_env();
        Ok(())
    }

    // ---------- comandos externos ----------

    /// Chamado com o painel pausado (terminal normal).
    pub fn run_job(&mut self, job: Job) {
        let cwd = self.root.clone().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
        println!("\n\x1b[1;34m▶ {}\x1b[0m\n", job.title);
        let mut ok = true;
        for (prog, args) in &job.steps {
            let args: Vec<&str> = args.iter().map(String::as_str).collect();
            println!("\x1b[2m$ {prog} {}\x1b[0m", args.join(" "));
            let Some(mut cmd) = sys::command(prog, &args, &cwd) else {
                println!("\x1b[31m`{prog}` não foi encontrado. Veja o guia para iniciantes.\x1b[0m");
                ok = false;
                break;
            };
            cmd.envs(job.env.iter().map(|(k, v)| (k, v)));
            match cmd.status() {
                Ok(s) if s.success() => {}
                Ok(_) if prog == "npm" && args == ["run", "dev"] => {} // Ctrl+C para o site
                Ok(s) => {
                    println!("\x1b[31mO comando terminou com erro ({s}).\x1b[0m");
                    ok = false;
                    break;
                }
                Err(e) => {
                    println!("\x1b[31m{e}\x1b[0m");
                    ok = false;
                    break;
                }
            }
        }
        if ok {
            match job.after {
                After::Nothing => {}
                After::SyncLocalSupabase => match self.sync_local_supabase(&cwd) {
                    Ok(()) => println!("\n\x1b[32m✓ .env.local preenchido com as chaves do Supabase local.\x1b[0m"),
                    Err(e) => {
                        println!("\n\x1b[31m{e}\x1b[0m");
                        ok = false;
                    }
                },
                After::Cloned => {
                    self.root = project::find_root();
                    if let Some(root) = &self.root {
                        let example = root.join(".env.example");
                        let local = root.join(".env.local");
                        if !local.exists() {
                            let _ = std::fs::copy(example, local);
                        }
                    }
                }
            }
        }
        println!("\n\x1b[1mPressione Enter para voltar ao painel.\x1b[0m");
        let _ = std::io::stdin().read_line(&mut String::new());
        self.reload_env();
        if ok {
            self.ok("Pronto!");
        } else {
            self.err("Algo deu errado. Leia a mensagem no terminal e tente de novo.");
        }
    }

    fn sync_local_supabase(&mut self, cwd: &std::path::Path) -> anyhow::Result<()> {
        let out = sys::capture("npx", &["--yes", "supabase", "status", "-o", "env"], cwd)?;
        let vars = project::parse_status_env(&out);
        let get = |names: &[&str]| names.iter().find_map(|n| vars.iter().find(|(k, _)| k == n).map(|(_, v)| v.clone()));
        let url = get(&["API_URL"]).ok_or_else(|| anyhow::anyhow!("Não consegui ler o endereço do Supabase local."))?;
        let key = get(&["PUBLISHABLE_KEY", "ANON_KEY"]).ok_or_else(|| anyhow::anyhow!("Não consegui ler a chave pública."))?;
        let mut pairs = vec![
            ("NEXT_PUBLIC_SUPABASE_URL", url),
            ("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key),
            ("NEXT_PUBLIC_SITE_URL", SITE.into()),
        ];
        if let Some(db) = get(&["DB_URL"]) {
            pairs.push(("CURSO_ON_DATABASE_URL", db));
        }
        // Chave secreta do Supabase local (a mesma de qualquer instalação local):
        // só o webhook da Stripe usa, para liberar o curso depois do pagamento.
        if let Some(secret) = get(&["SECRET_KEY", "SERVICE_ROLE_KEY"]) {
            pairs.push(("SUPABASE_SECRET_KEY", secret));
        }
        self.write_env(&pairs)
    }

    // ---------- a cada quadro ----------

    pub fn tick(&mut self) {
        if let Some(rx) = &self.import_rx {
            while let Ok(p) = rx.try_recv() {
                match p {
                    Progress::Line(l) => self.import_log.push(l),
                    Progress::Done { created, skipped, failed } => {
                        self.import_done = true;
                        let msg = format!("Importação concluída: {created} criados, {skipped} pulados (já existiam), {failed} com erro.");
                        self.status = Some((msg, failed > 0));
                    }
                }
            }
            if self.import_done {
                self.import_rx = None;
            }
        }
        if let Some(rx) = &self.test_rx {
            if let Ok(res) = rx.try_recv() {
                self.test_rx = None;
                let (msg, err) = match res {
                    Ok(m) => (m, false),
                    Err(e) => (e, true),
                };
                match &mut self.form {
                    Some((FormKind::Integration(_), form)) => form.notice = Some((msg, err)),
                    _ => self.status = Some((msg, err)),
                }
            }
        }
        if self.screen == Screen::Masterbase && self.mb.url.is_some() && !self.mb.running() {
            let tail = self.mb.tail(3).join(" · ");
            self.err(format!("O Masterbase parou. {tail}"));
            self.selected = 0;
        }
    }
}

pub fn slugify(s: &str) -> String {
    let mut out = String::new();
    for c in s.to_lowercase().chars() {
        let c = match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            'ñ' => 'n',
            c => c,
        };
        if c.is_ascii_alphanumeric() {
            out.push(c);
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let mut out: String = out.trim_end_matches('-').chars().take(70).collect();
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() { "curso".into() } else { out }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs() {
        assert_eq!(slugify("Matemática 2"), "matematica-2");
        assert_eq!(slugify("  Redação: nota 1000! "), "redacao-nota-1000");
        assert_eq!(slugify("¿?"), "curso");
    }
}
