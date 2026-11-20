//! Desenho das telas.

use crate::app::{App, Row, Screen};
use crate::content::{self, rgb};
use crate::form::{Form, Kind};
use crate::integrations::{self, Vis};
use crate::masterbase::{self, Masterbase};
use crate::project;
use ratatui::layout::{Alignment, Constraint, Layout, Margin, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{Block, BorderType, Clear, Gauge, List, ListItem, ListState, Paragraph, Wrap};
use ratatui::Frame;

const GUIDE: &str = include_str!("../../docs/primeiros-passos.md");

const BRAND: Color = Color::Rgb(59, 91, 253);
const SUN: Color = Color::Rgb(255, 200, 61);
const MINT: Color = Color::Rgb(29, 178, 122);
const CORAL: Color = Color::Rgb(255, 107, 74);
const MUTED: Color = Color::Rgb(138, 143, 156);

// Letras de 4 colunas × 5 linhas para o logo.
fn glyph(c: char) -> [&'static str; 5] {
    match c {
        'C' => [" ███", "█   ", "█   ", "█   ", " ███"],
        'U' => ["█  █", "█  █", "█  █", "█  █", " ██ "],
        'R' => ["███ ", "█  █", "███ ", "█ █ ", "█  █"],
        'S' => [" ███", "█   ", " ██ ", "   █", "███ "],
        'O' => [" ██ ", "█  █", "█  █", "█  █", " ██ "],
        'N' => ["█  █", "██ █", "█ ██", "█  █", "█  █"],
        _ => ["    "; 5],
    }
}

fn logo() -> Text<'static> {
    let mut lines = vec![];
    for row in 0..5 {
        let mut spans = vec![];
        for c in "CURSO".chars() {
            spans.push(Span::styled(format!("{} ", glyph(c)[row]), Style::new().fg(Color::White).bold()));
        }
        spans.push(Span::raw("  "));
        for c in "ON".chars() {
            spans.push(Span::styled(format!("{} ", glyph(c)[row]), Style::new().fg(BRAND).bold()));
        }
        // Os quatro sinais da matemática, em blocos coloridos, ao lado do logo.
        let tiles = [("+", BRAND), ("−", CORAL), ("×", MINT), ("÷", SUN)];
        if row == 1 || row == 3 {
            spans.push(Span::raw("   "));
            for (s, color) in if row == 1 { &tiles[..2] } else { &tiles[2..] } {
                spans.push(Span::styled(format!(" {s} "), Style::new().bg(*color).fg(Color::White).bold()));
                spans.push(Span::raw(" "));
            }
        }
        lines.push(Line::from(spans));
    }
    Text::from(lines)
}

pub fn draw(f: &mut Frame, app: &mut App) {
    let [header, body, status, footer] =
        Layout::vertical([Constraint::Length(8), Constraint::Min(8), Constraint::Length(1), Constraint::Length(1)]).areas(f.area());

    let head_block = Block::new().padding(ratatui::widgets::Padding::new(2, 2, 1, 0));
    let inner = head_block.inner(header);
    f.render_widget(head_block, header);
    let [logo_area, tag] = Layout::vertical([Constraint::Length(5), Constraint::Length(1)]).areas(inner);
    f.render_widget(Paragraph::new(logo()), logo_area);
    f.render_widget(
        Line::from(vec![
            Span::styled("Preparatório ENEM", Style::new().fg(SUN).bold()),
            Span::styled("  ·  open source  ·  ", Style::new().fg(MUTED)),
            Span::styled(screen_name(app.screen), Style::new().fg(Color::White)),
        ]),
        tag,
    );

    match app.screen {
        Screen::Home | Screen::Setup | Screen::Masterbase => menu(f, app, body),
        Screen::Courses => courses(f, app, body),
        Screen::Course => course(f, app, body),
        Screen::Import => import(f, app, body),
        Screen::Guide => guide(f, app, body),
        Screen::Integrations => integrations_screen(f, app, body),
    }

    if let Some((msg, err)) = &app.status {
        let style = if *err { Style::new().fg(CORAL).bold() } else { Style::new().fg(MINT).bold() };
        f.render_widget(Paragraph::new(format!("  {} {msg}", if *err { "✗" } else { "✓" })).style(style), status);
    }
    f.render_widget(Paragraph::new(hints(app)).style(Style::new().fg(MUTED)), footer);

    if let Some((_, form)) = &app.form {
        draw_form(f, form);
    }
    if let Some((msg, _)) = &app.confirm {
        let area = centered(f.area(), 60, 7);
        f.render_widget(Clear, area);
        let block = Block::bordered().border_type(BorderType::Rounded).border_style(Style::new().fg(SUN)).title(" Confirmar ");
        let text = Text::from(vec![Line::from(""), Line::from(msg.as_str()).bold(), Line::from(""), Line::from("Enter/s = sim   ·   Esc/n = não").fg(MUTED)]);
        f.render_widget(Paragraph::new(text).block(block).alignment(Alignment::Center).wrap(Wrap { trim: true }), area);
    }
}

