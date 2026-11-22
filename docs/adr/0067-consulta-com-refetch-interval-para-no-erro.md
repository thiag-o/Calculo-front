# 0067. Consulta que se atualiza sozinha para no erro, e a tela oferece "Tentar de novo"

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-22
- **Quem decidiu:** sessão global, registrada pela orquestração (tarefa F102)
- **Relacionadas:** ADRs 0008, 0015; `useExecution`, `useExecutionList`

## Contexto

O painel (2 s) e a lista de execuções atualizam por `refetchInterval` até um estado final. Com o React Query, uma atualização que falha (403, 404, rede) mantém os dados antigos e o ciclo continua, repetindo o pedido com erro a cada ciclo e escondendo o problema.

## Decisão

- Toda consulta com `refetchInterval` devolve `false` quando `query.state.status === 'error'`.
- A tela mostra um `Notice` de erro sobre os dados antigos, com a mensagem pelo `code` e o botão "Tentar de novo" (`refetch`). Os últimos dados continuam visíveis.
- Um `refetch` bem-sucedido tira o Notice e religa o ciclo, porque o intervalo é reavaliado.
- Vale hoje para `useExecution` e `useExecutionList`, e para as próximas consultas com atualização automática.

## Alternativas consideradas

- **Continuar tentando a cada ciclo:** pedidos inúteis em 403 e 404, e erro invisível.
- **Recuo progressivo (backoff):** mais código por pouco ganho; a pessoa decide quando tentar de novo.
- **Trocar a tela inteira por erro:** perde o progresso que a pessoa já via.

## Consequências

- **Bom:** sem pedidos repetidos com erro; a tela não perde o contexto; regra igual em todas as consultas.
- **Ruim:** uma queda curta de rede para a atualização até a pessoa agir.
- **A fazer:** novas consultas com `refetchInterval` seguem a regra e levam teste "falha no meio da atualização".
