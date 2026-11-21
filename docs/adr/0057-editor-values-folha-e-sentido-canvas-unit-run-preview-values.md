# 0057. `editor/values/` é uma folha com os formatadores, e o sentido é canvas → unit-run → preview → values

- **Status:** aceita, revisar no checkpoint (complementada por [0058](0058-ultimo-calculo-em-memoria-e-valores-no-canvas.md): o canvas lê o `unit-run` pelo último cálculo)
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F94, D25 e D27)
- **Relacionadas:** ADRs 0042, 0056 (complementa); `packages/react/src/editor/values/`, `preview/`, `unit-run/`, `sources/filters/`

## Contexto

A 0056 deixou cópias locais do formatador de número e de data no `preview`, "até a F94". A F94 cumpriu isso: criou `editor/values/` e removeu as cópias. Isso fixa o sentido completo de dependência entre as sub-verticais, que a 0056 só tratou para `unit-run` e `preview`.

## Decisão

- **Nova sub-vertical `editor/values/`:** é folha. Tem `formatApiNumber`, `readBrazilianNumber`, `NumberReading`, `formatDate`, `formatDateTime` e `NO_VALUE`. Só importa de dentro dela mesma.
- **Sentido de dependência:** `canvas → unit-run → preview → values`, sem ciclo (D27). O `preview` nunca importa o `unit-run`; o `values` não importa ninguém do editor. Sentido contrário exige ADR nova.
- **Reexport transitório:** `unit-run/index.ts` reexporta `formatApiNumber` e `readBrazilianNumber` de `../values`, só porque `sources/filters/filterRules.ts` ainda importa de `unit-run`. Quando a tarefa dona do `sources/filters` passar a importar de `../values`, o reexport sai.
- **Novos formatadores de valor** vão para `values/`, não para `preview` nem para `unit-run`.

## Alternativas consideradas

- **Manter as cópias no `preview`:** duas fontes da verdade para o mesmo formato; já era provisório na 0056.
- **Formatadores no `unit-run`, com o `preview` importando dele:** cria ciclo, pois o `unit-run` já depende do `preview`.
- **Mexer no `sources/filters` na F94:** fora da posse da tarefa; fica como pendência.

## Consequências

- **Bom:** uma só implementação de números e datas; sem ciclo; o formato muda em um lugar.
- **Ruim:** o reexport em `unit-run/index.ts` é dívida até o `sources/filters` migrar.
- **A fazer:** trocar o import em `sources/filters/filterRules.ts` para `../values` e remover o reexport.
