# 0002. Front como pacote `@fluxo/react`, sem iframe, com o app casca como hospedeiro zero

- **Status:** aceita
- **Data:** 2026-11-15 (decisão de produto tomada em 2026-11-14)
- **Quem decidiu:** dono do produto
- **Relacionadas:** design.md §3 "Front incorporável", §4 "Incorporação (token)", §18; [0003](0003-codigo-por-verticais.md), [0004](0004-monorepo-pnpm-vite-changesets.md)

## Contexto

O Fluxo de Cálculo será usado dentro de outras aplicações React, e os primeiros hospedeiros são sistemas do próprio dono do produto. Ele também precisa de um app próprio. Manter dois fronts (o app e uma versão incorporável) dobraria o trabalho e criaria diferenças entre eles.

## Decisão

- **Todo o front é o pacote npm `@fluxo/react`.** O app próprio (`apps/casca`) é só uma casca fina, com login próprio e layout, e usa o mesmo pacote: é o **hospedeiro zero**.
- **Sem iframe.** O isolamento é feito no próprio código:
  - classes com prefixo próprio e nenhum reset global de CSS;
  - portais (Radix) dentro da raiz do módulo;
  - rotas internas ao módulo e nada que dependa da janela inteira.
- **O pacote expõe:**
  - `<FluxoCalculo token tela tema onEvento />`;
  - componentes por tela;
  - tema por variáveis CSS `--fc-*`;
  - eventos, só para avisar o hospedeiro;
  - tipos TypeScript.
- **Requisitos do pacote:**
  - React 18 ou 19 como *peer dependency*;
  - Monaco carregado sob demanda;
  - *semver*: mudança incompatível só em versão maior.
- **Autenticação:**
  - incorporado, o pacote recebe um token de curta duração, pedido pelo backend do hospedeiro;
  - no casca, usa a sessão por cookie.

## Alternativas consideradas

- **iframe:** isola por completo, mas atrapalha tema, tamanho, navegação e eventos, e dá uma experiência de "site dentro do site".
- **Web Component ou micro-frontend (Module Federation):** ficam para o futuro e serão gerados do mesmo núcleo (oportunidades-futuras.md, item 10).
- **Dois fronts (app e incorporável):** trabalho dobrado e diferenças entre eles.

## Consequências

- **Bom:** um front só; o casca testa o pacote como um hospedeiro real.
- **Ruim:**
  - o CSS e os portais exigem cuidado para não vazar para o hospedeiro;
  - a connection string passa pelo JavaScript da página hospedeira (aceito, porque o hospedeiro é o próprio tenant).
- **A fazer:** a regra "nada de estilo global" entra na revisão de código e, se possível, num teste automático.
