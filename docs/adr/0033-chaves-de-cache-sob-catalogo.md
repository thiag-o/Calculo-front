# 0033. Chaves de cache do Catálogo sob `['catalog', …]`, invalidadas pelo prefixo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-17
- **Quem decidiu:** orquestração (tarefa F31)
- **Relacionadas:** ADRs 0003, 0008, 0015, 0020, 0023

## Contexto

O Catálogo tem sub-verticais (conexões, datasets, arquivos Excel, variáveis). Elas mostram dados que dependem uns dos outros: o dataset exibe o nome da conexão, e um dataset novo aparece nas outras abas. Pela ADR 0003, uma sub-vertical não importa as chaves de outra. A F30 (conexões) e a F31 (datasets) já usam `['catalog']` como raiz, seguindo a ADR 0020, mas a regra do catálogo não estava escrita.

## Decisão

- Toda consulta do Catálogo usa chave que começa com `['catalog', …]` (ex.: `['catalog','datasets','list']`).
- Depois de uma mutação, invalidamos o prefixo `['catalog']` inteiro, **menos** o detalhe que a própria mutação acabou de gravar com `setQueryData` (ADR 0023).
- Cada sub-vertical declara as próprias chaves, mesmo para ler o mesmo endpoint de outra. A F31 lê `GET /v1/connections` e `GET /v1/excel-files` em `['catalog','datasets','connections' | 'excel-files']`, sem importar as chaves da F30 e da F32.
- As chaves não levam o tenant: a troca de tenant reinicia o cache (ADR 0015).

## Alternativas consideradas

- **Importar as chaves de outra sub-vertical:** cria dependência entre elas e quebra a ADR 0003.
- **Invalidar só as chaves da própria sub-vertical:** as outras abas ficariam com dados velhos.
- **Estender a ADR 0020 para cobrir o catálogo:** a 0020 é da Administração; uma ADR própria deixa cada área com sua raiz.

## Consequências

- **Bom:** sub-verticais desacopladas; as novas já nascem atualizadas.
- **Ruim:** refaz mais buscas do que o necessário; o mesmo endpoint pode ficar em duas chaves e ser buscado duas vezes; a regra é convenção, sem verificação automática.
- **A fazer:** a F34 (montagem do catálogo) confere que as sub-verticais seguem a regra.
