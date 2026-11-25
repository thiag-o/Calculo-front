# 0079. Sino do incorporado entra na barra do `Tabs` por portal, como paliativo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-25
- **Quem decidiu:** orquestração (tarefa F139)
- **Relacionadas:** design.md E7-27, ADRs 0003, 0027, 0076

## Contexto

No modo incorporado, o sino de alertas (0076) precisa ficar na mesma linha das abas da tela. A barra das abas é desenhada pelo `Tabs` (`design-system/display`), que não tem lugar para ações extras. O `EmbeddedLayout` (módulo) não consegue pôr o sino ali dentro sem mexer no design system.

## Decisão

- `EmbeddedLayout` procura o elemento `.fc-tabs-bar` com `querySelector` e põe o `NotificationBellSlot` nele por `createPortal`, só quando a tela tem abas.
- Isso liga o módulo a uma classe interna do design system. É um paliativo aceito, não um padrão: outras telas não devem repetir o truque.
- O caminho limpo é o `Tabs` ganhar um slot de ações (por exemplo `actions`) e o módulo passar o sino por ele. Quando isso existir, o portal e o `querySelector` saem.

## Alternativas consideradas

- **Slot de ações no `Tabs` agora:** é o certo, mas muda o componente compartilhado e seus testes numa tarefa de acabamento. Fica para depois.
- **Sino acima das abas, em linha própria:** ocupa altura e foge do desenho da E7-27.

## Consequências

- **Bom:** o sino aparece onde o desenho pede, sem mexer no `Tabs`.
- **Ruim:** renomear `fc-tabs-bar` ou mudar o `Tabs` quebra o sino sem erro de tipo; só os testes do módulo avisam.
- **A fazer:** criar o slot de ações no `Tabs` e remover o portal; ao fazer isso, marcar esta ADR como substituída.
