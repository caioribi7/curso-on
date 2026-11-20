# Transições e cantos concêntricos

Este documento mapeia cada estado interativo do Curso On e como ele anima. Tudo
fica centralizado em `src/app/globals.css`; os componentes só usam as classes e
tokens descritos aqui.

## Regras gerais

| Regra | Valor |
|---|---|
| Curva padrão | `--ease-ui: cubic-bezier(.2, .8, .2, 1)` (saída rápida, chegada suave) |
| Mola (pop, ícones) | `--ease-spring: cubic-bezier(.34, 1.56, .64, 1)` |
| Hover, foco, pressionar | `--dur: 200ms` (`--dur-fast: 150ms` para menus e saídas) |
| Movimento (indicador, acordeão) | `--dur-move: 320ms` |
| Barras de progresso | `--dur-fill: 700ms` |
| Movimento reduzido | `prefers-reduced-motion: reduce` zera durações e desliga as View Transitions; as trocas viram instantâneas |

Todo `a`, `button`, `summary`, `input`, `select`, `textarea` e `label` já recebe
transição de cor, fundo, borda, sombra, contorno, opacidade e transformações
(regra `:where(...)`, de baixa prioridade). O utilitário `transition` do Tailwind
também usa `--dur` e `--ease-ui`.

## Cantos concêntricos

Um elemento encostado no canto de outro tem **raio interno = raio externo − espaço
entre eles**. Assim as duas curvas compartilham o mesmo centro.

| Token | Valor | Onde |
|---|---|---|
| `--r-card` / `rounded-card` | 34px | cards e painéis |
| `--pad-card` / `p-card` | 20px | padding padrão dos cards |
| `--r-inner` / `rounded-inner` | `--r-card − --pad-card` = 14px | botões, inputs, linhas, blocos de ícone, avisos |
| `--pad-panel` / `p-panel` | 6px | barras segmentadas, menus, chips com ícone |
| `--r-panel` / `rounded-panel` | `--r-inner + --pad-panel` = 20px | o que envolve um `--r-inner` a 6px |
| `--r-hero` / `rounded-hero` | 40px | blocos grandes de marca (os filhos não ficam nos cantos) |

Casos aplicados:

- **Card com conteúdo no canto** (estatísticas, ícone do curso, botão no rodapé): `rounded-card p-card` e o filho `rounded-inner`.
- **Barra segmentada** (abas): `rounded-panel p-panel`, itens e indicador `rounded-inner`.
- **Menu da conta**: `rounded-panel p-panel`, itens `rounded-inner`.
- **Alternativa de questão**: `rounded-panel p-panel`, letra `rounded-inner`. Borda vira `ring-inset` para não somar espaço.
- **Linhas de ranking**: pílulas (`rounded-full`) com `p-2` e avatar de 40px: 28 = 20 + 8.
- **Barra de navegação, barras de progresso, avatares e chips**: tudo `rounded-full`, que é sempre concêntrico.
- **Catálogo**: a linha da matéria tem `p-3`, então o card de curso dentro dela usa `--r-card − 12px`.
- **Feedback da questão**: tem botão no canto com `p-card`, então é `rounded-card`.

Para mudar o visual inteiro, mude `--r-card` e `--pad-card`; o resto acompanha.

## Mapa de estados

### Navegação

| Estado | Animação | Onde |
|---|---|---|
| Item ativo da barra principal | Indicador compartilhado (`<ViewTransition name="nav-main">`) desliza do item antigo para o novo | `nav-link.tsx` |
| Abas: áreas do catálogo, Total/Esta semana, seções do Estúdio | Mesmo indicador deslizante (`Segmented`), com a cor da área no catálogo | `motion/segmented.tsx` |
| Conteúdo das abas | Cross-fade do painel (`SwapTransition`, chave = aba) | catálogo, ranking, Estúdio |
| Troca de página | Página antiga some (150ms), nova sobe 12px com fade (260ms); o cabeçalho fica parado | `PageTransition` no layout |
| Mudança só de query string ou atualização por server action | Não repete a animação de página | chave = `pathname` |

As View Transitions usam o `<ViewTransition>` do React 19.3 (sem configuração no
Next 16). Sem suporte no navegador, tudo funciona igual, só sem animação.

### Controles

