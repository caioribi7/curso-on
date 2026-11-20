//! Formulário simples para o terminal: texto, senha, texto longo e escolha.

use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

#[derive(Clone)]
pub enum Kind {
    Text,
    Secret,
    Multiline,
    Number,
    Choice(Vec<(String, String)>), // (valor, rótulo)
    /// Botão: Enter devolve `Outcome::Button(key)`.
    Button,
}

/// Confere um valor: `Err` traz o problema, para mostrar ao lado do campo.
pub type Validator = fn(&str) -> Result<(), String>;

#[derive(Clone)]
pub struct Field {
    pub key: &'static str,
    pub label: String,
    pub hint: String,
    pub kind: Kind,
    pub value: String,
    pub choice: usize,
    /// Confere o formato enquanto a pessoa digita.
    pub check: Option<Validator>,
}

impl Field {
    pub fn new(key: &'static str, label: &str, kind: Kind) -> Self {
        Self { key, label: label.into(), hint: String::new(), kind, value: String::new(), choice: 0, check: None }
    }
    pub fn hint(mut self, h: &str) -> Self {
        self.hint = h.into();
        self
    }
    pub fn value(mut self, v: impl Into<String>) -> Self {
        self.value = v.into();
        self
    }
    pub fn check(mut self, f: Validator) -> Self {
        self.check = Some(f);
        self
    }
    /// `None` vazio, `Some(Ok)` formato certo, `Some(Err)` o problema.
    pub fn status(&self) -> Option<Result<(), String>> {
        let v = self.value.trim();
        (!v.is_empty()).then(|| self.check.map_or(Ok(()), |f| f(v)))
    }
    pub fn pick(mut self, value: &str) -> Self {
        if let Kind::Choice(opts) = &self.kind {
            self.choice = opts.iter().position(|(v, _)| v == value).unwrap_or(0);
        }
        self
    }
}

pub enum Outcome {
    None,
    Submit,
    Cancel,
    Button(&'static str),
}

pub struct Form {
    pub title: String,
    pub help: Vec<String>,
    pub fields: Vec<Field>,
    pub focus: usize,
    pub error: Option<String>,
    /// Resultado de uma ação (ex.: "Testar conexão"): (texto, é erro?).
    pub notice: Option<(String, bool)>,
    pub wide: bool,
}

impl Form {
    pub fn new(title: &str, fields: Vec<Field>) -> Self {
        Self { title: title.into(), help: vec![], fields, focus: 0, error: None, notice: None, wide: false }
    }
    pub fn help(mut self, lines: &[&str]) -> Self {
        self.help = lines.iter().map(|s| s.to_string()).collect();
        self
    }

    pub fn wide(mut self) -> Self {
        self.wide = true;
        self
    }

    pub fn get(&self, key: &str) -> String {
        self.fields
            .iter()
            .find(|f| f.key == key)
            .map(|f| match &f.kind {
                Kind::Choice(opts) => opts.get(f.choice).map(|o| o.0.clone()).unwrap_or_default(),
                _ => f.value.trim().to_owned(),
            })
            .unwrap_or_default()
    }

    pub fn set(&mut self, key: &str, value: &str) {
        if let Some(f) = self.fields.iter_mut().find(|f| f.key == key) {
            f.value = value.into();
        }
    }

