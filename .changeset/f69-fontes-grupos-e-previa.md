---
"@fluxo/react": minor
---

Fontes, grupos e execução unitária no editor (F63 a F69, épico 5). O `<Editor>` (e o `<Workflows>`, que o monta) passa a trabalhar com a fonte do lote, o bloco Fonte e os grupos.

- Propriedades: a barra **Fonte do lote** (que toma o lugar da barra Entradas quando o workflow tem fonte do lote) abre as propriedades dela, com dataset, variáveis, chave, filtros e ordenação; o bloco **Fonte** (Linear ou Filtro) e o **Grupo** têm as próprias propriedades, e o Cálculo e a Tabela de Decisão abrem também quando estão dentro de um grupo.
- Barra de ferramentas: **Fonte** (escolhe o dataset do catálogo e já traz as variáveis dele) e **Agrupar**, ao lado de Cálculo e Tabela de Decisão. As camadas mostram "Fonte do lote" no lugar de "Entradas".
- Painel inferior: nova aba **Prévia**, entre Problemas e Calcular, com `workflows.edit` ou `simulations.run`. Com fonte do lote, o **Calcular** pede a chave do registro (ou escolhe um da amostra da prévia) e mostra o trace.
- Canvas: depois de um Calcular, cada bloco e cada grupo mostra o status e os valores do último cálculo, com a faixa "Os valores são do último cálculo" e **Limpar**; qualquer edição limpa os valores.
- Papéis: o Configurador monta fontes e grupos; o Aprovador roda a prévia e o Calcular e não edita; o Auditor vê tudo só para leitura, sem Prévia e sem Calcular.
