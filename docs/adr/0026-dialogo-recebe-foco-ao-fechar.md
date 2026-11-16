# 0026. `Dialogo` recebe `focoAoFechar` para devolver o foco

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F37)
- **Relacionadas:** ADRs 0003, 0012, 0013, 0014; substitui a [0022](0022-foco-de-volta-em-dialogo-aberto-por-menu.md)

## Contexto

Diálogo aberto por item de `Menu` não tem gatilho próprio, e o Radix não sabe para onde devolver o foco ao fechar. A ADR 0022 resolveu isso na tela (`data-*` no gatilho, `focus()` ao fechar) e previu que, ao repetir, o `Dialogo` do design system aceitaria o elemento de retorno. A F16 repetiu (hook `useFocoDeVolta`) e a F14 usava `setTimeout`. A F37 é a tarefa prevista.

## Decisão

- O `Dialogo` aceita a prop opcional `focoAoFechar`: uma referência (`RefObject<HTMLElement | null>`) ou uma função que devolve o elemento, chamada só ao fechar.
- Está ligada a `onCloseAutoFocus`: com elemento, cancela o padrão do Radix e foca nele; sem a prop (ou sem elemento), vale o comportamento do Radix.
- O `data-*` continua só como forma de a tela achar o "…" da linha, buscando dentro da própria seção (ref da seção, nunca `document`). Se a linha sumiu ou o diálogo era de criação, a função devolve o botão principal da tela.
- Telas novas usam `focoAoFechar={() => elemento}`. Não há hook nem `setTimeout` de foco na tela.
- Removidos: o hook `useFocoDeVolta` (`integracao/focoDeVolta.ts`) e o `setTimeout` de `Usuarios`.

## Alternativas consideradas

- **Manter a regra da 0022 (foco na tela):** cada tela repetia código, e a própria 0022 pedia a mudança na terceira repetição.
- **Só referência, sem função:** a linha do menu muda e some; a função resolve o elemento na hora de fechar.
- **Buscar no `document`:** pode pegar elemento de outra instância do módulo no hospedeiro.

## Consequências

- **Bom:** o foco volta ao ponto certo com uma prop; sem código repetido nas telas; testado no `Dialogo` (Esc, Fechar e Cancelar).
- **Ruim:** o `data-*` segue sendo convenção, sem verificação automática.
- **A fazer:** nada.
