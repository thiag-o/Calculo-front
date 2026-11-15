# 0007. Fixar TypeScript 6 e usar o resolver TypeScript no eslint-plugin-boundaries

- **Status:** aceita, revisar no checkpoint. Complementada por [0009](0009-imports-internos-no-mesmo-elemento-das-fronteiras.md) (imports internos no mesmo elemento)
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F1)
- **Relacionadas:** [0003](0003-codigo-por-verticais.md), [0004](0004-monorepo-pnpm-vite-changesets.md)

## Contexto

Na tarefa F1 (scaffold) a verificação de fronteiras da ADR 0003 foi configurada com `eslint-plugin-boundaries` v7. Sem um resolver, os imports sem extensão (`./x` em vez de `./x.ts`) não eram vistos pelo plugin e a regra não pegava nada. Além disso, `typescript-eslint` e `vite-plugin-dts` ainda não aceitam TypeScript 7.

## Decisão

- Usamos `eslint-plugin-boundaries` v7 junto com `eslint-import-resolver-typescript`. O resolver é obrigatório para as fronteiras funcionarem.
- Fixamos o TypeScript em `^6` no monorepo, até `typescript-eslint` e `vite-plugin-dts` suportarem a versão 7.

## Alternativas consideradas

- **Sem resolver, exigindo extensão em todo import:** feio, vai contra o padrão do projeto e é fácil de esquecer.
- **TypeScript 7:** quebra o lint e a geração dos `.d.ts` do pacote.

## Consequências

- **Bom:** as fronteiras entre verticais passam a ser realmente verificadas no CI.
- **Ruim:** uma dependência de desenvolvimento a mais; o TypeScript fica uma versão maior atrás.
- **A fazer:** subir para o TypeScript 7 quando as duas ferramentas aceitarem. A primeira tarefa que criar uma vertical deve validar a configuração das fronteiras (arquivos soltos em `src/` e imports internos da mesma vertical).
