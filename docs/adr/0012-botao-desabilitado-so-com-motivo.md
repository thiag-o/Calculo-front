# 0012. Botão desabilitado só com `motivoDesabilitado` (`aria-disabled`, focável, dica no portal)

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F4)
- **Relacionadas:** [0003](0003-codigo-por-verticais.md), [0011](0011-tokens-raiz-e-portais-do-modulo.md)

## Contexto

O `<button disabled>` some da ordem de tabulação, não recebe foco nem dica e não diz ao usuário por que a ação está bloqueada. As telas seguintes (F7, F9…) vão desabilitar botões com frequência, por exemplo quando faltam dados para calcular.

## Decisão

- O `Botao` do design system não tem a prop `disabled`. O estado desabilitado vem da presença de `motivoDesabilitado` (texto).
- Com motivo, o botão usa `aria-disabled="true"`, continua focável e não executa o clique. O motivo fica ligado por `aria-describedby` e aparece numa dica (Radix Tooltip, atraso de 300 ms) renderizada no portal da raiz (`usePortalFluxo()`, ADR 0011).
- Regra para as verticais: quem desabilita um botão passa o porquê. Não existe botão desabilitado sem explicação.
- A dica do botão (`DicaBotao`) é privada. A F5 pode reaproveitar o visual ou trocá-la pela `Dica` genérica; o import interno é permitido pela ADR 0009.

## Alternativas consideradas

- **`disabled` nativo:** tira o botão do foco e do teclado e não explica o bloqueio.
- **`disabled` opcional ao lado do motivo:** permite o caso sem explicação, que é o que se quer evitar.

## Consequências

- **Bom:** teclado e leitor de tela alcançam o botão e entendem o bloqueio; o padrão é único em todas as verticais.
- **Ruim:** todo bloqueio exige um texto de motivo; o estilo desabilitado é feito por `aria-disabled`, não por `:disabled`.
- **A fazer:** F5 decide entre manter `DicaBotao` e usar a `Dica` genérica.
