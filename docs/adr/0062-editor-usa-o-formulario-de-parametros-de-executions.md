# 0062. O editor usa o formulário de parâmetros de `executions/index.ts`

- **Status:** aceita, revisar no checkpoint (complementada por [0063](0063-executions-le-workflows-pela-api-e-chaves-proprias.md) , [0066](0066-painel-da-execucao-chaves-de-registros-e-render-prop-do-trace.md) e [0073](0073-formulario-de-parametros-exige-workflow-id-e-modo-agendamento-irmao.md))
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F100)
- **Relacionadas:** plano.md E6-16; ADRs 0003, 0050, 0055; `packages/react/src/executions/index.ts`, `packages/react/src/executions/parameter-form/`

## Contexto

O formulário de parâmetros de uma execução (F100) é usado em dois lugares: no disparo da execução, em `executions/`, e na prévia e no "Calcular" do editor. O plano (E6-16) já decidiu que ele mora em `executions/parameter-form/` e é exportado pelo `executions/index.ts`. Isso cria a dependência `editor` -> `executions`, que não existia. Até aqui o sentido era o contrário ou não havia ligação.

## Decisão

- `executions/index.ts` exporta `ParameterForm`, `useParameterForm`, `initialFieldState`, `parameterErrorsFrom`, `readParameters`, `RELATIVE_LABELS` e os tipos do formulário (`WorkflowParameter`, `ParameterFormValues` e afins).
- O `editor` pode importar esses nomes, e só eles, de `executions/index.ts`. Não importa o interior de `executions/`.
- `executions` não importa nada de `editor/`, nem pelo `index.ts`. O sentido é um só: editor -> executions. Se `executions` precisar de algo do editor, recebe por props ou render props (como na 0050).
- Os rótulos dos valores relativos (`RELATIVE_LABELS`) ficam num lugar só, em `executions`, e o editor os reaproveita para mostrar o padrão do parâmetro.
- Outro nome de `executions` que o editor passe a usar entra no `index.ts` do mesmo jeito, um por vez, com a tarefa registrada no relatório.

## Alternativas consideradas

- **Pôr o formulário em `editor/`:** `executions` passaria a depender do editor, que é a vertical maior e mais instável.
- **Copiar o formulário nas duas verticais:** duplica a regra de validação e os rótulos, e as duas telas divergem.
- **Pasta comum fora das verticais:** a ADR 0003 não prevê pasta comum para tela com regra de produto. Só o design-system e a base técnica ficam fora.
- **Receber o formulário por props, do `Workflows`:** liga o editor ao formulário por fora sem ganho. O editor precisa do estado do formulário dentro da prévia.

## Consequências

- **Bom:** uma regra só de leitura e erro dos parâmetros, igual no disparo e na prévia.
- **Ruim:** mudar a assinatura do formulário exige olhar o editor. `executions` e `editor` não podem formar ciclo.
- **A fazer:** nada. Se o lint de fronteiras não barrar o sentido contrário (`executions` -> `editor`), reforçar a regra.
