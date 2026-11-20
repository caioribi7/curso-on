# Curso On

Plataforma **open source e 100% gratuita** de cursos preparatórios para o **ENEM**. Sem pagamento, sem assinatura: clone, crie seu curso e compartilhe. Cada matéria tem dois níveis (Matemática 1 e Matemática 2, Física 1 e Física 2…), com aulas curtas, banco de questões e gamificação: XP, níveis, sequência de dias e ranking da turma.

Você não precisa saber programar: o painel **`curso-on`**, feito em Rust, roda no terminal e configura tudo pelo menu, do banco de dados ao seu primeiro curso.

**Stack:** Next.js 16 (App Router, Server Actions), Supabase (Auth + Postgres com RLS), Tailwind CSS v4, Zod, e o painel em Rust (ratatui).

## Comece em 3 passos

1. Instale o [Node.js](https://nodejs.org) (LTS) e o [Git](https://git-scm.com).
2. Baixe o `curso-on` para o seu sistema em [Releases](https://github.com/caioribi7/curso-on/releases), ou instale com Rust:
   ```bash
   cargo install --git https://github.com/caioribi7/curso-on curso-on
   ```
3. Rode `curso-on` e siga o menu: **Configurar → Abrir a plataforma → Criar conta → Importar cursos ENEM**.

Nunca usou nada disso? O [guia para iniciantes](docs/primeiros-passos.md) explica cada passo, inclusive como criar a conta no Supabase. O mesmo guia abre dentro do painel.

## O painel `curso-on`

| Menu | O que faz |
|---|---|
| **Configurar** | Baixa o projeto, liga o Supabase local (Docker) ou guia a criação do Supabase na nuvem, cria as tabelas e instala as dependências. Escreve o `.env.local` por você. |
| **Abrir a plataforma** | Roda o site e abre o navegador em `localhost:3000`. |
| **Criar conta / Entrar** | Conta de professor no seu Supabase. |
| **Meus cursos** | Editor completo: curso (matéria + nível), módulos, aulas em Markdown, questões de múltipla escolha com explicação, publicar e excluir. |
| **Importar cursos ENEM** | Cria 26 cursos prontos (13 matérias × 2 níveis) a partir de [`content/enem.json`](content/enem.json). |
| **Masterbase** | Integração opcional, veja abaixo. |

O painel fala com o Supabase só com a chave pública e o login do professor, então passa pelas mesmas regras de segurança (RLS) do site.

## Integra com Masterbase

O [Masterbase](https://github.com/caioribi7/masterbase) é outro projeto open source do mesmo autor: um Postgres com tela visual, para quem não sabe SQL. No menu **Masterbase** do painel você:

- instala o Masterbase (um comando no Linux/macOS; download no Windows);
- abre o banco do Curso On numa porta livre, com configuração própria em `.masterbase/` (não mexe na sua);
- troca a conexão (`MASTERBASE_DATABASE_URL` no `.env.local`) para usar o banco na nuvem.

Por padrão ele usa o Supabase local (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Atenção: com o usuário `postgres` o Masterbase ignora o RLS. Evite editar XP e matrículas à mão e, em produção, use um usuário com menos permissões.

## Matérias e níveis

As 13 matérias do ENEM, por área, ficam em [`content/subjects.json`](content/subjects.json), a fonte única usada pelo site e pelo painel. Cada matéria tem um ícone flat próprio e uma cor para o nível 1 e outra para o nível 2.

| Área | Matérias |
|---|---|
| Linguagens | Português, Literatura, Redação, Inglês, Espanhol |
| Ciências Humanas | História, Geografia, Filosofia, Sociologia |
| Ciências da Natureza | Biologia, Química, Física |
| Matemática | Matemática |

## Funcionalidades

| Área | O que tem |
|---|---|
| **Auth** | Cadastro, login, Google OAuth, confirmação por e-mail, recuperação e troca de senha, rotas protegidas no `proxy.ts` |
| **Estúdio** (`/studio`) | Criar curso (matéria do ENEM, nível 1 ou 2, título), módulos e aulas com reordenação, editor de aula (texto + vídeo YouTube/Vimeo, prévia grátis, XP), banco de questões com gabarito, publicar/despublicar, lista de alunos |
| **Aluno** (`/app`) | Painel com nível, XP, sequência e meta diária; trilha do curso; aula com "Concluir"; prática de questões com feedback; ranking |
| **Vitrine** (`/cursos`) | Catálogo por área do ENEM, com os níveis 1 e 2 lado a lado, e página do curso com currículo e botão “Começar curso” (matrícula grátis) |

## Segurança

- **RLS em todas as tabelas.** Cursos em rascunho só aparecem para o dono. Conteúdo das aulas (`lesson_contents`) e gabarito (`question_answers`) ficam em tabelas separadas e protegidas.
- **XP, matrículas e progresso** só mudam por funções `SECURITY DEFINER` (`complete_lesson`, `answer_question`, `enroll_free`). O aluno também pode se matricular direto pela API, mas só em nome próprio e em curso publicado. `award_xp` não pode ser chamada pelo cliente, e um *column grant* impede o aluno de editar `xp`/`streak` no próprio perfil.
- **No servidor, a sessão é lida com `getClaims()`** (JWT verificado) e não com `getSession()`.
- **Proteções extras:**
  - todo Server Action revalida o usuário e checa a posse do recurso;
  - os redirects pós-login são sanitizados, o que evita *open redirect*;
  - as mensagens de erro de login são genéricas, para não revelar quais e-mails têm conta.
- **Headers de segurança:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy` (ver `next.config.ts`).
- **Testes de RLS:** `npm run test:db` roda as migrations num Postgres embutido (PGlite) e cobre 29 cenários de permissão.

## Rodando sem o painel (manual)

O painel faz tudo isto por você. Se preferir os comandos:

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

### Opção rápida: Supabase local (Docker)

```bash
npx supabase start        # sobe Postgres + Auth + API e aplica a migration
```

Copie a URL e a chave pública que o comando mostra para `.env.local`. Contas de teste locais: `scripts/test-accounts.md`.

### 1. Supabase (produção)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Copie **Project URL** e **Publishable key** (Project Settings → API) para `.env.local`.
3. Aplique as migrations usando a CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_REF
   npx supabase db push
   ```
   Se preferir, cole os arquivos de `supabase/migrations/` no SQL Editor, em ordem.
4. Em **Authentication → URL Configuration**, configure:
   - **Site URL**: `http://localhost:3000` (em produção, o seu domínio);
   - **Redirect URLs**: `http://localhost:3000/auth/callback` e `https://SEU-DOMINIO/auth/callback`.
5. (Opcional) Para habilitar Google em **Authentication → Providers → Google**, informe o Client ID/Secret do Google Cloud. A *redirect URI* do Google é a callback do Supabase mostrada nessa tela.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda `tsc` |
| `npm run test:db` | Testes de RLS/RPC das migrations (PGlite, sem Docker) |
| `npm run curso-on` | Compila e abre o painel (precisa de Rust) |
| `cargo test --manifest-path cli/Cargo.toml` | Testes do painel |

## Estrutura

```
cli/                   painel `curso-on` em Rust (ratatui)
content/               matérias do ENEM e pacote de cursos (JSON)
docs/                  guias para iniciantes
src/
  app/
    (auth)/            login, cadastro, recuperar/nova senha + server actions
    (platform)/
      app/             área do aluno (painel, curso, aula, questões, perfil)
      studio/          estúdio do criador (cursos, módulos, aulas, questões)
      cursos/          catálogo e página de venda (públicos)
    auth/callback/     troca do código OAuth / confirmação de e-mail
  components/          logo, ícones flat, UI (botões, campos, progresso)
  lib/                 supabase (server/proxy), dal, queries, utils
  proxy.ts             refresh de sessão + proteção de rotas
supabase/
  migrations/          schema, RLS, funções e grants
  tests/               testes de permissão
```

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure as variáveis do `.env.example`, com `NEXT_PUBLIC_SITE_URL` apontando para o domínio final.
3. Atualize as Redirect URLs no Supabase.

## Contribuindo

Contribuições são bem-vindas, principalmente aulas e questões novas para o `content/enem.json`. Veja o [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)
