# 0049. Resposta que grava no cache confere a marca da sessão (`sessionDataMark` e `sameSessionData`)

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F76)
- **Relacionadas:** [0015](0015-cache-na-troca-de-identidade-e-tenant.md) (complementa), [0019](0019-encerramento-de-sessao-no-modulo.md) (complementa), [0048](0048-limpeza-unica-da-sessao-e-telas-remontadas.md), [0043](0043-salvamento-do-rascunho-fora-do-use-mutation.md)

## Contexto

A 0015 cancela as consultas na troca, mas o `signal` só cobre consultas. Uma mutação (por exemplo, salvar o rascunho) que responde depois do logout, do 401 ou da troca de tenant ainda executava `setQueryData` ou `invalidateQueries` e devolvia dado da sessão anterior ao cache já limpo. O mesmo valia para uma troca de tenant que respondia depois de um logout.

## Decisão

- Cada `SessionData` tem um contador. `clearSessionData` e `replaceSessionInCache` o sobem de forma síncrona, antes de cancelar e limpar.
- **Padrão:** quem grava no cache depois de uma requisição guarda `sessionDataMark(queryClient)` antes de pedir e só grava se `sameSessionData(queryClient, mark)` ainda for verdadeiro. Em mutação, a marca vem do `onMutate`.
- Se a marca mudou, não grava nem invalida. A resposta ainda volta a quem chamou. Leituras (`readDraft`) que veem a marca mudar durante o GET leem de novo, na sessão nova.
- Aplicado em `saveDraft`, `readDraft` e `useSwitchTenant`, sem mudar assinaturas (ADR 0042 intacta). `unsavedChanges` usa `sessionDataMark > 0` para recusar mudança depois de uma limpeza.
- **Obrigação das verticais:** mutação nova que grava no cache no `onSuccess` segue este padrão.

## Alternativas consideradas

- **Só o `signal`:** não cobre mutações nem respostas que já chegaram.
- **Guardar tenant e usuário e comparar:** não pega logout seguido de novo login da mesma pessoa e exige ler a sessão em toda gravação.
- **Recriar o `QueryClient`:** ver 0048.

## Consequências

- **Bom:** resposta atrasada não traz dado da sessão anterior de volta, testado (sem a conferência, os 2 testes de salvamento em voo falham).
- **Ruim:** é um padrão a lembrar, sem lint. Hoje não o seguem: `admin/security/queries.ts`, `catalog/connections`, `catalog/datasets`, `catalog/files` e `workflows/queries.ts` (gravam no `onSuccess` sem a marca).
- **A fazer:** tarefa de manutenção para aplicar o padrão nessas verticais (`onMutate: () => sessionDataMark(queryClient)` e `sameSessionData` antes do `setQueryData`).