    pub fn handle(&mut self, key: KeyEvent) -> Outcome {
        let ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
        let n = self.fields.len();
        let field = &mut self.fields[self.focus];
        match key.code {
            KeyCode::Esc => return Outcome::Cancel,
            KeyCode::Char('s') if ctrl => return Outcome::Submit,
            KeyCode::Char('t') if ctrl => return Outcome::Button("test"),
            KeyCode::Char('o') if ctrl => return Outcome::Button("open"),
            KeyCode::Char('u') if ctrl => field.value.clear(),
            KeyCode::Tab | KeyCode::Down => self.focus = (self.focus + 1) % n,
            KeyCode::BackTab | KeyCode::Up => self.focus = (self.focus + n - 1) % n,
            KeyCode::Enter => match field.kind {
                Kind::Multiline => field.value.push('\n'),
                Kind::Button => return Outcome::Button(field.key),
                _ if self.focus + 1 == n => return Outcome::Submit,
                _ => self.focus += 1,
            },
            KeyCode::Left | KeyCode::Right => {
                if let Kind::Choice(opts) = &field.kind {
                    let len = opts.len();
                    field.choice = if key.code == KeyCode::Right { (field.choice + 1) % len } else { (field.choice + len - 1) % len };
                }
            }
            KeyCode::Backspace => {
                field.value.pop();
            }
            KeyCode::Char(c) if !ctrl => match field.kind {
                Kind::Choice(_) | Kind::Button => {}
                Kind::Number if !c.is_ascii_digit() && c != ',' && c != '.' => {}
                _ => field.value.push(c),
            },
            _ => {}
        }
        Outcome::None
    }

    /// Texto colado no terminal chega como um bloco só.
    pub fn paste(&mut self, text: &str) {
        let field = &mut self.fields[self.focus];
        match field.kind {
            Kind::Choice(_) | Kind::Button => {}
            Kind::Multiline => field.value.push_str(&text.replace("\r\n", "\n")),
            // Colar uma chave troca a anterior inteira (não dá para ver o que já tinha).
            Kind::Secret => field.value = text.lines().find(|l| !l.trim().is_empty()).unwrap_or("").trim().to_owned(),
            _ => field.value.push_str(text.lines().next().unwrap_or("").trim()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::crossterm::event::KeyEventKind;

    fn key(code: KeyCode) -> KeyEvent {
        KeyEvent { code, modifiers: KeyModifiers::NONE, kind: KeyEventKind::Press, state: ratatui::crossterm::event::KeyEventState::NONE }
    }

    #[test]
    fn typing_moving_and_choices() {
        let mut f = Form::new(
            "t",
            vec![
                Field::new("a", "A", Kind::Text),
                Field::new("n", "N", Kind::Number),
                Field::new("c", "C", Kind::Choice(vec![("x".into(), "X".into()), ("y".into(), "Y".into())])),
            ],
        );
        f.handle(key(KeyCode::Char('o')));
        f.handle(key(KeyCode::Char('i')));
        f.handle(key(KeyCode::Enter));
        f.handle(key(KeyCode::Char('a'))); // ignorado em número
        f.handle(key(KeyCode::Char('7')));
        f.handle(key(KeyCode::Tab));
        f.handle(key(KeyCode::Right));
        assert_eq!(f.get("a"), "oi");
        assert_eq!(f.get("n"), "7");
        assert_eq!(f.get("c"), "y");
        assert!(matches!(f.handle(key(KeyCode::Enter)), Outcome::Submit));
    }

    #[test]
    fn secrets_buttons_and_live_check() {
        fn starts_sk(v: &str) -> Result<(), String> {
            if v.starts_with("sk_") { Ok(()) } else { Err("sk_".into()) }
        }
        let mut f = Form::new("t", vec![Field::new("k", "K", Kind::Secret).check(starts_sk).value("velha"), Field::new("test", "Testar", Kind::Button)]);
        assert!(matches!(f.fields[0].status(), Some(Err(_))));
        f.paste("\n  sk_nova  \nlixo");
        assert_eq!(f.get("k"), "sk_nova");
        assert!(matches!(f.fields[0].status(), Some(Ok(()))));
        f.handle(KeyEvent::new(KeyCode::Char('u'), KeyModifiers::CONTROL));
        assert!(f.fields[0].status().is_none());
        assert!(matches!(f.handle(KeyEvent::new(KeyCode::Char('t'), KeyModifiers::CONTROL)), Outcome::Button("test")));
        f.handle(key(KeyCode::Tab));
        f.handle(key(KeyCode::Char('x')));
        assert!(matches!(f.handle(key(KeyCode::Enter)), Outcome::Button("test")));
    }
}
