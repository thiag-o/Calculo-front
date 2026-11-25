# 0036. Testes e2e servem o shell compilado (`vite preview`) e aquecem a página antes dos testes

- **Status:** aceita, revisar no checkpoint (complementada por [0071](0071-e2e-visual-compara-pixels-com-mascara.md))
- **Data:** 2026-11-18
- **Quem decidiu:** orquestração (tarefa F35)
- **Relacionadas:** ADR 0029 (e2e por épico), ADR 0030 (glob com `fallback()`), que esta complementa

## Contexto

A 0030 tratou a lentidão dos testes pelo lado da simulação. Na F35 mediu-se outra causa: com o Vite dev, a primeira página de cada teste (contexto novo, sem cache) baixava 41 módulos sem empacotar (só o zod tem 2,3 MB). Com 6 workers, abrir `/sign-in` custava de 11 a 18 s dos 30 s do teste. Num servidor dev reaproveitado, a primeira visita ainda otimiza dependências do `@fluxo/react` e recarrega a página (5 a 8 s).

## Decisão

- O `pnpm e2e` (nos dois modos) compila o shell uma vez e o serve com `vite preview` na porta 5173, no lugar do Vite dev. Isso vale para os testes de todos os épicos.
- A saída vai para `node_modules/.cache/e2e-shell` (fora do `dist/` do repositório). A compilação acontece aqui, e não pelo `pnpm build`, para que o `VITE_API_URL` seja o da execução.
- O limite de subida do servidor é de 180 s (a compilação roda antes de ele responder). Um servidor já aberto na 5173 é reaproveitado fora do CI, com o `VITE_API_URL` que ele tiver; a fixture falha se ele chamar outra API.
- Um `globalSetup` (`e2e/support/global-setup.ts`) abre `/sign-in` uma vez, fora do tempo dos testes, e espera o botão "Entrar". Ele nunca chama a API: responde `/v1/**` com 401 (`EXAMPLES.NoSession`) e CORS, reaproveitando `API_ROUTES` e `isApiCall` da 0030. Serve nos dois modos.
- A página de embed (porta 5274, hospedeiro) continua no Vite dev.

## Alternativas consideradas

- **Manter o Vite dev e só aquecer:** não resolve os 41 módulos por contexto novo. Descartada.
- **Usar o `pnpm build` do repositório:** o `VITE_API_URL` ficaria o da compilação anterior e sujaria o `dist/`. Descartada.
- **Aquecer chamando a API real:** acopla o aquecimento ao back e quebra no modo simulado. Descartada.

## Consequências

- **Bom:** testes mais rápidos e estáveis com vários workers; uma falha de renderização do shell aparece uma vez, no setup.
- **Ruim:** cada execução paga uma compilação (cerca de 10 s, mais com a máquina ocupada). O teste roda sobre o código compilado, sem HMR. Um servidor reaproveitado pode estar com outra API.
- **A fazer:** épicos novos não precisam configurar nada; só não devem depender do Vite dev no shell.
