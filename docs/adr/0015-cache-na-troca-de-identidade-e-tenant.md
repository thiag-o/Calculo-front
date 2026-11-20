# 0015. Trocar de identidade ou tenant: cancelar, gravar a sessão e reiniciar o cache, com `signal` em toda consulta

- **Status:** aceita, revisar no checkpoint (complementada por [0019](0019-encerramento-de-sessao-no-modulo.md), [0048](0048-limpeza-unica-da-sessao-e-telas-remontadas.md) e [0049](0049-marca-da-sessao-antes-de-gravar-no-cache.md); a 0048 troca o `resetQueries` e o "sair" por `replaceSessionInCache` e `clearSessionData`)
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F7)
- **Relacionadas:** [0008](0008-consumo-da-api-pelas-verticais.md) (complementa), [0003](0003-codigo-por-verticais.md)

## Contexto

A ADR 0008 deixou a limpeza do cache na troca de tenant ou na expiração para quem monta o QueryClient. A F7 implementou isso em `useEntrar`, `useTrocarTenant` e `useSair`. As chaves de consulta não levam o tenant, então os dados de um tenant ficariam no cache depois da troca. Uma resposta atrasada do tenant anterior também poderia voltar ao cache e aparecer ao lado do tenant novo. Todas as verticais seguintes vão ter consultas sujeitas a isso.

## Decisão

- **Trocar tenant (e entrar sobre uma identidade anterior):** no sucesso, num lote só, (1) cancelar as consultas em andamento, (2) gravar no cache a sessão nova devolvida pela API (sem novo `GET`) e (3) `resetQueries` em todas as outras consultas, exceto `['sessao']`. Nenhuma renderização mostra o tenant novo com dados do anterior.
- **Sair:** no sucesso, cancelar as consultas e remover o cache inteiro. Em erro (`csrf_invalido`), nada muda. Quem chama navega no `onSuccess`.
- **`403 sem_acesso_ao_tenant` ao trocar:** buscar a sessão de novo, porque a lista de tenants mudou.
- **Obrigação de toda vertical:** repassar o `signal` do TanStack no `queryFn` (`cliente.GET(..., { signal })`). Sem ele a resposta cancelada ainda é descartada, mas a requisição segue na rede e pode consumir recurso do tenant anterior.
- **Chaves de consulta não levam o tenant.** A limpeza acima é o que garante o isolamento. Quem criar uma consulta nova não precisa fazer nada além do `signal`.
- Limpar o cache quando a sessão expira continua para a F8 (quem monta o `QueryClient` do módulo).

## Alternativas consideradas

- **Tenant na chave de cada consulta:** o cache antigo ficaria guardado sem uso e cada vertical teria de lembrar de incluir o tenant. Um esquecimento vaza dado entre tenants.
- **`removeQueries` ou `invalidateQueries` em vez de `resetQueries`:** `remove` deixa consultas montadas sem dados até a próxima renderização, e `invalidate` mantém os dados antigos na tela enquanto busca.
- **Recarregar a página:** perde o estado do hospedeiro e não serve a um módulo embutido (ADR 0002).

## Consequências

- **Bom:** um padrão só, testado (com o `resetQueries` removido, 3 testes falham), sem dado do tenant anterior na tela.
- **Ruim:** esquecer o `signal` não quebra nenhum teste de tipo; só aparece como requisição desperdiçada. Toda troca de tenant refaz as consultas montadas.
- **A fazer:** a F8 e as verticais seguintes passam o `signal` no `queryFn` e conferem isso na revisão. Vale um teste ou regra de lint se esquecerem.