fn screen_name(s: Screen) -> &'static str {
    match s {
        Screen::Home => "Início",
        Screen::Setup => "Configuração",
        Screen::Courses => "Meus cursos",
        Screen::Course => "Editor do curso",
        Screen::Import => "Importar cursos ENEM",
        Screen::Masterbase => "Masterbase",
        Screen::Integrations => "Integrações",
        Screen::Guide => "Guia para iniciantes",
    }
}

fn hints(app: &App) -> String {
    if let Some((kind, _)) = &app.form {
        if matches!(kind, crate::app::FormKind::Integration(_)) {
            return "  Tab/↑↓ campos · Ctrl+V cola (substitui) · Ctrl+U apaga · Ctrl+T testa · Ctrl+S salva · Esc cancela".into();
        }
        return "  Tab/↑↓ campos · ← → escolhe · Enter próximo · Ctrl+S salva · Esc cancela".into();
    }
    match app.screen {
        Screen::Home => "  ↑↓ escolhe · Enter abre · q sai",
        Screen::Setup | Screen::Masterbase => "  ↑↓ escolhe · Enter abre · Esc volta",
        Screen::Integrations => "  ↑↓ escolhe · Enter configura · t testa as chaves salvas · Esc volta",
        Screen::Courses => "  Enter abre · n novo curso · p publica · v vê no site · x exclui · r atualiza · Esc volta",
        Screen::Course => "  m módulo · a aula · q questão · Enter edita · x exclui · p publica · v vê no site · Esc volta",
        Screen::Import => "  v abre o catálogo · Enter/Esc volta",
        Screen::Guide => "  ↑↓ PgUp PgDn rola · Esc volta",
    }
    .into()
}

fn panel(title: &str) -> Block<'_> {
    Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::new().fg(Color::Rgb(70, 74, 88)))
        .title(Span::styled(format!(" {title} "), Style::new().fg(Color::White).bold()))
}

fn menu(f: &mut Frame, app: &mut App, area: Rect) {
    let items = app.items();
    let [left, right] = Layout::horizontal([Constraint::Percentage(45), Constraint::Percentage(55)]).areas(area.inner(Margin::new(1, 0)));
    let list: Vec<ListItem> = items
        .iter()
        .map(|it| {
            ListItem::new(Line::from(vec![Span::raw("  "), Span::raw(it.label.clone())]))
        })
        .collect();
    let mut state = ListState::default().with_selected(Some(app.selected.min(items.len().saturating_sub(1))));
    let title = match app.screen {
        Screen::Setup => "Configurar",
        Screen::Masterbase => "Masterbase",
        _ => "O que você quer fazer?",
    };
    f.render_stateful_widget(
        List::new(list)
            .block(panel(title))
            .highlight_style(Style::new().bg(BRAND).fg(Color::White).bold())
            .highlight_symbol("▶"),
        left,
        &mut state,
    );

    let desc = items.get(app.selected).map(|i| i.desc.clone()).unwrap_or_default();
    let mut lines = vec![Line::from(desc).fg(Color::White), Line::from("")];
    match app.screen {
        Screen::Masterbase => lines.extend(masterbase_info(app)),
        _ => {
            lines.push(Line::from("Situação").bold().fg(SUN));
            for c in &app.checks {
                let (mark, color) = match c.ok {
                    Some(true) => ("✓", MINT),
                    Some(false) => ("✗", CORAL),
                    None => ("○", MUTED),
                };
                lines.push(Line::from(vec![
                    Span::styled(format!(" {mark} "), Style::new().fg(color).bold()),
                    Span::styled(format!("{:<10}", c.label), Style::new().bold()),
                    Span::styled(c.detail.clone(), Style::new().fg(MUTED)),
                ]));
            }
        }
    }
    f.render_widget(Paragraph::new(lines).block(panel("Detalhes")).wrap(Wrap { trim: false }), right);
}

