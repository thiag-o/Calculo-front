# 0050. `<Workflows>` recebe o editor por `renderEditor`, e o editor abre em rota irmã de tela cheia

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F57)
- **Relacionadas:** ADR 0003 (verticais), ADR 0006 (roteamento), ADR 0042 (contrato do editor), ADR 0048 (telas remontadas)

## Contexto

A vertical `workflows` (lista e Visão geral) abre o editor, que é outra vertical (`editor`). Importar uma da outra criaria dependência entre verticais, o que a ADR 0003 proíbe. O editor também precisa de tela cheia, sem menu lateral nem abas.

## Decisão

- `<Workflows>` recebe `renderEditor(props)` e, opcional, `renderUnsavedNotice(props)`. Quem junta as duas verticais é o módulo (`module/screens.tsx`), que importa as duas. `workflows` não importa `editor`.
- O editor é a rota `workflows/:id/editor`, irmã do layout, fora de `ShellLayout` e de `EmbeddedLayout`. A localização (`/workflows`, `/workflows/:id`, `/workflows/:id/editor`) é lida do endereço pelo módulo e passada a `<Workflows>` por `location`/`onLocationChange`.
- Regra para o futuro: vertical que precisa mostrar outra recebe a peça por `render*` do módulo, não importa.

## Alternativas consideradas

- **Importar `editor` dentro de `workflows`:** quebra a fronteira da ADR 0003.
- **Abrir o editor dentro do layout com menu:** tira espaço do canvas; o design pede tela cheia.
- **Excepcionar a fronteira no eslint:** abre precedente; render props custam pouco.

## Consequências

- **Bom:** fronteiras intactas; `workflows` testa sem o editor.
- **Ruim:** o módulo concentra a ligação; o editor não herda o remonte do `Outlet` (ADR 0048), então precisa remontar pela geração por conta própria.
- **A fazer:** nenhuma.