| Estado | Animação |
|---|---|
| Hover em botão, link, card | Cor/fundo em 200ms; cards de curso sobem 2px e ganham sombra |
| Pressionar | Botões descem 2px e a sombra encolhe; cards voltam ao lugar; chips e ícones encolhem levemente (`scale .97–.9`) |
| Foco (teclado) | Anel aparece com fade e se aproxima (offset 5px → 2px) |
| Input em foco | Borda na cor do curso + anel suave |
| Botão de envio pendente | Texto troca para "Salvando…", opacidade reduzida |

### Tema

| Estado | Animação |
|---|---|
| Alternar claro/escuro | Cross-fade da página inteira com `document.startViewTransition` (320ms). Sem suporte: cores fazem transição por 300ms. Sem flash: o servidor já renderiza o tema do cookie |
| Ícone sol/lua | Gira e cresce ao trocar (só depois do clique, não no carregamento) |

### Progresso e números

| Estado | Animação |
|---|---|
| Barras de progresso (curso, nível, meta do dia, rodada de questões) | Crescem de 0 ao aparecer e deslizam até o novo valor (`.bar-fill` + `@starting-style`) |
| Anel da meta de hoje | Traço se desenha ao aparecer (`.ring-fill`) |
| XP e sequência no topo, no painel e no card do aluno | Contam até o novo valor quando mudam (`CountUp`), por exemplo depois de concluir uma aula |

### Conquistas

| Estado | Animação |
|---|---|
| Conquista desbloqueada ao concluir aula | Toast mostra o emblema com pop (mola) |
| Card do aluno, emblemas novos desde a última visita | Pop + brilho dourado uma vez (`.badge-new`; o que já foi visto fica no `localStorage`) |
| Hover em emblema | Sobe 4px e cresce 5% |
| Emblema bloqueado | Cinza (`grayscale`) e 40% de opacidade |

### Questões

| Estado | Animação |
|---|---|
| Escolher alternativa | O destaque desliza da alternativa anterior para a nova |
| Resposta certa | Alternativa correta pulsa, mensagem entra subindo, "Acertou!" com pop |
| Resposta errada | Alternativa escolhida treme; as outras esmaecem |
| Próxima questão | Card atual sai para a esquerda, o novo entra pela direita |
| Fim da rodada | Card entra subindo, troféu com pop, XP conta |

### Redação

| Estado | Animação |
|---|---|
| Digitar / Foto ou PDF | Indicador `--r-inner` desliza dentro da barra `--r-panel` (`--dur-move`); o painel novo entra com `.anim-in` |
| Contador de linhas | Barra cresce com o texto (`.bar-fill`); fica amarela abaixo de 8 linhas e coral acima de 30 |
| Andamento (enviada → em correção → corrigida) | Etapa atual com pop; ligações preenchem com `.bar-fill` |
| Nota devolvida | Total conta até o valor (`CountUp`) e as 5 barras crescem de 0 |
| Comentário no texto | Trecho marcado clareia no hover; o ativo fica sólido e o comentário da lista ganha anel |
| Notas do professor | Grupo `rounded-panel p-panel` com botões `rounded-inner` (0 a 200) |

Folha pautada (`.essay-sheet`, em `src/styles/redacao.css`): linhas de 32px com `--line-strong`, nos dois temas.

### Avisos, menus e acordeões

| Estado | Animação |
|---|---|
| Toast "Aula concluída" | Sobe com fade; fecha sozinho em 6s (ou no ×) deslizando para baixo; remove `?concluida` da URL |
| Mensagens de formulário e avisos de erro | Entram subindo (`.anim-in`) |
| Menu da conta | Aparece descendo 6px com fade e escala; some com fade; fecha com clique fora, Esc ou navegação |
| Módulos na página do curso, "Editar módulo" no Estúdio | Abrem/fecham animando a altura (`::details-content` + `interpolate-size`); a seta gira 90° |

## Como adicionar uma nova transição

1. Use um token de duração e a curva `--ease-ui`; não invente valores soltos.
2. Para um destaque que se move entre itens, renderize `<Indicator name="…">` só dentro do item ativo e mude o item dentro de uma transição (link do Next ou `startTransition`).
3. Para conteúdo que entra, use `.anim-in` ou `.anim-pop`.
4. Teste com "Reduzir movimento" ligado no sistema.