fn masterbase_info(app: &mut App) -> Vec<Line<'static>> {
    let bin = Masterbase::binary();
    let db = project::mask_db_url(&app.mb_database_url());
    let running = app.mb.running();
    let mut v = vec![
        Line::from("Masterbase é outro projeto open source do Caio: um Postgres com tela visual, para quem não sabe SQL.").fg(MUTED),
        Line::from(""),
        Line::from(vec![
            Span::styled(" Instalado  ", Style::new().bold()),
            match &bin {
                Some(p) => Span::styled(p.display().to_string(), Style::new().fg(MINT)),
                None => Span::styled("não", Style::new().fg(CORAL)),
            },
        ]),
        Line::from(vec![
            Span::styled(" Ligado     ", Style::new().bold()),
            match &app.mb.url {
                Some(u) if running => Span::styled(u.clone(), Style::new().fg(MINT)),
                _ => Span::styled("não", Style::new().fg(MUTED)),
            },
        ]),
        Line::from(vec![Span::styled(" Banco      ", Style::new().bold()), Span::styled(db, Style::new().fg(MUTED))]),
        Line::from(""),
        Line::from("⚠ Atenção").fg(SUN).bold(),
        Line::from("Com o usuário postgres, o Masterbase vê e edita tudo, sem as regras de segurança (RLS) do site. Mudar XP, matrículas ou pagamentos à mão pode deixar dados inconsistentes. Em produção, use um usuário com menos permissões.").fg(MUTED),
    ];
    if bin.is_none() {
        v.push(Line::from(""));
        v.push(Line::from("Como instalar").fg(SUN).bold());
        v.push(Line::from(format!("Linux/macOS: {}", masterbase::INSTALL_SH)).fg(Color::White));
        v.push(Line::from(format!("Windows: baixe em {}/releases", masterbase::REPO)).fg(Color::White));
    }
    v
}

