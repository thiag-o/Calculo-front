# 0048. Limpar a sessão num lugar só: `clearSessionData`, `replaceSessionInCache`, memórias registradas e telas remontadas por geração

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F76)
- **Relacionadas:** [0015](0015-cache-na-troca-de-identidade-e-tenant.md) (complementa), [0019](0019-encerramento-de-sessao-no-modulo.md) (complementa), [0045](0045-memoria-da-tela-em-weakmap-por-query-client.md) (corrige), [0024](0024-troca-de-token-confere-a-sessao.md)

## Contexto

A ADR 0015 trocava de tenant com `resetQueries` e saía com remoção do cache. Isso deixava três furos. O estado local das telas (formulários, editor com a definição em memória) sobrevivia à troca de pessoa ou de tenant. As mutações encerradas continuavam no cache. E a ADR 0045 dizia que a memória em `WeakMap` sumia junto com o cache, o que é falso: o `QueryClient` não é recriado, então o `WeakMap` nunca era esvaziado. O logout também limpava em dois lugares (o `useSignOut` e o `ModuleProvider`), contra a ADR 0019.

## Decisão

- **Um lugar só** (`session/sessionCache.ts`, exportado por `session/index.ts`):
  - `clearSessionData(queryClient)`: cancela as consultas, faz `queryClient.clear()` (consultas e mutações) e avisa as memórias registradas. Vale para logout e 401.
  - `replaceSessionInCache` (troca de tenant, login, token de outra pessoa): avisa as memórias, remove as consultas que nenhuma tela mostra e as mutações encerradas, grava a sessão nova, zera as consultas montadas e avança a geração, tudo no mesmo lote. Isso substitui o "só `resetQueries`" da 0015.
- **Memórias fora do cache** (a do `WeakMap` da 0045) se registram com `onSessionDataCleared(queryClient, listener)`. Assim o `session` não importa as verticais. Já usam: mudanças não salvas do editor e valores do Calcular (`unit-run/memory.ts`). A "regra de tempo de vida" da 0045 passa a ser esta, não a vida do cache.
- **Telas remontam** com `useSessionGeneration()`, usado como `key` do `<Outlet>` do `ShellLayout` e do `EmbeddedLayout` e do `ModuleRouter` das telas avulsas. O menu lateral não remonta, então o foco fica no seletor de cliente.
- **Logout:** o `useSignOut` não limpa nada. Quem o usa encerra a sessão no módulo (`useEndSession`). O `ModuleProvider` mostra "A sessão terminou" e só então chama `clearSessionData`, uma vez, com a tela já fora (ADR 0019).
- **`lastSessionEnd` não é rearmado** no `ModuleProvider`. No casca, o `onSessionExpired` desmonta o `<FluxoCalculo>` e o login monta um módulo novo. No incorporado, o fim é por token, e token novo rearma. **Regra para telas avulsas:** o hospedeiro deve remontar o módulo depois de um novo login.
- **Memória nova do tipo 0045** deve se registrar em `onSessionDataCleared` ao nascer.

## Alternativas consideradas

- **Recriar o `QueryClient` na troca:** perde o estado do hospedeiro e quebra quem guarda a referência do cliente.
- **Manter `resetQueries`:** deixa mutações e consultas sem uso no cache, e não remonta o estado local das telas.
- **Rearmar `lastSessionEnd` no mesmo módulo:** não há caso real e arrisca avisar o hospedeiro várias vezes (o que a 0019 evita).
- **Cada memória escutar o cache por conta própria:** espalha o acoplamento e permite esquecer.

## Consequências

- **Bom:** um caminho só para logout, 401, troca de tenant e de pessoa; nada da pessoa anterior fica na tela, no cache ou na memória.
- **Ruim:** telas remontam na troca (o editor aberto perde o estado local). Quem criar memória nova e esquecer de registrar vaza valores até o fim da página.
- **A fazer:** esvaziar o salvamento do editor (`flush`) antes do `PUT /v1/session/tenant`, para não mandar PUT do tenant antigo (hoje o back recusa com 404 e nada é guardado). Documentar a regra de remontar o módulo nas telas avulsas (feito abaixo).

## Telas avulsas em modo cookie (sem código, decidido na F81)

- **O caso:** uma tela avulsa (`<Catalog>`, `<Workflows>`, `<Audit>`…) em modo cookie, fora do casca. Quando a API responde `401`, o módulo limpa a sessão uma vez e avisa `onSessionExpired` uma vez (ADR 0019). Como o `lastSessionEnd` não é rearmado, um novo login na mesma instância não avisaria de novo se a sessão caísse outra vez.
- **Regra:** quem monta uma tela avulsa em modo cookie, ao receber `onSessionExpired`, desmonta o módulo e monta um novo depois de o login terminar, como faz o casca. Com o módulo novo, o fim da sessão volta a ser avisado.
- **Por que não rearmar:** não há caso real na interface pública hoje (o login vive no casca, e no incorporado o fim é por token), e rearmar arrisca avisar o hospedeiro várias vezes. Se um hospedeiro precisar de login dentro do mesmo módulo, abre-se tarefa e ADR próprias.
