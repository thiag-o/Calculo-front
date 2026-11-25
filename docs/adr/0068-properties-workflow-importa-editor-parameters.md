# 0068. `properties/workflow` importa `editor/parameters/index.ts`, com ciclo permitido entre as duas

- **Status:** aceita, revisar no checkpoint (complementada por [0072](0072-parameters-importa-sources-e-filter-list-recusa-parametros.md): `editor/parameters` importa `sources`, em um sentido só)
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F98)
- **Relacionadas:** ADRs 0003, 0042, 0047, 0052; `packages/react/src/editor/properties/workflow/`, `packages/react/src/editor/parameters/`

## Contexto

Na F98 nasce a sub-vertical `editor/parameters/` (seções Parâmetros e Execução). O painel do workflow (`properties/workflow`) monta as duas seções, então importa `parameters`. Já `parameters` reusa peças de `properties/index.ts` (campos, mensagens), como a 0047 permite a outras sub-verticais. Resulta num ciclo de módulos igual ao da 0052 (`properties/workflow` e `sources/batch-source`). O lint de fronteiras não acusa, pois o elemento é `editor`. Nenhum lado usa o outro ao carregar o módulo, só ao renderizar.

## Decisão

- `properties/workflow` pode importar de `editor/parameters/index.ts`, e só dele (ADR 0003).
- `parameters` pode importar de `properties/index.ts` (já previsto na 0047).
- O ciclo é aceito com a mesma regra da 0052: nenhum lado usa o import do outro no carregamento do módulo (nada no topo do arquivo que dependa do outro). Por isso `WorkflowProperties.tsx` escreve ele mesmo os dois `path` da Execução (`settings.error_limit_percent`, `settings.trace_level`) em vez de importá-los.
- O sentido vale só para `properties/workflow` e `parameters`. Outras sub-verticais não entram no ciclo sem ADR nova.
- Se aparecer erro de ordem de carregamento ou uma terceira sub-vertical no ciclo, as peças comuns vão para uma pasta comum do editor (como a 0047 e a 0061 já apontam).

## Alternativas consideradas

- **Injetar as seções no painel por render props (como na 0059):** evitaria o import, mas o painel do workflow ganharia uma ligação extra, e as seções são parte fixa dele.
- **Pôr `parameters` dentro de `properties/workflow/`:** apaga a fronteira da sub-vertical, que tem peças próprias (literais, regras, problemas).
- **Mover agora as peças de `properties` para uma pasta comum:** resolve o ciclo, mas é trabalho grande e fora da posse da F98.

## Consequências

- **Bom:** o painel mostra as duas seções sem duplicar campos; `parameters` reaproveita as peças de `properties`.
- **Ruim:** mais um ciclo de módulos; mudar a assinatura de um lado exige olhar o outro.
- **A fazer:** no checkpoint, avaliar a pasta comum de peças do editor junto com o ciclo da 0052.
