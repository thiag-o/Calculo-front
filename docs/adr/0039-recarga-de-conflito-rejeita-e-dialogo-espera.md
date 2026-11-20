# 0039. Recarga depois de conflito rejeita quando falha, e o diálogo só fecha depois de recarregar

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F56)
- **Relacionadas:** ADRs 0008, 0033

## Contexto

Quando a API responde conflito (`dataset_changed`, `variable_changed`, conexão alterada), a tela mostra a mensagem da API e um botão "Recarregar". A F60 achou que a recarga podia falhar em silêncio: o diálogo fechava e a pessoa seguia vendo dados velhos. O `refetchQueries` do TanStack Query, por padrão, não rejeita quando a consulta falha. Esse fluxo se repete em conexões e datasets, e vai se repetir em outras telas.

## Decisão

- A função de recarga de um conflito usa `refetchQueries(..., { throwOnError: true })`, então rejeita se a consulta falhar (ex.: `useReloadDataset`).
- O diálogo de conflito só fecha depois que a recarga termina com sucesso. Enquanto roda, o botão fica em "carregando".
- Se a recarga rejeitar, o diálogo continua aberto, com o texto digitado, mostra "Não foi possível recarregar agora…" em `role="alert"` e o botão vira "Tentar de novo".
- O componente `ReloadNotice` e as funções `isChangedConflict`, `isCredentialUnreadable` e `conflictMessage` ficam em `catalog/errors/`, que já era o lugar comum de erros do Catálogo (a mensagem é a da API, ou um texto padrão em pt-BR, nunca vazia).

## Alternativas consideradas

- **Recarregar sem esperar e fechar o diálogo:** a falha some e a pessoa edita sobre dados velhos.
- **Tratar o erro dentro de cada tela:** cada tela decidiria de um jeito, e o padrão se perderia.

## Consequências

- **Bom:** a falha da recarga fica visível e a pessoa não perde o que digitou. Telas novas copiam o mesmo padrão.
- **Ruim:** todo chamador da recarga precisa tratar a rejeição.
- **A fazer:** telas de outras verticais com conflito devem seguir este padrão (cada uma com a sua cópia, pela ADR 0003, se não houver lugar comum).