fn integrations_screen(f: &mut Frame, app: &mut App, area: Rect) {
    let [left, right] = Layout::horizontal([Constraint::Percentage(38), Constraint::Percentage(62)]).areas(area.inner(Margin::new(1, 0)));
    // Largura útil de uma linha: tira as bordas (2), a seta de seleção (1) e a marca " ✓ " (3).
    let row = usize::from(left.width).saturating_sub(6);
    let list: Vec<ListItem> = integrations::ALL
        .iter()
        .map(|i| {
            let any = i.keys.iter().any(|k| app.has_key(k.env));
            let (mark, color, word) = if i.keys.is_empty() {
                ("○", MUTED, "sem chave")
            } else if any && i.configured(|k| app.has_key(k)) {
                ("✓", MINT, "pronta")
            } else if any {
                ("!", SUN, "incompleta")
            } else if i.required {
                ("✗", CORAL, "obrigatória")
            } else {
                ("○", MUTED, "opcional")
            };
            // Status sempre inteiro, encostado à direita; o nome é que encurta se faltar espaço.
            let name_w = row.saturating_sub(word.chars().count() + 1);
            let name: String = if i.name.chars().count() > name_w {
                i.name.chars().take(name_w.saturating_sub(1)).chain(std::iter::once('…')).collect()
            } else {
                i.name.to_owned()
            };
            ListItem::new(Line::from(vec![
                Span::styled(format!(" {mark} "), Style::new().fg(color).bold()),
                Span::raw(format!("{name:<name_w$} ")),
                Span::styled(word, Style::new().fg(color)),
            ]))
        })
        .collect();
    let selected = app.selected.min(integrations::ALL.len() - 1);
    let mut state = ListState::default().with_selected(Some(selected));
    f.render_stateful_widget(
        List::new(list).block(panel("Integrações")).highlight_style(Style::new().bg(BRAND).fg(Color::White).bold()).highlight_symbol("▶"),
        left,
        &mut state,
    );

    let integ = &integrations::ALL[selected];
    let mut lines = vec![Line::from(integ.summary).fg(Color::White), Line::from("")];
    if !integ.keys.is_empty() {
        lines.push(Line::from("Chaves").bold().fg(SUN));
        for k in integ.keys {
            let (state, color) = if app.in_keychain(k.env) {
                ("no chaveiro do sistema".to_owned(), MINT)
            } else if app.has_key(k.env) {
                // Só mostra o valor das chaves que são públicas por natureza.
                let v = app.env.as_ref().and_then(|e| e.real(k.env)).unwrap_or_default();
                if k.vis == Vis::Plain { (v, MINT) } else { (format!("{} no .env.local", integrations::mask(&v)), MINT) }
            } else {
                ((if integ.required && k.required { "falta" } else { "vazia" }).to_owned(), MUTED)
            };
            lines.push(Line::from(vec![
                // Espaço no fim: nomes longos (NEXT_PUBLIC_…) não grudam no valor.
                Span::styled(format!(" {:<24} ", k.env), Style::new().bold()),
                Span::styled(state, Style::new().fg(color)),
            ]));
        }
        lines.push(Line::from(""));
    }
    lines.push(Line::from("Como conseguir").bold().fg(SUN));
    for t in integ.tutorial {
        lines.push(Line::from(*t).fg(Color::Rgb(220, 222, 228)));
    }
    if integ.has_secrets() {
        lines.push(Line::from(""));
        lines.push(Line::from("Os segredos ficam no .env.local (fora do git) ou no chaveiro do sistema. Nunca aparecem na tela.").fg(MUTED));
    }
    f.render_widget(Paragraph::new(lines).block(panel(integ.name)).wrap(Wrap { trim: false }), right);
}

fn courses(f: &mut Frame, app: &App, area: Rect) {
    let area = area.inner(Margin::new(1, 0));
    if app.courses.is_empty() {
        let text = Text::from(vec![
            Line::from(""),
            Line::from("Você ainda não tem cursos.").bold(),
            Line::from(""),
            Line::from("Aperte n para criar o primeiro, ou volte ao início e escolha “Importar cursos ENEM”.").fg(MUTED),
        ]);
        f.render_widget(Paragraph::new(text).alignment(Alignment::Center).block(panel("Meus cursos")), area);
        return;
    }
    let list: Vec<ListItem> = app
        .courses
        .iter()
        .map(|c| {
            let subject = c["subject"].as_str().unwrap_or("");
            let level = c["level"].as_u64().unwrap_or(1) as u8;
            let color = if subject.is_empty() { BRAND } else { rgb(&content::color(subject, level)) };
            let published = c["status"] == "published";
            ListItem::new(Line::from(vec![
                Span::styled(if subject.is_empty() { "  ●  ".into() } else { format!(" {level}  ") }, Style::new().bg(color).fg(Color::White).bold()),
                Span::raw("  "),
                Span::styled(format!("{:<34}", c["title"].as_str().unwrap_or("")), Style::new().bold()),
                Span::styled(
                    if published { " Publicado " } else { " Rascunho  " },
                    Style::new().fg(if published { MINT } else { SUN }),
                ),
            ]))
        })
        .collect();
    let mut state = ListState::default().with_selected(Some(app.selected));
    f.render_stateful_widget(
        List::new(list).block(panel(&format!("Meus cursos ({})", app.courses.len()))).highlight_style(Style::new().bg(Color::Rgb(40, 44, 58))).highlight_symbol("▶ "),
        area,
        &mut state,
    );
}

