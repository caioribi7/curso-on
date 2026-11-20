//! `curso-on`: painel no terminal que configura o Curso On e cria cursos.

mod api;
mod app;
mod content;
mod form;
mod import;
mod integrations;
mod masterbase;
mod project;
mod secrets;
mod sys;
mod ui;

use ratatui::crossterm::event::{self, DisableBracketedPaste, EnableBracketedPaste, Event, KeyEventKind};
use ratatui::crossterm::execute;
use std::io::stdout;
use std::time::Duration;

fn main() -> anyhow::Result<()> {
    if let Some(arg) = std::env::args().nth(1) {
        match arg.as_str() {
            "--version" | "-V" => println!("curso-on {}", env!("CARGO_PKG_VERSION")),
            _ => println!("Uso: curso-on\n\nAbre o painel interativo. Rode dentro da pasta do projeto Curso On\n(ou defina CURSO_ON_DIR). Tudo é feito pelo menu."),
        }
        return Ok(());
    }

    // Ctrl+C durante `npm run dev` deve parar só o site, não o painel.
    let _ = ctrlc::set_handler(|| {});

    let mut app = app::App::new();
    let mut terminal = start()?;
    let result = (|| -> anyhow::Result<()> {
        while !app.quit {
            terminal.draw(|f| ui::draw(f, &mut app))?;
            if let Some(job) = app.job.take() {
                stop();
                app.run_job(job);
                terminal = start()?;
                continue;
            }
            if event::poll(Duration::from_millis(150))? {
                match event::read()? {
                    Event::Key(k) if k.kind == KeyEventKind::Press => app.on_key(k),
                    Event::Paste(text) => app.on_paste(&text),
                    _ => {}
                }
            }
            app.tick();
        }
        Ok(())
    })();
    stop();
    result
}

fn start() -> anyhow::Result<ratatui::DefaultTerminal> {
    let terminal = ratatui::init();
    let _ = execute!(stdout(), EnableBracketedPaste);
    Ok(terminal)
}

fn stop() {
    let _ = execute!(stdout(), DisableBracketedPaste);
    ratatui::restore();
}
