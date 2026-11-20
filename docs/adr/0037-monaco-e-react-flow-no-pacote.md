# 0037. Monaco e React Flow no pacote, com o Monaco carregado sob demanda

- **Status:** aceita, revisar no checkpoint (complementada por [0040](0040-monaco-environment-do-hospedeiro-tem-prioridade.md): `MonacoEnvironment` do hospedeiro tem prioridade)
- **Data:** 2026-11-19
- **Quem decidiu:** orquestração (tarefa F47)
- **Relacionadas:** ADR 0002 (sem iframe, CSS próprio), ADR 0004 (build em modo biblioteca), E4-21

## Contexto

O épico 4 traz o editor de workflows (grafo com `@xyflow/react`) e o editor de fórmulas (`monaco-editor`). O Monaco é grande (alguns MB) e só a tela do editor o usa. O módulo é incorporado em hospedeiros sem iframe: não pode ter CDN, reset global nem CSS que vaze para fora.

## Decisão

- Duas dependências de `packages/react`, com versão exata: `@xyflow/react` 13.0.2 e `monaco-editor` 0.57.0.
- O Monaco entra no pacote (não é `external`) e sai num pedaço próprio chamado `monaco`, configurado em `codeSplitting.groups` do `vite.config.ts`. Quem o usa chama `import()` dinâmico a partir da tela do editor; `dist/index.js` não o contém e o navegador só baixa o pedaço quando o editor abre (E4-21).
- Os imports vão por `monaco-editor/editor/editor.api` (só o núcleo; as linguagens e recursos que o editor usar entram um a um), nunca por `monaco-editor` inteiro.
- O worker do editor é importado com `?worker` (`monaco-editor/editor/editor.worker?worker`) e sai como arquivo local em `dist/`; `MonacoEnvironment.getWorker` aponta para ele. Não há URL de CDN nem `loader.config({ paths })`. Sem o worker, o Monaco roda na própria página (mais lento, funciona); isso é aceito como degradação, não como padrão.
- CSS: o Monaco injeta o dele pelo próprio JS do pedaço, com classes `monaco-*` e `codicon`, e o canvas importa o `@xyflow/react/dist/base.css`, que traz só a estrutura das classes `react-flow*` (sem cores nem tema; não o `style.css`, desde a F51). Os dois têm prefixo próprio; o aceite do build confere que `dist/styles.css` não tem seletor global (`*`, `html`, `body`, `:root`). O que o `estilos.md` precisar sobrescrever usa classes `fc-` sobre a raiz do módulo, nunca seletor global. Portais e widgets do Monaco (`overflowWidgetsDomNode`) ficam dentro da raiz do módulo.
- O canvas usa o `base.css` e não o `style.css` do React Flow porque tudo o que é visível (blocos, portas, ligações, minimapa, controles) vem das classes `fc-canvas*` e dos tokens `--fc-*` (estilos.md §8). O `.react-flow` do `base.css` declara `color-scheme: light dark`; o `canvas.css` repõe `inherit`, para valer o tema do módulo (F51; registrado na F79).
- O `@xyflow/react` fica no pacote principal por ora; se pesar, a tela do editor passa a carregá-lo também sob demanda.

## Alternativas consideradas

- **Monaco por CDN (loader padrão):** viola a regra de não depender de rede externa e do CSP do hospedeiro.
- **Monaco como `external` (dependência do hospedeiro):** o hospedeiro teria de configurar bundler e workers; quebra o "instalar e usar".
- **CodeMirror:** descartado pelo design (E4), que pede o Monaco.

## Consequências

- **Bom:** o início do módulo não paga o custo do Monaco; sem rede externa.
- **Ruim:** o hospedeiro precisa de bundler que entenda o worker emitido; o pacote cresce em `dist/`.
- **A fazer:** medir os tamanhos reais no `dist/` e registrar aqui após o primeiro `pnpm build` (tamanho do `index.js`, do pedaço `monaco`, do worker e de `styles.css`); a tarefa do editor cria o carregador com `import()`.

## Tamanho medido

Medido em 2026-11-19, com `pnpm build` e um carregador temporário (`import()` de um módulo que usava o Monaco e o worker; apagado depois):

| Arquivo | Sem o editor | Com o carregador |
|---|---|---|
| `dist/index.js` | 255,47 kB (56,63 kB gzip) | 255,56 kB (56,68 kB gzip), sem código do Monaco |
| `dist/monaco-*.js` (pedaço sob demanda) | não existe | 3.285 kB (760 kB gzip) |
| `dist/assets/editor.worker-*.js` | não existe | 304 kB |
| `dist/styles.css` | 47,05 kB (7,33 kB gzip) | 162,14 kB (23,43 kB gzip) |

Verificações: nenhuma URL de CDN em `dist/*.js` e `dist/*.css` (as ocorrências de `cdn` ficam só nos `.map`, texto dos fontes); nenhum seletor global (`*`, `html`, `body`, `:root`) em `dist/styles.css`.

Dois pontos que a medição mostrou:
- O `sash.css` do Monaco declara variáveis em `:root`. O `vite.config.ts` tem o plugin `fc-scope-monaco-root`, que troca `:root` por `.fc-root` nos CSS do `monaco-editor`. Sem ele o aceite de seletor global falharia.
- O modo biblioteca junta todo o CSS em `styles.css`; por isso o CSS do Monaco (cerca de 115 kB) e o do xyflow entram no `styles.css` eager, não no pedaço sob demanda. Aceito por ora; se pesar, a tarefa do editor passa a carregar esse CSS no pedaço dinâmico (`cssCodeSplit`).
- O TypeScript precisa de um `declare module '*?worker'` (ou `vite/client` nos tipos) onde o carregador for escrito; sem isso `import ... ?worker` dá TS2307 (o build passa mesmo assim). Fica para a tarefa do editor.
