# 0061. `editor/definition/` é a pasta comum do editor para leituras puras da definição

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-22
- **Quem decidiu:** orquestração (tarefa F109, D33 opção A, decidida pela sessão global)
- **Relacionadas:** ADRs 0003, 0042, 0047, 0052, 0057, 0059 (complementa 0057 e 0059); `packages/react/src/editor/definition/`

## Contexto

`allNodes`, `producedNames`, `variableNameCounts` e `locateNode` existiam copiados em `groups`, `properties`, `sources/source-block` e `values`. A 0047, a 0052 e a 0059 adiaram a "pasta comum do editor" por causa dos ciclos entre sub-verticais. A 0003 proíbe `shared/`.

## Decisão

- **Nova sub-vertical `editor/definition/`**, com nome que não é `shared/`. É folha: importa só o tipo de `../draft` (e `api`). Qualquer sub-vertical do editor importa dela pelo `index.ts`.
- **Entra:** funções puras e tipos que leem a `WorkflowDefinition` e que mais de uma sub-vertical usa: `allNodes`, `producedNames`, `declaredVariableNames`, `variableNameCounts`, `locateNode` (devolve `{ node, path, groups }`), e os tipos `DefinitionNode`, `GroupNode`, `NodePlace`.
- **Não entra:** edição da definição, componente, hook, estado, nem nada que dependa de outra sub-vertical.
- **Semântica fixada:** `producedNames` de um grupo devolve o Output dele; `declaredVariableNames` e `variableNameCounts` ignoram grupos (o Output repete nomes de dentro).
- **Ajuste da 0057:** `values/` continua folha, mas passa a importar de `definition/` (também folha). Onde a 0057 diz "só importa de dentro dela mesma", leia "dela e de `definition/`". O sentido fica `canvas → unit-run → preview → values → definition`.
- **Ampliação da 0059:** o canvas também importa `sources/source-block`, só por `sources/index.ts` (`defaultOutputs`, `defaultOrder`, `toLinearMode`). Sem volta, sem ciclo. Sai a pendência "padrões duplicados" da 0059; `properties/definition.ts`, `groups/tree.ts` e `source-block/sourceNode.ts` reexportam de `definition/` o que os vizinhos já importavam.

## Alternativas consideradas

- **Manter as cópias:** o nome de variável e o lugar do nó podem divergir entre sub-verticais.
- **Pasta `shared/` ou `common/`:** proibida pela 0003; vira depósito.
- **Uma sub-vertical dona (por exemplo `groups`) e as outras importando dela:** cria ciclos que a 0052 já mostrou ser difíceis.

## Consequências

- **Bom:** uma só implementação de cada leitura; sem ciclo; as fronteiras do eslint seguem verdes.
- **Ruim:** `definition/` pode atrair código que não é leitura pura; a regra "não entra" precisa ser cobrada na revisão. Sobram `canvas/graph.ts` (`producedNames(block)`, embrulho de uma linha) e o motor simulado do e2e.
- **A fazer:** `canvas/graph.ts` pode exportar o `producedNames` do `groups` direto, sem embrulho.
