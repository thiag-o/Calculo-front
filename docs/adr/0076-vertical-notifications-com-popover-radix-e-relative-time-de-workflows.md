# 0076. Vertical `notifications/` importa `workflows/index.ts` e usa `@radix-ui/react-popover`

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F130)
- **Relacionadas:** design.md E7-27, ADRs 0003, 0011, 0049, 0067, 0069, 0070

## Contexto

O sino de alertas (F130) é uma vertical nova, `notifications/`. Ele mostra "há 5 min" em cada alerta, e o `relativeTime` já existe e é exportado por `workflows/index.ts`. A E7-27 pede um popover Radix, e o pacote `@radix-ui/react-popover` não estava instalado. O sino só entra na tela na F131, que decide a permissão e as rotas.

## Decisão

- `notifications/` pode importar `workflows/index.ts`, só para o `relativeTime`. O sentido é um só: `workflows` não importa `notifications`, então não há ciclo.
- Adicionamos `@radix-ui/react-popover` (`^1.3.1`) ao `@fluxo/react`. As dependências dele já estão no pacote por causa do dropdown-menu e do dialog. O build o trata como externo, como os demais `@radix-ui/*`. O popover fica direto em `notifications/`, com portal na raiz do módulo (0011). Não criamos componente novo no `design-system`.
- `<NotificationBell>` não conhece rotas nem permissões. Recebe `onOpenExecution(executionId)` e `onOpenSchedules(workflowId)`, e quem o hospeda liga as rotas e confere `executions.view`, como no padrão `onOpen…` (0070).
- Chaves de cache sob `['notifications', …]`, exportadas com `NOTIFICATIONS_REFRESH_MS`.

## Alternativas consideradas

- **Mover `relativeTime` para `design-system/format/` (0069):** é o lugar certo a longo prazo, mas mexe em `workflows` e em `home` numa tarefa que não é deles. Fica como melhoria futura.
- **Copiar o `relativeTime` em `notifications/`:** duplica a regra de texto de tempo, e a 0069 proíbe cópias.
- **Montar o popover com o `Dialogo` ou o `Menu` existentes:** nenhum dos dois serve para um painel não modal com links e foco devolvido ao botão.

## Consequências

- **Bom:** um só texto de "há X min" no produto; popover acessível (Esc, foco, portal) sem código próprio.
- **Ruim:** `notifications` passa a depender de `workflows` só por uma função de formatação. Mais uma biblioteca Radix para manter.
- **A fazer:** mover `relativeTime` para `design-system/format/` quando alguém mexer nele; a F131 liga o sino e as rotas.
