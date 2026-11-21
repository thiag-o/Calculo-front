# 0055. O editor lê datasets e variáveis do catálogo por `catalog/index.ts`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F64)
- **Relacionadas:** design.md E5-16, E5-18; ADRs 0003, 0033, 0034; `packages/react/src/catalog/index.ts`, `packages/react/src/catalog/datasets/index.ts`

## Contexto

O bloco Fonte (F64) precisa listar os datasets e as variáveis de um dataset. As consultas `useDatasetList` e `useDatasetVariables` já existiam em `catalog/datasets/queries.ts`, mas o `catalog/index.ts` não expunha nenhuma consulta. Pela ADR 0003, uma vertical só importa de outra pelo `index.ts`. Surge a dependência `editor` -> `catalog`, que ainda não existia. A F63 (fonte do lote) deve precisar das mesmas consultas.

## Decisão

- `catalog/datasets/index.ts` e `catalog/index.ts` exportam `useDatasetList` e `useDatasetVariables`.
- O `editor` pode importar essas duas consultas, e só elas, de `catalog/index.ts`. Não importa o interior do catálogo.
- As chaves de cache continuam as da 0033 e da 0034 (`['catalog', …]`, variáveis sob a chave do detalhe). O editor não cria chave própria para dados do catálogo.
- Outra consulta do catálogo usada pelo editor entra no `index.ts` do mesmo jeito, uma linha por vez, com a tarefa que a pediu registrada no relatório.

## Alternativas consideradas

- **Copiar as consultas no editor:** duplica chave de cache e regra de erro, e o cache do catálogo se parte em dois.
- **Importar `catalog/datasets/queries.ts` direto:** fere a ADR 0003 e o lint.
- **Receber a lista por props, do `Workflows`:** liga o catálogo a cada tela do editor sem ganho, porque o bloco Fonte precisa recarregar ao trocar de dataset.

## Consequências

- **Bom:** uma só fonte de cache para o catálogo, com o tratamento de erro e o "Tentar de novo" iguais em todo o editor.
- **Ruim:** mudar a assinatura dessas consultas exige olhar o editor (F63, F64).
- **A fazer:** a F63 usa o mesmo export. Se o conflito de merge aparecer, manter uma linha só.
