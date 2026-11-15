# 0010. CSS do pacote em dois caminhos: CSS extraído pelo Vite e fontes como import externo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F3)
- **Relacionadas:** [0002](0002-pacote-react-sem-iframe.md), [0004](0004-monorepo-pnpm-vite-changesets.md), [0011](0011-tokens-raiz-e-portais-do-modulo.md)

## Contexto

O pacote `@fluxo/react` é gerado pelo Vite em modo biblioteca. Ele precisa de CSS próprio e das fontes Geist e Geist Mono, sem CDN. No modo biblioteca, o Vite embute as fontes em base64 dentro do CSS, o que incha o pacote e tira do hospedeiro o controle do empacotamento.

## Decisão

- **CSS das verticais:** cada vertical importa seu `.css` no TypeScript. O Vite os extrai para um único CSS do pacote, que o hospedeiro importa (`@fluxo/react/estilos.css`).
- **Fontes:** usamos `@fontsource-variable/geist` e `@fontsource-variable/geist-mono` (dependência nova). São `import` externo no JS, e o bundler do hospedeiro empacota os `.woff2`. Não passam pelo CSS do pacote.
- **`sideEffects: ["**/*.css"]`** no `package.json`: um módulo TS que só tem `import` de efeito colateral é descartado no build. Por isso os imports das fontes ficam em `RaizFluxo.tsx`, e não num arquivo `fontes.ts` à parte.

## Alternativas consideradas

- **Embutir fontes em base64 no CSS:** é o que o Vite faz por padrão na biblioteca. Infla o CSS e impede o cache e o controle do hospedeiro.
- **Fontes por CDN:** proibido (G7, sem CDN).
- **Copiar os `.woff2` para `dist` e referenciar por `@font-face` próprio:** mais manutenção, e o hospedeiro teria de servir os arquivos.

## Consequências

- **Bom:** pacote enxuto; o hospedeiro decide como empacotar as fontes.
- **Ruim:** o hospedeiro precisa de um bundler que entenda `.css` e `.woff2` importados do JS. Quem criar import de efeito colateral novo precisa lembrar do `sideEffects`.
- **Resolvido pela F25:** o `package.json` exporta `./estilos.css` → `./dist/estilos.css`, mas o Vite emitia `index.css`. A F25 definiu `build.lib.cssFileName: 'estilos'` em `packages/react/vite.config.ts`. A emissão real de `dist/estilos.css` será reconferida quando `src/index.ts` exportar o módulo (F10/portão F12).
