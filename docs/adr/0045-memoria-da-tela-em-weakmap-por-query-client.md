# 0045. Lembrar na tela sem persistir: `WeakMap` por `QueryClient`, com chave de pessoa, tenant e item

- **Status:** aceita, revisar no checkpoint (corrigida por [0048](0048-limpeza-unica-da-sessao-e-telas-remontadas.md): a memória não some com o cache, ela se registra em `onSessionDataCleared`)
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F55)
- **Relacionadas:** design.md §1 (princípio 3), ADRs 0015, 0019, 0043

## Contexto

A aba Calcular precisa lembrar os valores digitados quando a aba ou o editor fecha e abre de novo. O design proíbe `localStorage` e `sessionStorage` para dado de trabalho. Outro caso igual já existe: `trackDraftSave` (ADR 0043) e a memória de mudanças não salvas (F74) guardam estado fora do React, num `WeakMap` por `QueryClient`. É um padrão que as próximas telas vão repetir.

## Decisão

- Estado que deve "durar enquanto o módulo está aberto, mas não ser persistido" fica num `WeakMap<QueryClient, Map<string, T>>` no módulo da vertical.
- A chave inclui `usuário:tenant:item` (na F55, `usuário:tenant:workflow`). Outra pessoa ou outro tenant no mesmo módulo não vê o valor.
- Nada vai a `localStorage`, `sessionStorage` nem a cookie.
- O `Map` é lido e gravado fora do `setState` (o updater pode rodar duas vezes). O estado do React só espelha o valor.
- O tempo de vida é o do `QueryClient`: quando a troca de identidade ou o encerramento da sessão reinicia o cache (ADRs 0015 e 0019), o valor some junto.

## Alternativas consideradas

- **`localStorage`/`sessionStorage`:** quebra o princípio 3 e vaza valores entre pessoas no mesmo navegador.
- **Cache do TanStack Query (`setQueryData`):** a limpeza do cache por prefixo ou a coleta (`gcTime`) apagaria o valor sem relação com a tela.
- **Só estado do React:** perde os valores ao fechar a aba ou o editor.
- **Contexto global no módulo:** precisa de provedor novo e não acompanha a troca de `QueryClient`.

## Consequências

- **Bom:** padrão único, sem persistência, isolado por pessoa e tenant, limpo junto com o cache.
- **Ruim:** recarregar a página do navegador perde tudo; é intencional.
- **A fazer:** nova memória desse tipo repete a chave `usuário:tenant:item` e documenta o que guarda. Se aparecer um terceiro uso igual, avaliar extrair um helper comum.
