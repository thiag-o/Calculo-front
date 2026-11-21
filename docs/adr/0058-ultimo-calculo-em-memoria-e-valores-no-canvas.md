# 0058. Último cálculo em memória por `QueryClient`, valores no canvas só para a definição que rodou, e grupo que recebe nós prontos

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F68, D27)
- **Relacionadas:** ADRs 0042, 0044, 0045, 0048, 0049, 0056, 0057 (complementa); `packages/react/src/editor/unit-run/lastRun.ts`, `canvas/run-values/`, `groups/GroupBoxNode.tsx`

## Contexto

A F68 mostra no canvas os valores do último cálculo da aba Calcular. O painel monta só a aba aberta, então o trace precisa sobreviver a fechar a aba. O canvas passa a ler o `unit-run`, no sentido já fixado pela 0057 (canvas → unit-run → preview → values). O `GroupBoxNode` (`editor/groups`) também precisa desenhar valores, mas não pode importar o canvas.

## Decisão

- **Dependência:** o canvas lê o `unit-run` só por `unit-run/index.ts` (`useLastUnitRun`). Isso já está coberto pela 0057 e não muda.
- **Store do último trace:** em memória, um por `QueryClient` (`WeakMap`), fora do cache do TanStack, no padrão da 0045 e da 0056. Guarda `{revision, definition, symbols, trace}`.
  - A chave `pessoa:tenant:workflow` é calculada na hora de guardar, lendo a sessão do cache. Sem pessoa e tenant, nada é guardado.
  - É esquecido por `onSessionDataCleared` (0048). A gravação só vale com `isSameSessionData` (0049).
  - Sem `localStorage` nem `sessionStorage`.
  - `useLastUnitRun(workflowId)` devolve `{lastRun, clear(run)}`. O `clear(run)` só esquece aquele `run`; um cálculo mais novo fica.
- **Quando os valores valem:** só enquanto a `definition` na tela é a que rodou (identidade, 0044), a `revision` é a calculada e o `save.status` é `saved`. Qualquer edição, desfazer ou Recarregar os esquece. Desfazer não traz os valores de volta. Reabrir o editor também os limpa.
- **Grupo sem importar o canvas:** `GroupBoxData.run` recebe nós React prontos (marca do status e valor de cada Output), como o `menu` já faz. `editor/groups` não importa o canvas. Quem quiser mostrar algo novo num grupo passa pelo `data`, não por import.

## Alternativas consideradas

- **Guardar o trace no cache do TanStack:** a coleta e a limpeza por prefixo o apagariam sem relação com a tela (mesmo motivo da 0045).
- **`localStorage`:** proibido pelo design para dado de trabalho.
- **Valores valerem também depois de desfazer, comparando por conteúdo:** exige comparar definições e arrisca mostrar valores que não batem com o rascunho. Esquecer é mais seguro.
- **Chave calculada ao ler, não ao guardar:** uma resposta tardia poderia cair na sessão errada.
- **`groups` importando o canvas:** cria ciclo entre sub-verticais.

## Consequências

- **Bom:** os valores nunca contradizem o rascunho exibido; nada persiste; sem ciclo; a F69 não precisa ligar nada no `Editor.tsx`.
- **Ruim:** uma edição pequena apaga todos os valores, e é preciso calcular de novo. Um terceiro store em memória repete o padrão.
- **A fazer:** com o terceiro uso, extrair o helper comum previsto na 0045. Unificar o despacho de formato por tipo duplicado entre `canvas/run-values/views.ts` e `unit-run/values.ts`, levando-o para `editor/values/`.