fn course(f: &mut Frame, app: &App, area: Rect) {
    let area = area.inner(Margin::new(1, 0));
    let Some(c) = &app.course else { return };
    let subject = c["subject"].as_str().unwrap_or("");
    let level = c["level"].as_u64().unwrap_or(1) as u8;
    let color = if subject.is_empty() { BRAND } else { rgb(&content::color(subject, level)) };
    let published = c["status"] == "published";
    let title = format!(
        "{} · {}",
        c["title"].as_str().unwrap_or(""),
        if published { "publicado" } else { "rascunho" }
    );
    let list: Vec<ListItem> = app
        .rows
        .iter()
        .map(|r| match r {
            Row::Module { title, icon, lessons, .. } => ListItem::new(Line::from(vec![
                Span::styled(" ▣ ", Style::new().bg(color).fg(Color::White).bold()),
                Span::styled(format!(" {title}"), Style::new().bold()),
                Span::styled(format!("   {lessons} aulas · ícone {icon}"), Style::new().fg(MUTED)),
            ])),
            Row::Lesson { title, minutes, xp, .. } => ListItem::new(Line::from(vec![
                Span::styled("    ├ ", Style::new().fg(MUTED)),
                Span::raw(title.clone()),
                Span::styled(format!("   {minutes} min · +{xp} XP"), Style::new().fg(MUTED)),
            ])),
            Row::QuestionsHeader(n) => ListItem::new(Line::from(vec![
                Span::styled(" ? ", Style::new().bg(SUN).fg(Color::Black).bold()),
                Span::styled(format!(" Banco de questões ({n})"), Style::new().bold()),
                Span::styled("   Enter ou q adiciona", Style::new().fg(MUTED)),
            ])),
            Row::Question { statement, difficulty, .. } => {
                let short: String = statement.chars().take(70).collect();
                let (d, dc) = match difficulty.as_str() {
                    "easy" => ("fácil", MINT),
                    "hard" => ("difícil", CORAL),
                    _ => ("média", SUN),
                };
                ListItem::new(Line::from(vec![
                    Span::styled("    • ", Style::new().fg(MUTED)),
                    Span::raw(short),
                    Span::styled(format!("   {d}"), Style::new().fg(dc)),
                ]))
            }
        })
        .collect();
    let mut state = ListState::default().with_selected(Some(app.selected));
    let block = panel(&title).border_style(Style::new().fg(color));
    f.render_stateful_widget(List::new(list).block(block).highlight_style(Style::new().bg(Color::Rgb(40, 44, 58)).add_modifier(Modifier::BOLD)), area, &mut state);
}

fn import(f: &mut Frame, app: &App, area: Rect) {
    let area = area.inner(Margin::new(1, 0));
    let [gauge, log] = Layout::vertical([Constraint::Length(3), Constraint::Min(3)]).areas(area);
    let done = app.import_log.len();
    let ratio = if app.import_total == 0 { 1.0 } else { (done as f64 / app.import_total as f64).min(1.0) };
    f.render_widget(
        Gauge::default()
            .block(panel(if app.import_done { "Importação concluída" } else { "Importando…" }))
            .gauge_style(Style::new().fg(MINT).bg(Color::Rgb(40, 44, 58)))
            .ratio(ratio)
            .label(format!("{done}/{}", app.import_total)),
        gauge,
    );
    let height = log.height.saturating_sub(2) as usize;
    let start = app.import_log.len().saturating_sub(height);
    let lines: Vec<Line> = app.import_log[start..]
        .iter()
        .map(|l| {
            let color = if l.starts_with('✓') { MINT } else if l.starts_with('✗') { CORAL } else { MUTED };
            Line::from(l.clone()).fg(color)
        })
        .collect();
    f.render_widget(Paragraph::new(lines).block(panel("Cursos")), log);
}

fn guide(f: &mut Frame, app: &App, area: Rect) {
    let area = area.inner(Margin::new(1, 0));
    let lines: Vec<Line> = GUIDE
        .lines()
        .map(|l| {
            if let Some(h) = l.strip_prefix("# ") {
                Line::from(h.to_owned()).fg(SUN).bold()
            } else if let Some(h) = l.strip_prefix("## ") {
                Line::from(format!("▌{h}")).fg(BRAND).bold()
            } else if let Some(h) = l.strip_prefix("### ") {
                Line::from(h.to_owned()).bold()
            } else if l.starts_with("```") {
                Line::from("")
            } else {
                Line::from(l.replace("**", "").replace('`', "")).fg(Color::Rgb(220, 222, 228))
            }
        })
        .collect();
    f.render_widget(Paragraph::new(lines).block(panel("Guia para iniciantes")).wrap(Wrap { trim: false }).scroll((app.scroll, 0)), area);
}

