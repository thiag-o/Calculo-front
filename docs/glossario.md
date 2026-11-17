# Glossário do código do front: português → inglês

Dicionário dos nomes do front depois da regra do dono de 2026-11-16: **todo o código em inglês; os textos para pessoas continuam em português** (ADR [0031](adr/0031-codigo-em-ingles.md), que segue a [0047 do back](../../backend/docs/adr/0047-codigo-em-ingles.md); decisão E3-20 do `docs/plano.md`).

- **O que está aqui:** os nomes que **não são da API**: verticais e pastas, arquivos, componentes, props e os valores delas, hooks, tipos, classes `fc-`, tokens `--fc-*`, rotas da URL, chaves de cache, scripts e os nomes do e2e.
- **Nomes da API** (caminhos, campos, códigos de erro, permissões, tipos de evento, esquemas, cookie): ficam no [`../backend/docs/glossario.md`](../../backend/docs/glossario.md). Até a F42 terminar, o código do front ainda usa os nomes da API **em português**, porque a API é a de hoje (veja [Nomes da API que ficam até a F42](#nomes-da-api-que-ficam-até-a-f42)).
- **Como ler:** cada linha é um conceito. A coluna "Português" traz o nome de antes da F41; a coluna "Inglês", o nome a usar. Código novo usa só a coluna "Inglês".
- **Nome que não está aqui:** componha pelo [vocabulário](#vocabulário-do-front) e pelo vocabulário do glossário do back, seguindo as [regras de forma](#regras-de-forma). Se nenhum dos dois resolver, o nome novo entra aqui na mesma tarefa.
- **Um termo por conceito**, como no back: o mesmo conceito tem o mesmo nome na API e no front (`role`, `user`, `session`, `api key`, `authorized domain`, `access event`).

## Regras de forma

| Regra | Exemplo |
|---|---|
| Componente, tipo e interface em `PascalCase`; as props de um componente em `<Componente>Props` | `NewApiKeyDialog`, `TableColumn`, `ButtonProps` |
| Hook com `use` + verbo ou substantivo em `camelCase` | `useSession`, `useCreateApiKey`, `useApiKeyList` |
| Função, variável e prop em `camelCase`; constante de módulo em `UPPER_SNAKE_CASE` | `groupBySection`, `onSessionExpired`, `NO_PERMISSION_MESSAGE` |
| Callback de prop com `on` + evento; função interna que trata o evento com `handle` | `onClose`, `onTabChange`; `handleKeyDown`, `handleClick` |
| Booleano como adjetivo, particípio ou `has`/`is` | `open`, `loading`, `disabled`, `hasPermission`, `isApiCall` |
| Valor de prop e de união de literais em minúsculas, em inglês | `variant="secondary"`, `theme="dark"`, `side="top"` |
| Arquivo de componente com o nome do componente; os demais em `camelCase` ou `kebab-case`, como já estavam | `ApiKeys.tsx`, `queries.ts`, `access-events.css` |
| Pasta e vertical em `kebab-case`, no singular para área e no plural para coleção | `admin/users`, `session/sign-in`, `test-cases` |
| Apoio de teste em `<nome>.test-support.ts(x)` (não é teste, não vai para o pacote) | `users.test-support.tsx` |
| Classe CSS: `fc-` + inglês em `kebab-case`, com o bloco na frente (`fc-<bloco>-<parte>-<estado>`) | `fc-button-primary`, `fc-sidebar-item-icon` |
| Token CSS: `--fc-` + inglês (os tokens já nasceram em inglês e não mudam) | `--fc-primary`, `--fc-text-secondary` |
| Atributo `data-` próprio: `data-fc-` + inglês | `data-fc-portals`, `data-fc-api-key-actions` |
| Rota da URL e chave de cache em inglês, em `kebab-case` | `/admin/users`, `['admin', 'api-keys']` |
| Script do `package.json` em inglês, `verbo:objeto` | `generate:api`, `e2e:real` |
| Texto para pessoas fica em pt-BR: rótulos, títulos, mensagens, `aria-label`, `placeholder`, descrições de `describe`/`it`/`test`, mensagens de erro lançadas, textos da página de teste | `label="Nome"`, `it('mostra o estado vazio')` |

## Exceções

| Nome | Por quê |
|---|---|
| `@fluxo/react`, `FluxoCalculo`, `FluxoCalculoProps`, prefixo `Fluxo` em tipos públicos (`FluxoScreen`, `FluxoTheme`, `FluxoNavigation`, `FluxoEvent`, `FluxoRoot`, `FluxoModule`, `FluxoBrand`, `useFluxoPortal`) | nome do produto (E3-15) |
| Prefixos `fc-` (classes), `--fc-` (tokens), `data-fc-` (atributos), `fc_` (cookies) | prefixos do produto (E3-15) |
| `VITE_AMBIENTE` e os valores dele (`local`, `homologacao`, `producao`) | variável dos environments do GitHub (`.github/workflows`, fora da F41); muda junto com o deploy |
| `E2E_CASCA_URL`, `E2E_ADMIN_SENHA`, `E2E_DOIS_TENANTS_*` | variáveis do e2e no modo real; a F42 as troca junto com as do back (`E2E_SAMPLE_*`) |
| Rota legada `/redefinir` | o back ainda monta o link de redefinição com ela (`FLUXO_URL_CASCA/redefinir?token=…`); o casca aceita `/reset-password` e `/redefinir` até a F42/B48 |
| Nomes dos papéis iniciais, tenants e contas de demonstração (`Admin`, `Configurador`, `Demonstração`, `Outra Empresa`) usados como chave ou dado nos testes | são dados (texto), não código |

## Verticais e pastas

Fixados pela E3-20 do `docs/plano.md`.

| Português | Inglês |
|---|---|
| `administracao` | `admin` |
| `administracao/integracao` | `admin/integration` |
| `administracao/papeis` | `admin/roles` |
| `administracao/seguranca` | `admin/security` |
| `administracao/usuarios` | `admin/users` |
| `api/cliente` | `api/client` |
| `api/consultas` | `api/queries` |
| `api/gerado` | `api/generated` (arquivo `schema.ts`) |
| `auditoria` | `audit` |
| `auditoria/acessos` | `audit/access` |
| `catalogo` | `catalog` |
| `design-system/exibicao` | `design-system/display` |
| `design-system/formulario` | `design-system/form` |
| `design-system/raiz` | `design-system/root` |
| `design-system/tipografia` | `design-system/typography` |
| `estados` | `states` |
| `execucoes` | `executions` |
| `inicio` | `home` |
| `modulo` | `module` |
| `modulo/avulso` | `module/standalone` |
| `modulo/casca` | `module/shell` |
| `modulo/incorporado` | `module/embedded` |
| `modulo/roteador` | `module/router` |
| `notificacoes` | `notifications` |
| `sessao` | `session` |
| `sessao/entrar` | `session/sign-in` |
| `sessao/redefinir` | `session/reset-password` |
| `testes` | `test-cases` |
| `api`, `design-system`, `design-system/tokens`, `editor`, `formula`, `workflows` | ficam |
| `apps/casca` (pacote `casca`) | `apps/shell` (pacote `shell`) |
| `e2e/apoio` | `e2e/support` |
| `e2e/epico-1`, `e2e/epico-2` | `e2e/epic-1`, `e2e/epic-2` |
| `e2e/epico-2/apoio` | `e2e/epic-2/support` |
| `scripts/gerar-api.mjs` | `scripts/generate-api.mjs` |

## Arquivos

Os componentes ficam no arquivo de mesmo nome (`Admin.tsx`, `ApiKeys.tsx`, `ResetLinkDialog.tsx`…). Os demais:

| Português | Inglês |
|---|---|
| `consultas.ts` | `queries.ts` |
| `mensagens.ts` | `messages.ts` |
| `icones.tsx` | `icons.tsx` |
| `datas.ts` | `dates.ts` |
| `origem.ts` | `origin.ts` |
| `parametros.ts` | `parameters.ts` |
| `periodo.ts` | `period.ts` |
| `tiposEvento.ts` | `eventTypes.ts` |
| `erroApi.ts` | `apiError.ts` |
| `criarClienteApi.ts` | `createApiClient.ts` |
| `criarQueryClient.ts` | `createQueryClient.ts` |
| `estruturaCampo.tsx` | `fieldStructure.tsx` |
| `telas.tsx` | `screens.tsx` |
| `encerramento.ts` | `sessionEnd.ts` |
| `EstadosModulo.tsx` | `ModuleStates.tsx` |
| `TelasAvulsas.tsx` | `StandaloneScreens.tsx` |
| `cacheSessao.ts` | `sessionCache.ts` |
| `mutacoes.ts` | `mutations.ts` |
| `useSessao.ts` | `useSession.ts` |
| `redefinicao.ts` | `passwordReset.ts` |
| `mensagensRedefinicao.ts` | `resetPasswordMessages.ts` |
| `mensagemErroLogin.ts` | `signInErrorMessage.ts` |
| `useLarguraEstreita.ts` | `useNarrowWidth.ts` |
| `*.test.apoio.ts(x)` | `*.test-support.ts(x)` |
| `ambiente.ts` (casca) | `environment.ts` |
| `teste-incorporacao.html`, `teste-incorporacao.tsx` | `embed-test.html`, `embed-test.tsx` |
| `vite.incorporacao.config.ts` | `vite.embed.config.ts` |
| `api-simulada.ts`, `simulacao.ts`, `contrato.ts`, `telas.ts` (e2e) | `simulated-api.ts`, `simulation.ts`, `contract.ts`, `screens.ts` |
| CSS: `botao.css`, `caixa.css`, `caixa-selecao.css`, `campo.css`, `selecao.css`, `aviso.css`, `carregando.css`, `dialogo.css`, `dica.css`, `estado-vazio.css`, `marcadores.css`, `tabela.css`, `raiz.css`, `tipografia.css`, `casca.css`, `incorporado.css`, `modulo.css`, `inicio.css`, `entrar.css`, `redefinir.css`, `administracao.css`, `acessos.css`, `auditoria.css`, `integracao.css`, `papeis.css`, `seguranca.css`, `usuarios.css` | `button.css`, `card.css`, `checkbox.css`, `field.css`, `select.css`, `notice.css`, `loading.css`, `dialog.css`, `tooltip.css`, `empty-state.css`, `markers.css`, `table.css`, `root.css`, `typography.css`, `shell.css`, `embedded.css`, `module.css`, `home.css`, `sign-in.css`, `reset-password.css`, `admin.css`, `access-events.css`, `audit.css`, `integration.css`, `roles.css`, `security.css`, `users.css` |
| testes e2e: `login`, `sair`, `senha-errada-e-bloqueio`, `troca-de-tenant`, `csrf`, `auditoria-de-acessos`, `chave-api-e-incorporacao`, `configuracao-de-seguranca`, `configurador-e-link-de-redefinicao`, `cors-dominio-nao-autorizado`, `papel-personalizado`, `exemplos-contrato` | `login`, `sign-out`, `wrong-password-and-lock`, `tenant-switch`, `csrf`, `access-audit`, `api-key-and-embed`, `security-settings`, `configurator-and-reset-link`, `cors-unauthorized-domain`, `custom-role`, `contract-examples` |

## Interface pública do pacote

Muda na versão maior da F41 (changeset `.changeset/f41-codigo-em-ingles.md`).

| Português | Inglês |
|---|---|
| `<Inicio>`, `InicioProps` | `<Home>`, `HomeProps` |
| `<Administracao>`, `AdministracaoProps` | `<Admin>`, `AdminProps` |
| `<Auditoria>`, `AuditoriaProps` | `<Audit>`, `AuditProps` |
| `TelaAvulsaProps` | `StandaloneScreenProps` |
| `<Entrar>`, `EntrarProps` (prop `onEntrar`) | `<SignIn>`, `SignInProps` (prop `onSignIn`) |
| `<RedefinirSenha>`, `RedefinirSenhaProps` (prop `onSalvar`) | `<ResetPassword>`, `ResetPasswordProps` (prop `onSave`) |
| `Sessao` | `Session` |
| prop `tela` (tipo `TelaFluxo`) | prop `screen` (tipo `FluxoScreen`) |
| valores de `tela`: `inicio`, `auditoria`, `administracao`, `usuarios`, `papeis`, `integracao`, `seguranca` | valores de `screen`: `home`, `audit`, `admin`, `users`, `roles`, `integration`, `security` |
| prop `tema` (tipo `TemaFluxo`): `'claro' \| 'escuro' \| 'sistema'` | prop `theme` (tipo `FluxoTheme`): `'light' \| 'dark' \| 'system'` |
| prop `navegacao` (tipo `NavegacaoFluxo`): `'url' \| 'memoria'` | prop `navigation` (tipo `FluxoNavigation`): `'url' \| 'memory'` |
| prop `onEvento` (tipo `EventoFluxo`) | prop `onEvent` (tipo `FluxoEvent`) |
| prop `onSessaoExpirada` | prop `onSessionExpired` |
| CSS publicado `@fluxo/react/estilos.css` | `@fluxo/react/styles.css` |
| raiz do módulo `.fc-raiz` (onde se sobrescrevem os tokens) | `.fc-root` |
| eventos (`EventoFluxo`): nenhum ainda | `FluxoEvent`: nenhum ainda; os do épico 5 em diante nascem em inglês, `<resource>_<participle>` como no back |

## Rotas da URL

| Português | Inglês |
|---|---|
| `/entrar` (casca) | `/sign-in` |
| `/redefinir?token=…` (casca) | `/reset-password?token=…` (o casca ainda aceita `/redefinir`: veja [Exceções](#exceções)) |
| `/inicio` | `/home` |
| `/auditoria` | `/audit` |
| `/administracao`, `/administracao/usuarios`, `/administracao/papeis`, `/administracao/integracao`, `/administracao/seguranca` | `/admin`, `/admin/users`, `/admin/roles`, `/admin/integration`, `/admin/security` |
| `/catalogo` (épico 3) | `/catalog` |
| `teste-incorporacao.html` (página de teste) | `embed-test.html` |
| elemento `#raiz` do `index.html` | `#root` |

## Chaves de cache (TanStack Query)

| Português | Inglês |
|---|---|
| `['sessao']` | `['session']` |
| `['administracao', …]` | `['admin', …]` |
| `['administracao', 'usuarios', 'lista' \| 'papeis']` | `['admin', 'users', 'list' \| 'roles']` |
| `['administracao', 'papeis', 'lista' \| 'permissoes']` | `['admin', 'roles', 'list' \| 'permissions']` |
| `['administracao', 'integracao', 'chaves' \| 'dominios']` | `['admin', 'integration', 'api-keys' \| 'authorized-domains']` |
| `['administracao', 'seguranca']` | `['admin', 'security']` |
| `['auditoria', 'acessos', …]` | `['audit', 'access-events', …]` |
| `['redefinicao', token]` | `['password-reset', token]` |

## Scripts e projetos

| Português | Inglês |
|---|---|
| `pnpm gerar:api` | `pnpm generate:api` |
| `pnpm --filter casca …` | `pnpm --filter shell …` |
| projeto do Playwright `simulado` (`metadata.modo`) | `simulated` (`metadata.mode`) |
| `metadata.hospedeiroUrl` | `metadata.hostAppUrl` |
| contas do e2e `admin`, `doisTenants` | `admin`, `twoTenants` |

## Props, valores e campos de formulário

| Português | Inglês |
|---|---|
| `rotulo`, `dica`, `erro` (campos e botão) | `label`, `tooltip`, `error` |
| `variante`: `principal`, `secundario`, `fantasma`, `perigo` | `variant`: `primary`, `secondary`, `ghost`, `danger` |
| `tamanho`: `pequeno`, `padrao`, `grande` | `size`: `small`, `default`, `large` |
| `soIcone`, `icone`, `carregando` | `iconOnly`, `icon`, `loading` |
| `motivoDesabilitado`, `exibirMotivo`: `dica` \| `ao-lado` | `disabledReason`, `showReason`: `tooltip` \| `beside` |
| `Texto`: `estilo` (`heading-24`…), `tom` (`principal` \| `secundario` \| `terciario`), `medio`, `como` | `Text`: `variant`, `emphasis` (`primary` \| `secondary` \| `tertiary`), `medium`, `as` |
| `Caixa`: `como`, `espaco` (`padrao` \| `nenhum`) | `Card`: `as`, `padding` (`default` \| `none`) |
| `Status`: `cor` (`cinza`, `ambar`, `verde`, `vermelho`, `decisao`, `multiplo`), `pulsando` | `Status`: `tone` (`gray`, `amber`, `green`, `red`, `decision`, `multi`), `pulsing` |
| `Selo`: `cor` (`cinza`, `azul`, `verde`, `ambar`, `vermelho`) | `Badge`: `tone` (`gray`, `blue`, `green`, `amber`, `red`) |
| `Aviso`: `tipo` (`erro`, `atencao`, `sucesso`, `info`), `titulo`, `acoes` | `Notice`: `type` (`error`, `warning`, `success`, `info`), `title`, `actions` |
| `MensagemCampo`: `tipo` (`dica` \| `erro`) | `FieldMessage`: `type` (`tooltip` \| `error`) |
| `Dica`: `conteudo`, `lado` (`cima`, `baixo`, `esquerda`, `direita`) | `Tooltip`: `content`, `side` (`top`, `bottom`, `left`, `right`) |
| `Tabela`: `legenda`, `colunas` (`chave`, `titulo`, `celula`, `alinhamento`: `inicio` \| `fim`, `largura`, `tituloOculto`, `larguraEsqueleto`), `linhas`, `chaveLinha`, `carregando`, `erro`, `vazio` | `Table`: `caption`, `columns` (`key`, `title`, `cell`, `align`: `start` \| `end`, `width`, `hiddenTitle`, `skeletonWidth`), `rows`, `rowKey`, `loading`, `error`, `empty` |
| `Menu`: `itens` (`rotulo`, `icone`, `perigo`, `aoSelecionar`, `motivoDesabilitado`; separador `tipo: 'separador'`), `gatilho`, `alinhamento` | `Menu`: `items` (`label`, `icon`, `danger`, `onSelect`, `disabledReason`; separator `type: 'separator'`), `trigger`, `align` |
| `Dialogo`: `titulo`, `descricao`, `acoes`, `aberto`, `abertoInicial`, `aoMudarAberto`, `gatilho`, `focoAoFechar` | `Dialog`: `title`, `description`, `actions`, `open`, `initialOpen`, `onOpenChange`, `trigger`, `focusOnClose` |
| `EstadoVazio`: `titulo`, `descricao`, `acao`, `icone` | `EmptyState`: `title`, `description`, `action`, `icon` |
| `Carregando`: `rotulo`, `linhas`; `Esqueleto`: `largura` | `Loading`: `label`, `rows`; `Skeleton`: `width` |
| telas de abas: `aba`, `aoTrocarAba` | `tab`, `onTabChange` |
| diálogos das telas: `aoFechar`, `focoAoFechar`, `aoConfirmar` | `onClose`, `focusOnClose`, `onConfirm` |
| estado `DialogoAberto` das telas: `tipo` (`nova`, `novo`, `editar`, `remover`, `revogar`, `link`) | `OpenDialog`: `type` (`new`, `edit`, `delete`, `revoke`, `link`) |
| campos dos formulários (`nome`, `papeis`, `ativo`, `senha`, `origem`, `permissoes`, `confirmacao`, `nova_senha`) | `name`, `roles`, `active`, `password`, `origin`, `permissions`, `confirmation`, `newPassword`. O corpo enviado à API e os `campos` do erro continuam com os nomes da API até a F42: o mapa fica nos `messages.ts` de cada tela |
| `ErroApi`: `codigo`, `mensagem`, `campos`, `corpo` | `ApiError`: `code`, `message` (o de `Error`), `fields`, `body` |
| códigos que nascem no cliente: `sem_conexao`, `resposta_inesperada` | ficam até a F42, junto com os códigos da API |

## Classes CSS

Montadas pelo vocabulário abaixo (`fc-` + bloco + parte + estado). Os nomes compostos e os que não seguem a palavra a palavra:

| Português | Inglês |
|---|---|
| `fc-raiz` | `fc-root` |
| `fc-caixa`, `fc-caixa-sem-espaco` | `fc-card`, `fc-card-no-padding` |
| `fc-caixa-selecao-*` | `fc-checkbox-*` |
| `fc-menu-lateral-*` | `fc-sidebar-*` |
| `fc-seletor-cliente-*` | `fc-tenant-selector-*` |
| `fc-estado-vazio-*` | `fc-empty-state-*` |
| `fc-mensagem-campo-*` | `fc-field-message-*` |
| `fc-campo-senha-*` | `fc-password-field-*` |
| `fc-dica-botao-*` | `fc-button-tooltip-*` |
| `fc-botao-so-icone` | `fc-button-icon-only` |
| `fc-oculto-visualmente` | `fc-visually-hidden` |
| `fc-layout-casca` | `fc-shell-layout` |
| `fc-modulo-marca` | `fc-module-brand` |
| `fc-redefinir-*` | `fc-reset-password-*` |
| `fc-entrar-*` | `fc-sign-in-*` |
| `fc-texto-{principal,secundario,terciario,medio}` | `fc-text-{primary,secondary,tertiary,medium}` |
| `fc-status-{cinza,ambar,verde,vermelho,decisao,multiplo,pulsando}` | `fc-status-{gray,amber,green,red,decision,multi,pulsing}` |
| animações `fc-*-surgir`, `fc-botao-girar`, `fc-status-pulsar`, `fc-esqueleto-brilho` | `fc-*-appear`, `fc-button-spin`, `fc-status-pulse`, `fc-skeleton-shimmer` |
| atributos `data-fc-portais`, `data-fc-acoes-chave`, `data-fc-acoes-dominio`, `data-fc-acoes-usuario` | `data-fc-portals`, `data-fc-api-key-actions`, `data-fc-authorized-domain-actions`, `data-fc-user-actions` |
| as classes de tipografia (`fc-heading-24`, `fc-label-12`, `fc-copy-14`, `fc-mono-13`…) | ficam |

Os tokens `--fc-*` já eram em inglês (`--fc-primary`, `--fc-gray-100`, `--fc-text-secondary`, `--fc-cat-decision`…) e não mudaram. O `estilos.md` da orquestração continua com os nomes visuais em português (a referência é visual, não de código).

## Vocabulário do front

Palavra a palavra, para compor nomes de componentes, props, classes e variáveis. Completa o vocabulário do glossário do back; em caso de conflito, vale o do back.

| Português | Inglês | Observação |
|---|---|---|
| `aba`, `abas` | `tab`, `tabs` | aba da tela (a aba do Excel, na API, é `sheet`) |
| `tela`, `telas` | `screen`, `screens` | nos testes, a variável de `render(...)` é `view` (o `screen` do Testing Library já existe) |
| `secao` | `section` | |
| `rotulo` | `label` | |
| `dica` | `tooltip` | |
| `aviso` | `notice` | nota inline (componente `Notice`) |
| `caixa` | `card` (componente) ou `box` (parte de um controle) | `Card`; `fc-checkbox-box` |
| `caixa de seleção` | `checkbox` | |
| `selecao` | `select` | |
| `campo` | `field` | |
| `botao` | `button` | |
| `selo` | `badge` | |
| `esqueleto` | `skeleton` | |
| `carregando` | `loading` | |
| `menu lateral` | `sidebar` | |
| `seletor de cliente` | `tenant selector` | "cliente" na tela é o tenant |
| `casca` | `shell` | o app casca |
| `incorporado` | `embedded` | modo incorporado |
| `avulso`, `avulsa` | `standalone` | tela avulsa |
| `hospedeiro` | `host app` (`hostApp`) | como no back; `host` é nome de máquina |
| `raiz` | `root` | raiz do módulo |
| `roteador` | `router` (`ModuleRouter`) | |
| `navegacao` | `navigation` | |
| `memoria` | `memory` | |
| `tema`, `claro`, `escuro`, `sistema` | `theme`, `light`, `dark`, `system` | |
| `encerramento` (da sessão) | `session end` (`sessionEnd`) | |
| `entrar`, `sair` | `sign in`, `sign out` | |
| `redefinir senha` | `reset password` | |
| `chave` (de API) | `apiKey` | a chave de uma lista ou de cache é `key` |
| `dominio` (autorizado) | `authorizedDomain` | nunca `domain` sozinho |
| `acessos` | `access events` | auditoria de acessos |
| `periodo`, `de`, `ate` | `period`, `from`/`since`, `until` | `since`/`until` como na API |
| `motivo` | `reason` | |
| `foco` | `focus` | |
| `gatilho` | `trigger` | |
| `alinhamento`, `inicio`, `fim` | `align`, `start`, `end` | alinhamento de coluna |
| `variante`, `principal`, `secundario`, `terciario`, `fantasma`, `perigo` | `variant`, `primary`, `secondary`, `tertiary`, `ghost`, `danger` | |
| `tamanho`, `pequeno`, `padrao`, `grande`, `medio` | `size`, `small`, `default`, `large`, `medium` | |
| `tom` | `tone` (Status, Badge, Avatar) ou `emphasis` (Text) | o `tone` de `Text` colidia com o atributo HTML |
| `cinza`, `azul`, `verde`, `ambar`, `vermelho` | `gray`, `blue`, `green`, `amber`, `red` | os nomes dos tokens |
| `cima`, `baixo`, `esquerda`, `direita` | `top`, `bottom`, `left`, `right` | |
| `largura`, `altura`, `estreito`, `compacto`, `recolhido` | `width`, `height`, `narrow`, `compact`, `collapsed` | |
| `legenda` | `caption` | |
| `celula`, `linha`, `coluna` | `cell`, `row`, `column` | |
| `vazio` | `empty` | |
| `esquema` (zod) | `schema` | |
| `folha` (de estilo) | `stylesheet` | |
| `simulado`, `simular`, `fila` | `simulated`, `simulate`, `queue` | apoio de teste |
| `apoio` | `support` | |
| `epico` | `epic` | |
| `aoX` (callback) | `onX` | `aoFechar` → `onClose` |
| `ehX` | `isX` | `ehJson` → `isJson` |
| `temX` | `hasX` | `temPermissao` → `hasPermission` |
| `semX` | `noX`/`withoutX` | `SemTelas` → `NoScreens` |
| `MENSAGEM_X`, `MOTIVO_X`, `ROTA_X`, `CHAVE_X` | `X_MESSAGE`, `X_REASON`, `X_ROUTE`, `X_KEY` | o qualificador vai para o fim |

## Nomes da API que ficam até a F42

O código usa a API de hoje. Ficam em português, e a F42 os troca pelo glossário do back:

- caminhos `/v1/...`, campos do JSON (`itens`, `proximo_cursor`, `nome`, `papeis`, `codigo`, `campos`…), códigos de erro (`sem_sessao`, `dados_invalidos`…), permissões (`auditoria.ver`…), tipos de evento (`login_ok`…), parâmetros de consulta (`tipo`, `desde`, `ate`, `limite`) e o cookie `fc_sessao`;
- as chaves dos esquemas gerados (`Schemas['Usuario']`, `Schemas['Sessao']`…); os nomes de tipo do front que as apelidam já estão em inglês (`type User = Schemas['Usuario']`);
- os nomes dos exemplos do contrato no `e2e/support/contract.ts` (`DadosInvalidos`, `SemSessao`…), que são `components.examples` do contrato;
- no e2e, as propriedades do estado simulado que espelham o JSON da API (`nome`, `papeis`, `ativo`, `permissoes`…);
- os códigos que nascem no cliente (`sem_conexao`, `resposta_inesperada`) e o código simulado de teste `unavailable`.

## Componentes e tipos

Tabela completa dos nomes renomeados na F41 (inclui os tipos e componentes internos e os de teste).

| Português | Inglês |
|---|---|
| `AbaAdministracao` | `AdminTab` |
| `AcaoMenu` | `MenuAction` |
| `Acessos` | `AccessEvents` |
| `Administracao` | `Admin` |
| `AdministracaoNaRota` | `RoutedAdmin` |
| `AdministracaoProps` | `AdminProps` |
| `AlteracaoConfiguracaoSeguranca` | `SecuritySettingsUpdate` |
| `AlteracaoUsuario` | `UserUpdate` |
| `ApiE2E` | `E2EApi` |
| `ApiSimulada` | `SimulatedApi` |
| `Auditoria` | `Audit` |
| `AuditoriaProps` | `AuditProps` |
| `Autenticacao` | `Auth` |
| `Aviso` | `Notice` |
| `AvisoProps` | `NoticeProps` |
| `Botao` | `Button` |
| `BotaoBaseProps` | `ButtonBaseProps` |
| `BotaoComTextoProps` | `TextButtonProps` |
| `BotaoNativo` | `NativeButton` |
| `BotaoNativoProps` | `NativeButtonProps` |
| `BotaoProps` | `ButtonProps` |
| `BotaoSoIconeProps` | `IconButtonProps` |
| `Caixa` | `Card` |
| `CaixaPapel` | `RoleCheckbox` |
| `CaixaPermissao` | `PermissionCheckbox` |
| `CaixaProps` | `CardProps` |
| `CaixaSelecao` | `Checkbox` |
| `CaixaSelecaoProps` | `CheckboxProps` |
| `CampoLogin` | `SignInField` |
| `CampoPapel` | `RoleField` |
| `CampoSeguranca` | `SecurityField` |
| `CampoSenha` | `PasswordField` |
| `CampoSenhaProps` | `PasswordFieldProps` |
| `CampoTexto` | `TextField` |
| `CampoTextoProps` | `TextFieldProps` |
| `CampoUsuario` | `UserField` |
| `Carregando` | `Loading` |
| `CarregandoFormulario` | `FormLoading` |
| `CarregandoModulo` | `ModuleLoading` |
| `CarregandoProps` | `LoadingProps` |
| `Casca` | `Shell` |
| `Chave` | `ApiKey` |
| `ChaveApi` | `ApiKey` |
| `ChaveApiCriada` | `CreatedApiKey` |
| `ChavesApi` | `ApiKeys` |
| `ClienteApi` | `ApiClient` |
| `CodigoPermissao` | `PermissionCode` |
| `ColunaTabela` | `TableColumn` |
| `ConfiguracaoSeguranca` | `SecuritySettings` |
| `Confirmacao` | `Confirmation` |
| `ConsultaAcessos` | `AccessEventsQuery` |
| `ContaInicial` | `InitialAccount` |
| `ContaSimulada` | `SimulatedAccount` |
| `ConteudoAvulso` | `StandaloneContent` |
| `ConteudoModulo` | `ModuleContent` |
| `ConteudoModuloProps` | `ModuleContentProps` |
| `ContextoApi` | `ApiContext` |
| `ContextoEncerrarSessao` | `EndSessionContext` |
| `ContextoPortal` | `PortalContext` |
| `Controlada` | `Controlled` |
| `Controlado` | `Controlled` |
| `CorpoErro` | `ErrorBody` |
| `CorpoProblema` | `ProblemBody` |
| `CorSelo` | `BadgeTone` |
| `CorStatus` | `StatusTone` |
| `Credenciais` | `LoginCredentials` |
| `DadosFormulario` | `FormFields` |
| `DadosLogin` | `SignInData` |
| `DadosNovaChave` | `NewApiKeyData` |
| `DadosNovoDominio` | `NewAuthorizedDomainData` |
| `DadosPapel` | `RoleData` |
| `DadosSenha` | `PasswordData` |
| `DadosUsuario` | `UserData` |
| `Declaracao` | `Declaration` |
| `DefinicaoAba` | `TabDefinition` |
| `DefinicaoAvulsa` | `StandaloneDefinition` |
| `DefinicaoTela` | `ScreenDefinition` |
| `DescricaoParametro` | `ParameterDescription` |
| `Dialogo` | `Dialog` |
| `DialogoAberto` | `OpenDialog` |
| `DialogoComFocoInformado` | `DialogWithGivenFocus` |
| `DialogoDeAjuste` | `AdjustDialog` |
| `DialogoLinkRedefinicao` | `ResetLinkDialog` |
| `DialogoLinkRedefinicaoProps` | `ResetLinkDialogProps` |
| `DialogoNovaChave` | `NewApiKeyDialog` |
| `DialogoNovaChaveProps` | `NewApiKeyDialogProps` |
| `DialogoNovoDominio` | `NewAuthorizedDomainDialog` |
| `DialogoNovoDominioProps` | `NewAuthorizedDomainDialogProps` |
| `DialogoPapel` | `RoleDialog` |
| `DialogoPapelProps` | `RoleDialogProps` |
| `DialogoProps` | `DialogProps` |
| `DialogoRemoverDominio` | `DeleteAuthorizedDomainDialog` |
| `DialogoRemoverDominioProps` | `DeleteAuthorizedDomainDialogProps` |
| `DialogoRemoverPapel` | `DeleteRoleDialog` |
| `DialogoRemoverPapelProps` | `DeleteRoleDialogProps` |
| `DialogoRevogarChave` | `RevokeApiKeyDialog` |
| `DialogoRevogarChaveProps` | `RevokeApiKeyDialogProps` |
| `DialogoSalvarSeguranca` | `SaveSecurityDialog` |
| `DialogoSalvarSegurancaProps` | `SaveSecurityDialogProps` |
| `DialogoUsuario` | `UserDialog` |
| `DialogoUsuarioProps` | `UserDialogProps` |
| `Dica` | `Tooltip` |
| `DicaBotao` | `ButtonTooltip` |
| `DicaBotaoProps` | `ButtonTooltipProps` |
| `DicaProps` | `TooltipProps` |
| `Dominio` | `AuthorizedDomain` |
| `DominioAutorizado` | `AuthorizedDomain` |
| `DominiosAutorizados` | `AuthorizedDomains` |
| `Elemento` | `Tag` |
| `ElementoTexto` | `TextElement` |
| `Encerramento` | `SessionEnd` |
| `Entrar` | `SignIn` |
| `EntrarProps` | `SignInProps` |
| `Epico2` | `Epic2` |
| `ErroApi` | `ApiError` |
| `ErroEnvio` | `SubmitError` |
| `ErroFormulario` | `FormError` |
| `ErroLogin` | `SignInError` |
| `ErroModulo` | `ModuleError` |
| `ErroModuloProps` | `ModuleErrorProps` |
| `ErroTela` | `ScreenError` |
| `EspacoCaixa` | `CardPadding` |
| `Esqueleto` | `Skeleton` |
| `EsqueletoProps` | `SkeletonProps` |
| `EsqueletoSeguranca` | `SecuritySkeleton` |
| `Esquemas` | `Schemas` |
| `Estado` | `State` |
| `EstadoVazio` | `EmptyState` |
| `EstadoVazioProps` | `EmptyStateProps` |
| `EstiloTexto` | `TextStyle` |
| `Evento` | `StoredAccessEvent` |
| `EventoAcesso` | `AccessEvent` |
| `EventoFluxo` | `FluxoEvent` |
| `Execucao` | `Execution` |
| `ExibicaoMotivo` | `ReasonDisplay` |
| `FecharDialogo` | `DialogClose` |
| `FecharDialogoProps` | `DialogCloseProps` |
| `FetchSimulado` | `SimulatedFetch` |
| `FiltrosAcessos` | `AccessEventFilters` |
| `Formulario` | `Form` |
| `FormularioSeguranca` | `SecurityForm` |
| `FormularioSenha` | `PasswordForm` |
| `FormularioSenhaProps` | `PasswordFormProps` |
| `GrupoMenu` | `MenuGroup` |
| `GrupoParametros` | `ParameterGroup` |
| `GrupoPermissoes` | `PermissionGroup` |
| `IconeAlerta` | `AlertIcon` |
| `IconeAtencao` | `WarningIcon` |
| `IconeAuditoria` | `AuditIcon` |
| `IconeCadeado` | `LockIcon` |
| `IconeCarregando` | `LoadingIcon` |
| `IconeChave` | `KeyIcon` |
| `IconeCopiar` | `CopyIcon` |
| `IconeEscudo` | `ShieldIcon` |
| `IconeExpandirMenu` | `ExpandMenuIcon` |
| `IconeFechar` | `CloseIcon` |
| `IconeFiltroVazio` | `EmptyFilterIcon` |
| `IconeGlobo` | `GlobeIcon` |
| `IconeHistorico` | `HistoryIcon` |
| `IconeInfo` | `InfoIcon` |
| `IconeInicio` | `HomeIcon` |
| `IconeIntegracao` | `IntegrationIcon` |
| `IconeMaisAcoes` | `MoreActionsIcon` |
| `IconeMarca` | `BrandIcon` |
| `IconeMenos` | `MinusIcon` |
| `IconeOlho` | `EyeIcon` |
| `IconeOlhoRiscado` | `EyeOffIcon` |
| `IconePapeis` | `RolesIcon` |
| `IconeProps` | `IconProps` |
| `IconeRecolherMenu` | `CollapseMenuIcon` |
| `IconeSair` | `SignOutIcon` |
| `IconeSeguranca` | `SecurityIcon` |
| `IconeSetaBaixo` | `ChevronDownIcon` |
| `IconeSucesso` | `SuccessIcon` |
| `IconeTeste` | `TestIcon` |
| `IconeTrocar` | `SwitchIcon` |
| `IconeUsuarios` | `UsersIcon` |
| `IconeVazio` | `EmptyIcon` |
| `IconeVoltarPadrao` | `ResetDefaultIcon` |
| `IdsCampo` | `FieldIds` |
| `Inicio` | `Home` |
| `InicioProps` | `HomeProps` |
| `Integracao` | `Integration` |
| `IsolamentoDoHospedeiro` | `HostAppIsolation` |
| `ItemAcao` | `ActionItem` |
| `ItemMenu` | `MenuItem` |
| `ItemMenuLateral` | `SidebarItem` |
| `LadoDica` | `TooltipSide` |
| `LayoutCasca` | `ShellLayout` |
| `LayoutCascaProps` | `ShellLayoutProps` |
| `LayoutIncorporado` | `EmbeddedLayout` |
| `LayoutIncorporadoProps` | `EmbeddedLayoutProps` |
| `LinkRedefinicao` | `ResetLink` |
| `LinkVerificado` | `VerifiedLink` |
| `MarcaFluxo` | `FluxoBrand` |
| `Membro` | `Member` |
| `MensagemCampo` | `FieldMessage` |
| `MensagemCampoProps` | `FieldMessageProps` |
| `MensagensCampo` | `FieldMessages` |
| `MenuUsuario` | `UserMenu` |
| `MenuUsuarioProps` | `UserMenuProps` |
| `ModoAutenticacao` | `AuthMode` |
| `ModoE2E` | `E2EMode` |
| `ModuloFluxo` | `FluxoModule` |
| `ModuloFluxoProps` | `FluxoModuleProps` |
| `Montagem` | `Mount` |
| `NavegacaoFluxo` | `FluxoNavigation` |
| `NomeConta` | `AccountName` |
| `NomeDaSessao` | `SessionName` |
| `NomeExemplo` | `ExampleName` |
| `NovaChaveApi` | `NewApiKey` |
| `NovaSenha` | `NewPassword` |
| `NovoDominioAutorizado` | `NewAuthorizedDomain` |
| `NovoUsuario` | `NewUser` |
| `OndeEstaOHospedeiro` | `HostAppLocation` |
| `OpcaoSelecao` | `SelectOption` |
| `OpcoesClienteApi` | `ApiClientOptions` |
| `OpcoesTexto` | `TextOptions` |
| `Pagina` | `EmbedTestPage` |
| `Papeis` | `Roles` |
| `Papel` | `Role` |
| `ParametroSeguranca` | `SecurityParameter` |
| `Permissao` | `Permission` |
| `PortalSimples` | `SimplePortal` |
| `Problema` | `Problem` |
| `PropsCampo` | `FieldProps` |
| `PropsCheckbox` | `RadixCheckboxProps` |
| `PropsIcone` | `IconProps` |
| `PropsProvedorApi` | `ApiProviderProps` |
| `ProvedorApi` | `ApiProvider` |
| `Provedores` | `Providers` |
| `ProvedorModulo` | `ModuleProvider` |
| `ProvedorModuloProps` | `ModuleProviderProps` |
| `RaizFluxo` | `FluxoRoot` |
| `RaizFluxoProps` | `FluxoRootProps` |
| `RedefinirSenha` | `ResetPassword` |
| `RedefinirSenhaProps` | `ResetPasswordProps` |
| `RequisicaoRecebida` | `ReceivedRequest` |
| `ResizeObserverSimulado` | `SimulatedResizeObserver` |
| `Resposta` | `RouteResponse` |
| `Resultado` | `Result` |
| `ResultadoChamada` | `CallResult` |
| `ResultadoSessao` | `SessionResult` |
| `Rotas` | `RouteTable` |
| `RotasDoModulo` | `ModuleRoutes` |
| `RotasDoModuloProps` | `ModuleRoutesProps` |
| `Roteador` | `ModuleRouter` |
| `RoteadorProps` | `ModuleRouterProps` |
| `Rotulo` | `Label` |
| `RotuloAmbiente` | `EnvironmentLabel` |
| `RotuloProps` | `LabelProps` |
| `SecaoMenu` | `MenuSection` |
| `SecaoMenuLateral` | `SidebarSection` |
| `Seguranca` | `Security` |
| `Selecao` | `Select` |
| `SelecaoProps` | `SelectProps` |
| `SeletorCliente` | `TenantSelector` |
| `SeletorClienteProps` | `TenantSelectorProps` |
| `Selo` | `Badge` |
| `SeloProps` | `BadgeProps` |
| `SemAcesso` | `NoAccess` |
| `SemRaiz` | `NoRoot` |
| `SemTelas` | `NoScreens` |
| `SeparadorMenu` | `MenuSeparator` |
| `Sessao` | `Session` |
| `SessaoAberta` | `OpenSession` |
| `SessaoCookie` | `CookieSession` |
| `SessaoEncerrada` | `EndedSession` |
| `SimulacaoEpico2` | `Epic2Simulation` |
| `Tabela` | `Table` |
| `TabelaProps` | `TableProps` |
| `TamanhoBotao` | `ButtonSize` |
| `TelaAcessos` | `AccessEventsScreen` |
| `TelaAdministracao` | `AdminScreen` |
| `TelaAuditoria` | `AuditScreen` |
| `TelaAvulsa` | `StandaloneScreen` |
| `TelaAvulsaProps` | `StandaloneScreenProps` |
| `TelaEntrar` | `SignInScreen` |
| `TelaEntrarProps` | `SignInScreenProps` |
| `TelaFluxo` | `FluxoScreen` |
| `TelaInicio` | `HomeScreen` |
| `TelaIntegracao` | `IntegrationScreen` |
| `TelaPapeis` | `RolesScreen` |
| `TelaRedefinirSenha` | `ResetPasswordScreen` |
| `TelaRedefinirSenhaProps` | `ResetPasswordScreenProps` |
| `TelaSeguranca` | `SecurityScreen` |
| `TemaFluxo` | `FluxoTheme` |
| `TenantResumo` | `TenantSummary` |
| `Texto` | `Text` |
| `TextoProps` | `TextProps` |
| `TipoAviso` | `NoticeType` |
| `TipoCampoTexto` | `TextFieldType` |
| `TipoEvento` | `EventType` |
| `TipoMensagemCampo` | `FieldMessageType` |
| `TokenIncorporacao` | `EmbedToken` |
| `TomTexto` | `TextEmphasis` |
| `Usuario` | `User` |
| `Usuarios` | `Users` |
| `ValoresFormulario` | `FormValues` |
| `VarianteBotao` | `ButtonVariant` |

## Hooks

| Português | Inglês |
|---|---|
| `useAlterarConfiguracaoSeguranca` | `useUpdateSecuritySettings` |
| `useAlterarPapel` | `useUpdateRole` |
| `useAlterarUsuario` | `useUpdateUser` |
| `useCatalogoPermissoes` | `usePermissionCatalog` |
| `useClienteApi` | `useApiClient` |
| `useConfiguracaoSeguranca` | `useSecuritySettings` |
| `useCriarChave` | `useCreateApiKey` |
| `useCriarDominio` | `useCreateAuthorizedDomain` |
| `useCriarPapel` | `useCreateRole` |
| `useCriarUsuario` | `useCreateUser` |
| `useDadosDaPessoa` | `usePersonData` |
| `useDadosDoTenant` | `useTenantData` |
| `useEncerrarSessao` | `useEndSession` |
| `useEntrar` | `useSignIn` |
| `useGerarLinkRedefinicao` | `useGenerateResetLink` |
| `useIdsCampo` | `useFieldIds` |
| `useLarguraEstreita` | `useNarrowWidth` |
| `useListaAcessos` | `useAccessEventList` |
| `useListaChaves` | `useApiKeyList` |
| `useListaDominios` | `useAuthorizedDomainList` |
| `useListaPapeis` | `useRoleList` |
| `useListaUsuarios` | `useUserList` |
| `usePapeisDisponiveis` | `useAvailableRoles` |
| `usePortalFluxo` | `useFluxoPortal` |
| `useRedefinirSenha` | `useResetPassword` |
| `useRemoverDominio` | `useDeleteAuthorizedDomain` |
| `useRemoverPapel` | `useDeleteRole` |
| `useRevogarChave` | `useRevokeApiKey` |
| `useSair` | `useSignOut` |
| `useSessao` | `useSession` |
| `useTrocarTenant` | `useSwitchTenant` |
| `useVerificarLink` | `useVerifyLink` |
