# 0009. Permitir imports internos dentro do mesmo elemento nas fronteiras do eslint

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F6)
- **Relacionadas:** [0003](0003-codigo-por-verticais.md), [0007](0007-ferramentas-de-lint-e-typescript-6.md)

## Contexto

A ADR 0007 mandou a primeira tarefa que criasse uma vertical validar a configuração das fronteiras. Na F6 apareceu o erro: os padrões do `eslint-plugin-boundaries` terminam em `*`, então cada arquivo é um elemento próprio. Com `default: 'disallow'`, qualquer import entre arquivos da mesma vertical era recusado (por exemplo, `erroApi.ts` importar `../gerado/esquema`, ou o `index.ts` reexportar). Não dava para ter mais de um arquivo por vertical.

## Decisão

Em `eslint.config.js`, `boundaries/dependencies` ganha três políticas que permitem import interno dentro do mesmo elemento:

- `api` para `api`;
- `design-system` para `design-system`;
- vertical para vertical **com o mesmo `nome`** (`'{{ from.element.captured.nome }}'`).

A regra da ADR 0003 não muda: entre verticais, e de fora para dentro de `api` e `design-system`, só se importa pelo `index.ts`. `api` não importa vertical. Foi conferido com arquivos de sonda (apagados depois): os casos permitidos passam e os recusados dão erro.

## Alternativas consideradas

- **Um arquivo só por vertical:** inviável.
- **Mudar os padrões de elemento para pasta inteira:** mexe em como o plugin enxerga tudo e arrisca afrouxar a regra entre verticais.
- **Desligar a regra dentro de pastas:** perde a verificação.

## Consequências

- **Bom:** verticais, `api` e `design-system` podem ter vários arquivos, e a fronteira entre elas continua verificada.
- **Ruim:** a configuração fica mais longa, com uma política por tipo de elemento. Tipo novo de elemento precisa da sua própria política.
- **A fazer:** nada. Cumpre o "a fazer" da ADR 0007.
