# 0030. Simulação e2e intercepta a API por glob `**/v1/**` com `route.fallback()`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F39)
- **Relacionadas:** ADR 0029 (e2e por épico), que esta complementa

## Contexto

A simulação do modo `simulado` interceptava as chamadas com `page.route` e um filtro em função. Com o Vite dev, cada página aberta serve cerca de 40 módulos, e cada um ia e voltava do processo do teste só para ser liberado (cerca de 115 idas e voltas no teste da auditoria, medido na F39). Isso estourava o tempo dos testes do épico 2.

## Decisão

- A simulação registra a rota com o glob `ROTAS_DA_API` (`**/v1/**`), que o Playwright confere sem chamar o processo do teste.
- Dentro do handler, `ehChamadaDaApi(route, origemCasca)` refina o filtro (só `/v1/...` e fora da origem do casca). Se não for chamada da API, o handler chama `route.fallback()`.
- As simulações dos próximos épicos usam o mesmo glob e o mesmo `ehChamadaDaApi`, sem filtro por função no `page.route`. Como a do épico registra depois, o `fallback()` passa a chamada adiante para a rota do épico anterior (ver 0029).

## Alternativas consideradas

- **Filtro por função em `page.route`:** custo de uma ida e volta por módulo do Vite. Descartada.
- **Só o glob, sem `ehChamadaDaApi`:** o glob pega `/v1/` também na origem do casca. Descartada.

## Consequências

- **Bom:** testes simulados bem mais rápidos; padrão único para os épicos.
- **Ruim:** o glob é largo, então o refinamento no handler é obrigatório e `fallback()` não pode ser esquecido.
- **A fazer:** os próximos épicos reutilizam `ROTAS_DA_API` e `ehChamadaDaApi` de `e2e/apoio/api-simulada.ts`.
