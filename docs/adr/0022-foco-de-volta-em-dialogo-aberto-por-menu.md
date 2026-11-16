# 0022. Diálogo aberto por item de Menu: a tela devolve o foco pelo `data-*` do gatilho

- **Status:** substituída por [0026](0026-dialogo-recebe-foco-ao-fechar.md)
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F14)
- **Relacionadas:** ADRs 0003, 0012, 0013, 0014

## Contexto

Quando um diálogo abre a partir de um item de `Menu`, o `Dialogo` do design system não tem gatilho próprio, e o Radix não sabe para onde devolver o foco ao fechar. O foco se perde no `body`, o que prejudica o uso por teclado.

## Decisão

- A tela marca o botão "…" de cada linha com um atributo `data-fc-<nome>` (ex.: `data-fc-acoes-usuario="<id>"`).
- Ao fechar o diálogo, a tela procura esse elemento só dentro da própria seção (ref da seção, nunca `document`) e chama `focus()`.
- Se o elemento sumiu (linha removida) ou o diálogo era de criação, o foco vai para o botão principal da tela ("Novo usuário").
- Se mais telas repetirem isso, o `Dialogo` do design system passa a aceitar uma referência do elemento de retorno, e esta ADR é substituída.

## Alternativas consideradas

- **Alterar o `Dialogo` agora:** muda o design system por um único uso; adiado até repetir.
- **Buscar no `document`:** pode pegar elemento de outra instância do módulo no hospedeiro.
- **Deixar o foco cair no `body`:** falha de acessibilidade.

## Consequências

- **Bom:** foco volta ao ponto certo sem mexer no design system.
- **Ruim:** cada tela repete um pouco de código; o `data-*` é convenção, sem verificação automática.
- **Atualização (tarefa F16):** o gatilho de repetição foi atingido. A tela de integração (F16) é a segunda a devolver o foco pelo `data-*`, agora num hook local `useFocoDeVolta`. A decisão continua valendo e a ADR segue aceita; a mudança no `Dialogo` fica para uma tarefa própria do design system (que substituirá esta ADR). Uma terceira tela deve esperar essa tarefa, não copiar o hook.
- **A fazer:** tarefa do design system para o `Dialogo` aceitar a referência do elemento de retorno.
