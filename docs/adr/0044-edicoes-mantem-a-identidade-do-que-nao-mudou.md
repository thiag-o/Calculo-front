# 0044. Edições da definição mantêm os mesmos objetos do que não mudou

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F54)
- **Relacionadas:** ADR 0042; `packages/react/src/editor/decision-table/tableModel.ts`

## Contexto

A análise de problemas roda 400 ms depois de cada mudança (ADR 0042). Nesse intervalo, a tela mostra a definição nova com os problemas da definição antiga (`problemsOutdated`). Os problemas apontam por posição (`path`). Se a edição de uma regra movida ou incluída recriar todas as regras, nada diz qual marca pertence a qual regra, e a marca pode cair na vizinha.

## Decisão

- As funções de edição da definição (na grade, `tableModel.ts`) são puras e devolvem uma definição nova que **reaproveita os mesmos objetos** das regras, colunas e nós que não mudaram. Só o que mudou é recriado.
- Quem mostra problemas de uma análise mais velha liga a marca ao objeto, não só à posição. Assim a marca acompanha a regra movida ou deslocada por uma inclusão, e some com a regra removida.
- Toda edição nova do editor que reordena, inclui ou remove itens segue o mesmo padrão. A F53 (entradas reordenadas) deve usá-lo.
- Cada teste de edição confere a identidade (`toBe`) do que não deveria mudar.

## Alternativas consideradas

- **Dar id a cada regra:** muda o contrato com o backend (modelo de dados); as regras não têm id.
- **Esperar a análise nova e esconder as marcas:** a marca some a cada tecla e pisca.
- **Clonar tudo e aceitar a marca na vizinha:** mostra problema na regra errada por 400 ms.

## Consequências

- **Bom:** marcas corretas durante a espera; também ajuda o `memo` das regras (só redesenha a que mudou, medido na F54).
- **Ruim:** quem edita precisa tomar cuidado para não clonar sem querer; um `structuredClone` ou `map` que recria tudo quebra o padrão (os testes pegam).
- **A fazer:** F53 aplicar o padrão nas entradas.
