//! Formulário simples para o terminal: texto, senha, texto longo e escolha.

use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

#[derive(Clone)]
pub enum Kind {
    Text,
    Secret,
    Multiline,
    Number,
    Choice(Vec<(String, String)>), // (valor, rótulo)
}

#[derive(Clone)]
pub struct Field {
    pub key: &'static str,
    pub label: String,
    pub hint: String,
    pub kind: Kind,
    pub value: String,
    pub choice: usize,
}

impl Field {
    pub fn new(key: &'static str, label: &str, kind: Kind) -> Self {
        Self { key, label: label.into(), hint: String::new(), kind, value: String::new(), choice: 0 }
    }
    pub fn hint(mut self, h: &str) -> Self {
        self.hint = h.into();
        self
    }
    pub fn value(mut self, v: impl Into<String>) -> Self {
        self.value = v.into();
        self
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
}

pub struct Form {
    pub title: String,
    pub help: Vec<String>,
    pub fields: Vec<Field>,
    pub focus: usize,
    pub error: Option<String>,
}

impl Form {
    pub fn new(title: &str, fields: Vec<Field>) -> Self {
        Self { title: title.into(), help: vec![], fields, focus: 0, error: None }
    }
    pub fn help(mut self, lines: &[&str]) -> Self {
        self.help = lines.iter().map(|s| s.to_string()).collect();
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
            KeyCode::Tab | KeyCode::Down => self.focus = (self.focus + 1) % n,
            KeyCode::BackTab | KeyCode::Up => self.focus = (self.focus + n - 1) % n,
            KeyCode::Enter => match field.kind {
                Kind::Multiline => field.value.push('\n'),
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
                Kind::Choice(_) => {}
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
            Kind::Choice(_) => {}
            Kind::Multiline => field.value.push_str(&text.replace("\r\n", "\n")),
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
}
