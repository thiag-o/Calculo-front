# 0074. Esc de combobox dentro de diálogo Radix: listener nativo em captura que faz `preventDefault`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F124)
- **Relacionadas:** ADRs 0012, 0014, 0026; `packages/react/src/executions/parameter-form/AllowedValuesField.tsx`

## Contexto

O campo de valores permitidos por consulta (F124) é um combobox ARIA que abre uma lista dentro do `TriggerExecutionDialog`. O Esc deve fechar só a lista. O `DismissableLayer` do Radix escuta o Esc no `document`, em captura, e fecha o diálogo, a menos que o evento já esteja com `defaultPrevented`. O `stopPropagation` do React não chega a tempo, pois o React ouve na raiz, depois do `document`.

## Decisão

- Enquanto a lista está aberta, o combobox registra um listener nativo de `keydown` em captura na `window` (`{ capture: true }`). Ele roda antes do `document`.
- Se a tecla é Esc e o alvo é o próprio campo, o listener chama `preventDefault()`. O Radix então ignora o Esc, e o handler do campo fecha a lista.
- O listener só existe com a lista aberta e é removido ao fechar ou desmontar.
- Todo combobox ou popup futuro dentro de `Dialogo` segue este padrão, com um teste que monta o diálogo real e confere que o 1º Esc não chama `onClose`.

## Alternativas consideradas

- **`stopPropagation` no handler do React:** não funciona, o Radix já agiu.
- **`Dialogo` do design system ignorar Esc vindo de `[role=combobox][aria-expanded=true]`:** é mais central, mas mexe num componente compartilhado e foi deixado fora da posse da F124. Pode substituir esta ADR depois.
- **Desligar o fechamento por Esc do diálogo:** tira o Esc de todo o diálogo.

## Consequências

- **Bom:** Esc fecha uma camada por vez, sem mudar o design system.
- **Ruim:** cada combobox repete o listener. Depende do detalhe interno do Radix (`defaultPrevented`), que pode mudar numa atualização.
- **A fazer:** avaliar mover a regra para o `Dialogo` se surgir um segundo combobox em diálogo.