fn draw_form(f: &mut Frame, form: &Form) {
    let multiline = form.fields.iter().any(|x| matches!(x.kind, Kind::Multiline));
    let help_h = if form.help.is_empty() { 0 } else { form.help.len() as u16 + 1 };
    let fields_h: u16 = form.fields.iter().map(|x| match x.kind {
        Kind::Multiline => 6,
        Kind::Button => 1,
        _ => 2,
    }).sum();
    let extra = u16::from(form.error.is_some()) + u16::from(form.notice.is_some());
    let height = (fields_h + help_h + 4 + extra).min(f.area().height.saturating_sub(2));
    let area = centered(f.area(), if multiline || form.wide { 96 } else { 76 }, height);
    f.render_widget(Clear, area);
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::new().fg(BRAND))
        .title(Span::styled(format!(" {} ", form.title), Style::new().fg(Color::White).bold()))
        .title_bottom(Line::from(" Ctrl+S salva · Esc cancela ").right_aligned().fg(MUTED));
    let inner = block.inner(area).inner(Margin::new(1, 0));
    f.render_widget(block, area);

    let mut lines: Vec<Line> = form.help.iter().map(|h| Line::from(h.clone()).fg(MUTED)).collect();
    if !lines.is_empty() {
        lines.push(Line::from(""));
    }
    let mut cursor_line = 0usize;
    for (i, field) in form.fields.iter().enumerate() {
        let focused = i == form.focus;
        if matches!(field.kind, Kind::Button) {
            let style = if focused { Style::new().bg(BRAND).fg(Color::White).bold() } else { Style::new().fg(BRAND).bold() };
            lines.push(Line::from(vec![Span::raw(if focused { "▶ " } else { "  " }), Span::styled(format!(" {} ", field.label), style)]));
            if focused {
                cursor_line = lines.len();
            }
            continue;
        }
        let label_style = if focused { Style::new().fg(SUN).bold() } else { Style::new().bold() };
        let mut label = vec![Span::styled(format!("{} ", field.label), label_style)];
        match field.status() {
            Some(Ok(())) if field.check.is_some() => label.push(Span::styled(" ✓ formato ok", Style::new().fg(MINT))),
            Some(Err(e)) => label.push(Span::styled(format!(" ✗ {e}"), Style::new().fg(CORAL))),
            _ if !field.hint.is_empty() => label.push(Span::styled(format!(" {}", field.hint), Style::new().fg(MUTED))),
            _ => {}
        }
        lines.push(Line::from(label));
        if focused {
            cursor_line = lines.len();
        }
        let caret = if focused { "▏" } else { "" };
        let value_style = if focused { Style::new().fg(Color::White).bg(Color::Rgb(36, 40, 54)) } else { Style::new().fg(Color::Rgb(200, 202, 210)) };
        match &field.kind {
            Kind::Choice(opts) => {
                let label = opts.get(field.choice).map(|o| o.1.as_str()).unwrap_or("");
                lines.push(Line::from(vec![
                    Span::styled(if focused { " ◀ " } else { "   " }, Style::new().fg(SUN)),
                    Span::styled(format!(" {label} "), value_style.bold()),
                    Span::styled(if focused { " ▶" } else { "" }, Style::new().fg(SUN)),
                ]));
            }
            Kind::Secret => {
                // Nunca mostra o valor, nem o tamanho dele.
                let shown = integrations::mask(&field.value);
                let empty = if field.value.is_empty() && focused { "cole aqui (Ctrl+V)" } else { "" };
                lines.push(Line::from(vec![Span::styled(format!(" {shown}{caret} "), value_style), Span::styled(empty, Style::new().fg(MUTED))]));
            }
            Kind::Button => {}
            Kind::Multiline => {
                let all: Vec<&str> = field.value.split('\n').collect();
                let start = all.len().saturating_sub(5);
                for (j, l) in all[start..].iter().enumerate() {
                    let last = start + j + 1 == all.len();
                    lines.push(Line::from(Span::styled(format!(" {l}{} ", if last { caret } else { "" }), value_style)));
                }
                for _ in all.len() - start..5 {
                    lines.push(Line::from(""));
                }
            }
            _ => lines.push(Line::from(Span::styled(format!(" {}{caret} ", field.value), value_style))),
        }
    }
    if let Some((msg, err)) = &form.notice {
        lines.push(Line::from(format!("{} {msg}", if *err { "✗" } else { "✓" })).fg(if *err { CORAL } else { MINT }).bold());
    }
    if let Some(e) = &form.error {
        lines.push(Line::from(format!("✗ {e}")).fg(CORAL).bold());
    }
    // Rola para manter o campo atual visível em telas pequenas.
    // Rola só quando o campo atual (rótulo + até 6 linhas de valor) não cabe.
    let visible = inner.height as usize;
    let scroll = if lines.len() <= visible { 0 } else { (cursor_line + 6).saturating_sub(visible).min(lines.len() - visible) as u16 };
    f.render_widget(Paragraph::new(lines).scroll((scroll, 0)), inner);
}

