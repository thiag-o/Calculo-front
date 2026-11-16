# 0025. POST que só lê ou verifica vira `useQuery` com `staleTime: Infinity`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F17)
- **Relacionadas:** [0008](0008-consumo-da-api-pelas-verticais.md), [0015](0015-cache-na-troca-de-identidade-e-tenant.md)

## Contexto

`POST /v1/redefinicao/verificacao` usa POST para o token ir no corpo e não na URL, mas não consome o link e não muda nada. A tela precisa dos estados de carregando e erro, e de "Tentar de novo". As ADRs 0008 e 0015 tratam consulta como GET com `signal`.

## Decisão

- Um POST sem efeito (verificação, busca com corpo) é um `useQuery`, não um `useMutation`.
- Usa `staleTime: Infinity`, para não repetir a chamada ao remontar ou refocar a janela.
- Repassa o `signal` no `queryFn`, como manda a ADR 0015.
- POST que muda estado continua `useMutation`.

## Alternativas consideradas

- **`useMutation` disparada num efeito:** exige controlar à mão carregando, erro, repetição e execução dupla do StrictMode.
- **Passar o token na URL com GET:** o token apareceria em histórico, logs e cabeçalho `Referer`.

## Consequências

- **Bom:** estados de consulta prontos; sem chamada repetida.
- **Ruim:** quem lê vê POST dentro de `useQuery` e pode achar estranho; vale um comentário no código. A chave de cache leva o token, que fica na memória até o `gcTime`.
- **A fazer:** nada.
