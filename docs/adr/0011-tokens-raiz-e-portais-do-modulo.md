# 0011. Tokens `--fc-*` só na raiz do módulo, tema pela `RaizFluxo` e portais por `usePortalFluxo()`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F3)
- **Relacionadas:** [0002](0002-pacote-react-sem-iframe.md) (cumpre o "a fazer" dele), [0003](0003-codigo-por-verticais.md), [0010](0010-css-do-pacote-em-dois-caminhos.md)

## Contexto

Sem iframe (ADR 0002), o CSS do módulo convive com o do hospedeiro. O pacote não pode mudar nada fora dele, o hospedeiro precisa poder sobrescrever as variáveis, e os portais do Radix, por padrão no `body`, perderiam tema e fonte.

## Decisão

- **Tokens:** todo `--fc-*` é declarado só dentro de `:where(.fc-raiz…)`, nunca em `:root`. O `:where()` deixa a especificidade em zero, então o hospedeiro sobrescreve com `.fc-raiz { --fc-…: … }`. Aliases (`--fc-text`, `--fc-primary`…) apontam por `var()` para os tokens de base.
- **Tema:** claro em `.fc-raiz`; escuro em `.fc-raiz[data-theme='dark']`; tema `sistema` (sem `data-theme`) por `@media (prefers-color-scheme: dark)` com os mesmos valores do escuro.
- **`<RaizFluxo tema className>`:** `div.fc-raiz` que traduz `claro | escuro | sistema` em `data-theme`, aplica a base de texto e contém o contêiner `div.fc-portais` (`display: contents`).
- **Portais:** `const portal = usePortalFluxo(); … {portal && <X.Portal container={portal}>…}`. O hook devolve `null` na primeira renderização e lança erro fora da `RaizFluxo`, para nenhum portal cair no `body`.
- **Regra para as verticais:** CSS de componente usa só classes `.fc-*` e variáveis `--fc-*`; token novo só em `.fc-raiz`. O teste `raiz/sem-estilo-global.test.ts` varre todos os `.css` do pacote e reprova seletor global, seletor sem `fc-`, `--fc-*` fora de `.fc-raiz` e `@import`.

## Alternativas consideradas

- **Tokens em `:root`:** vazam para o hospedeiro e brigam com as variáveis dele.
- **Shadow DOM:** isola por completo, mas atrapalha tema, portais e a integração com o Radix.
- **Portais no `body`:** perdem tema, fonte e escopo de classes.
- **Tema `sistema` por JavaScript (`matchMedia`):** exige estado e causa troca visível na primeira renderização; o `@media` resolve só no CSS.

## Consequências

- **Bom:** nada vaza para o hospedeiro; o hospedeiro sobrescreve qualquer token; o padrão é verificado por teste.
- **Ruim:** todo conteúdo deve estar dentro da `RaizFluxo`; todo portal exige `usePortalFluxo()` e a checagem de `null`.
- **A fazer:** F4, F5 e seguintes seguem o padrão. O jsdom não avalia `prefers-color-scheme`; o tema `sistema` no escuro é conferido pela igualdade das declarações, não pelo valor calculado.
