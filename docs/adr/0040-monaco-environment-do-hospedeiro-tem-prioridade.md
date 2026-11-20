# 0040. `MonacoEnvironment` do hospedeiro tem prioridade; o pacote só define o dele se faltar

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-20
- **Quem decidiu:** orquestração (tarefa F52)
- **Relacionadas:** ADR 0037 (complementa), ADR 0002

## Contexto

A ADR 0037 diz que `MonacoEnvironment.getWorker` aponta para o worker local do pacote. Mas `MonacoEnvironment` é uma variável global da página, e o módulo é incorporado em hospedeiros sem iframe. Um hospedeiro que já usa Monaco tem o worker dele (com serviços de linguagem). Se o pacote sobrescrevesse, quebraria o editor do hospedeiro.

## Decisão

- O carregador (`loadMonaco.ts`) só define `MonacoEnvironment.getWorker` se o hospedeiro ainda não tiver um. Se tiver, o hospedeiro fornece o worker e o pacote não mexe.
- O worker do pacote é o genérico (`editor.worker`), sem serviços de linguagem. A linguagem `fluxo-formula` é feita só com Monarch no thread principal.
- O tema do Monaco também é global na página. O editor define um tema por conjunto de cores (`fc-formula-<cores>`) e o reaplica no foco; dois módulos com temas diferentes na mesma página só se corrigem ao focar o editor. Fica registrado no código.

## Alternativas consideradas

- **Sempre sobrescrever:** quebra o Monaco do hospedeiro.
- **Nunca definir (exigir do hospedeiro):** quebra o "instalar e usar" da 0037.

## Consequências

- **Bom:** convive com hospedeiro que já usa Monaco; sem configuração no caso comum.
- **Ruim:** com worker do hospedeiro, o comportamento depende dele. O tema global pode piscar com dois módulos de temas diferentes até o foco.
- **A fazer:** nada.
