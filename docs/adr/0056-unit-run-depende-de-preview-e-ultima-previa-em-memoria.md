# 0056. `unit-run` depende de `preview` (só nesse sentido), e a última prévia fica em memória, exposta por `useLastPreview`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F66, D25)
- **Relacionadas:** ADRs 0003, 0025, 0042, 0045, 0048; `packages/react/src/editor/preview/`, `packages/react/src/editor/unit-run/`

## Contexto

A aba Prévia (F66) devolve amostras de registros. A aba Calcular (F67) usa essas amostras no "Escolher registro". Então o `unit-run` precisa ler a última prévia do `preview`. A F66 também importava `formatApiNumber` do `unit-run`, o que fecharia um ciclo entre sub-verticais. A sessão global decidiu o sentido (D25, opção A).

A última prévia precisa sobreviver a fechar e abrir a aba (o painel monta só a aba aberta), sem ir a `localStorage`. A rota é tratada como consulta (ADR 0025), com `gcTime: 0`, então o cache do TanStack não serve para guardá-la.

## Decisão

- **Sentido de dependência:** só `editor/unit-run` importa de `editor/preview`, e só pelo `preview/index.ts`. O `preview` não importa o `unit-run`. Sentido contrário exige ADR nova.
- **Duplicação provisória:** o `preview` mantém cópias locais do formatador de número e do de data (`preview/values.ts`, com comentário). A F94 leva os dois para `editor/values/`, usado pelos dois, e remove as cópias.
- **Última prévia:** fica num store em memória por `QueryClient` (`useSyncExternalStore`), fora do cache do TanStack, no padrão da ADR 0045. A chave é `pessoa:tenant:workflow`. O store é esquecido por `onSessionDataCleared` (ADR 0048), no logout e na troca de pessoa ou tenant.
- **Interface:** `useLastPreview` sai em `preview/index.ts`. A F67 lê `groups[0].records[].record_key` por ele.

## Alternativas consideradas

- **`unit-run` e `preview` se importando:** ciclo entre sub-verticais, difícil de desfazer.
- **Formatadores no `unit-run` e `preview` importando de lá:** o sentido fica errado, pois o `unit-run` já depende do `preview`.
- **Criar `editor/values/` já na F66:** foge da posse da F66 e da F67 em andamento; vira a F94.
- **Guardar a prévia no cache do TanStack (`setQueryData`):** a coleta e a limpeza por prefixo a apagariam sem relação com a tela (mesmo motivo da 0045).
- **`localStorage`/`sessionStorage`:** proibido pelo design para dado de trabalho.

## Consequências

- **Bom:** sem ciclo; a F67 reaproveita a amostra sem nova chamada; nada persiste.
- **Ruim:** dois formatadores duplicados até a F94; recarregar a página perde a prévia (intencional).
- **A fazer:** a F94 remove as cópias. Se um terceiro uso do padrão do store aparecer, avaliar o helper comum já previsto na 0045.
