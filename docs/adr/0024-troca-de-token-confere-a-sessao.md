# 0024. Troca de token no modo token: conferir a sessão com `GET /v1/sessao` e descartar o cache se a identidade mudar

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F17)
- **Relacionadas:** [0019](0019-encerramento-de-sessao-no-modulo.md) (complementa, fecha o "A fazer"), [0015](0015-cache-na-troca-de-identidade-e-tenant.md), [0008](0008-consumo-da-api-pelas-verticais.md)

## Contexto

A ADR 0019 disse que renovar o token da mesma pessoa não limpa o cache, e deixou para a F17 decidir o caso em que o hospedeiro entrega um token de outra pessoa ou de outro tenant. O token é opaco para o módulo: só a API sabe de quem ele é. Sem checagem, os dados da pessoa anterior ficariam no cache ao lado da identidade nova.

## Decisão

- A cada token novo, o `useSessao` cria o cliente e faz um `GET /v1/sessao` com ele.
- **Mesma pessoa e mesmo tenant:** grava a sessão e mantém o cache (renovação normal).
- **Outra pessoa ou outro tenant:** segue a ADR 0015 (cancelar, gravar a sessão, reiniciar o cache).
- **Token novo vencido (`401 sem_sessao`):** chama o `onSessaoExpirada`, uma vez, como na ADR 0019.
- **Resposta de um token que já foi trocado de novo:** é descartada.
- `trocarSessaoNoCache` e `CHAVE_SESSAO` ficam em `sessao/cacheSessao.ts`, sem import circular.

## Alternativas consideradas

- **Sempre limpar o cache a cada token novo:** seguro, mas a renovação periódica refaria todas as consultas e a tela piscaria.
- **Nunca limpar, confiar no hospedeiro:** o módulo não tem como saber que a identidade mudou; risco de dado de outra pessoa na tela.
- **Ler a identidade de dentro do token:** o token é opaco e o formato pode mudar.

## Consequências

- **Bom:** isolamento entre pessoas e tenants também no modo token, sem refazer consultas à toa.
- **Ruim:** um `GET /v1/sessao` extra por renovação de token.
- **A fazer:** nada; o "A fazer" da ADR 0019 está fechado.
