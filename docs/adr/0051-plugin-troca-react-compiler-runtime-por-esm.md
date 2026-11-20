# 0051. Plugin do Vite troca o `react-compiler-runtime` do React Flow por uma versão ESM

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F57)
- **Relacionadas:** ADR 0004 (build em modo biblioteca), ADR 0037 (Monaco e React Flow no pacote)

## Contexto

O `@xyflow/react` importa `react-compiler-runtime`, arquivo CommonJS que chama `require('react')`. No build em modo biblioteca, com `react` externo, esse `require` não tem onde rodar e a página do hospedeiro falha ao carregar.

## Decisão

- `packages/react/vite.config.ts` tem o plugin `fc-react-compiler-runtime` (`enforce: 'pre'`), que resolve `react-compiler-runtime` para um módulo virtual (`'\0fc-react-compiler-runtime'`, escrito como escape, sem byte NUL no arquivo).
- O módulo virtual exporta só `c` (cache de memo), com a lógica do `react-compiler-runtime` 1.0.0 em ESM e `import * as React from 'react'`; `react` segue externo.
- Ao subir a versão do `@xyflow/react`, conferir se ainda usa só `c` e se a lógica copiada continua igual.

## Alternativas consideradas

- **Incluir `react` no bundle:** duplica o React e quebra hooks no hospedeiro.
- **Plugin `commonjs` do Rollup para o arquivo:** o `require('react')` continuaria sem resolução com `react` externo.
- **Trocar o React Flow:** custo alto, sem ganho.

## Consequências

- **Bom:** o `dist` carrega no hospedeiro sem `require`.
- **Ruim:** cópia de lógica de terceiros para manter.
- **A fazer:** rever a cópia nas atualizações do `@xyflow/react`.
