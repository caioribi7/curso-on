# Primeiros passos no Curso On

Este guia é para quem nunca criou um curso nem mexeu com programação. Você vai precisar de uns 20 minutos.

## O que é o Curso On

Uma plataforma gratuita e open source de cursos preparatórios para o ENEM que você roda no seu computador (ou coloca na internet). Cada matéria tem dois níveis: 1 para a base e 2 para o aprofundamento. Os alunos ganham XP, mantêm sequência de estudos e aparecem num ranking.

Tudo se controla por um painel no terminal: o comando `curso-on`.

## 1. Instale o que falta

- **Node.js** (versão LTS): baixe em nodejs.org e instale com tudo no padrão.
- **Git**: baixe em git-scm.com (no Windows, aceite as opções padrão).
- **Docker Desktop** (opcional): só se quiser o banco de dados no seu computador. Baixe em docker.com e deixe aberto.

Sem Docker, você usa o Supabase na nuvem, que é grátis. Os dois caminhos estão abaixo.

## 2. Pegue o painel `curso-on`

Copie e cole no terminal um destes comandos (ele baixa, confere e instala):

Linux e macOS:

```
curl -fsSL https://raw.githubusercontent.com/caioribi7/curso-on/main/install.sh | sh
```

Windows (no PowerShell):

```
irm https://raw.githubusercontent.com/caioribi7/curso-on/main/install.ps1 | iex
```

Ou, se tiver Rust instalado:

```
cargo install --git https://github.com/caioribi7/curso-on curso-on
```

Abra o terminal, entre na pasta onde quer guardar o projeto e rode:

```
curso-on
```

Se o projeto ainda não estiver no computador, escolha **Configurar o Curso On → Baixar o Curso On**.

Use as setas para escolher, Enter para abrir e Esc para voltar. Para colar texto, use o atalho de colar do seu terminal (Ctrl+V ou Ctrl+Shift+V).

## 3. Prepare o banco de dados (Supabase)

O Supabase guarda as contas, os cursos e o progresso dos alunos. Escolha um caminho:

### Caminho A: no seu computador (precisa do Docker)

1. Abra o Docker Desktop e espere ele ficar verde.
2. No painel: **Configurar o Curso On → Supabase no meu computador**.
3. Espere. Na primeira vez ele baixa as imagens e pode levar alguns minutos.
4. Pronto: o painel preenche o arquivo `.env.local` sozinho.

### Caminho B: na nuvem (grátis, sem Docker)

1. Entre em supabase.com e clique em **Start your project**. Dá para entrar com a conta do GitHub.
2. Clique em **New project**. Dê um nome (por exemplo, curso-on), crie uma senha forte para o banco e **guarde essa senha**.
3. Escolha a região mais próxima (São Paulo) e espere o projeto ficar pronto.
4. No painel do `curso-on`: **Configurar o Curso On → Supabase na nuvem**. A tela mostra onde copiar a Project URL e as chaves.
5. Depois: **Criar as tabelas na nuvem**. Você vai precisar do Reference ID (Project Settings → General) e da senha do banco do passo 2.

A senha do banco e a chave secreta (sb_secret_…) do Supabase dão acesso total aos dados. O Curso On não precisa da chave secreta: nunca mande para ninguém nem coloque no GitHub. O arquivo `.env.local` já fica fora do Git.

## 4. Abra a plataforma

No painel: **Abrir a plataforma**. Na primeira vez ele instala as dependências (alguns minutos). O navegador abre em localhost:3000 quando o site estiver pronto.

Para desligar o site, aperte Ctrl+C no terminal e depois Enter para voltar ao painel.

## 5. Crie sua conta de professor

No painel: **Criar conta de professor**. Coloque seu nome, e-mail e uma senha de pelo menos 8 caracteres. A mesma conta funciona no site.

No Supabase na nuvem, ele pode pedir para confirmar o e-mail. Abra o e-mail, confirme e use **Entrar como professor**.

## 6. Seus primeiros cursos

### O jeito rápido: importar o pacote ENEM

**Importar cursos ENEM** cria 26 cursos prontos (13 matérias, níveis 1 e 2), com módulos, aulas curtas e questões. Depois é só editar do seu jeito.

### Criar do zero

1. **Meus cursos → n** (novo curso). Escolha a matéria com as setas ← →, e o nível. Todo curso nasce grátis; se quiser vender, ponha um preço no site (Estúdio → Configurações) depois de ligar a Stripe em Integrações.
2. Dentro do curso, aperte **m** para criar um módulo (um capítulo, como “Funções”).
3. Com o módulo selecionado, aperte **a** para criar uma aula. O conteúdo aceita Markdown:
   - `# Título` para títulos
   - `- item` para listas
   - `**negrito**` para destacar
4. Aperte **q** para criar questões de múltipla escolha. Escreva a explicação: o aluno vê depois de responder.
5. Quando estiver pronto, aperte **p** para publicar. Rascunhos só você vê.
6. Aperte **v** para ver o curso no site.

Dica: deixe a primeira aula como **prévia**. Quem visita a página do curso consegue ler antes de clicar em “Começar curso”.

## 7. Masterbase: ver o banco sem SQL (opcional)

O Masterbase é outro projeto open source do mesmo autor. Ele mostra as tabelas do Curso On como planilhas, para você ver alunos, cursos e respostas sem escrever SQL.

No painel: **Masterbase → Abrir o banco no Masterbase**. Se ele não estiver instalado, a tela mostra como instalar. A primeira conta que você criar no Masterbase vira a administradora.

Cuidado: com o usuário postgres, o Masterbase ignora as regras de segurança do site. Evite mudar XP e matrículas à mão.

## Deu problema?

- **“Node.js ✗” na tela de situação**: instale o Node e abra um terminal novo.
- **Supabase local não liga**: confira se o Docker Desktop está aberto e rodando.
- **“E-mail ou senha incorretos”**: confira o e-mail; se esqueceu a senha, crie outra conta ou redefina pelo site.
- **A porta 3000 está ocupada**: feche outro site que esteja rodando e tente de novo.
- **Ainda travado?** Abra uma issue no GitHub contando o que apareceu na tela.
