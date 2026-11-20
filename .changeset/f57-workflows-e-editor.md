---
"@fluxo/react": minor
---

Workflows e editor (F57, épico 4). O pacote exporta `<Workflows>` (e o tipo `WorkflowsProps`), a tela com a lista, a Visão geral de cada workflow e o editor; funciona sozinha, como `<Home>`, `<Catalog>`, `<Audit>` e `<Admin>`, e pede `workflows.view`.

- `<FluxoCalculo>`: novo item "Workflows" no menu e aba no modo incorporado, com `workflows.view`. A prop `screen` aceita `'workflows'`.
- Rotas internas no modo `url`: `/workflows`, `/workflows/:id` e `/workflows/:id/editor`. O editor ocupa o módulo inteiro (sem o menu lateral no app casca, sem as abas no modo incorporado).
- App casca: com um workflow aberto, o seletor de contexto mostra "cliente › workflow" e o menu do workflow tem só "Visão geral".
- Início: "Workflows recentes" com os dados reais (até 6) e o botão "Novo workflow".
- Papéis: quem só vê (Operador, Auditor) abre o editor para leitura, sem "Calcular"; o Aprovador vê "Calcular" e não edita; sem `workflows.view` (Integrador) o item não aparece.
