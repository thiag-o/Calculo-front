# 0028. Telas avulsas funcionam sozinhas, com provedor interno do módulo

- **Status:** aceita, revisar no checkpoint
- **Data:** 2026-11-16
- **Quem decidiu:** orquestração (tarefa F38), a partir da decisão da sessão global (opção A, problema levantado na F28)
- **Relacionadas:** [0002](0002-pacote-react-sem-iframe.md), [0003](0003-codigo-por-verticais.md), [0006](0006-roteamento-interno-e-configuracao-do-modulo.md), [0015](0015-cache-na-troca-de-identidade-e-tenant.md), [0016](0016-isolar-roteador-do-modulo-com-contextos-unsafe.md), [0019](0019-encerramento-de-sessao-no-modulo.md), [0027](0027-telas-de-abas-controladas-e-secoes-do-menu.md) (complementa)

## Contexto

A ADR 0002 promete "componentes por tela". Na F28 (guia de incorporação) ficou claro que as telas cruas exportadas (`<Administracao>`, `<Inicio>`, `<Auditoria>`) não rodam sozinhas: exigem raiz, cliente da API, cache e roteador montados por quem usa. O hospedeiro não deveria conhecer essas peças internas.

## Decisão

- **Provedor interno.** `modulo/ProvedorModulo.tsx` reúne raiz (tema e portais), cliente da API (cookie ou Bearer), `QueryClient` próprio e encerramento da sessão. É usado pelo `<FluxoCalculo>` e por cada tela avulsa. O pacote não o exporta.
- **Telas avulsas em `modulo/avulso/`**, sem vertical nova (a ADR 0003 continua valendo: as verticais não importam o `modulo`). O `src/index.ts` exporta as avulsas no lugar das telas cruas; as cruas seguem nos `index.ts` das verticais, só para uso interno.
- **Props das avulsas:** `apiUrl`, `token?`, `tema?`, `onEvento?`, `onSessaoExpirada?` (`TelaAvulsaProps`). Sem `token`, usa cookie.
- **Navegação sempre em memória**, isolada do roteador do hospedeiro (ADR 0016). Não há `navegacao` nem `tela`.
- **Permissão conferida na entrada.** Sem ela, a tela mostra "sem acesso" e não chama a API. Início é aberto a todos; Auditoria pede `auditoria.ver`; Administração pede ao menos uma área (`PERMISSOES_ADMINISTRACAO`) e mostra só as sub-abas permitidas.
- **Cada avulsa é independente:** raiz, tema, cache e sessão próprios. Duas na mesma página não dividem cache. Quem quer cache comum usa o `<FluxoCalculo>`.
- **Mudança na interface pública (complementa a 0027):** `<Administracao>`, `<Inicio>` e `<Auditoria>` exportados deixam de aceitar `aba?` e `aoTrocarAba?` e passam a receber as props acima. O controle de aba pela rota (ADR 0027) continua só dentro do módulo, usando a tela crua.

## Alternativas consideradas

- **Hospedeiro monta os provedores:** expõe peças internas, e cada hospedeiro erraria a montagem (raiz, portais, cache).
- **Exportar o provedor e manter as telas cruas:** o contrato público cresce e vira dívida de semver.
- **Vertical nova para as avulsas:** não há domínio novo; seria fronteira sem função.
- **Cache compartilhado entre avulsas:** acopla instâncias e complica a troca de identidade (ADR 0015).

## Consequências

- **Bom:** `<Administracao apiUrl=... />` funciona sozinho; o `<FluxoCalculo>` e as avulsas têm uma só montagem de sessão e cache; o hospedeiro não conhece peças internas.
- **Ruim:** quebra de interface pública (`aba?`/`aoTrocarAba?` saem; vale versão maior ou changeset adequado se já publicado). Duas avulsas na página repetem consultas, pois não dividem cache.
- **A fazer:** `pnpm build` e o typecheck do casca contra o `dist/` novo. O Catálogo (épico 3) deve seguir o mesmo padrão de avulsa.
