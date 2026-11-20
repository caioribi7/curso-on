# Integrações

O Curso On funciona só com o Supabase. Todo o resto é opcional. No painel, abra **Integrações** (no início ou em **Configurar**), escolha uma, cole as chaves e aperte **Testar conexão**.

| Integração | Para quê | Chaves (`.env.local`) | Teste de conexão |
|---|---|---|---|
| **Supabase** (obrigatória) | Banco e login | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `GET /auth/v1/settings` |
| **Masterbase** | Ver e editar o banco numa tela visual | `MASTERBASE_DATABASE_URL` (vazio = Supabase local) | Conecta na porta do Postgres e confere se o Masterbase está instalado |
| **Stripe** | Cobrar por cursos, se você quiser | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `GET /v1/balance` (não cobra nada) |
| **Resend** | E-mails do site | `RESEND_API_KEY`, `EMAIL_FROM` | `GET /domains` e confere o domínio do remetente |
| **Cloudflare R2 / S3** | Arquivos e vídeos próprios | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | `HEAD` no bucket, assinado com AWS Signature V4 |
| **YouTube / Vimeo** | Vídeos das aulas | nenhuma | nada a testar: cole o link no editor da aula |
| **Plausible / Google Analytics** | Visitas ao site | `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` ou `NEXT_PUBLIC_GA_ID` | Confere se o serviço responde |
| **OpenAI / Anthropic** | Pré-correção de redações com IA | `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` | `GET /v1/models` (não gasta créditos) |

Cada tela do painel traz o passo a passo, com links, de como conseguir cada chave. O mesmo texto fica em [`cli/src/integrations.rs`](../cli/src/integrations.rs).

## Como as chaves são protegidas

- **Campos mascarados.** Um segredo colado aparece como `••••••••••••`, sempre do mesmo tamanho, para não revelar nem quantos caracteres tem. Colar (Ctrl+V) troca a chave inteira; Ctrl+U apaga.
- **Formato conferido na hora.** Ao lado do campo aparece `✓ formato ok` ou o problema, por exemplo "essa é a chave publicável (pk_); aqui vai a secreta (sk_…)". O teste de conexão só roda com o formato certo.
- **Teste sem vazamento.** As mensagens de erro usam só o código HTTP, nunca o corpo da resposta (a Stripe, por exemplo, repete parte da chave no erro). Nenhuma chave vai em URL.
- **Dois lugares para guardar**, à sua escolha em cada integração:
  - **`.env.local`**: ignorado pelo git (`.env*` no `.gitignore`). O painel grava num arquivo temporário e troca de uma vez, e no Linux/macOS deixa o arquivo com permissão `600` (só você lê). No Windows ele fica na sua pasta de usuário, que já é privada.
  - **Chaveiro do sistema**: Keychain (macOS), Gerenciador de Credenciais (Windows) ou Secret Service (Linux, com GNOME Keyring ou KWallet). O `.env.local` guarda só uma linha `# curso-on:chaveiro NOME_DA_CHAVE`, sem o valor. Quando você usa **Abrir a plataforma**, o painel lê o chaveiro e passa as chaves para o `npm run dev` como variáveis de ambiente, sem imprimir nada.
- Chaves públicas por natureza (`NEXT_PUBLIC_*`, nome do bucket, endpoint) sempre vão para o `.env.local`, porque o Next precisa delas para montar o site.

Para colocar o site no ar (Vercel, por exemplo), copie as mesmas variáveis para as *Environment Variables* do provedor. Nunca commite o `.env.local`.

## O que o site já usa

| Integração | Situação |
|---|---|
| Supabase | Em uso. |
| YouTube / Vimeo | Em uso (editor da aula, embed `youtube-nocookie.com`). |
| Masterbase | Em uso pelo painel. |
| Stripe | Chaves e teste prontos; checkout no site é o próximo passo (abaixo). |
| Resend, R2/S3, Analytics, IA | Chaves e teste prontos; o site ainda não lê essas variáveis. |

## Próximo passo: checkout com Stripe

O Curso On é grátis e open source, e continua assim por padrão. A ideia é que a cobrança só exista quando `STRIPE_SECRET_KEY` **e** `STRIPE_WEBHOOK_SECRET` estiverem definidas: sem elas, nenhum preço aparece e tudo segue grátis.

Os pagamentos foram removidos no commit `77b8b79` (junto com as colunas `price_cents`/`currency` e a tabela `payments`, pela migration `20261120000000_free_open_source.sql`). Para voltar com eles atrás da chave, falta:

1. Uma migration nova recriando `courses.price_cents` (padrão `0`) e a tabela `payments`, com RLS e a função que matricula depois do pagamento.
2. `src/lib/stripe.ts` que só cria o cliente quando as duas variáveis existem, e um `isPaidEnabled()` usado pelas telas.
3. Preço no formulário do estúdio e botão "Comprar" na página do curso, só quando `isPaidEnabled()` e `price_cents > 0`.
4. `src/app/api/webhooks/stripe/route.ts` validando a assinatura com `STRIPE_WEBHOOK_SECRET` e tratando `checkout.session.completed`. O webhook antigo gravava com um cliente admin (`SUPABASE_SECRET_KEY`); prefira uma função `SECURITY DEFINER` para não precisar dessa chave, ou adicione-a como segredo na integração Stripe.
5. Testes de RLS para a tabela `payments` em `supabase/tests/rls.test.mjs`.

O código antigo está em `git show 77b8b79^:src/app/api/webhooks/stripe/route.ts` e arquivos vizinhos, e serve de ponto de partida.
