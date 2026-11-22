# 0029. Testes e2e: `apoio/` por épico com fixture estendida e cópia única dos exemplos do contrato

- **Status:** aceita, revisar no checkpoint (complementada por [0030](0030-simulacao-e2e-intercepta-por-glob-com-fallback.md) e [0060](0060-e2e-simulado-valida-respostas-contra-o-contrato.md))
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F21)
- **Relacionadas:** ADR 0005 (tipos pelo OpenAPI)

## Contexto

Os testes ponta a ponta rodam no modo simulado (API em memória) e no modo real (back no ar), com os mesmos arquivos. O épico 1 criou `e2e/apoio/` (fixture, simulação, `contrato.ts`). No épico 2 apareceram rotas novas e 28 exemplos novos de erro do contrato. Uma primeira versão copiou os exemplos para `e2e/epico-2/apoio/contrato-epico-2.ts`, o que deixava duas cópias para conferir com o `openapi.yaml`. Nenhuma ADR cobria os e2e.

## Decisão

- Cada épico tem a sua pasta `e2e/epico-N/apoio/`, com `fixtures.ts` que **estende** a fixture de `e2e/apoio` e `simulacao.ts` com as rotas do épico.
- A simulação do épico registra a rota depois da do épico 1, então responde primeiro e guarda o estado de todas as páginas do teste (`novaPagina()` abre outro navegador para outra pessoa).
- Os exemplos do contrato têm **uma cópia só**, o `EXEMPLOS` de `e2e/apoio/contrato.ts`. Todo épico acrescenta os seus ali, e `e2e/apoio/exemplos-contrato.spec.ts` confere a cópia com o `openapi.yaml`. Não se criam arquivos de contrato por épico.
- Teste que só faz sentido com o back (CORS, CSRF) fica pulado no modo simulado.

## Alternativas consideradas

- **Contrato por épico (`contrato-epico-N.ts`):** duplica exemplos e exige uma conferência por épico. Descartada.
- **Uma simulação única para todos os épicos:** o arquivo cresce sem limite e todo épico mexe nele. Descartada.
- **Fixture própria sem estender a base:** repete login, sessão e instalação da simulação. Descartada.

## Consequências

- **Bom:** padrão pronto para os próximos épicos; o contrato tem uma fonte só.
- **Ruim:** `e2e/apoio/contrato.ts` é compartilhado, então cada épico precisa mexer num arquivo que não é dele (a tarefa deve ter `e2e/apoio` na posse). A ordem de registro das rotas importa.
- **A fazer:** os próximos épicos criam `e2e/epico-N/apoio/` do mesmo jeito.
