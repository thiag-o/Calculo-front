# Decisões de arquitetura (ADRs) · frontend

Uma ADR registra **uma** decisão que afeta a estrutura do código: o que foi decidido, por quê e o que se perde com isso.
O backend tem as dele em `../backend/docs/adr/`. O desenho do produto está em `../docs/design.md`.

## Quando escrever

- Escolha de biblioteca, padrão ou estrutura que seria caro desfazer.
- Exceção a uma ADR aceita (nesse caso, uma ADR nova que substitui a antiga).
- Não precisa de ADR: detalhe que cabe numa revisão de código, ou regra de produto (essa fica no design.md).

## Como escrever

1. Copie [modelo.md](modelo.md) para `NNNN-titulo-curto.md`, com o próximo número.
2. Comece com status **proposta**. Ela passa a **aceita** quando o dono do produto aprova.
3. ADR aceita não é reescrita. Se a decisão mudar, escreva uma nova e marque a antiga como **substituída por NNNN**.
4. Acrescente uma linha na tabela abaixo.

## Índice

| Nº | Decisão | Status | Data |
|---|---|---|---|
| [0001](0001-registrar-decisoes-em-adrs.md) | Registrar decisões de arquitetura em ADRs | aceita | 2026-11-15 |
| [0002](0002-pacote-react-sem-iframe.md) | Front como pacote `@fluxo/react` sem iframe; app casca como hospedeiro zero | aceita | 2026-11-15 |
| [0003](0003-codigo-por-verticais.md) | Código organizado por verticais, com fronteiras verificadas | aceita | 2026-11-15 |
| [0004](0004-monorepo-pnpm-vite-changesets.md) | Monorepo pnpm, Vite em modo biblioteca, Changesets e GitHub Packages | aceita | 2026-11-15 |
| [0005](0005-tipos-da-api-pelo-openapi.md) | Tipos da API gerados do contrato OpenAPI do backend (openapi-typescript + openapi-fetch) | aceita | 2026-11-15 |
| [0006](0006-roteamento-interno-e-configuracao-do-modulo.md) | Roteamento interno com react-router e `apiUrl` no `<FluxoCalculo>` | aceita | 2026-11-15 |
| [0007](0007-ferramentas-de-lint-e-typescript-6.md) | Fixar TypeScript 6 e usar o resolver TypeScript no eslint-plugin-boundaries | aceita, revisar no checkpoint (complementada por 0009) | 2026-11-15 |
| [0008](0008-consumo-da-api-pelas-verticais.md) | Verticais consomem a API por `useClienteApi()`, `dadosOuErro()` e `ErroApi.codigo` | aceita, revisar no checkpoint | 2026-11-15 |
| [0009](0009-imports-internos-no-mesmo-elemento-das-fronteiras.md) | Permitir imports internos dentro do mesmo elemento nas fronteiras do eslint | aceita, revisar no checkpoint | 2026-11-15 |
| [0010](0010-css-do-pacote-em-dois-caminhos.md) | CSS do pacote em dois caminhos: CSS extraído pelo Vite e fontes (`@fontsource`) como import externo | aceita, revisar no checkpoint | 2026-11-15 |
| [0011](0011-tokens-raiz-e-portais-do-modulo.md) | Tokens `--fc-*` só na raiz do módulo, tema pela `RaizFluxo` e portais por `usePortalFluxo()` | aceita, revisar no checkpoint | 2026-11-15 |
| [0012](0012-botao-desabilitado-so-com-motivo.md) | Botão desabilitado só com `motivoDesabilitado` (`aria-disabled`, focável, dica no portal) | aceita, revisar no checkpoint | 2026-11-15 |
| [0013](0013-menu-desabilitado-so-com-motivo.md) | Item de menu desabilitado só com `motivoDesabilitado`, como o botão (complementa 0012) | aceita, revisar no checkpoint | 2026-11-15 |
| [0014](0014-comportamento-modal-do-radix-no-hospedeiro.md) | Aceitar o comportamento modal do Radix (rolagem, `aria-hidden`, `z-index`) sobre a página do hospedeiro | aceita, revisar no checkpoint | 2026-11-15 |
| [0015](0015-cache-na-troca-de-identidade-e-tenant.md) | Trocar identidade ou tenant: cancelar, gravar a sessão e reiniciar o cache, com `signal` em toda consulta (complementa 0008) | aceita, revisar no checkpoint | 2026-11-15 |
| [0016](0016-isolar-roteador-do-modulo-com-contextos-unsafe.md) | Isolar o roteador do módulo do react-router do hospedeiro com contextos `UNSAFE_` (complementa 0006) | aceita, revisar no checkpoint | 2026-11-15 |
| [0017](0017-modo-url-com-basename-fixo.md) | Modo `url` com `basename` fixo em `/`, sem prop (complementa 0006) | aceita, revisar no checkpoint | 2026-11-15 |
| [0018](0018-faixas-de-largura-medidas-no-modulo.md) | Faixas de largura medidas no módulo com ResizeObserver, não na janela | aceita, revisar no checkpoint | 2026-11-15 |
| [0019](0019-encerramento-de-sessao-no-modulo.md) | Encerrar sessão: avisar o hospedeiro uma vez por token e limpar o cache depois que o layout sai (complementa 0015) | aceita, revisar no checkpoint | 2026-11-15 |
| [0020](0020-chaves-de-cache-sob-administracao.md) | Chaves de cache da Administração sob `['administracao', …]`, invalidadas pelo prefixo | aceita, revisar no checkpoint | 2026-11-16 |
| [0021](0021-segredo-mostrado-uma-vez-sem-cache.md) | Segredo mostrado uma vez: mutação com `gcTime: 0`, presa ao diálogo | aceita, revisar no checkpoint | 2026-11-16 |
| [0022](0022-foco-de-volta-em-dialogo-aberto-por-menu.md) | Diálogo aberto por item de Menu: a tela devolve o foco pelo `data-*` do gatilho | substituída por 0026 | 2026-11-16 |
| [0023](0023-parametros-de-seguranca-gravam-resposta-sem-invalidar-prefixo.md) | Parâmetros de segurança: salvar grava a resposta do PUT e não invalida o prefixo (complementa 0020) | aceita, revisar no checkpoint | 2026-11-16 |
| [0024](0024-troca-de-token-confere-a-sessao.md) | Troca de token no modo token: conferir a sessão e descartar o cache se a identidade mudar (complementa 0019) | aceita, revisar no checkpoint | 2026-11-16 |
| [0025](0025-post-sem-efeito-como-consulta.md) | POST que só lê ou verifica vira `useQuery` com `staleTime: Infinity` | aceita, revisar no checkpoint | 2026-11-16 |
| [0026](0026-dialogo-recebe-foco-ao-fechar.md) | `Dialogo` recebe `focoAoFechar` (referência ou função) para devolver o foco; substitui a 0022 | aceita, revisar no checkpoint | 2026-11-16 |
| [0027](0027-telas-de-abas-controladas-e-secoes-do-menu.md) | Telas de abas controláveis pela rota (`aba`/`aoTrocarAba`) e seção do menu como um item só, no casca e no incorporado; componente `Tabs` (complementa 0006) | aceita, revisar no checkpoint (complementada por 0028; atualizada na F40) | 2026-11-16 |
| [0028](0028-telas-avulsas-com-provedor-interno.md) | Telas avulsas funcionam sozinhas, com provedor interno do módulo (complementa 0027) | aceita, revisar no checkpoint | 2026-11-16 |
| [0029](0029-e2e-apoio-por-epico-e-contrato-unico.md) | Testes e2e: `apoio/` por épico com fixture estendida e cópia única dos exemplos do contrato | aceita, revisar no checkpoint (complementada por 0030 e 0060) | 2026-11-16 |
| [0030](0030-simulacao-e2e-intercepta-por-glob-com-fallback.md) | Simulação e2e intercepta a API por glob `**/v1/**` com `route.fallback()` (complementa 0029) | aceita, revisar no checkpoint (complementada por 0036) | 2026-11-16 |
| [0031](0031-codigo-em-ingles.md) | Código do front em inglês, textos para pessoas em português (segue a 0047 do back; glossário em `docs/glossario.md`) | aceita, revisar no checkpoint | 2026-11-16 |
| [0032](0032-segredo-digitado-fora-do-cache-de-mutacao.md) | Segredo digitado pela pessoa: mutação sem variáveis, corpo lido na chamada, `gcTime: 0` (complementa 0021) | aceita, revisar no checkpoint | 2026-11-17 |
| [0033](0033-chaves-de-cache-sob-catalogo.md) | Chaves de cache do Catálogo sob `['catalog', …]`, invalidadas pelo prefixo (segue a 0020) | aceita, revisar no checkpoint (complementada por 0034) | 2026-11-17 |
| [0034](0034-dados-filhos-do-dataset-sob-a-chave-do-detalhe.md) | Dados filhos do dataset (variáveis) sob a chave do detalhe, gravados com `setQueryData` (complementa 0033) | aceita, revisar no checkpoint | 2026-11-17 |
| [0035](0035-envio-com-progresso-por-xhr-no-cliente-da-api.md) | Envio de arquivo com progresso por `client.upload` (XMLHttpRequest) no cliente da API (complementa 0008) | aceita, revisar no checkpoint | 2026-11-17 |
| [0036](0036-e2e-serve-o-shell-compilado-com-aquecimento.md) | Testes e2e servem o shell compilado (`vite preview`) e aquecem a página antes dos testes (complementa 0030) | aceita, revisar no checkpoint | 2026-11-18 |
| [0037](0037-monaco-e-react-flow-no-pacote.md) | Monaco e React Flow no pacote, com o Monaco carregado sob demanda | aceita, revisar no checkpoint (complementada por 0040) | 2026-11-19 |
| [0038](0038-chaves-de-cache-sob-workflows.md) | Chaves de cache dos Workflows sob `['workflows', …]`, com filtro em objeto e limpeza na exclusão (segue a 0033) | aceita, revisar no checkpoint | 2026-11-20 |
| [0039](0039-recarga-de-conflito-rejeita-e-dialogo-espera.md) | Recarga depois de conflito rejeita quando falha (`throwOnError`), e o diálogo só fecha depois de recarregar | aceita, revisar no checkpoint | 2026-11-20 |
| [0040](0040-monaco-environment-do-hospedeiro-tem-prioridade.md) | `MonacoEnvironment` do hospedeiro tem prioridade; o pacote só define o dele se faltar (complementa 0037) | aceita, revisar no checkpoint | 2026-11-20 |
| [0041](0041-formula-editor-recebe-o-texto-analisado.md) | `<FormulaEditor>` recebe `analyzedValue`, o texto em que os problemas foram calculados | aceita, revisar no checkpoint | 2026-11-20 |
| [0042](0042-contrato-do-editor-entre-sub-verticais.md) | Sub-verticais do editor falam com o rascunho só por `useDraftEditor()` e `useProblemCounts()` | aceita, revisar no checkpoint (complementada por 0047, 0053 e 0056) | 2026-11-20 |
| [0043](0043-salvamento-do-rascunho-fora-do-use-mutation.md) | Salvar o rascunho com função controlada por refs, e ler o rascunho só depois dos salvamentos em voo (complementa 0025) | aceita, revisar no checkpoint | 2026-11-20 |
| [0044](0044-edicoes-mantem-a-identidade-do-que-nao-mudou.md) | Edições da definição mantêm os mesmos objetos do que não mudou, para a marca de problema acompanhar a regra (segue a 0042) | aceita, revisar no checkpoint | 2026-11-20 |
| [0045](0045-memoria-da-tela-em-weakmap-por-query-client.md) | Lembrar na tela sem persistir: `WeakMap` por `QueryClient`, com chave de pessoa, tenant e item (segue a 0043) | aceita, revisar no checkpoint | 2026-11-20 |
| [0046](0046-texto-invalido-fica-no-campo-e-nao-vai-ao-rascunho.md) | Texto que daria erro de forma fica no campo, com o erro, e não vai ao rascunho (segue a 0043) | aceita, revisar no checkpoint | 2026-11-20 |
| [0047](0047-pecas-de-propriedades-exportadas-para-outras-sub-verticais.md) | Outras sub-verticais do editor podem importar peças de `properties/index.ts` (complementa 0042) | aceita, revisar no checkpoint (complementada por 0052 e 0068) | 2026-11-20 |
| [0048](0048-limpeza-unica-da-sessao-e-telas-remontadas.md) | Limpar a sessão num lugar só (`clearSessionData`, `replaceSessionInCache`, `onSessionDataCleared`) e remontar as telas por geração (complementa 0015 e 0019, corrige 0045) | aceita, revisar no checkpoint | 2026-11-20 |
| [0049](0049-marca-da-sessao-antes-de-gravar-no-cache.md) | Resposta que grava no cache confere a marca da sessão (`sessionDataMark`/`isSameSessionData`) (complementa 0015 e 0019) | aceita, revisar no checkpoint | 2026-11-20 |
| [0050](0050-workflows-recebe-o-editor-por-render-props.md) | `<Workflows>` recebe o editor por `renderEditor`; editor em rota irmã de tela cheia (segue a 0003) | aceita, revisar no checkpoint | 2026-11-20 |
| [0051](0051-plugin-troca-react-compiler-runtime-por-esm.md) | Plugin do Vite troca o `react-compiler-runtime` do React Flow por ESM (complementa 0037) | aceita, revisar no checkpoint | 2026-11-20 |
| [0052](0052-properties-workflow-importa-sources-batch-source.md) | `properties/workflow` importa `sources/batch-source/index.ts`, com ciclo permitido entre as duas (complementa 0047) | aceita, revisar no checkpoint (complementada por 0059 e 0068) | 2026-11-21 |
| [0053](0053-use-draft-editor-expoe-groups.md) | `useDraftEditor()` expõe `groups`, o Input derivado da análise (complementa 0042) | aceita, revisar no checkpoint | 2026-11-21 |
| [0054](0054-posicao-do-no-dentro-do-grupo-relativa-ao-conteudo.md) | Posição de um nó dentro de um grupo é relativa à área de conteúdo do grupo | aceita, revisar no checkpoint | 2026-11-21 |
| [0055](0055-editor-le-o-catalogo-por-catalog-index.md) | O editor lê datasets e variáveis do catálogo por `catalog/index.ts` (segue a 0003, 0033 e 0034) | aceita, revisar no checkpoint | 2026-11-21 |
| [0056](0056-unit-run-depende-de-preview-e-ultima-previa-em-memoria.md) | `unit-run` depende de `preview` (só nesse sentido); a última prévia fica em memória por `QueryClient`, exposta por `useLastPreview` (complementa 0042, segue a 0045) | aceita, revisar no checkpoint (complementada por 0057) | 2026-11-21 |
| [0057](0057-editor-values-folha-e-sentido-canvas-unit-run-preview-values.md) | `editor/values/` é folha com os formatadores; sentido canvas → unit-run → preview → values (complementa 0056) | aceita, revisar no checkpoint (complementada por 0058, 0059 e 0061) | 2026-11-21 |
| [0058](0058-ultimo-calculo-em-memoria-e-valores-no-canvas.md) | Último cálculo em memória por `QueryClient`, valores no canvas só para a definição que rodou, e grupo que recebe nós prontos (complementa 0057, segue a 0045) | aceita, revisar no checkpoint | 2026-11-21 |
| [0059](0059-canvas-importa-sources-batch-source-e-propriedades-por-render-props.md) | O canvas importa `sources/batch-source`, e o `PropertiesPanel` recebe as peças de fontes e grupos por render props (complementa 0052 e 0057) | aceita, revisar no checkpoint (complementada por 0061) | 2026-11-21 |
| [0060](0060-e2e-simulado-valida-respostas-contra-o-contrato.md) | E2e simulado valida as respostas da API simulada (`VALIDATED_ROUTES`) contra o esquema do contrato, com o Ajv do openapi-typescript (complementa 0029) | aceita, revisar no checkpoint | 2026-11-22 |
| [0061](0061-editor-definition-folha-com-leituras-puras-da-definicao.md) | `editor/definition/` é a pasta comum (folha) das leituras puras da definição; `values/` importa dela e o canvas importa `sources/source-block` (complementa 0057 e 0059) | aceita, revisar no checkpoint | 2026-11-22 |
| [0062](0062-editor-usa-o-formulario-de-parametros-de-executions.md) | O editor usa o formulário de parâmetros de `executions/index.ts`; `executions` não importa o editor (segue a 0003 e a E6-16) | aceita, revisar no checkpoint (complementada por 0063 e 0066) | 2026-11-22 |
| [0063](0063-executions-le-workflows-pela-api-e-chaves-proprias.md) | `executions` lê workflows direto pela API com chaves próprias sob `['executions', …]`; `executions/api/` é a peça comum das sub-verticais (complementa 0062) | aceita, revisar no checkpoint (complementada por 0066) | 2026-11-22 |
| [0064](0064-dialogo-de-envio-fica-travado-ate-a-resposta.md) | Diálogo de envio fica travado até a resposta, para a ação não sair duas vezes | aceita, revisar no checkpoint | 2026-11-22 |
| [0065](0065-formula-exporta-leituras-de-parametro-e-lista-de-sugestoes.md) | `formula/index.ts` exporta as leituras de parâmetro e a lista de sugestões, e `editor/sources/filters` as usa; regra de nome num lugar só (segue a 0003 e a 0055) | aceita, revisar no checkpoint | 2026-11-22 |
| [0066](0066-painel-da-execucao-chaves-de-registros-e-render-prop-do-trace.md) | Painel da execução: chaves dos registros sob `['executions', id]` e trace por render prop `renderRecordTrace` (complementa 0062 e 0063; atualizada na F118: chave `['executions', id, 'definition']` e gaveta com a definição congelada) | aceita, revisar no checkpoint (atualizada na F118) | 2026-11-22 |
| [0067](0067-consulta-com-refetch-interval-para-no-erro.md) | Consulta com `refetchInterval` para no erro; a tela mostra Notice com "Tentar de novo" | aceita, revisar no checkpoint | 2026-11-22 |
| [0068](0068-properties-workflow-importa-editor-parameters.md) | `properties/workflow` importa `editor/parameters/index.ts`, com ciclo permitido entre as duas, mesma regra da 0052 (complementa 0047 e 0052) | aceita, revisar no checkpoint | 2026-11-22 |
| [0069](0069-formatadores-de-numero-e-data-no-design-system.md) | Formatadores de número e data no padrão brasileiro em `design-system/format/`, sem cópias (complementa 0056 e 0062) | aceita | 2026-11-22 |

## Pendentes (sem ADR ainda)

- Nenhuma no momento. Novas decisões de arquitetura tomadas durante a construção viram ADR automaticamente (skill `orquestrar-frente`, desenho da orquestração §9).
