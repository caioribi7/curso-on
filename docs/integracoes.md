# Integrações

O Curso On funciona só com o Supabase. Todo o resto é opcional. No painel, abra **Integrações** (no início ou em **Configurar**), escolha uma, cole as chaves e aperte **Testar conexão**.

| Integração | Para quê | Chaves (`.env.local`) | Teste de conexão |
|---|---|---|---|
| **Supabase** (obrigatória) | Banco e login | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `GET /auth/v1/settings` |
| **Masterbase** | Ver e editar o banco numa tela visual | `MASTERBASE_DATABASE_URL` (vazio = Supabase local) | Conecta na porta do Postgres e confere se o Masterbase está instalado |
| **Stripe** | Vender seus cursos (cartão e Pix), se você quiser | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY` | `GET /v1/balance` (não cobra nada) e uma leitura no admin do Supabase |
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
| Stripe | Em uso: preço por curso, checkout, webhook, reembolso e vendas no estúdio (abaixo). |
| OpenAI / Anthropic | Em uso na pré-correção de redações (o botão só aparece com a chave). |
| Resend, R2/S3, Analytics | Chaves e teste prontos; o site ainda não lê essas variáveis. |

## Vender cursos com a Stripe

Criar e publicar continua grátis. A venda é por curso e só funciona com as três chaves (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`); sem elas, curso com preço fica com a compra pausada e nada é cobrado.

1. **Ligue a integração** no painel: **Integrações → Stripe**. No Supabase local a `SUPABASE_SECRET_KEY` já vem preenchida pelo **Configurar**.
2. **Ponha o preço** em **Estúdio → curso → Configurações → Preço** (`0` = grátis).
3. **Webhook.** No computador: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (a Stripe CLI mostra o `whsec_…`). Em produção: **Developers → Webhooks → Add endpoint** em `https://SEU-SITE/api/webhooks/stripe` com os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `charge.refunded`.
4. **Pix:** ative em **Settings → Payment methods** na Stripe.

Como funciona por dentro:

- O botão **Comprar** abre o Stripe Checkout com o preço lido do banco (nunca do formulário). A confirmação em `/checkout/sucesso` só mostra o status; quem libera o acesso é o webhook.
- O webhook confere a assinatura, grava em `payments` e cria a matrícula `stripe`. Eventos repetidos não duplicam nada. `charge.refunded` marca o pagamento como reembolsado e tira a matrícula que veio dele.
- No banco (`20261124000000_venda_de_cursos.sql`): `enroll_free` e a matrícula direta pela API só valem para curso com `price_cents = 0`; o envio de redação não matricula de graça em curso pago; `payments` não aceita escrita do cliente. Tudo coberto por `supabase/tests/vendas.test.mjs`.
- Para testar sem cartão: `node --env-file=.env.local scripts/webhook-test.mjs <id-do-curso> <id-do-aluno>` manda um evento assinado igual ao da Stripe.
