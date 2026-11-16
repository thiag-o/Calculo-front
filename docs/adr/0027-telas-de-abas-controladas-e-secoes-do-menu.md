# 0027. Telas de abas controláveis pela rota e seção do menu como uma aba no incorporado

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F19), a partir da resposta D6 do dono do produto
- **Relacionadas:** [0003](0003-codigo-por-verticais.md), [0006](0006-roteamento-interno-e-configuracao-do-modulo.md) (complementa)

## Contexto

A resposta D6 pede que, no modo incorporado, as abas de topo sejam os mesmos itens do menu lateral, e que a aba Administração mostre o `<Administracao>` com sub-abas. No casca, o menu tem um item por área (Usuários, Papéis, Integração, Segurança). Uma vertical não pode importar o `modulo` (ADR 0003), mas a rota precisa acompanhar a aba interna. O Catálogo (épico 3) terá o mesmo desenho.

## Decisão

- **Tela de abas é controlável.** `<Administracao>` aceita `aba?` e `aoTrocarAba?`. Sem elas, guarda a aba sozinha (uso avulso). Com elas, quem usa decide. Escolher a aba já aberta não avisa ninguém. Uma `aba` sem permissão abre a primeira permitida. O módulo liga cada aba a uma rota. Outras telas de abas (ex.: `<Catalogo>`) seguem o mesmo padrão.
- **Seção do menu vira uma aba no incorporado.** `DefinicaoTela.secao` define as abas de topo: uma por tela solta e uma por seção. A aba da seção aponta para a primeira área permitida, fica ativa em qualquer área e some se nenhuma for permitida.
- **`TelaFluxo` ganha `'administracao'`**, que abre a primeira área permitida; a rota `/administracao` faz o mesmo. É acréscimo à interface pública; nada sai.
- **No casca**, cada área abre a mesma `<Administracao>` na aba dela. Menu lateral e aba interna mostram a mesma área, sincronizados pela rota.

## Alternativas consideradas

- **Aba interna só por estado, sem rota:** quebra link direto e o "voltar" no casca, e deixa menu e aba fora de sincronia.
- **A vertical importar o roteador do módulo:** fere a ADR 0003.
- **Seis abas planas no incorporado:** foi a primeira versão; foge da D6 e cresce a cada item novo.
- **Casca sem abas internas:** possível trocando o `conteudo` das áreas em `telas.tsx`; deixado ao portão.

## Consequências

- **Bom:** um componente só para casca, incorporado e avulso; endereço, menu e abas andam juntos; padrão pronto para o Catálogo.
- **Ruim:** no casca a área aparece duas vezes (menu e aba). O CSS das abas está repetido entre `administracao` e o incorporado.
- **A fazer:** componente `Abas` no design system, numa tarefa própria. A F20 exporta `Administracao` e o novo `TelaFluxo`.