fn centered(area: Rect, width: u16, height: u16) -> Rect {
    let w = width.min(area.width.saturating_sub(2));
    let h = height.min(area.height);
    Rect { x: area.x + (area.width - w) / 2, y: area.y + (area.height - h) / 2, width: w, height: h }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::{App, Screen};
    use ratatui::backend::TestBackend;
    use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
    use ratatui::Terminal;

    fn render(app: &mut App, w: u16, h: u16) -> String {
        let mut t = Terminal::new(TestBackend::new(w, h)).unwrap();
        t.draw(|f| draw(f, app)).unwrap();
        let buf = t.backend().buffer().clone();
        buf.content().iter().map(|c| c.symbol()).collect()
    }

    #[test]
    fn every_screen_renders_at_any_size() {
        let mut app = App::new();
        for screen in [Screen::Home, Screen::Setup, Screen::Masterbase, Screen::Guide, Screen::Courses, Screen::Import, Screen::Integrations] {
            app.screen = screen;
            for (w, h) in [(120, 40), (80, 24), (40, 12), (10, 5)] {
                render(&mut app, w, h);
            }
        }
        app.screen = Screen::Home;
        assert!(render(&mut app, 120, 40).contains("Configurar o Curso On"));
    }

    #[test]
    fn integration_form_never_shows_a_secret() {
        let mut app = App::new();
        app.screen = Screen::Integrations;
        app.selected = integrations::ALL.iter().position(|i| i.id == integrations::Id::Stripe).unwrap();
        assert!(render(&mut app, 120, 40).contains("dashboard.stripe.com"));
        app.on_key(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));
        if app.root.is_none() {
            return;
        }
        let secret = "sk_test_51NAOPODEAPARECERNATELA0123456789abcdef";
        app.on_paste(secret);
        let screen = render(&mut app, 120, 40);
        assert!(screen.contains("Testar conexão"));
        assert!(screen.contains("formato ok"));
        assert!(!screen.contains("NAOPODE"));
        app.on_paste("pk_test_errado");
        assert!(render(&mut app, 120, 40).contains("publicável"));
        app.on_key(KeyEvent::new(KeyCode::Tab, KeyModifiers::NONE));
        app.on_paste("whsec_curta");
        assert!(render(&mut app, 120, 40).contains("cortada"));
        app.on_key(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE));
        assert!(app.form.is_none());
    }

    #[test]
    fn forms_render() {
        let mut app = App::new();
        app.screen = Screen::Setup;
        app.selected = app.items().iter().position(|i| i.label.contains("nuvem")).unwrap();
        app.on_key(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE));
        if app.root.is_some() {
            assert!(app.form.is_some());
            assert!(render(&mut app, 100, 30).contains("supabase.com"));
            render(&mut app, 30, 10);
        }
    }
}
