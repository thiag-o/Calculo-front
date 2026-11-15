# 0013. Item de menu desabilitado só com `motivoDesabilitado`, como o botão

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F5)
- **Relacionadas:** [0012](0012-botao-desabilitado-so-com-motivo.md) (complementa), [0003](0003-codigo-por-verticais.md)

## Contexto

A ADR 0012 vale para o `Botao`. A F5 criou o `Menu` (Radix DropdownMenu), cujos itens também podem ficar indisponíveis. Sem regra própria, o menu teria um `disabled` que some do teclado e não explica o bloqueio.

## Decisão

- `AcaoMenu` não tem `disabled`. O estado vem de `motivoDesabilitado` (texto).
- Com motivo, o item usa `aria-disabled`, continua alcançável pelas setas, não executa a ação e mantém o menu aberto.
- O motivo aparece embaixo do rótulo (12px, texto terciário) e entra no `aria-describedby`. O nome acessível continua sendo só o rótulo.
- Regra geral: todo controle do design system que possa ficar desabilitado segue este padrão (sem `disabled`, com motivo visível). A 0012 passa a valer para eles também.

## Alternativas consideradas

- **`disabled` nativo do Radix:** tira o item do foco e não explica o bloqueio.
- **Motivo só em dica (tooltip):** em item de menu a dica brigaria com a navegação por setas; o texto visível é mais simples e acessível.

## Consequências

- **Bom:** padrão único para botões e menus; teclado e leitor de tela entendem o bloqueio.
- **Ruim:** todo item bloqueado exige texto de motivo e o item fica mais alto.
