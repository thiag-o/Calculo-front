---
"@fluxo/react": minor
---

Catálogo (F34, épico 3). O pacote exporta `<Catalog>` (e o tipo `CatalogProps`), a tela com as abas Conexões, Datasets e Arquivos e o detalhe de uma conexão, de um dataset ou de um arquivo; funciona sozinha, como `<Home>`, `<Audit>` e `<Admin>`, e pede `connections.view`.

- `<FluxoCalculo>`: novo item "Catálogo" no menu e aba no modo incorporado, com `connections.view`. A prop `screen` aceita `'catalog'`.
- Rotas internas no modo `url`: `/catalog`, `/catalog/connections/:id`, `/catalog/datasets`, `/catalog/datasets/:id`, `/catalog/files` e `/catalog/files/:id`.
- Arquivos: o envio em andamento pode ser cancelado; um 413 mostra o tamanho máximo, sem "Tentar de novo"; remover um arquivo tira o detalhe dele do cache.
- Dataset: se a lista de variáveis falha, a coluna "Variáveis" avisa e oferece "Tentar de novo"; o diálogo da variável fecha assim que a API confirma; um tipo que a coluna não aceita mais aparece marcado ao editar.
