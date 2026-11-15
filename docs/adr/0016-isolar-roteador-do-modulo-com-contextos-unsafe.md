# 0016. Isolar o roteador do módulo do react-router do hospedeiro com os contextos `UNSAFE_` do react-router

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-15
- **Quem decidiu:** orquestração (tarefa F8)
- **Relacionadas:** [0006](0006-roteamento-interno-e-configuracao-do-modulo.md) (complementa), [0002](0002-pacote-react-sem-iframe.md)

## Contexto

No modo `memoria` (ADR 0006), o módulo cria um roteador próprio. Se o hospedeiro também usa react-router (caso comum), os contextos do roteador dele vazam para dentro do módulo e o roteador em memória falha ou lê a URL do hospedeiro. O react-router 8 só permite isolar isso pelos contextos exportados com prefixo `UNSAFE_` (Location, Navigation, Route, DataRouter*, Fetchers, ViewTransition, Framework). O `react-router` está como dependência (`^8.5.1`), não como peer.

## Decisão

- O módulo reinicia os contextos `UNSAFE_*` do react-router na sua raiz, para o roteador interno não enxergar o do hospedeiro.
- Há um teste com hospedeiro que tem `Router` próprio; ele é o aviso se uma versão do react-router mudar esses nomes.

## Alternativas consideradas

- **Pedir ao hospedeiro que não use react-router:** inviável, é o caso comum.
- **Roteador próprio por estado:** já descartado na ADR 0006.
- **Montar o módulo em iframe:** contraria a ADR 0002.

## Consequências

- **Bom:** o módulo funciona dentro de hospedeiros com react-router, sem tocar na URL deles.
- **Ruim:** `UNSAFE_` não tem garantia de estabilidade. Uma versão maior do react-router pode quebrar o isolamento. Como a dependência não é peer, o hospedeiro pode ter uma cópia diferente do react-router, e então os contextos nem são compartilhados.
- **A fazer:** fixar a versão do `react-router` (sem `^`, ou limitar à major 8) e avaliar `peerDependency`. Só subir de major rodando o teste do hospedeiro.
