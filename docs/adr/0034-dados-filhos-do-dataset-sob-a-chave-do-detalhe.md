# 0034. Dados filhos do dataset ficam sob a chave do detalhe e são gravados com `setQueryData`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-17
- **Quem decidiu:** orquestração (tarefa F33)
- **Relacionadas:** ADRs 0023, 0033

## Contexto

A ADR 0033 manda invalidar o prefixo `['catalog']` depois de uma mutação, menos o detalhe que a mutação gravou. Na F33, as variáveis são dados filhos do dataset. Remover, renomear ou atualizar as colunas do dataset preserva o detalhe, e as variáveis precisam acompanhar esse destino. Se ficassem em outra chave, seriam buscadas de novo, inclusive depois de remover o dataset (404).

## Decisão

- Dados que pertencem a um dataset usam chave sob o detalhe: `['catalog','datasets','detail',id,'variables']`.
- Nas mutações desses dados, a lista é atualizada por `setQueryData` (como na 0023) e o resto de `['catalog']` é invalidado, **menos o detalhe do dataset e seus filhos**.
- Isso complementa a 0033: a exceção "menos o detalhe" vale também para as chaves abaixo dele.
- Quem criar outro dado filho de dataset segue o mesmo caminho.

## Alternativas consideradas

- **Chave própria `['catalog','variables', datasetId]`:** o prefixo do detalhe não a alcança. Ela seria invalidada e buscada de novo a cada mutação do dataset, inclusive após remover (404).
- **Invalidar tudo, sem exceção:** simples, mas refaz buscas e pode mostrar erro de um dataset que já foi removido.

## Consequências

- **Bom:** variáveis e dataset mudam juntos, sem buscas extras.
- **Ruim:** quem muda o detalhe precisa lembrar que os filhos ficam de fora da invalidação; é convenção, sem verificação automática.
- **A fazer:** a F34 confere esta regra junto com a 0033.
