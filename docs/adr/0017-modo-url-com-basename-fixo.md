# 0017. Modo `url` com `basename` fixo em `/`, sem prop no contrato

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F8)
- **Relacionadas:** [0006](0006-roteamento-interno-e-configuracao-do-modulo.md) (complementa)

## Contexto

A ADR 0006 diz que o modo `url` usa roteador ligado à URL "com `basename`", mas a lista de props do `<FluxoCalculo>` não tem `basename`, e o casca (F10) monta `<FluxoCalculo navegacao="url">` sem ele.

## Decisão

- No modo `url`, o módulo usa `BrowserRouter` com `basename` `/`. As rotas são `/inicio` etc.
- Não criamos a prop `basename` agora.

## Alternativas consideradas

- **Prop `basename` já agora:** muda o contrato do módulo sem que nenhum consumidor precise.

## Consequências

- **Bom:** contrato menor.
- **Ruim:** o módulo em modo `url` não pode ficar num subcaminho (ex.: `/app/fluxo`).
- **A fazer:** se um hospedeiro precisar, abrir tarefa própria para a prop `basename` (mudança de contrato, com versão nova do pacote).
