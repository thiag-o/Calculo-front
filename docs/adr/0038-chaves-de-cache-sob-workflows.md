# 0038. Chaves de cache dos Workflows sob `['workflows', …]`, com filtro em objeto e limpeza na exclusão

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F48)
- **Relacionadas:** ADRs 0003, 0008, 0015, 0020, 0023, 0033

## Contexto

Workflows é uma vertical nova. Duas telas leem a lista: a própria lista (F48) e o Início (F57), que quer só os 6 mais recentes. Pela ADR 0003, o Início usa as consultas exportadas pela vertical Workflows. Se as duas pedissem a mesma chave com parâmetros diferentes, uma sobrescreveria a outra. Além disso, a exclusão (F49) precisa deixar o cache sem dados de um workflow que não existe mais.

## Decisão

- Toda consulta de Workflows usa chave que começa com `['workflows', …]`:
  - lista: `['workflows','list',filtro]`;
  - detalhe: `['workflows',id]`;
  - rascunho: `['workflows',id,'draft']`.
- O `filtro` é um objeto normalizado `{ name?, limit? }`: nome sem espaços nas pontas, e campo vazio some da chave. O Início usa `{ limit: 6 }` e não colide com a lista.
- Criar e editar gravam a resposta em `['workflows',id]` (ADR 0023) e invalidam as listas (`['workflows','list']`).
- `useDeleteWorkflow` remove do cache o detalhe e o rascunho (`removeQueries`) e invalida as listas. Quem chama só navega no `onSuccess`.
- As chaves não levam o tenant: a troca de tenant reinicia o cache (ADR 0015).
- A vertical exporta as chaves e os hooks pelo `index.ts`; quem precisa de lista com outro filtro usa o hook, não monta chave.

## Alternativas consideradas

- **Chave com o filtro em posições soltas (`['workflows','list',name,limit]`):** campos opcionais viram `undefined` na posição e geram chaves diferentes para o mesmo pedido.
- **Início filtrar no cliente a lista completa:** busca mais do que precisa e depende da paginação da lista.
- **A tela de exclusão limpar o cache:** cada chamador teria de lembrar; o risco é deixar detalhe e rascunho velhos.
- **Estender as ADRs 0020 e 0033:** cada área tem a sua raiz; uma ADR própria mantém isso.

## Consequências

- **Bom:** lista e Início convivem sem colisão; exclusão deixa o cache coerente em um só lugar; segue o padrão das outras áreas.
- **Ruim:** invalidar `['workflows','list']` refaz todas as listas abertas; a normalização é convenção do hook, sem verificação automática.
- **A fazer:** F49 e F57 usam os hooks e as chaves como estão, sem criar chaves próprias.
