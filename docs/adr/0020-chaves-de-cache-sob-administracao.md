# 0020. Chaves de cache da Administração sob `['administracao', …]`, invalidadas pelo prefixo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F15)
- **Relacionadas:** ADRs 0003, 0008, 0015

## Contexto

As abas da Administração (usuários, papéis e as próximas) mostram dados que dependem uns dos outros. A tela de usuários exibe nomes de papéis e a lista deles. Quando um papel é criado, alterado ou removido, essa tela precisa atualizar. Pela ADR 0003, uma aba não deve importar as chaves de cache de outra.

## Decisão

- Toda consulta da Administração usa chave que começa com `['administracao', …]` (ex.: `['administracao','papeis','lista']`).
- Depois de mutar papéis, invalidamos o prefixo `['administracao']`, **menos** o catálogo de permissões (`['administracao','papeis','permissoes']`), que não muda com essas mutações.
- Mutações de uma aba não importam chaves de outras abas. Quem cria uma aba nova mantém as chaves sob `['administracao', …]`.
- Erros pontuais (ex.: `nao_encontrado`) continuam invalidando só a chave da própria lista.

## Alternativas consideradas

- **Importar as chaves de usuários em papéis:** cria dependência entre abas e quebra a fronteira da ADR 0003.
- **Invalidar só as chaves de papéis:** a tela de usuários ficaria com nomes velhos até recarregar.
- **Evento ou contexto de "papéis mudaram":** mais código para um problema que o prefixo já resolve.

## Consequências

- **Bom:** as abas ficam desacopladas e novas abas se atualizam sem mudar as existentes.
- **Ruim:** invalida mais do que o necessário (refaz buscas de abas montadas); a regra depende de convenção, sem verificação automática.
- **A fazer:** a exceção do catálogo é uma lista que cresce se surgirem outras consultas estáveis; avaliar no checkpoint.
