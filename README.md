# Curso On

Plataforma para **criar, organizar e vender cursos**, com aulas, banco de questões e gamificação (XP, níveis, sequência de dias e ranking da turma). O visual é flat e amigável, e cada curso tem a sua cor.

**Stack:** Next.js 16 (App Router, Server Actions), Supabase (Auth + Postgres com RLS), Stripe Checkout (cartão e Pix), Tailwind CSS v4, Zod.

## Funcionalidades

| Área | O que tem |
|---|---|
| **Auth** | Cadastro, login, Google OAuth, confirmação por e-mail, recuperação e troca de senha, rotas protegidas no `proxy.ts` |
| **Estúdio** (`/studio`) | Criar curso (título, ícone, cor, preço), módulos e aulas com reordenação, editor de aula (texto + vídeo YouTube/Vimeo, prévia grátis, XP), banco de questões com gabarito, publicar/despublicar, lista de alunos |
| **Aluno** (`/app`) | Painel com nível, XP, sequência e meta diária; trilha do curso; aula com "Concluir"; prática de questões com feedback; ranking |
| **Vitrine** (`/cursos`) | Catálogo e página de venda com currículo, matrícula grátis ou compra |
| **Pagamento** | Stripe Checkout; o webhook assinado libera a matrícula e trata reembolso |

## Segurança

- **RLS em todas as tabelas.** Cursos em rascunho só aparecem para o dono. Conteúdo das aulas (`lesson_contents`) e gabarito (`question_answers`) ficam em tabelas separadas e protegidas.
- **XP, matrículas e progresso** só mudam por funções `SECURITY DEFINER` (`complete_lesson`, `answer_question`, `enroll_free`) ou pelo webhook do Stripe. `award_xp` não pode ser chamada pelo cliente, e um *column grant* impede o aluno de editar `xp`/`streak` no próprio perfil.
- **O preço vem sempre do banco**, nunca do formulário. A matrícula paga só é criada pelo webhook depois da verificação da assinatura (`STRIPE_WEBHOOK_SECRET`).
- **No servidor, a sessão é lida com `getClaims()`** (JWT verificado) e não com `getSession()`.
- **Proteções extras:**
  - todo Server Action revalida o usuário e checa a posse do recurso;
  - os redirects pós-login são sanitizados, o que evita *open redirect*;
  - as mensagens de erro de login são genéricas, para não revelar quais e-mails têm conta.
- **Headers de segurança:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy` (ver `next.config.ts`).
- **Testes de RLS:** `npm run test:db` roda a migration num Postgres embutido (PGlite) e cobre 29 cenários de permissão.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Copie **Project URL**, **Publishable key** e **Secret key** (Project Settings → API) para `.env.local`.
3. Aplique a migration usando a CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_REF
   npx supabase db push
   ```
   Se preferir, cole `supabase/migrations/20261118000000_init.sql` no SQL Editor.
4. Em **Authentication → URL Configuration**, configure:
   - **Site URL**: `http://localhost:3000` (em produção, o seu domínio);
   - **Redirect URLs**: `http://localhost:3000/auth/callback` e `https://SEU-DOMINIO/auth/callback`.
5. (Opcional) Para habilitar Google em **Authentication → Providers → Google**, informe o Client ID/Secret do Google Cloud. A *redirect URI* do Google é a callback do Supabase mostrada nessa tela.

### 2. Stripe

1. Pegue a **Secret key** de teste (`sk_test_…`) em Developers → API keys.
2. Para receber webhooks localmente:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Copie o `whsec_…` exibido para `STRIPE_WEBHOOK_SECRET`.
3. Em produção, crie um endpoint em Developers → Webhooks apontando para `https://SEU-DOMINIO/api/webhooks/stripe` com os eventos:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
4. Para aceitar **Pix**, ative o método em Settings → Payment methods (conta BR). O Checkout usa os métodos ativos automaticamente.

Teste com o cartão `4242 4242 4242 4242`, qualquer data futura e qualquer CVC.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda `tsc` |
| `npm run test:db` | Testes de RLS/RPC da migration (PGlite, sem Docker) |

## Estrutura

```
src/
  app/
    (auth)/            login, cadastro, recuperar/nova senha + server actions
    (platform)/
      app/             área do aluno (painel, curso, aula, questões, perfil, compras)
      studio/          estúdio do criador (cursos, módulos, aulas, questões)
      cursos/          catálogo e página de venda (públicos)
      checkout/        retorno do Stripe
    api/webhooks/stripe/  webhook assinado → pagamento + matrícula
    auth/callback/     troca do código OAuth / confirmação de e-mail
  components/          logo, ícones flat, UI (botões, campos, progresso)
  lib/                 supabase (server/admin/proxy), dal, queries, stripe, utils
  proxy.ts             refresh de sessão + proteção de rotas
supabase/
  migrations/          schema, RLS, funções e grants
  tests/               testes de permissão
```

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure as variáveis do `.env.example`, com `NEXT_PUBLIC_SITE_URL` apontando para o domínio final.
3. Atualize as Redirect URLs no Supabase e crie o webhook de produção no Stripe.
