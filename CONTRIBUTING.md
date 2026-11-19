# Como contribuir

Obrigado por ajudar o Curso On! Dá para contribuir mesmo sem programar.

## Conteúdo (sem programar)

O pacote de cursos fica em [`content/enem.json`](content/enem.json). Cada curso tem `subject` (a matéria), `level` (1 ou 2), módulos com aulas e uma lista de questões.

- Aulas: `title`, `summary` (uma linha), `minutes`, `xp` e `body` em Markdown. Prefira aulas curtas, de 5 a 12 minutos.
- Questões: `statement`, `options` (2 a 5), `correct` (posição da certa, começando em 0), `difficulty` (`easy`, `medium` ou `hard`) e `explanation`.
- Ícones de módulo aceitos: `blocks`, `pie`, `percent`, `scale`, `shapes`, `graph`, `book`, `bulb`, `flask`, `globe`, `target`, `trophy`.
- Escreva com suas palavras. Não copie questões de provas, apostilas ou sites sem licença compatível com MIT.

Rode `cargo test --manifest-path cli/Cargo.toml`: os testes conferem se o JSON respeita os limites do banco.

## Código

1. Faça um fork e crie um branch.
2. Site: `npm install`, `npm run dev`. Antes de abrir o PR: `npm run lint`, `npm run typecheck` e `npm run test:db`.
3. Painel: `cd cli && cargo run`. Antes do PR: `cargo test` e `cargo fmt`.
4. Mudou o banco? Crie uma migration nova em `supabase/migrations/` (nunca edite uma antiga) e adicione casos em `supabase/tests/rls.test.mjs`.
5. Abra o PR explicando o que muda e como testar.

## Regras de segurança

- Nunca commite `.env.local` nem chaves (`sb_secret_…`, `sk_live_…`, `whsec_…`).
- Toda tabela nova precisa de RLS. XP, matrículas e progresso só mudam por funções `SECURITY DEFINER`.
- Achou uma falha? Não abra issue pública: escreva para o mantenedor pelo GitHub.

## Integrações

O Curso On integra com outros projetos open source do autor, como o [Masterbase](https://github.com/caioribi7/masterbase). Integrações são sempre opcionais: o Curso On precisa funcionar sozinho.
