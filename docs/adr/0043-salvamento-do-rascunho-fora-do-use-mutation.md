# 0043. Salvar o rascunho com função controlada por refs, e ler o rascunho só depois dos salvamentos em voo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F50)
- **Relacionadas:** ADRs 0008, 0025, 0038, 0039, 0042

## Contexto

O rascunho é salvo sozinho, 2 s depois da última mudança. O PUT precisa ser um por vez, sempre sobre a revisão mais recente (senão dá `409 draft_conflict`), e continuar depois que a tela some (saída pelo módulo). `useMutation` morre com o componente e não garante a ordem. Além disso, abrir ou recarregar o rascunho logo depois de sair podia ler uma versão velha enquanto um PUT ainda corria.

## Decisão

- O PUT é a função `saveDraft`, controlada por refs no `DraftEditorProvider`: um por vez, com novo salvamento encadeado se houve mudança no meio, sempre sobre a revisão mais recente. Salva também ao desmontar. A resposta vai para o cache e invalida o workflow com `exact` e as listas.
- Cada salvamento em voo é registrado por `QueryClient` e `workflowId` (`trackDraftSave`, num `WeakMap` em `draft/queries.ts`). `useDraft` e `fetchDraftAgain` (abrir e "Recarregar rascunho") esperam esses salvamentos terminarem (`draftSavesSettled`), inclusive o encadeado.
- `useDraft` usa `refetchOnMount: 'always'`, e a tela só monta o editor com o rascunho lido depois de abrir.
- A análise segue a ADR 0025: POST como consulta, `gcTime: 0`, `staleTime: Infinity`, versão local na chave. Resultado mais velho nunca troca um mais novo.
- Conflito 409 para o salvamento e pede "Recarregar rascunho", que troca a definição local pela do servidor, sem mesclar (segue a 0039).
- Outro caso parecido (salvar algo que deve sobreviver à tela e ordenar com a leitura) usa este padrão.

## Alternativas consideradas

- **`useMutation`:** não sobrevive ao desmonte, não serializa PUTs e não deixa a leitura esperar.
- **Cancelar o PUT ao sair:** perde a edição.
- **Confiar no cache ao reabrir:** abre rascunho velho e gera 409 no salvamento seguinte.

## Consequências

- **Bom:** sem 409 espúrio ao reabrir logo depois de sair; edição não se perde na troca de rota.
- **Ruim:** controle manual com refs é mais difícil de ler que `useMutation`; fechar a aba do navegador perde até 2 s (sem `beforeunload`, pela ADR 0002).
- **A fazer:** quem criar outro salvamento automático avalia este padrão antes de usar `useMutation`.
