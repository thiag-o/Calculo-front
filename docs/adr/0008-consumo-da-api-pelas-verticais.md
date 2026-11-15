# 0008. Verticais consomem a API por `useClienteApi()`, `dadosOuErro()` e `ErroApi.codigo`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F6)
- **Relacionadas:** [0003](0003-codigo-por-verticais.md), [0005](0005-tipos-da-api-pelo-openapi.md), [0006](0006-roteamento-interno-e-configuracao-do-modulo.md)

## Contexto

A F6 criou o cliente da API (openapi-fetch) em `packages/react/src/api/`. Todas as verticais dos épicos 1 e 2 vão fazer consultas e mutações, então o jeito de chamar a API e de tratar erro será repetido muitas vezes. A ADR 0005 já manda decidir pelo `codigo` do problem+json, mas não define como isso chega na tela.

## Decisão

- **Chamada:** a vertical pega o cliente com `useClienteApi()` e envolve cada chamada em `dadosOuErro(cliente.METODO('/v1/...'))`. Ela devolve os dados ou lança `ErroApi`. Quem importa vem só do `index.ts` de `api`.
- **Erro:** `ErroApi` tem `status`, `codigo`, `mensagem`, `campos` (sempre existe, pode ser vazio) e `corpo` (problem+json inteiro, com membros de extensão). A tela decide por `erro instanceof ErroApi && erro.codigo === '...'`, nunca pelo texto.
- **Códigos que nascem no front:** `sem_conexao` (falha de rede, status 0) e `resposta_inesperada` (erro sem problem+json). São reservados ao cliente: o back não deve usar esses slugs.
- **Autenticação:** modo cookie (`credentials: 'include'` e `X-CSRF-Token` lido de `fc_csrf` em POST, PUT, PATCH e DELETE) ou modo token (`Authorization: Bearer`, `credentials: 'omit'`, sem CSRF). O critério é `token !== undefined`, então `token: ''` é modo token e vira `401 sem_sessao` em vez de cair em silêncio no cookie. O modo token não manda cookie para não misturar duas identidades (e tenants) na mesma requisição.
- **Repetição:** consultas repetem até 3 vezes só em falha passageira (rede, 5xx, desconhecida), nunca em 4xx. Mutações nunca repetem.
- **Sessão expirada:** o cliente avisa por `aoExpirarSessao` quando vem `401 sem_sessao`. Limpar o cache na troca de tenant ou na expiração é de quem monta o QueryClient (F7, F8), não do cliente.

## Alternativas consideradas

- **Cada vertical usar `fetch` ou o openapi-fetch direto:** repete CSRF, erros e repetição em todo lugar, e some o padrão.
- **Hooks gerados (orval):** já descartado na ADR 0005.
- **Cliente que lança erro sem `dadosOuErro`:** o openapi-fetch devolve `{ data, error }` e `error` fica vazio em erro sem corpo; decidir por `response.ok` num único ponto evita esse furo.

## Consequências

- **Bom:** tratamento de erro, CSRF e repetição iguais em todas as verticais; testes simples (mock do cliente pelo provedor).
- **Ruim:** as verticais dependem de `ErroApi` e dos dois códigos reservados; mudar o formato exige mexer em todas.
- **A fazer:** registrar no contrato do backend que `sem_conexao` e `resposta_inesperada` são reservados ao cliente.
