# 0042. Sub-verticais do editor falam com o rascunho só por `useDraftEditor()` e `useProblemCounts()`

- **Status:** aceita, revisar no checkpoint (complementada por [0047](0047-pecas-de-propriedades-exportadas-para-outras-sub-verticais.md): peças exportadas por `properties/index.ts`)
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F50)
- **Relacionadas:** ADRs 0003, 0009, 0025, 0038, 0041

## Contexto

O editor é dividido em sub-verticais (rascunho, layout, problemas, propriedades, canvas, grade, Calcular). A F50 é dona do rascunho e do histórico. F51, F53, F54 e F55 precisam ler e mudar a definição, saber qual item está selecionado e ver os problemas, sem cada uma abrir seu próprio acesso à API.

## Decisão

- O estado do rascunho aberto vive num `DraftEditorProvider`. As outras sub-verticais usam só dois ganchos:
  - `useDraftEditor()`: `definition`, `revision`, `problems`, `symbols`, `readOnly`, `selection` e `select`, `change(update, { mergeKey })`, `undo`, `redo`, `save`, `retrySave`, `flush()`, `reload`, e `analyzedDefinition`, `problemsOutdated`, `analysisFailed`.
  - `useProblemCounts()`: `total`, `byNode`, `inputs`, `output`, `workflow`, contados sobre a definição analisada.
- A seleção é `{ item, field }`. `item` é `workflow | inputs | output | node`; `field` é o `path` do problema, para propriedades e grade focarem o campo.
- `mergeKey` sugerido é o `path` do campo digitado. Mudanças com o mesmo `mergeKey` a menos de 1 s viram um passo de histórico.
- `flush()` salva na hora e devolve a revisão ou `null` (conflito ou erro, já mostrados na barra). A F55 chama antes de Calcular.
- `analyzedDefinition` é o texto em que os problemas foram calculados, para o `analyzedValue` da ADR 0041.
- Sub-verticais não editam o cache `['workflows', id, 'draft']` nem chamam o PUT do rascunho. Mudança passa por `change`.
- O histórico guarda até 50 passos. Em só leitura, `change`, `undo` e `redo` não fazem nada.

## Alternativas consideradas

- **Cada sub-vertical mexe no cache do rascunho:** espalha a regra de salvar, de revisão e de conflito, e quebra o histórico.
- **Estado global (store) novo:** dependência nova sem ganho; contexto resolve, pois o rascunho é de uma tela só.
- **Props descendo da tela:** a F57 teria de ligar cada sub-vertical à mão e o contrato mudaria a cada tarefa.

## Consequências

- **Bom:** uma interface só para quatro tarefas; revisão, conflito e histórico ficam num lugar.
- **Ruim:** mudar o contexto afeta todas as sub-verticais; qualquer campo novo precisa de aviso a elas.
- **A fazer:** F51, F53, F54 e F55 usam estes ganchos; novos campos entram aqui por ADR complementar.
