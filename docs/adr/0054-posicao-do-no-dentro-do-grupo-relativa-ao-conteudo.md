# 0054. Posição de um nó dentro de um grupo é relativa à área de conteúdo do grupo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-21
- **Quem decidiu:** orquestração (tarefa F65)
- **Relacionadas:** ADR 0044; D23 do plano; B126 (back), E5-19

## Contexto

O contrato do rascunho tem `position` em cada nó e em cada grupo, mas não dizia a partir de onde ela conta quando o nó está dentro de um grupo. O exemplo `DraftWithSources` (nó `td` em 0,0 dentro do grupo em 240,0) só faz sentido se for relativa ao grupo; em coordenadas absolutas, os blocos se sobreporiam. O motor não lê a posição, mas o front, as demais telas e o `prepare-local` do back geram e leem esse dado. A D23 decidiu a regra e a B126 a fixa na descrição do contrato.

## Decisão

- No grupo raiz, o `position` é relativo ao canvas.
- O `position` de um grupo é o canto do contêiner no grupo pai (ou no canvas, se for raiz).
- O `position` de um nó de dentro conta a partir da área de conteúdo do grupo (`GROUP_CONTENT`, 196 × 52: depois da barra de Input e do cabeçalho). Vale em qualquer profundidade.
- Dentro de um grupo, a posição nunca fica negativa.
- Agrupar, Desagrupar, "Mover para o grupo…" e "Tirar do grupo" convertem as posições para que nada se mova na tela.
- Quem gera rascunhos (telas, `prepare-local` do back, exemplos) segue a mesma regra.

## Alternativas consideradas

- **Coordenadas absolutas do canvas:** mover um grupo exigiria reescrever todos os nós de dentro, e o exemplo do contrato sobreporia blocos.
- **Relativa ao canto do contêiner:** o React Flow aceita, mas o cabeçalho e a barra de Input ocupam esse canto; a área de conteúdo evita um deslocamento fixo em cada nó.

## Consequências

- **Bom:** mover ou recolher um grupo não mexe nos nós de dentro; casa com o `parentId` do React Flow.
- **Ruim:** a conversão é obrigatória em toda ação que muda o pai de um nó; o tamanho de `GROUP_CONTENT` vira parte do contrato implícito.
- **A fazer:** a B126 descreve a regra no contrato; geradores de rascunho do back seguem a regra.
