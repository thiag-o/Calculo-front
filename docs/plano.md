# Plano frontend — Fluxo de Cálculo (MVP)

Executado pela skill `orquestrar-frente` (frente `frontend`), sob a orquestração global (`../docs/plano-global.md`).

## Contexto
- **Repositório:** `C:\dev\fluxo-calculo\frontend` (git, branch `main`).
  - pnpm workspaces com `packages/react` (`@fluxo/react`, o produto) e `apps/casca` (o hospedeiro zero);
  - especificação do produto em `../docs/design.md`;
  - **estilo visual em `../docs/estilos.md`**, a fonte da verdade de toda tela.
- **Ferramentas:** Node (versão do `.nvmrc`), pnpm 10, Vite, Vitest com Testing Library, Playwright, ESLint com `eslint-plugin-boundaries`.
- **Arquitetura** (ADRs 0002 e 0003):
  - verticais em `packages/react/src/<vertical>/`, com interface pública só pelo `index.ts`;
  - regras do "The Vertical Codebase" (atualização da ADR 0003): a vertical nasce da rota ou tela; pastas por tipo (`components`, `hooks`, `types`, `utils`, `helpers`, `lib`, `shared`, `common`) são proibidas em qualquer nível; algo privado de outra vertical só por exposição no `index.ts` dela ou por vertical nova (tarefa própria e ADR);
  - `design-system` e `api` não importam ninguém;
  - sem iframe: classes com o prefixo `fc-`, nenhum reset global, portais Radix dentro da raiz do módulo, nada que dependa da janela inteira;
  - tipos da API sempre gerados do contrato (ADR 0005), nunca escritos à mão.
- **Qualidade** (o verificador reprova se faltar):
  - `pnpm lint` (com as fronteiras), `pnpm typecheck`, `pnpm test` e `pnpm build`;
  - testes junto com o código, verificando o comportamento visível;
  - toda tela com os estados completos (vazio, carregando, erro, desabilitado com motivo) e acessível (rótulos, foco visível, teclado);
  - textos em pt-BR.
- **Idioma (regra do dono de 2026-11-16; decisões E3-15 a E3-20):**
  - **todo o código em inglês:** pastas, arquivos, componentes, hooks, funções, variáveis, tipos, props, comentários, nomes de token e de classe CSS, rotas da URL, scripts do `package.json` e nomes de arquivo de teste;
  - **em pt-BR ficam só os textos para pessoas:** rótulos, títulos, mensagens, `aria-label`, as descrições de `describe` e `it`, e a documentação (`docs/`, ADRs, README e este plano);
  - dicionários: `../backend/docs/glossario.md` (API) e `docs/glossario.md` (front, tarefa F41). Até a F42 terminar, o código ainda tem nomes em português; código novo usa os nomes dos glossários;
  - os nomes desta seção e da seção "Contratos" (`apps/casca`, `api/gerado`, `pnpm gerar:api`, `<FluxoCalculo tela tema navegacao onEvento …>`, `<Inicio>`, `<Catalogo>` etc.) valem, depois da F41 e da F42, pela tradução do glossário (lista no começo do épico 3).
- **Nunca agir com dúvida** (skill orquestrar-frente §3).
- **Modo worktree (regra do dono, 2026-11-19):** Modo worktree: ativo (desde 2026-11-20, depois da F61). No máximo **dois `pnpm e2e` ao mesmo tempo** (com três, faltou CPU na verificação da F61); as outras checagens não têm esse limite. Ativo, cada tarefa roda numa worktree própria (`../worktrees/frontend/<T>`, branch `task/<T>`), com as portas do e2e escolhidas por `FLUXO_TEST_ISOLATION_ID`, sem trava de build e com até 3 ou 4 tarefas ao mesmo tempo (skill `orquestrar-frente` §2.0).
- **Portas proibidas (regra do dono, 2026-11-19):** nunca use as portas 5000 nem 5001 no host, como padrão, em teste, na integração ou em release. Isso vale para Compose, `.env`, servidores de desenvolvimento, Playwright e scripts. A porta interna de um container (o Moto escuta na 5000 dentro dele) pode ficar; só a porta publicada no host muda.

## Contratos
Valem para todas as tarefas. Mudar um contrato exige tarefa de contrato própria.

**Contrato com o backend**
- **Fonte:** `../backend/contratos/openapi.yaml`, escrito pelo back **antes** da implementação.
- **Tipos:** `pnpm gerar:api` gera os tipos em `packages/react/src/api/gerado/` com **openapi-typescript**; as chamadas usam **openapi-fetch**. Os arquivos gerados ficam versionados.
- **Formato:** `/v1`, JSON em `snake_case`. Erros em problem+json com um `codigo` estável: a tela decide pelo `codigo`, nunca pelo texto.
- **Autenticação:**
  - **app casca:** cookie de sessão (`credentials: 'include'`), mais o cabeçalho `X-CSRF-Token` com o valor do cookie `fc_csrf` em POST, PUT, PATCH e DELETE;
  - **incorporado:** `Authorization: Bearer <token>` recebido do hospedeiro, sem CSRF.

**Interface pública do pacote** (`packages/react/src/index.ts`)
- **Módulo inteiro:**
  `<FluxoCalculo apiUrl token? tela? tema? navegacao? onEvento? onSessaoExpirada? />`
  - `apiUrl`: endereço da API.
  - `token`: modo incorporado; sem ele, o módulo usa o cookie.
  - `tela`: tela inicial.
  - `tema`: `'claro' | 'escuro' | 'sistema'` (padrão `'sistema'`).
  - `navegacao`:
    - `'url'`, no casca: as rotas internas sincronizadas com a URL, com `basename` fixo em `/` e sem prop (ADR 0017; decisão da sessão global no CK1: só vira prop quando um hospedeiro precisar montar o módulo fora da raiz);
    - `'memoria'`, padrão quando incorporado: não toca a URL do hospedeiro.
- **Componentes por tela**, para quem quer só uma parte: épico 1 `<Inicio>`; épico 2 `<Administracao>` e `<Auditoria>`; épico 3 `<Catalogo>`; épico 4 `<Workflows>` (lista, Visão geral e editor; a prop `screen` aceita `workflows`). Cada um funciona sozinho: recebe as mesmas props do `<FluxoCalculo>` (`apiUrl`, `token?`, `tema?`, `onEvento?`, `onSessaoExpirada?`), monta internamente a raiz, a API e o cache, e navega sempre em memória (decisão da sessão global no épico 2, tarefa F38).
- **Tela de login e de redefinição de senha:** exportadas para o casca (`<Entrar>`, `<RedefinirSenha>`).
- **Roteamento:** `react-router` (modo memória quando incorporado).
- **Estado do servidor:** TanStack Query.
- **Formulários:** react-hook-form com zod.

**Layout** (design.md §15 e `estilos.md`)
- **App casca:** menu lateral único, que pode ser escondido (só ícones abaixo de 1180 px), com o seletor de contexto no topo (tenant); os itens sem permissão não aparecem.
- **Incorporado:** sem menu lateral e sem topo próprios; abas internas; tema herdado pelas variáveis `--fc-*`.

**Testes ponta a ponta** (`e2e/`, Playwright, na raiz do repositório)
- `pnpm e2e`: contra a API **simulada**. As respostas vêm de exemplos do contrato (`page.route`) e o comando roda no portão do front.
- `pnpm e2e:real`: contra o back de verdade (`E2E_API_URL`) e o casca, usando as credenciais do `preparar-local` do back. Roda no teste de integração do checkpoint.
- Os mesmos arquivos de teste servem aos dois modos; a simulação é ligada por fixture.

**Contrato do épico 4: workflows, rascunho e linguagem de fórmula**
- **Rotas e esquemas:** os da B56 (`../backend/docs/plano.md`, épico 4). A especificação da linguagem (sintaxe, tipos, arredondamento, nulos, Tabela de Decisão, códigos de problema e de falha) está em Contratos do back, "Linguagem de fórmula e motor". O front nunca reimplementa as regras: tipos e problemas vêm sempre da API (`problems`, `symbols`, `GET /v1/formula-language`).
- **Posições dos problemas:** `start` e `end` contam pontos de código; o front converte para as posições do Monaco (UTF-16) antes de marcar.
- **Valores:**
  - na API, números são texto com ponto (`"1500.00"`);
  - na tela, o formulário de "Calcular" e o resultado usam o padrão brasileiro (`1.500,00`, E4-24);
  - as fórmulas e as células da Tabela de Decisão são texto da linguagem, com ponto decimal (E4-3), e aparecem como foram digitadas.
- **Rótulos fixos** (estilos §13), com uma frase por ação:
  - **Novo workflow** e **Abrir editor**;
  - **Calcular** (execução unitária com valores digitados, nome novo desta tabela);
  - "Primeira" e "Única" (política de acerto);
  - "Gerar erro", "Deixar vazio com aviso" e "Usar valor padrão" (política de erro);
  - "Meio para cima", "Meio para o par" e "Cortar" (modo de arredondamento);
  - "Herdar do workflow" (nó sem sobrescrita).
- **Chaves de cache** (ADR 0033 e 0034): `['workflows', 'list', filtro]`, `['workflows', id]` e, sob ele, `['workflows', id, 'draft']`. Também `['formula-language']`. A análise e a execução unitária são POST sem efeito, tratados como consulta (ADR 0025), e não ficam no cache.

## Tarefas

### Épico 1 — Base técnica, login e tenants

**F1 · Dependências, ferramentas e configuração**
- dep: —
- modelo: sonnet
- arquivos: `package.json`, `pnpm-lock.yaml`, `packages/react/package.json`, `apps/casca/package.json`, `eslint.config.js`, `tsconfig.base.json`, `packages/react/tsconfig.json`, `apps/casca/tsconfig.json`, `packages/react/vite.config.ts`, `apps/casca/vite.config.ts`, `playwright.config.ts`, `.nvmrc`, `README.md`, `docs/adr/0004-monorepo-pnpm-vite-changesets.md`, `.github/workflows/ci.yml`
- Fazer:
  - instalar `react` e `react-dom` (dev e peer), `react-router`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, as primitivas Radix usadas nos épicos 1–2 (dialog, dropdown-menu, select, checkbox, tooltip, tabs), `openapi-fetch` e as fontes Geist e Geist Mono empacotadas localmente (sem CDN);
  - instalar para desenvolvimento: `typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-dts`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `eslint`, `typescript-eslint`, `eslint-plugin-boundaries`, `openapi-typescript`, `@playwright/test` (com o navegador Chromium);
  - validar o `eslint.config.js`;
  - scripts `lint`, `typecheck`, `test`, `build`, `e2e`, `e2e:real` e `gerar:api`;
  - **Node 26** (resposta G6): `.nvmrc` = `26`, `engines.node` = `>=26`, o CI usa o `.nvmrc`. Atualize o README e a ADR 0004 (onde diz Node 24), registrando que a mudança veio da resposta G6.
- Aceite:
  - `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (um teste de fumaça) e `pnpm build` passam;
  - um import proibido entre verticais, criado e apagado durante a tarefa, é recusado pelo `pnpm lint` (evidência no relatório);
  - uma pasta por tipo (por exemplo `packages/react/src/sessao/utils/x.ts`), criada e apagada durante a tarefa, é recusada pelo `pnpm lint` via `eslint-plugin-boundaries` (evidência no relatório).

**F2 · Tipos da API do épico 1**
- tipo: contrato
- dep: F1, B2
- modelo: sonnet
- arquivos: `packages/react/src/api/gerado/`, `scripts/gerar-api.mjs`
- Fazer:
  - `pnpm gerar:api` lê `../backend/contratos/openapi.yaml` e gera `packages/react/src/api/gerado/esquema.ts`;
  - o script falha com uma mensagem clara se o contrato não existir.
- Aceite: os tipos gerados compilam; rodar duas vezes não muda nada.

**F3 · Design system: tokens, raiz do módulo e tipografia**
- dep: F1
- modelo: opus
- arquivos: `packages/react/src/design-system/index.ts`, `packages/react/src/design-system/tokens/`, `packages/react/src/design-system/raiz/`, `packages/react/src/design-system/tipografia/`
- Fazer:
  - todos os tokens `--fc-*` do `estilos.md` §2, claro e escuro, declarados na **raiz do módulo** (nunca em `:root`);
  - `<RaizFluxo tema>` aplica `data-theme` e o prefixo `fc-`, e oferece o contêiner de portais para o Radix;
  - a escala tipográfica do `estilos.md` com Geist e Geist Mono.
- Aceite:
  - teste: dentro da raiz, as variáveis resolvem nos dois temas; fora dela, nada muda;
  - nenhum seletor global (`*`, `html`, `body`, `:root`) no CSS gerado.

**F4 · Design system: controles de formulário**
- dep: F3
- modelo: opus
- arquivos: `packages/react/src/design-system/formulario/`, `packages/react/src/design-system/index.ts`
- Fazer, conforme o `estilos.md` (estados, tamanhos, raio, foco), e reexportar `formulario` no `design-system/index.ts`:
  - `Botao` (principal, secundário, perigo, só ícone, carregando, desabilitado com motivo em tooltip);
  - `CampoTexto`, `CampoSenha` (mostrar e ocultar), `Rotulo`, `MensagemCampo` (dica e erro);
  - `Caixa de seleção` e `Selecao` (Radix);
  - um `index.ts` próprio.
- Aceite:
  - testes de comportamento: teclado, foco, `aria-*`, estado desabilitado com motivo;
  - todas as cores e medidas vêm dos tokens.

**F5 · Design system: exibição e diálogos**
- dep: F3
- modelo: opus
- arquivos: `packages/react/src/design-system/exibicao/`, `packages/react/src/design-system/index.ts`
- Fazer, conforme o `estilos.md`, e reexportar `exibicao` no `design-system/index.ts`:
  - `Caixa`, `Status` (ponto + palavra), `Selo`, `Tabela` simples (cabeçalho, linhas, vazio, carregando);
  - `EstadoVazio`, `Carregando` (esqueleto), `Aviso` (sucesso, erro, atenção);
  - `Dialogo` (Radix, portal na raiz do módulo, foco preso, Esc fecha), `Menu` (dropdown), `Dica` (tooltip);
  - um `index.ts` próprio.
- Aceite: testes de comportamento e acessibilidade; o portal do diálogo fica dentro da raiz do módulo, não no `body`.

**F6 · API: cliente e consultas**
- dep: F2
- modelo: opus
- arquivos: `packages/react/src/api/index.ts`, `packages/react/src/api/cliente/`, `packages/react/src/api/consultas/`
- Fazer:
  - `criarClienteApi({apiUrl, token?})` com openapi-fetch. Modo cookie: `credentials: 'include'` e `X-CSRF-Token` lido do cookie nas mutações. Modo token: `Authorization: Bearer`;
  - conversão de problem+json em `ErroApi {status, codigo, mensagem, campos}`;
  - evento de sessão expirada (401 `sem_sessao`);
  - `QueryClient` com os padrões do produto;
  - provedor React do cliente.
- Aceite: testes com `fetch` simulado nos dois modos, cobrindo o CSRF nas mutações e a conversão de erro.

**F7 · Sessão: login, sessão atual e troca de tenant**
- dep: F4, F5, F6
- modelo: opus
- arquivos: `packages/react/src/sessao/`
- Fazer:
  - `useSessao()` (`GET /v1/sessao`), `useEntrar`, `useSair` e `useTrocarTenant`, com `temPermissao(codigo)`;
  - tela `<Entrar>` conforme o `estilos.md`. Mensagens por `codigo`:
    - `credenciais_invalidas`: mensagem genérica;
    - `login_bloqueado`: "tente de novo às HH:MM";
    - `muitas_tentativas`: espere um pouco.
- Aceite: testes da tela (sucesso, cada erro, campos obrigatórios, envio pelo Enter) e dos hooks.

**F8 · Módulo: `<FluxoCalculo>`, rotas e navegação**
- dep: F7, F9
- modelo: opus
- arquivos: `packages/react/src/modulo/`
- Fazer:
  - `<FluxoCalculo>` com as propriedades da seção Contratos: monta `RaizFluxo`, o provedor da API, o QueryClient e o roteador (`url` ou `memoria`);
  - **layout do casca:** menu lateral recolhível, só com ícones abaixo de 1180 px, e seletor de contexto do tenant (troca pelo `useTrocarTenant`);
  - **layout incorporado:** abas;
  - itens por permissão;
  - sem sessão: `onSessaoExpirada`.
- Aceite:
  - testes: menu e seletor de tenant; no modo `memoria`, a URL da página não muda;
  - item sem permissão não aparece;
  - o layout incorporado não renderiza o menu lateral.

**F9 · Início (estados vazios)**
- dep: F5
- modelo: sonnet
- arquivos: `packages/react/src/inicio/`
- Fazer: tela Início com as seções "Precisa de você", "Workflows recentes" e "Execuções recentes", ainda com os estados vazios do `estilos.md` (sem dados até os épicos seguintes).
- Aceite: testes dos estados vazios.

**F10 · Integração do épico 1: interface pública e app casca**
- dep: F7, F8, F9, F25
- modelo: sonnet
- arquivos: `packages/react/src/index.ts`, `apps/casca/src/`, `apps/casca/index.html`, `apps/casca/.env.example`
- Fazer:
  - o `index.ts` do pacote exporta `<FluxoCalculo>`, `<Inicio>`, `<Entrar>` e os tipos públicos;
  - **casca:** a rota `/entrar` usa `<Entrar>`; com sessão, `<FluxoCalculo apiUrl={VITE_API_URL} navegacao="url">`; o rótulo `VITE_AMBIENTE` aparece fora de produção.
- Aceite: `pnpm build` gera o pacote (ESM e `.d.ts`) e o casca; o casca em `pnpm dev` abre o login.

**F11 · Testes ponta a ponta do épico 1**
- dep: F10
- modelo: opus
- arquivos: `e2e/epico-1/`, `e2e/apoio/`
- Fazer:
  - a infraestrutura dos dois modos (fixture de API simulada a partir de exemplos do contrato; modo real por `E2E_API_URL`);
  - testes dos fluxos do épico 1 no plano global: login, senha errada e bloqueio, sair, troca de tenant.
  - O fluxo "requisição sem CSRF é recusada" só roda no modo real.
- Aceite: `pnpm e2e` passa. O modo real é exercitado no teste de integração do checkpoint.

**F24 · Lint: entrada em outra vertical só pelo `index.ts` da raiz**
- dep: F1
- modelo: opus
- arquivos: `eslint.config.js`
- Fazer: corrigir a brecha achada na F3. Hoje um arquivo em `src/sessao/` importando `../design-system/tipografia` (o `index.ts` de uma **subpasta** de outra vertical) passa no lint. A ADR 0003 só permite entrar em outra vertical pelo `index.ts` da **raiz** dela. Dentro da própria vertical, os imports entre subpastas continuam livres.
- Aceite (com evidência executada no relatório, arquivos de teste criados e apagados durante a tarefa):
  - importar o `index.ts` de subpasta de outra vertical é recusado pelo `pnpm lint`;
  - importar o `index.ts` da raiz de outra vertical continua aceito;
  - import entre subpastas da mesma vertical continua aceito;
  - as regras que já existiam (import profundo, pasta por tipo, arquivo solto em `src/`, `design-system` e `api` sem dependências) continuam recusando;
  - `pnpm lint` passa no código atual.

**F25 · Build do pacote: CSS publicado como `estilos.css`**
- dep: F1
- modelo: sonnet
- arquivos: `packages/react/vite.config.ts`
- Fazer: corrigir o nome do CSS gerado no build (achado na F7/F8). Hoje o build emite `dist/index.css`, mas o `packages/react/package.json` exporta `./estilos.css` → `./dist/estilos.css` (ADR 0010 do front, item "a fazer"). Quem importa `@fluxo/react/estilos.css` não acha o arquivo. Use `build.lib.cssFileName: 'estilos'`.
- Aceite:
  - `pnpm build` gera `packages/react/dist/estilos.css`, e não `index.css`;
  - o CSS gerado continua sem seletor global (`*`, `html`, `body`, `:root`);
  - o export `./estilos.css` do `package.json` resolve para um arquivo existente (evidência no relatório);
  - `pnpm lint`, `pnpm typecheck` e `pnpm test` continuam verdes.

**F26 · Correção da integração do épico 1: modo real estável em paralelo**
- dep: F11
- modelo: opus
- arquivos: `e2e/epico-1/`, `e2e/apoio/`, `playwright.config.ts`, `README.md`
- Fazer: corrigir a falha do teste de integração do checkpoint 1. Relatório: `../backend/.claude/orquestracao/backend/relatorios/integracao-epico-1.md`.
  - **A falha:** com o paralelismo padrão (`fullyParallel: true`), `pnpm e2e:real` falhou de forma intermitente. Quatro testes estouraram o tempo de 30 s: csrf, "sessão sobrevive a recarregar", "senha errada" e "cinco erros". Com `--workers=1`, os 8 passaram. No log da API houve 401, 423 e 200, sem 429.
  - **Comece reproduzindo:** suba o back como em "Ambiente do teste de integração" no `../docs/plano-global.md` e rode `pnpm e2e:real` sem `--workers=1` até ver a falha. Guarde o trace do Playwright e o log da API. Ache a causa antes de mudar qualquer coisa.
  - **Se a causa estiver nos testes** (contas, estado ou limite de login compartilhado entre testes paralelos): isole os testes. Por exemplo, dê uma conta própria a cada teste que muda estado, ou rode em série só os que dividem estado. Não troque o projeto inteiro para um worker só, e não aumente o tempo limite para esconder a falha.
  - **Se a causa estiver no back** (a API falha ou demora com logins ao mesmo tempo): não contorne no front. Devolva `DUVIDA` com a evidência (trace, log, tempos), e a sessão global cria a correção no backend.
  - **Também:**
    - o `playwright.config.ts` repassa `E2E_API_URL` ao casca como `VITE_API_URL`, para não exigir as duas variáveis iguais à mão;
    - o `README.md` documenta como rodar o modo real: back de pé, `E2E_API_URL`, e as contas `E2E_ADMIN_EMAIL`, `E2E_ADMIN_SENHA`, `E2E_DOIS_TENANTS_EMAIL` e `E2E_DOIS_TENANTS_SENHA` (tiradas do `preparar-local`), e a espera de 60 s entre rodadas por causa do limite de 20 logins por minuto por IP.
- Aceite (evidência executada no relatório):
  - a causa da falha descrita com a evidência que a confirma;
  - `pnpm e2e:real` com o paralelismo padrão passa em 3 rodadas seguidas, com 60 s de espera entre elas;
  - `pnpm e2e` (modo simulado) continua passando;
  - com só `E2E_API_URL` definida, o casca fala com a mesma API;
  - `pnpm lint` e `pnpm typecheck` verdes.

**F12 · Portão do épico 1**
- tipo: portao
- dep: F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F24, F25, F26
- modelo: sonnet
- Aceite:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm e2e` verdes;
  - `pnpm gerar:api` não muda nada (tipos em dia com o contrato);
  - revisão de interface das telas do épico pelo `estilos.md`.

### Épico 2 — Usuários, papéis e incorporação

**F13 · Tipos da API do épico 2**
- tipo: contrato
- dep: F12, B13
- modelo: sonnet
- arquivos: `packages/react/src/api/gerado/`
- Aceite: `pnpm gerar:api` atualizado e compilando.

**F14 · Administração: usuários**
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/administracao/usuarios/`
- Fazer:
  - lista de usuários (nome, e-mail, papéis, ativo);
  - criar e editar (nome, papéis, ativo);
  - "Gerar link de redefinição", num diálogo que mostra o link uma única vez, com "Copiar";
  - erros por `codigo` (`ultimo_admin`, ...).
- Aceite: testes de cada ação e de cada erro; estados vazio, carregando e erro.

**F15 · Administração: papéis e permissões**
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/administracao/papeis/`
- Fazer:
  - lista de papéis; criar e editar com o catálogo de permissões agrupado, com as sensíveis destacadas;
  - o Admin aparece travado, com o motivo;
  - remover, com confirmação (`papel_em_uso`).
- Aceite: testes; o Admin não oferece editar nem remover.

**F16 · Administração: integração (chaves de API e domínios)**
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/administracao/integracao/`
- Fazer:
  - **chaves:** criar (a chave aparece uma vez, com "Copiar" e o aviso de que não será mostrada de novo), listar (prefixo, criada, último uso, revogada) e revogar com confirmação;
  - **domínios autorizados:** adicionar (com validação da origem) e remover.
- Aceite: testes; depois de fechar o diálogo, a chave não fica em lugar nenhum do estado.

**F23 · Administração: segurança**
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/administracao/seguranca/`
- Fazer:
  - tela com os cinco parâmetros do tenant (inatividade e duração máxima da sessão, senha mínima, validade do link de redefinição e do token de incorporação);
  - mostra o padrão e os limites de cada um;
  - salvar com confirmação; "Voltar ao padrão" por campo;
  - erros `valor_fora_do_limite` no campo;
  - aviso de que o bloqueio de login e o limite por IP são do sistema, não do tenant.
- Aceite: testes de edição, validação nos limites (no cliente e pela resposta da API) e estados.

**F17 · Sessão: redefinição de senha e modo token**
- dep: F13, B40
- modelo: opus
- arquivos: `packages/react/src/sessao/`, `packages/react/src/api/gerado/`
- Resposta D4 (sessão global): a tela consulta `POST /v1/redefinicao/verificacao` (B40) ao abrir e mostra a senha mínima exata e o prazo do link. `410 link_invalido` mostra a mensagem de link inválido e não mostra o formulário. Regenere os tipos (`pnpm gerar:api`) com o contrato da B40. O envio do formulário é "Salvar" (§13).
- Fazer:
  - tela `<RedefinirSenha token>` (nova senha e confirmação; regras da senha mostradas; `link_invalido`);
  - no modo token, a sessão vem de `GET /v1/sessao` com Bearer, e o token vencido chama `onSessaoExpirada`.
- Aceite: testes da tela e do modo token.

**F18 · Auditoria: acessos**
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/auditoria/`, `packages/react/src/design-system/formulario/CampoTexto.tsx`, `packages/react/src/design-system/formulario/CampoTexto.test.tsx`
- Resposta D3 (sessão global):
  - período com "De" e "Até" no calendário do navegador: `date` entra em `TipoCampoTexto`, com o teste. "Até" inclui o dia inteiro: envie `ate` como o início do dia seguinte, no fuso do navegador, porque o `ate` da API é exclusivo;
  - ponto de status: `login_ok` verde, `login_falhou` âmbar, `login_bloqueado` vermelho e os demais cinza, com a tabela de rótulos do relatório da F18;
  - um tipo por vez, num `Selecao`.
- Fazer: tela de acessos com filtro por tipo e por período, paginação por cursor, e status por ponto + palavra para os tipos de evento.
- Aceite: testes dos filtros, da paginação e dos estados.

**F19 · Módulo: menu por permissão, rotas e abas**
- dep: F14, F15, F16, F18, F23
- modelo: opus
- arquivos: `packages/react/src/modulo/`, `packages/react/src/administracao/index.ts`, `packages/react/src/administracao/Administracao.tsx`, `packages/react/src/administracao/administracao.css`, `packages/react/src/administracao/Administracao.test.tsx`
- Resposta D6 (sessão global): no modo incorporado, as abas de topo são os mesmos itens do menu lateral (Início, Auditoria, Administração e, nos próximos épicos, Catálogo e os demais). A aba "Administração" mostra o `<Administracao>`, com sub-abas Usuários, Papéis, Integração e Segurança, cada uma com a sua permissão. Ela some quando o usuário não tem nenhuma delas. O mesmo `<Administracao>` é usado no casca e no incorporado.
- Fazer:
  - o `administracao/index.ts` reexporta `usuarios`, `papeis`, `integracao` e `seguranca`, e a tela `<Administracao>` com as abas internas;
  - rotas e itens de Administração (Usuários, Papéis, Integração, Segurança) e de Auditoria, cada um com a sua permissão;
  - a propriedade `tela` abre direto uma tela;
  - no modo incorporado, as abas seguem as mesmas permissões.
- Aceite: testes por papel (o Configurador não vê Administração; o Auditor vê Auditoria).

**F20 · Integração do épico 2: interface pública, casca e página de teste de incorporação**
- dep: F17, F19
- modelo: sonnet
- arquivos: `packages/react/src/index.ts`, `apps/casca/src/`, `apps/casca/teste-incorporacao.html`, `apps/casca/vite.incorporacao.config.ts`
- Fazer:
  - o pacote exporta `<Administracao>`, `<Auditoria>` e `<RedefinirSenha>`;
  - **casca:** a rota pública `/redefinir?token=...`;
  - **página de teste de incorporação** em `http://localhost:5274`, servida por uma configuração própria do Vite, **fora do build de produção**:
    - um campo "chave de API" troca a chave por um token em `POST /v1/incorporacao/sessoes`;
    - monta `<FluxoCalculo token navegacao="memoria">`;
    - a página avisa que é só para teste local.
- Aceite: `pnpm build` não inclui a página de teste; a página monta o módulo incorporado contra o back local.

**F21 · Testes ponta a ponta do épico 2**
- dep: F20
- modelo: opus
- arquivos: `e2e/epico-2/`, `e2e/apoio/` (o `e2e/apoio/` pela resposta D7)
- Fazer: os fluxos do épico 2 do plano global (usuário Configurador sem Administração, papel personalizado, link de redefinição de uso único, chave de API e incorporação, chave revogada, configuração de segurança, auditoria de acessos). O CORS de domínio não autorizado só roda no modo real.
- Aceite: `pnpm e2e` passa.

**F27 · Design system: contraste dos hovers, tokens num lugar só e react-router fixo**
- dep: F12
- modelo: sonnet
- arquivos: `packages/react/src/design-system/`, `packages/react/package.json`, `pnpm-lock.yaml`
- Fazer (pendências adiáveis do épico 1, decididas pela sessão global no CK1):
  - **Contraste:** os dois hovers abaixo de 4,5:1 (principal no tema claro, cerca de 4,1; perigo no escuro, cerca de 2,9) passam a ter no mínimo 4,5:1 contra o texto deles, mantendo o tom do `estilos.md`. Ponha no relatório os valores antigos, os novos e o contraste medido; a sessão global atualiza o `estilos.md` §7.1 com eles.
  - **Tokens num lugar só:** `--fc-primary-hover`, `--fc-on-danger`, `--fc-shadow-menu`, `--fc-overlay` (preto 32% no claro e 64% no escuro, valor aceito) e `--fc-shadow-modal` vão para o `tokens.css` do design system. Nenhum token `--fc-*` fica declarado fora dele.
  - **`DicaBotao`** reaproveita a `Dica` em vez de repetir a lógica.
  - **react-router** fixo na versão exata instalada (sem `^`). O módulo usa contextos `UNSAFE_*` (ADR 0016), e até uma versão menor pode quebrá-los. Atualizar exige rodar o teste do hospedeiro com roteador próprio.
  - Os ícones SVG repetidos ficam como estão, até haver demanda por uma biblioteca de ícones.
- Aceite: contraste medido e registrado; `grep` sem `--fc-` declarado fora do `tokens.css`; `pnpm lint`, `typecheck`, `test`, `build` e `e2e` verdes; nenhuma mudança visual além dos dois hovers.

**F28 · Guia de incorporação**
- dep: F20
- modelo: sonnet
- arquivos: `docs/incorporacao.md`, `README.md`
- Fazer: guia para quem incorpora o `@fluxo/react` num sistema hospedeiro, com link no `README.md`:
  - instalação e o CSS `@fluxo/react/estilos.css`;
  - as props do `<FluxoCalculo>` e os componentes por tela;
  - modo token: troca da chave de API por token no back do hospedeiro (nunca no navegador), `onSessaoExpirada` e domínios autorizados (CORS);
  - tema e sobrescrita de tokens `.fc-raiz { --fc-…: … }`;
  - **convivência com a página** (ADR 0014): com diálogo ou menu aberto, o Radix trava a rolagem do `body` e põe `aria-hidden` no resto da página. Explique também o risco de `z-index` do hospedeiro e como evitá-lo;
  - `navegacao="memoria"` e o `basename` fixo em `/` no modo `url`.
- Aceite: cada prop e cada código de erro citado existe no código ou no contrato; os exemplos de código compilam (trecho testado ou copiado de um teste).

**F37 · Design system: diálogo devolve o foco a um elemento informado**
- dep: F14, F16, F27
- modelo: sonnet
- arquivos: `packages/react/src/design-system/exibicao/`, `packages/react/src/administracao/usuarios/`, `packages/react/src/administracao/integracao/`
- Fazer (decisão da sessão global; gatilho de repetição da ADR 0022):
  - o `Dialogo` ganha uma prop opcional com a referência do elemento que recebe o foco ao fechar (para diálogos abertos por um item de `Menu`, cujo gatilho some ao fechar o menu). Sem a prop, mantém o comportamento atual do Radix;
  - a F14 (pelo `data-*` do gatilho) e a F16 (pelo hook `useFocoDeVolta`) passam a usar a prop; o código repetido sai;
  - a ADR 0022 recebe uma atualização apontando a prop nova. As telas seguintes (épicos 2 e 3) usam só a prop.
- Aceite:
  - teste do `Dialogo`: com a prop, o foco volta ao elemento informado ao fechar por Esc, pelo botão de fechar e por "Cancelar";
  - os testes da F14 e da F16 continuam verdes sem o código antigo;
  - `pnpm lint`, `typecheck`, `test` e `build` verdes.

**F38 · Componentes por tela funcionando sozinhos**
- dep: F20, F28
- modelo: opus
- arquivos: `packages/react/src/modulo/`, `packages/react/src/index.ts`, `docs/incorporacao.md`, `apps/casca/teste-incorporacao.html`, `apps/casca/src/teste-incorporacao.tsx`
- Fazer: decisão da sessão global (opção A do problema relatado na F28). `<Inicio>`, `<Administracao>` e `<Auditoria>`, exportados pelo pacote, passam a funcionar fora do `<FluxoCalculo>`:
  - a montagem de raiz, API e cache (`RaizFluxo`, `ProvedorApi`, `QueryClient`) sai do `ModuloFluxo` para um provedor interno do `modulo/`, usado pelo `<FluxoCalculo>` e pelas versões avulsas das telas;
  - as versões avulsas ficam no `modulo/` e recebem `apiUrl`, `token?`, `tema?`, `onEvento?` e `onSessaoExpirada?`. A navegação é sempre em memória. Sem permissão para a tela, aparece o estado de "sem acesso" do `estilos.md`;
  - o `src/index.ts` exporta as versões avulsas no lugar das telas cruas; os provedores continuam internos;
  - o guia `docs/incorporacao.md` explica o uso avulso;
  - a página de teste de incorporação ganha um exemplo com `<Administracao>` avulso;
  - ADR registrando a decisão.
- Aceite: testes que montam cada tela avulsa só com `apiUrl` (cookie) e com `token`, com tema e portais (diálogo) funcionando; `pnpm build` gera os exports; o `<FluxoCalculo>` continua passando nos testes atuais.

**F39 · Correção da integração do épico 2: hospedeiro em 5274 e modo real com 2 workers**
- dep: F21
- modelo: opus
- arquivos: `playwright.config.ts`, `package.json`, `e2e/epico-2/`, `e2e/apoio/`, `README.md`
- Resposta D8 (sessão global):
  - (1) o CORS da troca com `Authorization: Chave` é corrigido no back, na B44;
  - (2) só no projeto `real`, o timeout de teste e de `expect` sobe para 60 s. No simulado, investigue por que a auditoria leva de 11 a 15 s sozinha: se houver espera fixa, debounce ou paginação desnecessária no teste, corrija. Nada de `test.slow()` genérico;
  - o `README.md` passa a citar a porta 5274 e os 2 workers do modo real, no lugar de "paralelismo padrão".
- Fazer: corrigir as falhas do teste de integração do CK2 (relatório em `../backend/.claude/orquestracao/backend/relatorios/integracao-epico-2.md`).
  - **Hospedeiro errado:** o teste de chave de API e incorporação usa a origem do casca (5173) como se fosse o hospedeiro. Para o back, 5173 é o casca, cujo CORS não aceita `Authorization`, e por isso o preflight dá 400. Comece reproduzindo a falha no modo real. Depois:
    - o `playwright.config.ts` passa a subir também a página de teste de incorporação em `http://localhost:5274` (`vite.incorporacao.config.ts`), como um segundo `webServer`, nos dois modos;
    - o hospedeiro do teste passa a ser 5274, a origem que o `preparar-local` cadastra; no simulado, a fixture faz o mesmo.
  - **Instabilidade, decisão da sessão global:** sozinha, a API atende 6 logins paralelos em menos de 1,5 s. Os timeouts vêm da máquina saturada (6 Chromes, o Vite dev e a API na mesma máquina). O `e2e:real` passa a rodar com `--workers=2` no próprio script do `package.json`, com um comentário do motivo. O simulado continua com o paralelismo padrão.
- Aceite:
  - evidência da falha antes da correção (preflight 400 com `Origin` 5173) e do sucesso depois;
  - o `pnpm e2e:real` completo (comando oficial, já com 2 workers) fica para o teste de integração do CK2, que só roda depois da B44 do back. Na F39, basta rodar o modo real dos testes que não dependem da troca de chave;
  - `pnpm e2e` continua passando;
  - `pnpm lint` e `pnpm typecheck` verdes.

**F22 · Portão do épico 2**
- tipo: portao
- dep: F13, F14, F15, F16, F17, F18, F19, F20, F21, F23, F27, F28, F37, F38, F39
- modelo: sonnet
- Aceite: o mesmo do F12, com as telas do épico 2.

### Épico 3 — Conexões e catálogo

As decisões E3-1 a E3-19 e as permissões de cada rota estão no plano do back (`../backend/docs/plano.md`, épico 3). O contrato é o da B26. Telas, decididas pela sessão global:
- rota `/catalog`, com as abas Conexões, Datasets e Arquivos (os rótulos ficam em português; o caminho é código);
- detalhe do dataset em `/catalog/datasets/:id`, com colunas e variáveis;
- vertical `catalog/`, com as sub-verticais `connections/`, `datasets/` (as variáveis ficam dentro, porque são editadas na tela do dataset) e `files/`.

**Código em inglês (regra do dono de 2026-11-16; decisões E3-15 a E3-19 do back, e esta, E3-20, do front).** Todo o código vai para o inglês; os textos para pessoas continuam em pt-BR (veja "Idioma" no Contexto). Os nomes de código citados nas tarefas F29 a F35 (por exemplo `<Catalogo>`, a prop `tela`, os `codigo` de erro, as permissões e `E2E_EXEMPLO_*`) foram escritos antes da regra e valem pelo conceito: o nome a usar é o do glossário (`../backend/docs/glossario.md` para a API e `docs/glossario.md` para o front). Exemplos: `<Catalogo>` → `<Catalog>`; `tela` → `screen`; `conexao_em_uso` → `connection_in_use`; `conexoes.ver` → `connections.view`. Os rótulos da tela ("Nova conexão", "Salvar", "Testar") não mudam. Nomes estruturais fixados agora, por causa da posse de arquivos:
- verticais: `administracao` → `admin`, `auditoria` → `audit`, `catalogo` → `catalog`, `estados` → `states`, `execucoes` → `executions`, `inicio` → `home`, `modulo` → `module`, `notificacoes` → `notifications`, `sessao` → `session`, `testes` → `test-cases`; `api`, `design-system`, `editor`, `formula` e `workflows` ficam;
- subpastas: `api/gerado` → `api/generated`, `api/cliente` → `api/client`, `api/consultas` → `api/queries`; `design-system/{exibicao,formulario,raiz,tipografia}` → `{display,form,root,typography}`; `modulo/{avulso,casca,incorporado,roteador}` → `module/{standalone,shell,embedded,router}`; `sessao/{entrar,redefinir}` → `session/{sign-in,reset-password}`; `administracao/{integracao,papeis,seguranca,usuarios}` → `admin/{integration,roles,security,users}`; `auditoria/acessos` → `audit/access`;
- app: `apps/casca` → `apps/shell` (pacote `shell`);
- ponta a ponta: `e2e/epico-<n>` → `e2e/epic-<n>`, `e2e/apoio` → `e2e/support`;
- comandos: `pnpm gerar:api` → `pnpm generate:api`;
- exceções: o nome do produto (`@fluxo/react`, `<FluxoCalculo>`) e os prefixos `fc-` das classes e `--fc-` dos tokens (o resto do nome do token vai para o inglês).

**F41 · Código TypeScript em inglês**
- dep: F22, B46
- modelo: opus
- arquivos: `packages/`, `apps/`, `e2e/`, `scripts/`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `eslint.config.js`, `playwright.config.ts`, `tsconfig.base.json`, `.changeset/`, `README.md`, `docs/`, `.claude/rules/`
- Fazer:
  - `docs/glossario.md` do front: os termos que não são da API (verticais, componentes, props, hooks, tokens `--fc-*`, classes `fc-`, rotas da URL, scripts), sem contrariar a lista acima nem o glossário do back;
  - renomear para o glossário: pastas, arquivos, componentes, hooks, funções, variáveis, tipos, props, comentários, nomes de token e de classe, rotas da URL e scripts do `package.json`;
  - **a interface pública muda de nome** (`<Inicio>` → `<Home>`, `<Administracao>` → `<Admin>`, `<Auditoria>` → `<Audit>`, `<Entrar>` → `<SignIn>`, `<RedefinirSenha>` → `<ResetPassword>`, props `tela`, `tema` (`'claro' | 'escuro' | 'sistema'`), `navegacao` (`'url' | 'memoria'`), `onEvento`, `onSessaoExpirada`, o CSS publicado `estilos.css` → `styles.css`, e os nomes de eventos): atualizar o `docs/incorporacao.md`, o README e a página de teste de incorporação, e criar um changeset `major` com a lista;
  - **sem mudar a API:** os tipos gerados só mudam de pasta (`api/generated/`); campos, caminhos e códigos da API continuam os de hoje até a F42;
  - textos que a pessoa lê (rótulos, títulos, mensagens, `aria-label`) e as descrições de `describe` e `it` ficam em português;
  - **nesta tarefa, o implementador usa `git mv`**, só nos arquivos da tarefa, para manter o histórico. Nada de `git add -A` nem `git add .`;
  - a ADR "código em inglês" do front, apontando a do back.
- Aceite:
  - `pnpm lint` (com as fronteiras atualizadas), `typecheck`, `test`, `build` e `e2e` verdes, com o mesmo número de testes de antes;
  - um `git grep` com a lista de termos em português dos dois glossários em `packages/`, `apps/` e `e2e/` só acha textos para pessoas, nomes da API (que a F42 troca) e as exceções. O comando e o resultado vão no relatório.

**F42 · Tipos e chamadas da API em inglês**
- tipo: contrato
- dep: F41, B48, B49
- modelo: opus
- arquivos: `packages/react/src/`, `e2e/`, `scripts/`, `package.json`, `README.md`, `docs/incorporacao.md`, `apps/shell/src/`, `playwright.config.ts`, `docs/glossario.md`
- Fazer:
  - `pnpm generate:api` a partir de `../backend/contracts/openapi.yaml`;
  - chamadas, campos, códigos de erro, permissões, nomes de evento e cookie (`fc_session`) no código, nos testes e nos exemplos do modo simulado;
  - no modo real: os comandos do back (`prepare-local`), as variáveis de ambiente novas do back e as do e2e em inglês (`E2E_SAMPLE_*` no lugar de `E2E_EXEMPLO_*`), documentadas no README;
  - sai a rota legada `/redefinir` do shell (a B49 passa a gerar o link com `/reset-password`), e o estado simulado do e2e vai para o inglês (exceções da F41 no `docs/glossario.md`).
- Aceite:
  - `pnpm lint`, `typecheck`, `test`, `build` e `e2e` verdes;
  - decisão D9 (sessão global, 2026-11-17): o teste de exemplos do contrato é conferido contra o contrato commitado da B48 (`git show <commit>:contracts/openapi.yaml` num arquivo temporário), porque o do disco tem a B26 em andamento; o `pnpm e2e:real` fica para o teste de integração do CK3;
  - nenhum campo, caminho ou código da API em português no código (`git grep` com a lista do glossário do back).

**Posse no catálogo (D11, sessão global, 2026-11-17):** a F30 a F33 usam o design system como ele está. Peça visual nova que só o catálogo usa (área de soltar arquivo, campo de SQL monoespaçado) nasce dentro da sub-vertical que a usa, e só vai para o `design-system/` quando houver um segundo uso, numa tarefa própria. Consultas e testes ficam dentro da sub-vertical, como em `admin/`. A F34 é dona da raiz de `catalog/` (o `<Catalog>`, as abas e o `index.ts`) depois que a F30 a F33 terminam.

**F29 · Tipos da API do épico 3**
- tipo: contrato
- dep: F42, B26
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts` (D11)
- Aceite: `pnpm generate:api` atualizado e compilando; o teste de exemplos do contrato (`contract-examples`) verde contra o contrato da B26, com os exemplos do épico 3 (D9).

**F30 · Catálogo: conexões**
- dep: F29
- modelo: opus
- arquivos: `packages/react/src/catalog/connections/`
- Fazer:
  - **lista:** nome, tipo e último teste (ponto + palavra: "ok", "falhou", "não testada", com a data);
  - **nova conexão** (só com `conexoes.gerenciar` e `credenciais.gerenciar`):
    - campos tipo, nome, host, porta (padrão 5432 ou 1433 conforme o tipo), banco, usuário e senha (`type="password"`);
    - "Testar" antes de "Salvar", mostrando versão, TLS, somente leitura e tempo. O "Salvar" fica habilitado sem teste prévio: a API testa ao salvar e não grava se falhar (decisão da sessão global na F30);
    - erros por `codigo`: `conexao_nao_somente_leitura` com a lista de privilégios, `conexao_sem_tls`, `conexao_falhou` e `conexao_existente`;
  - **detalhe:** renomear; testar a conexão salva; remover com confirmação (`conexao_em_uso`);
  - **trocar credencial** (só `credenciais.gerenciar`): o `destino` aparece preenchido e a senha vazia, e salvar exige os cinco campos;
  - **sem `credenciais.gerenciar`:** não aparecem nem o destino nem as ações de credencial.
  - **D34 do back (segurança do teste de conexão):** o erro `connection_target_not_allowed` (destino bloqueado) aparece como os outros, com a mensagem da API; as mensagens de erro do teste são textos fixos da API, mostrados como vêm; sem `credentials.manage`, o `last_test` traz só `ok`, `tested_at` e `error`, e a tela mostra só o ponto, a palavra e a data (versão, TLS, somente leitura e tempo aparecem só no resultado do botão "Testar").
  - **Campo só de escrita (design §4):** a credencial nunca vai para o cache do TanStack Query, para o `localStorage` nem para a URL. O estado do formulário é apagado ao salvar, cancelar ou fechar.
- Aceite:
  - testes de cada ação e de cada erro;
  - estados vazio, carregando e erro;
  - um teste prova que, depois de salvar ou cancelar, a senha digitada não está no cache de consultas nem no DOM.

**F31 · Catálogo: datasets de tabela e de SQL**
- dep: F29
- modelo: opus
- arquivos: `packages/react/src/catalog/datasets/`, `packages/react/src/catalog/columns/`
- Fazer:
  - **colunas compartilhadas (D11):** a tabela de colunas com tipos e os rótulos de `DataType` ficam em `catalog/columns/`, usados também pela F32 e pela F33;
  - **lista de datasets:** nome, tipo, origem e data das colunas;
  - **novo de tabela:**
    - escolher a conexão;
    - navegar pelos objetos, com busca e "Carregar mais" (cursor);
    - ver as colunas antes de criar;
    - dar o nome;
  - **novo de SQL** (só `sql_livre.usar`): área de texto monoespaçada (o Monaco entra no épico 4); `sql_invalido` mostra o motivo no campo;
  - **detalhe do dataset:**
    - colunas com nome, tipo de origem, tipo e anulável; coluna com `tipo: null` aparece como "sem suporte";
    - "Atualizar colunas";
    - renomear;
    - remover com confirmação, que avisa que as variáveis também saem.
- Aceite: testes de cada fluxo e de cada erro (`objeto_inexistente`, `dataset_existente`, `sql_invalido`); estados vazio, carregando e erro.

**F32 · Catálogo: arquivos Excel**
- dep: F29, F31
- modelo: opus
- arquivos: `packages/react/src/catalog/files/`, `packages/react/src/api/client/` (só se o envio multipart pedir ajuste no cliente)
- Fazer:
  - **envio:** arrastar e soltar, ou botão; só `.xlsx`; o limite de 20 MB é conferido também no cliente; progresso do envio;
  - **erros:** `arquivo_grande`, `arquivo_invalido` e `cabecalho_invalido`, este com as colunas apontadas;
  - **lista de arquivos;**
  - **detalhe do arquivo:** abas com colunas e tipos inferidos, e "Criar dataset desta aba" (`POST /v1/datasets` com `tipo: excel`);
  - **remover** com confirmação (`arquivo_em_uso`).
- Aceite: testes do envio (sucesso, cada erro e limite no cliente), das abas e da criação do dataset; estados vazio, carregando e erro.

**F33 · Catálogo: variáveis no detalhe do dataset**
- dep: F31
- modelo: opus
- arquivos: `packages/react/src/catalog/datasets/`
- Fazer:
  - no detalhe do dataset, cada coluna com tipo suportado pode virar variável: nome de negócio, tipo (só as conversões aceitas pela E3-10) e casas para `decimal`;
  - editar e remover variáveis;
  - erros por `codigo`: `variavel_existente`, `tipo_incompativel` e `nome_variavel_invalido`; a regra do nome também é conferida no cliente;
  - sem `variaveis.gerenciar`, as variáveis aparecem só para leitura.
  - achado da revisão da F31 (sessão global): uma falha ao recarregar a lista de conexões em segundo plano não esconde o seletor nem trava o "Salvar" do "Novo dataset"; os dados já carregados continuam valendo, com um aviso discreto de que não foi possível atualizar.
- Aceite: testes de criar, editar e remover; cada erro; o seletor de tipo oferece só as conversões aceitas.

**F34 · Integração do épico 3: menu Catálogo, rotas e interface pública**
- dep: F30, F32, F33, F40
- modelo: sonnet
- arquivos: `packages/react/src/catalog/`, `packages/react/src/module/`, `packages/react/src/index.ts`, `apps/shell/src/`, `docs/incorporacao.md`, `README.md`, `.changeset/`, `docs/glossario.md` (os nomes novos do catálogo, como `Connections`, `ConnectionList` e `ConnectionDetail`)
- Fazer:
  - `catalogo/index.ts` exporta `<Catalogo>`, com as abas (cada uma com a sua permissão), e o detalhe do dataset;
  - item "Catálogo" no menu, com `conexoes.ver`;
  - rotas `/catalogo`, `/catalogo/conexoes/:id`, `/catalogo/datasets/:id` e `/catalogo/arquivos/:id`;
  - a prop `tela` aceita `catalogo`;
  - o pacote exporta `<Catalogo>` (Contratos: componentes por tela).
- Achados da revisão da F32 (sessão global), na tela de arquivos:
  - remover um arquivo tira também o detalhe dele do cache;
  - o envio em andamento pode ser cancelado ("Cancelar"), sem deixar arquivo pela metade na lista;
  - um 413, venha da API ou de um proxy, mostra a mensagem de tamanho máximo, sem "Tentar de novo".
- Achados da revisão da F33 (sessão global), na tela do dataset:
  - quando a lista de variáveis falha, a coluna "Variáveis" mostra o estado de erro com "Tentar de novo", em vez de ficar vazia;
  - o diálogo da variável fecha assim que a API confirma; o recarregamento do catálogo segue em segundo plano;
  - ao editar uma variável cujo tipo não está mais entre as conversões aceitas (a coluna mudou), o tipo atual aparece marcado como "não aceito mais", e salvar exige escolher um tipo válido.
- Aceite: testes por papel (o Integrador vê e edita tudo; o Configurador vê o catálogo só para leitura, sem credenciais; o Auditor também só lê); `pnpm build` gera o pacote com o export novo.

**F35 · Testes ponta a ponta do épico 3**
- dep: F34
- modelo: opus
- arquivos: `e2e/epic-3/`, `e2e/support/`, `playwright.config.ts`, `README.md`
- Fazer:
  - os fluxos do épico 3 do plano global: conexão Postgres de exemplo (testar, objetos e colunas com tipos), dataset com nome de negócio nas colunas (variáveis), envio de Excel com aba e tipos inferidos, e a credencial que nunca volta para o front;
  - no modo real:
    - usar o `postgres-exemplo` do back, com as credenciais por variáveis `E2E_EXEMPLO_*`, documentadas no README;
    - provar que nenhuma resposta da API depois de salvar contém a senha (interceptando as respostas no Playwright);
    - provar que a conexão com o `exemplo_escrita` é recusada.
- Aceite: `pnpm e2e` passa.

**F40 · Manutenção: abas no design system, títulos e estilos crus**
- dep: F42
- modelo: opus
- arquivos: `packages/react/src/design-system/`, `packages/react/src/admin/`, `packages/react/src/module/`, `packages/react/src/audit/`, `packages/react/src/home/`, `packages/react/src/session/`, `apps/shell/src/`, `docs/adr/`, `e2e/epic-2/` (D10: a ADR 0027 e os fluxos do épico 2 que mudam com a navegação nova)
- Fazer (pendências adiáveis do CK2, decididas pela sessão global):
  - **componente `Abas` no design system** (Radix Tabs, estilo do `estilos.md`), no lugar das abas repetidas em `administracao/` e `modulo/`. O `<Catalogo>` do épico 3 vai usá-lo;
  - **Administração uma vez só no casca:** o menu lateral mostra um item "Administração", e as áreas (Usuários, Papéis, Integração, Segurança) ficam só nas abas internas, como no incorporado. A ADR 0027 recebe uma atualização;
  - **h1 em toda tela**, com a hierarquia de títulos coerente (o h2 da F19 vira subtítulo onde couber);
  - **sem valores crus:** os px de layout de `acessos.css` e as cores e estilos inline de `apps/casca/src/teste-incorporacao.tsx` passam a usar tokens `--fc-*`;
  - **confirmado como está:** o Admin sem menu de ações e o selo "Sensível" em âmbar (F15); datas absolutas e o "…" desabilitado com motivo na chave revogada (F16); rótulos e cores dos 13 tipos de evento (F18).
- Aceite: testes do `Abas` (teclado, foco, permissões); as telas de Administração e Auditoria continuam passando; `pnpm lint`, `typecheck`, `test`, `build` e `e2e` verdes; nenhum `--fc-` declarado fora do `tokens.css` e nenhum px de layout cru nos arquivos citados.

**F44 · Manutenção: catálogo robusto (achados da revisão da F34)**
- dep: F34
- modelo: sonnet
- arquivos: `packages/react/src/catalog/`, `packages/react/src/api/index.ts` (só para expor o detector de cancelamento de `api/client/apiError.ts`, se ainda não estiver exposto)
- Fazer (decidido pela sessão global):
  - um endereço mal formado em `/catalog/...` (id inválido, parte faltando) mostra o estado "não encontrado" com o caminho de volta, sem derrubar a tela;
  - o "Tentar de novo" das variáveis aparece no lugar certo da tabela quando a lista falha, não só numa linha;
  - o detector de cancelamento duplicado vira um só: fica o de `api/client/apiError.ts`, exposto pelo `api/index.ts`, e o catálogo apaga a cópia dele e passa a usar esse (decisão da sessão global na verificação da F44);
  - o envio de arquivo que continua ao trocar de aba fica como está, mas o resultado (sucesso ou erro) aparece na aba Arquivos quando a pessoa voltar.
- Aceite: testes de cada caso; lint, typecheck, test e build verdes.

**F45 · Manutenção: erros e cancelamento do catálogo num lugar só**
- dep: F44
- modelo: sonnet
- arquivos: `packages/react/src/catalog/`, `packages/react/src/api/index.ts`
- Fazer (observações da revisão da F44, decididas pela sessão global):
  - **erros:** uma função única do catálogo traduz o erro de consulta em mensagem; `not_found` vira "não encontrado" em todas as telas (conexões, datasets, arquivos e variáveis); `invalid_data` só vira "não encontrado" nas consultas de detalhe por id (id mal formado no endereço); nas listas, um 422 mostra a mensagem de erro da consulta com "Tentar de novo" (correção da sessão global na verificação da F45). Sai a lista repetida em 4 telas e a mensagem crua da API;
  - **cancelamento:** o `api/index.ts` passa a exportar o detector de cancelamento de `api/client/apiError.ts`; o catálogo apaga a cópia de `catalog/files/queries.ts` e usa o exportado.
- Aceite: teste da função de erros com cada código; nenhuma cópia do detector no catálogo; lint (com as fronteiras), typecheck, test e build verdes.

**F43 · Manutenção: testes estáveis sob carga**
- dep: F35
- modelo: sonnet
- arquivos: `packages/react/src/`, `packages/react/vite.config.ts` (D13: em `packages/react/src/`, só arquivos de teste `*.test.ts(x)` e de apoio aos testes; fora de `admin/` e `catalog/datasets/`, nenhum componente muda)
- Fazer (achado da verificação da F31, decidido pela sessão global):
  - no `pnpm test` completo sob carga, testes da Administração (como `admin/users/UserDialog.test.tsx`) e o "Carregar mais" de `catalog/datasets/` estouram o tempo e passam sozinhos;
  - achar a causa em cada um (espera fixa, `waitFor` sem consulta assíncrona, `userEvent` com atraso, renderização pesada) e corrigir no teste ou no componente;
  - aumentar o tempo limite global só se a causa for comprovadamente a máquina, e com o motivo num comentário.
  - **D13 (sessão global, 2026-11-18):** a causa do tempo (a pausa do `userEvent` a cada ação) vale para todos os testes do pacote. A correção (`delay: null` e colar o texto no lugar de digitar, onde isso não enfraquece a asserção) se aplica a todos os testes de `packages/react/src/` que usam `userEvent`, de uma vez, e não pasta por pasta. Fora de `admin/` e `catalog/datasets/`, mudam só os arquivos de teste e de apoio aos testes.
  - **D12 (sessão global, 2026-11-18):** a causa medida é saturação de CPU. Fica o `maxWorkers: 4` e entra `testTimeout: 15000` no `vite.config.ts`, os dois com a medição no comentário. No `module/catalogByRole.test.tsx`, as consultas `findByRole` que passaram de 1 s sob carga recebem `{ timeout: 4000 }` na própria chamada, com o motivo comentado. Não se cria arquivo de setup novo (`vitest.setup.ts`): a criação foi negada pelo controle de permissões, e o ajuste por chamada resolve sem ela.
- Aceite: `pnpm test` completo três vezes seguidas, sem nenhuma falha por tempo, com a máquina ocupada pelo e2e simulado rodando em paralelo numa das vezes; lint, typecheck e build verdes.

**F60 · Catálogo — credencial ilegível (D44) e conflito de versão**
- dep: F45, B73
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `packages/react/src/catalog/connections/`, `packages/react/src/catalog/datasets/`, `packages/react/src/catalog/Catalog.tsx`, `e2e/support/contract.ts` (ampliada na dúvida da F60, como a D11 da F29)
- Fazer (D44 do back, decidida pela sessão global em 2026-11-18):
  - `pnpm generate:api` com o contrato da B73;
  - quando testar a conexão, abrir os objetos ou ver as colunas responder `409 connection_credential_unreadable`, mostrar a mensagem da API e oferecer a ação que já existe de trocar a credencial, para quem tem `credentials.manage`. Quem não tem essa permissão vê só a mensagem;
  - a B73 também declara o `409 connection_credential_unreadable` nas rotas de dataset que abrem o banco do cliente (criar dataset, atualizar colunas e prévia, conforme o contrato): nas telas de `catalog/datasets/`, mostrar a mesma mensagem, com um link para a conexão do dataset em vez da ação de trocar a credencial;
  - `409 connection_changed` (conflito de versão, B73) ao renomear, trocar a credencial ou testar a conexão salva: mostrar a mensagem da API com **Recarregar**, que busca a conexão de novo, sem reenviar nada sozinho;
  - a lista e o detalhe continuam mostrando a conexão quando o `target` vem `null`. Esse caso já existe para quem não tem `credentials.manage`; confira que ele também cobre quem tem a permissão.
- Aceite: testes do componente com o 409 `connection_credential_unreadable` nas três ações, com e sem `credentials.manage`, com o 409 `connection_changed` nas três ações que gravam, e com o `target` nulo para quem tem a permissão; tipos, lint, testes e build verdes.

**F36 · Portão do épico 3**
- tipo: portao
- dep: F29, F30, F31, F32, F33, F34, F35, F40, F41, F42, F43, F44, F45, F60
- modelo: sonnet
- Aceite: o mesmo do F12, com as telas do épico 3.

### Épico 4 — Linguagem de fórmula, Cálculo e Tabela de Decisão

As decisões E4-1 a E4-18, a linguagem e as permissões estão no plano do back (`../backend/docs/plano.md`, épico 4, e Contratos, "Linguagem de fórmula e motor"). O contrato é o da B56. Decisões do front, tomadas pela sessão global em 2026-11-18:
- **E4-19, telas e verticais:**
  - rotas `/workflows` (lista), `/workflows/:id` (Visão geral) e `/workflows/:id/editor` (editor);
  - vertical `workflows/` (lista, novo workflow, Visão geral e as consultas do workflow), vertical `editor/` (tela cheia, rascunho, canvas, camadas, propriedades, grade da Tabela de Decisão, problemas e "Calcular") e vertical `formula/` (Monaco e a linguagem);
  - o editor usa o `formula/` e o `workflows/` só pelo `index.ts` deles.
  - Motivo: as verticais já existem vazias com esses papéis (ADR 0003).
- **E4-20, editor:**
  - **no casca:** tela cheia, sem o menu do app; barra de 48px com ←, caminho, selo "Rascunho", "● N problemas" clicável e "Salvo há…";
  - **incorporado:** ocupa a área do módulo e esconde as abas, com ← para voltar;
  - **painéis:** Camadas, canvas, Propriedades e o painel inferior com as abas **Problemas** e **Calcular**. Testes e Prévia entram nos épicos 10 e 5; Rodar testes, Simular e Enviar para revisão também ficam fora;
  - **sem `workflows.edit`:** o editor abre só para leitura, e a aba Calcular aparece com `workflows.edit` ou `simulations.run`.
  - Motivo: design §15 e estilos §9 e §16, mostrando só o que já funciona neste épico.
- **E4-21, Monaco:**
  - o pacote `monaco-editor` vem do npm, carregado por `import()` só quando um campo de fórmula aparece, sem CDN e sem os serviços de linguagem do Monaco (TypeScript, JSON, CSS): a linguagem `fluxo-formula` é nossa;
  - o Monaco só serve à fórmula do Cálculo; as células e os cabeçalhos da Tabela de Decisão são campos de texto simples, monoespaçados;
  - se o Monaco não carregar, o campo vira um campo de texto simples, com o aviso, e os problemas aparecem embaixo.
  - Motivo: design §3 (Monaco sob demanda); um Monaco por célula pesaria demais numa grade de 500 regras.
- **E4-22, grade da Tabela de Decisão:**
  - "Abrir tabela", nas propriedades, abre a grade no lugar do canvas (Esc ou "Voltar ao canvas" fecha);
  - nas propriedades ficam a política de acerto e as colunas;
  - a grade tem teclado de planilha (setas, Enter, Tab, F2, digitar substitui) e aceita colar um bloco copiado do Excel (texto separado por tabulação).
  - Motivo: o painel de 340px não comporta uma tabela, e o contador vem do Excel.
- **E4-23, salvar e analisar:**
  - o rascunho é salvo sozinho 2 s depois da última mudança, ao sair do editor e antes de "Calcular";
  - enquanto se digita, a análise (`POST …/draft/analysis`) roda 400 ms depois da última tecla, só para os problemas e os símbolos, sem salvar;
  - um `409 draft_conflict` para o salvamento e mostra "Este rascunho mudou em outra aba ou por outra pessoa", com **Recarregar rascunho**. Nada é mesclado.
  - Motivo: a pessoa não perde o que digitou, e a auditoria não recebe um evento por tecla.
- **E4-24, números na tela:**
  - no "Calcular", os campos de número aceitam o padrão brasileiro (vírgula decimal, pontos de milhar opcionais: `1500,00` ou `1.500,00`) e mandam à API o texto com ponto;
  - o resultado mostra `1.500,00`;
  - um valor com mais casas que a entrada é recusado no próprio campo, sem arredondar.
  - Motivo: estilos §3; a regra de nunca arredondar a entrada (E4-14).
- **E4-25, navegação:**
  - dentro de um workflow, o seletor de contexto mostra tenant › workflow, e o menu do nível do workflow tem só **Visão geral** neste épico. Versões, Execuções, Testes, Descrição e Configurações entram com os épicos deles;
  - o Início passa a mostrar os workflows recentes (até 6, pelo `updated_at`), com **Novo workflow**.
  - Motivo: estilos §12 (nada de item que não leva a lugar nenhum) e §16 (Início).

**F46 · Tipos da API do épico 4**
- tipo: contrato
- dep: B56
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`
- Aceite: `pnpm generate:api` atualizado e compilando; o teste de exemplos do contrato (`contract-examples`) verde contra o contrato da B56, com os exemplos do épico 4 (rascunho do exemplo, análise com problema, execução unitária `ok`, `ok_with_warnings` e `error`) e o 429 do teste de conexão.

**F47 · Dependências do editor**
- dep: —
- modelo: sonnet
- arquivos: `package.json`, `pnpm-lock.yaml`, `packages/react/package.json`, `packages/react/vite.config.ts`, `docs/adr/`
- Fazer:
  - instalar `@xyflow/react` e `monaco-editor` como dependências do pacote, com versão fixada;
  - configurar o build para o Monaco sair num pedaço próprio, carregado sob demanda (E4-21), com o worker do editor empacotado localmente. Sem worker, o Monaco roda na página, e isso fica registrado;
  - a ADR "Monaco e React Flow no pacote": o carregamento sob demanda, o CSS de cada um (classes próprias, sem reset global, ADR 0002) e o tamanho medido.
- Aceite (evidência no relatório):
  - `pnpm build` gera o pacote com o Monaco num pedaço separado; a entrada principal (`dist/index.js`) não contém o código do Monaco;
  - o build não tem URL de CDN (busca por `cdn` e `jsdelivr` no `dist/`);
  - o CSS gerado continua sem seletor global (`*`, `html`, `body`, `:root`);
  - `pnpm lint`, `typecheck` e `test` verdes.

**F48 · Workflows: lista e novo workflow**
- dep: F46
- modelo: opus
- arquivos: `packages/react/src/workflows/index.ts`, `packages/react/src/workflows/queries.ts`, `packages/react/src/workflows/list/`
- Fazer:
  - as consultas e mutações dos workflows (`queries.ts`: listar com filtro e cursor, ler, criar, alterar e remover), com as chaves de Contratos, expostas no `workflows/index.ts` para o editor e o Início;
  - **lista** (`/workflows`):
    - cards de workflow (estilos §7.6): ícone em contorno, nome, "Rascunho · N blocos", "editado por X há Y" e o selo âmbar de problemas quando houver;
    - "Filtrar por nome" e "Carregar mais" (cursor);
    - 3 colunas a partir de 1440px e 2 abaixo de 1180px (estilos §15);
  - **Novo workflow** (só com `workflows.edit`): diálogo com nome e objetivo; `workflow_exists` aparece no campo do nome; ao salvar, abre a Visão geral do workflow novo;
  - estados vazio ("Nenhum workflow ainda" · "Crie o primeiro workflow para montar o cálculo." · **Novo workflow**), carregando e erro.
- Aceite: testes da lista, do filtro, do "Carregar mais", da criação (sucesso e `workflow_exists`), sem o botão para quem não tem `workflows.edit`; os quatro estados.

**F49 · Workflows: Visão geral**
- dep: F48
- modelo: opus
- arquivos: `packages/react/src/workflows/overview/`
- Fazer (estilos §16, só o que existe no épico 4):
  - título e objetivo, com **Abrir editor** como ação principal;
  - **Versão em produção:** estado vazio "Nenhuma versão publicada" (versões são do épico 10);
  - **Rascunho** em uma linha: revisão, quem editou e quando, número de blocos e o selo de problemas;
  - **Execuções:** estado vazio;
  - menu "…" com **Renomear** (nome e objetivo, `workflow_exists` no campo) e **Remover workflow** (confirmação com o nome; depois volta para a lista e tira o detalhe do cache);
  - sem `workflows.edit`: sem o menu, e o botão continua **Abrir editor** (o editor abre só para leitura);
  - `not_found` e id mal formado mostram "não encontrado", com o caminho de volta (como a F44).
- Aceite: testes de cada parte, de renomear, de remover e dos erros; os quatro estados.

**F50 · Editor: tela cheia, rascunho e problemas**
- dep: F47, F48
- modelo: opus
- arquivos: `packages/react/src/editor/draft/`, `packages/react/src/editor/layout/`, `packages/react/src/editor/problems/`
- Fazer:
  - **rascunho:**
    - as consultas do rascunho (`GET` e `PUT …/draft`, a análise);
    - o estado da edição local (definição, item selecionado e "desfazer" de até 50 passos, com Ctrl Z e Ctrl Shift Z);
    - o salvamento sozinho e a análise ao digitar (E4-23), com o "Salvo há…" e o "Salvando…";
    - o conflito `draft_conflict` (E4-23);
    - o modo só leitura (E4-20);
  - **layout** (estilos §9 e §15):
    - barra de 48px e painéis Camadas 260px, canvas, Propriedades 340px e inferior 220px recolhível (220px e 300px de 1180px a 1280px);
    - os painéis recebem o conteúdo por propriedades, para a F57 montar;
  - **problemas:**
    - o contador "● N problemas" na barra, que abre a aba Problemas;
    - a lista agrupada por bloco, com código e mensagem, e com o clique selecionando o bloco e o campo;
    - a contagem por bloco, exposta para o canvas e as camadas.
- Aceite (testes com a API simulada):
  - salva 2 s depois da última mudança e não antes; salva ao sair;
  - a análise roda 400 ms depois da última tecla e não salva;
  - `409` mostra o aviso e **Recarregar rascunho** traz a versão nova;
  - desfazer e refazer;
  - só leitura sem `workflows.edit`;
  - o contador e a lista de problemas, com o clique levando ao bloco;
  - os quatro estados da tela.

**F51 · Editor: canvas e camadas**
- dep: F50, F74, F75
- modelo: opus
- arquivos: `packages/react/src/editor/canvas/`, `packages/react/src/editor/layers/`
- Fazer (React Flow; estilos §8 e §11):
  - **blocos** Cálculo e Tabela de Decisão: quadrado da categoria (`--fc-cat-calc`, `--fc-cat-decision`), nome em `mono-13`, tipo em 11px;
    - portas de entrada à esquerda (as variáveis que o bloco lê) e de saída à direita (as que ele produz), com o tipo em `mono-12`;
    - ícone vermelho e número de problemas no cabeçalho;
  - **entradas e saída:** uma barra **Entradas** à esquerda (as entradas declaradas, com a múltipla mostrando os campos) e uma barra **Saída** à direita (os campos de saída), como as barras de Input e Output do grupo;
  - **ligações:** vêm dos `symbols` e das `dependencies` da análise (E4-9, D15: B106 e F75), nunca são desenhadas à mão. As portas de entrada são os `reads` de cada nó, e a contagem do Delete é o número de nós que leem a saída do bloco. As do bloco selecionado em `gray-1000`; as outras em `gray-500`;
  - **barra de ferramentas** flutuante, embaixo e no centro, com Cálculo e Tabela de Decisão. Um bloco novo nasce com id e nome de saída livres (`calc_1`, `resultado_1`…), perto do centro da tela;
  - mover o bloco grava a `position`; Delete remove o bloco selecionado, com a confirmação que diz quantos blocos usam a saída dele;
  - **minimapa e zoom** no canto superior direito (o minimapa some abaixo de 1280px);
  - **teclado:** Tab passa pelos blocos, as setas movem, Enter abre as propriedades, Esc tira a seleção;
  - **camadas:** a árvore Entradas › blocos (na ordem de `root.nodes`) › Saída, em `mono-13`, com o ícone de problema e a seleção ligada ao canvas;
  - só leitura: sem a barra de ferramentas, sem mover e sem remover.
- Aceite: testes de cada item (incluir, mover, remover com confirmação, seleção ligada entre canvas e camadas, teclado, ícone de problema); ligações derivadas de um rascunho de exemplo; nada de ligação desenhada à mão.

**F52 · Fórmula: editor Monaco e linguagem**
- dep: F46, F47
- modelo: opus
- arquivos: `packages/react/src/formula/`
- Fazer (E4-21; estilos §8, "Editor de fórmula"):
  - `<FormulaEditor value onChange problems symbols context readOnly aria-label />`, exposto no `formula/index.ts`;
  - a consulta `GET /v1/formula-language` e a linguagem `fluxo-formula` no Monaco: funções (com os sinônimos sem acento) em `--fc-cat-source`, números em `--fc-cat-calc`, palavras-chave em `--fc-cat-decision`; `mono-13`, fundo `background-200`, raio 6px; tema claro e escuro pelos tokens;
  - **autocomplete:**
    - os símbolos com nome, tipo e o quadrado da categoria da origem (entrada linear `--fc-cat-source`, múltipla `--fc-cat-multi`, Cálculo `--fc-cat-calc`, Tabela `--fc-cat-decision`);
    - as funções do contexto, com a assinatura e a descrição;
    - depois de um campo múltiplo, completa com `[]`;
  - **problemas:** sublinhado ondulado `red-700` nas posições do problema (convertidas de pontos de código), a mensagem ao passar o mouse e uma nota vermelha embaixo. Com `suggestion`, a correção rápida "Trocar por X";
  - **acessibilidade:** Tab sai do editor (o modo de foco por Tab do Monaco ligado), `aria-label` do campo e `aria-describedby` para a nota de problema;
  - carregando: o esqueleto do campo; falha ao carregar: campo de texto simples com o aviso (E4-21).
- Aceite (com o Monaco simulado nos testes de unidade, e um teste que carrega o de verdade):
  - realce de cada classe de símbolo;
  - autocomplete com símbolos e funções;
  - marcação na posição certa com acento antes do trecho;
  - a correção rápida troca o nome;
  - Tab sai do editor;
  - o Monaco não é pedido antes de o campo aparecer (o `import()` só roda ao montar);
  - a falha ao carregar mostra o campo simples.

**F53 · Editor: propriedades do Cálculo, das entradas, da saída e do workflow**
- dep: F50, F52, F74, F75
- modelo: opus
- arquivos: `packages/react/src/editor/properties/`, `packages/react/src/catalog/index.ts`
- Fazer:
  - **Cálculo:**
    - nome do bloco, descrição curta e a fórmula no `<FormulaEditor>`, passando em `analyzedValue` o texto que foi enviado à análise (sem isso, uma análise que devolve os mesmos problemas não repõe os marcadores; achado da F52);
    - a saída: nome da variável, tipo `integer` ou `decimal` e casas (padrão: as casas do workflow);
    - modo de arredondamento e política de erro, cada um com "Herdar do workflow"; o valor padrão aparece só com "Usar valor padrão";
  - **Entradas:**
    - lista das entradas declaradas: nome, Linear ou Múltiplo (segmented control), tipo e casas;
    - a múltipla tem os campos (nome, tipo, casas);
    - incluir, remover (com aviso de quantos blocos usam a entrada, contados pelas `dependencies` da análise; D15 e D16) e reordenar;
  - **Saída:** os campos (nome e variável escolhida entre os símbolos lineares);
  - **Workflow** (nada selecionado): política de erro e arredondamento padrão (casas e modo);
  - os problemas de cada campo aparecem junto do campo, pelo `path`;
  - só leitura: tudo desabilitado, com o motivo "Você não tem permissão para editar este workflow".
- Aceite: testes de cada formulário (mudança vai para o rascunho; o problema aparece no campo certo pelo `path`; o valor padrão só com a política certa; segmented control por teclado); só leitura.

**F54 · Editor: grade da Tabela de Decisão**
- dep: F50
- modelo: opus
- arquivos: `packages/react/src/editor/decision-table/`
- Fazer (E4-22):
  - **propriedades da Tabela:** nome, descrição, política de acerto ("Primeira" ou "Única"), modo de arredondamento e política de erro (com "Herdar do workflow"); colunas de condição (fórmula do cabeçalho) e de resultado (nome, tipo, casas e valor padrão); **Abrir tabela**;
  - **grade:**
    - cabeçalho com as condições e os resultados separados por uma divisória;
    - linhas numeradas a partir de 1;
    - células monoespaçadas: vazia mostra `-` em terciário;
    - incluir, remover e mover regras (botões e Alt + seta);
    - incluir e remover colunas;
    - teclado de planilha e colar do Excel, que acrescenta linhas quando o bloco colado passa do fim;
    - cada célula com problema tem borda `red-700`, e a mensagem aparece ao focar (`aria-describedby`) e na aba Problemas;
  - **acessibilidade:** `role="grid"`, cabeçalhos ligados às células e o foco visível na célula;
  - **até 500 regras** sem travar a digitação (lista virtualizada se precisar).
- Aceite: testes de edição pelo teclado, colar um bloco 3 × 2 do Excel (inclusive passando do fim), incluir, remover e mover regras e colunas, a política de acerto, problema numa célula pelo `path`, só leitura; uma grade de 500 regras abre e responde à digitação sem atraso perceptível (teste com tempo limite).

**F55 · Editor: calcular com valores digitados**
- dep: F50
- modelo: opus
- arquivos: `packages/react/src/editor/unit-run/`
- Fazer (E4-14, E4-24):
  - aba **Calcular** no painel inferior, com o formulário gerado das entradas declaradas:
    - texto: campo de texto;
    - número: campo de número no padrão brasileiro;
    - data e data e hora: campos próprios;
    - booleano: seleção "vazio", "verdadeiro" e "falso";
    - múltipla: uma tabela pequena de itens, com incluir e remover;
  - campo vazio vai como nulo (múltipla vazia, como lista vazia);
  - **Calcular:**
    - salva o rascunho pendente antes de rodar;
    - fica desabilitado com o motivo "Resolva N problemas para calcular" enquanto houver problema;
    - `draft_conflict` mostra o aviso da E4-23;
    - `invalid_inputs` marca o campo pelo `fields`;
  - **resultado:**
    - status com ponto e palavra (ok, com avisos, erro; estilos §7.5);
    - as saídas;
    - por bloco: os valores, "Regra N" na Tabela de Decisão, avisos e erro;
    - o nome do bloco seleciona-o no canvas;
    - os blocos não rodados em cinza;
  - os últimos valores digitados ficam só na memória da tela, por workflow, enquanto o módulo estiver aberto (nada de `localStorage`, design §1, princípio 3).
- Aceite:
  - conversão de `1.500,00` e `1500,5` para `"1500.00"` e `"1500.5"`; recusa de `1500,005` numa entrada de 2 casas;
  - o envio e cada estado do resultado (`ok`, `ok_with_warnings`, `error` com `not_run`);
  - o botão desabilitado com motivo;
  - `invalid_inputs` no campo certo;
  - salva antes de rodar;
  - nada em `localStorage` nem `sessionStorage` (teste que espia os dois).

**F56 · Manutenção: pendências do CK3 no front**
- dep: F46
- modelo: sonnet
- arquivos: `packages/react/src/design-system/`, `packages/react/src/catalog/connections/`, `packages/react/src/catalog/datasets/`, `packages/react/src/catalog/errors/`, `packages/react/src/catalog/files/`, `packages/react/src/catalog/Catalog.tsx`, `packages/react/src/admin/integration/queries.ts`, `packages/react/src/admin/roles/queries.ts`, `packages/react/src/admin/security/queries.ts`, `packages/react/src/admin/users/queries.ts`, `packages/react/src/api/client/apiError.ts`, `packages/react/src/module/FluxoCalculo.tsx`, `packages/react/src/module/FluxoCalculo.test.tsx`, `packages/react/src/session/reset-password/passwordReset.ts`, `e2e/epic-1/csrf.spec.ts`, `e2e/epic-2/support/screens.ts`, `e2e/epic-3/credential-never-returned.spec.ts`
- Fazer (pendências adiáveis do CK3, decididas pela sessão global):
  - **px crus no design system:** os espaços em px dos CSS de `design-system/` (por exemplo, `tabs.css`, `menu.css`, `card.css`) passam a usar os tokens `--fc-space-*`; medidas que não são espaço (borda de 1px, alturas de controle, tamanhos de fonte) ficam como estão, se já forem tokens ou exceções listadas no `estilos.md`;
  - **achados médios da revisão da F60** (sessão global, 2026-11-19), para a pessoa não perder o que digitou:
    - o "Recarregar" do `409 connection_changed` trata a falha da própria recarga, com a mensagem e a opção de tentar de novo;
    - o diálogo não fecha quando a recarga falha, e o texto digitado fica;
    - o link "Abrir conexão" dentro do "Novo dataset" pede confirmação, ou abre a conexão sem descartar o formulário, antes de trocar de aba;
    - quando a API não manda mensagem, o aviso de conflito no detalhe da conexão usa um texto padrão em pt-BR, nunca vazio;
    - o `isCredentialUnreadable` duplicado em `connections/messages.ts` e `datasets/messages.ts` vira uma função só, no lugar comum do catálogo;
    - o PUT de renomear dataset também pode responder `409 connection_credential_unreadable`: a tela de renomear mostra a mesma mensagem das outras telas de dataset;
    - os `409 dataset_changed` e `variable_changed` (B77, back) nas telas de dataset e de variável mostram a mensagem da API com **Recarregar**, como o conflito da conexão; o erro de validação do upload chega em `fields.file`;
  - **resíduos da F41:** `screen: screen` e `{ body: body }` viram a forma curta; as descrições de teste que ainda citam `navegacao` e `memoria` passam a citar `navigation` e `memory`. Os arquivos acima são os que a busca achou; confira de novo no começo da tarefa;
  - **429 do teste de conexão (E4-16):** em `catalog/connections/`, o `too_many_connection_tests` mostra "Muitos testes de conexão seguidos. Tente de novo em N s.", com o `retry_after_seconds`, e desabilita **Testar** com esse motivo até o tempo passar.
- Aceite:
  - nenhum espaço em px cru nos CSS do `design-system/` (busca com o padrão, com a lista de exceções no relatório);
  - nenhum `screen: screen`, `body: body`, `navegacao` nem `memoria` em `packages/`, `apps/` e `e2e/` (busca no relatório);
  - teste do 429 com o tempo e o botão desabilitado com motivo;
  - as telas continuam iguais na revisão de interface;
  - `pnpm lint`, `typecheck`, `test`, `build` e `e2e` verdes.

**F57 · Integração do épico 4: rotas, menu, Início e interface pública**
- dep: F49, F51, F53, F54, F55, F56
- modelo: sonnet
- arquivos: `packages/react/src/editor/index.ts`, `packages/react/src/editor/Editor.tsx`, `packages/react/src/editor/editor.css`, `packages/react/src/workflows/index.ts`, `packages/react/src/workflows/Workflows.tsx`, `packages/react/src/module/`, `packages/react/vite.config.ts`, `e2e/support/simulated-api.ts`, `e2e/epic-2/support/simulation.ts`, `e2e/epic-3/support/simulation.ts`, `packages/react/src/home/`, `packages/react/src/index.ts`, `apps/shell/src/`, `docs/incorporacao.md`, `docs/glossario.md`, `README.md`, `.changeset/`
- Fazer:
  - **editor:** `<Editor>` monta o layout da F50 com o canvas e as camadas (F51), as propriedades por tipo de item (F53 e as da Tabela, da F54), a grade da F54 no lugar do canvas e as abas Problemas e Calcular (F50, F55);
    - peças prontas: `<WorkflowCanvas onOpenProperties>` e `<Layers>` (F51), o painel de Propriedades (F53), a grade (F54, aberta pelo `isGridPath`), a aba Calcular (F55) e o `<UnsavedChangesNotice>` (F74), este nas telas seguintes ao editor;
    - o selo "React Flow" do canto do canvas **fica** (decisão da global, 2026-11-20: o pacote é MIT, e os autores pedem a atribuição a quem não assina o plano Pro);
  - **rotas e menu:**
    - `<Workflows>` com as rotas `/workflows`, `/workflows/:id` e `/workflows/:id/editor`;
    - item "Workflows" no menu, com `workflows.view`;
    - seletor de contexto tenant › workflow e o menu do nível do workflow (E4-25);
    - o editor em tela cheia no casca e na área do módulo no incorporado (E4-20);
  - a prop `screen` aceita `workflows`; o pacote exporta `<Workflows>` (Contratos: componentes por tela);
  - **Início:** "Workflows recentes" com os dados reais e **Novo workflow** (E4-25);
  - os nomes novos no `docs/glossario.md`; o guia de incorporação e um changeset `minor`.
- Aceite: testes por papel (o Configurador cria e edita; o Operador e o Auditor veem a lista, a Visão geral e o editor só para leitura, sem "Calcular"; o Aprovador vê "Calcular" e não edita; o Integrador não vê "Workflows"); o editor sem o menu do casca; o Início com os recentes; `pnpm build` gera o pacote com o export novo.

**F58 · Testes ponta a ponta do épico 4**
- dep: F57
- modelo: opus
- arquivos: `e2e/epic-4/`, `e2e/support/`, `playwright.config.ts`, `README.md`
- Fazer:
  - os fluxos do épico 4 do plano global:
    - criar um workflow e abrir o editor;
    - declarar as entradas e montar a Tabela de Decisão e os Cálculos do exemplo;
    - ver e corrigir o erro de tipo no bloco;
    - calcular com valores digitados (`ok`, com a regra que casou, e com "Única" e duas regras casando);
    - o rascunho salvo depois de recarregar;
    - o aviso de conflito com duas abas;
    - o editor só para leitura do Auditor;
  - no modo real:
    - usar o workflow "Pontuação de exemplo" do `prepare-local` e as contas por papel do épico 2;
    - provar que `Calcular` com `valor_item` 1500,00, categoria A e meta verdadeiro mostra `pontos` 225,00 e "Regra 2".
- Aceite: `pnpm e2e` passa. O modo real é exercitado no teste de integração do CK4.

**F61 · e2e isolado por worktree**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `playwright.config.ts`, `e2e/support/`, `apps/shell/vite.config.ts`, `apps/shell/vite.embed.config.ts`, `scripts/e2e-ports.mjs`, `README.md`
- Fazer (regra do dono de 2026-11-19, modo worktree no Contexto):
  - com `FLUXO_TEST_ISOLATION_ID=<id>` definida, o e2e simulado usa portas próprias para o shell e para a página de incorporação, derivadas do id de forma determinística, numa faixa fixa (por exemplo, 6100 a 6999), sem nunca cair em 5000 ou 5001;
  - sem a variável, as portas de hoje (5173 e 5274) continuam;
  - o modo real (`e2e:real`) não muda: ele roda só na integração do checkpoint;
  - a seção "Testes em paralelo (worktrees)" no README.
- Aceite: dois `pnpm e2e` simulados rodando ao mesmo tempo com ids diferentes passam sem disputar porta; sem a variável, o comportamento é o de antes; um teste das portas derivadas confere a faixa e a ausência de 5000 e 5001.

**F72 · Manutenção: caminho do back por variável (modo worktree)**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `scripts/generate-api.mjs`, `e2e/support/contract-examples.spec.ts`, `README.md`
- Fazer (proposta da frente, decidida pela sessão global em 2026-11-20):
  - o `generate:api` e o `contract-examples.spec.ts` leem o repositório do back de `FLUXO_BACKEND_DIR`, quando a variável está definida; sem ela, o caminho de hoje (`../backend`) continua;
  - com a variável definida e o contrato ausente, o comando e o teste **falham** com a mensagem clara, nunca pulam em silêncio;
  - sem a variável e sem o back (o CI do front), o teste continua pulado, com o motivo visível na saída;
  - o README, em "Testes em paralelo (worktrees)", manda definir `FLUXO_BACKEND_DIR=C:/dev/fluxo-calculo/backend` na worktree.
- Aceite: numa worktree em `worktrees/frontend/<T>` com a variável, o `pnpm generate:api` e o `contract-examples` rodam de verdade; com a variável apontando para uma pasta sem contrato, os dois falham com a mensagem; sem a variável, o comportamento é o de antes.

**F73 · Manutenção: achados médios da revisão da F56**
- dep: F56
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/catalog/connections/`, `packages/react/src/catalog/datasets/`, `packages/react/src/catalog/errors/`
- Fazer (cinco MÉDIOS da revisão da F56, decididos pela sessão global em 2026-11-20):
  - o `useTestCooldown` deriva o estado sem `setState` dentro do efeito, e o **Testar** nunca fica habilitado nem por um quadro depois do 429;
  - o 429 do salvar nos diálogos de conexão mostra a contagem regressiva, como o Testar;
  - a contagem ao lado do botão não é anunciada a cada segundo por leitor de tela: anuncia uma vez ao começar e uma vez ao liberar;
  - fica uma função só para a regra do conflito (`isChangedConflict` ou `isConnectionChanged`), no `catalog/errors/`, sem a duplicata sem uso;
  - "Continuar editando" no `NewDatasetDialog` devolve o foco ao campo de onde a pessoa saiu.
- Aceite: um teste para cada item (inclusive o botão nunca habilitado entre o 429 e a contagem, e o `aria-live` anunciando só no começo e no fim); `pnpm lint`, `typecheck` e `test` verdes.

**F74 · Manutenção: achados médios da revisão da F50**
- dep: F50
- modelo: opus
- revisão: não
- arquivos: `packages/react/src/editor/draft/`, `packages/react/src/editor/layout/`, `packages/react/src/editor/problems/`
- Fazer (MÉDIOS da revisão da tentativa 2 da F50, decididos pela sessão global em 2026-11-20):
  - **salvamento ao sair (o mais sério):** se o salvamento feito ao sair do editor falhar, a mudança fica guardada na memória da tela, por workflow, e a tela seguinte mostra "Não deu para salvar a última mudança de {workflow}.", com **Voltar ao editor**. Ao voltar, o editor abre com a mudança e tenta salvar de novo. Nada é perdido em silêncio, e nada vai para o `localStorage`;
  - o aviso "a análise falhou" nunca aparece sobre uma versão já trocada;
  - com a análise falhando, o contador da barra mostra que pode estar desatualizado ("● N problemas · desatualizado");
  - o prefetch em voo nunca abre uma revisão mais velha que a do cache;
  - na lista de problemas, os títulos seguem a ordem (h2 antes de h3);
  - o botão de recolher tem um rótulo fixo, e só o `aria-expanded` muda;
  - **D17:** o `DraftEditorProvider` guarda e o `useDraftEditor()` expõe também as `dependencies` e a `order` da análise, do salvamento e do Recarregar (complemento da ADR 0042), e o `editor/draft/` exporta o tipo `Dependency`. A F51 e a F53 leem daí, sem um segundo POST de análise;
  - **Desfazer e Refazer:** sem botões visíveis neste épico (decisão da global: o estilos.md não os desenha, e a barra fica mínima). A região do canvas declara `aria-keyshortcuts="Control+Z Control+Shift+Z"`.
- Aceite: um teste para cada item, inclusive a falha do salvamento ao sair com a volta ao editor e a mudança intacta, e nada em `localStorage` nem `sessionStorage`.

**F75 · Tipos da API: dependências e ordem na análise**
- tipo: contrato
- dep: B106
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`
- Fazer (D15, decidida pela sessão global em 2026-11-20): regenerar os tipos do contrato da B106 (`Dependency`, `dependencies` e `order` em `Draft` e `Analysis`) e pôr os campos nos exemplos do contrato simulado.
- Aceite: `pnpm typecheck` e o `contract-examples` verdes, com os tipos novos no gerado.

**F76 · Manutenção: limpar os dados da sessão no logout e na troca de tenant**
- dep: F74
- modelo: opus
- revisão: sim
- arquivos: `packages/react/src/session/`, `packages/react/src/module/`, `packages/react/src/editor/draft/unsavedChanges.ts`, `packages/react/src/editor/draft/unsavedChanges.test.ts`, `packages/react/src/editor/draft/queries.ts`, `packages/react/src/editor/draft/queries.test.ts`, `packages/react/src/editor/unit-run/memory.ts`, `packages/react/src/editor/unit-run/memory.test.ts`
- Fazer (proposta da frente, decidida pela sessão global em 2026-11-20): no logout, na troca de tenant e quando a sessão expira (401), o módulo limpa o cache inteiro do React Query (`queryClient.clear()`) e a memória de mudanças não salvas da F74, antes de mostrar a tela seguinte. Nada de um usuário ou de um tenant fica visível ao próximo, no mesmo navegador. Confira no relatório o que o back já invalida (cookie e CSRF), sem depender disso.
- Também (achados da tentativa 1, decididos pela sessão global em 2026-11-20): uma resposta de salvamento ou de consulta que chega depois da limpeza, de outra pessoa ou de outro tenant, nunca grava no cache novo (confere a sessão antes de gravar); o logout limpa uma vez só, depois de a tela sair; a memória do Calcular também é limpa.
- Também (três MÉDIOS da revisão da tentativa 2 da F74, decididos pela sessão global em 2026-11-20):
  - um teste prova que a mudança é guardada na memória **antes** de a promise do salvamento assentar;
  - quem perde a permissão de editar não perde a mudança: ela fica na memória até o logout ou a troca de tenant, e o aviso diz "Você não tem mais permissão para editar este workflow. A mudança fica guardada até você sair.";
  - um salvamento que dá certo limpa a memória daquele workflow e daquele dono, e nenhuma tela mostra "Não deu para salvar" sobre algo já salvo.
- Aceite: testes do logout, da troca de tenant e do 401: depois de cada um, nenhuma consulta antiga está no cache, a memória de mudanças está vazia e a tela seguinte busca de novo; um teste com dois usuários seguidos no mesmo módulo não mostra dado do primeiro.

**F77 · Manutenção: regras de hooks do React no lint**
- dep: F57
- modelo: sonnet
- revisão: não
- arquivos: `package.json`, `pnpm-lock.yaml`, `eslint.config.js`, `packages/react/src/`, `apps/shell/src/`
- Fazer (proposta da frente, decidida pela sessão global em 2026-11-20): acrescentar o `eslint-plugin-react-hooks` e ligar `rules-of-hooks` (erro) e `exhaustive-deps` (erro), e corrigir o que aparecer. Uma dependência deixada de fora de propósito leva o comentário do motivo, nunca um desligamento em massa. Ela roda depois da integração do épico (F57), porque mexe em muitos arquivos.
- Aceite: `pnpm lint` verde com as duas regras ligadas; o relatório lista cada correção e cada exceção comentada; `pnpm typecheck`, `test` e `build` verdes.

**F78 · Manutenção: médios da revisão da F54 e da F55**
- dep: F54, F55
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/editor/decision-table/`, `packages/react/src/editor/unit-run/`
- Fazer (decidido pela sessão global em 2026-11-20):
  - na grade, o `aria-busy` vai na região viva certa, e a tecla digitada no modo de substituir passa pelo `cleanCell`;
  - no Calcular, os nomes do resultado vêm do estado já atualizado depois do `flush`, nunca de um render atrás;
  - testes do `badInput` em data, em data e hora e num item da lista múltipla.
- Aceite: um teste para cada item; os testes da F54 e da F55 seguem verdes.

**F79 · Manutenção: desempenho e teclado do canvas (revisão da F51)**
- dep: F51
- modelo: opus
- revisão: não
- arquivos: `packages/react/src/editor/canvas/`, `packages/react/src/editor/layers/`, `packages/react/src/editor/decision-table/`, `packages/react/src/editor/draft/names.ts`, `docs/adr/0037-*.md`
- Fazer (achados da revisão da tentativa 2 da F51, decididos pela sessão global em 2026-11-20):
  - **desempenho (ALTO):** o `canvasGraph` devolve nós e arestas estáveis. Um bloco que não mudou mantém a mesma referência, e o `memo(BlockNode)` passa a valer. O cache apaga os ids removidos;
  - o Delete usa a contagem só com a análise em dia (`problemsOutdated`); com ela atrasada, diz "Conferindo quem usa este bloco…" e espera;
  - Delete e Esc funcionam pelas camadas, e o Tab das camadas segue a seleção do canvas;
  - incluir e remover são anunciados ao leitor de tela, e depois de remover o foco vai para o bloco vizinho, ou para o canvas;
  - o `newBlock` é calculado dentro do atualizador do estado;
  - a regra do nome livre (`calc_N`, `resultado_N`) fica num lugar só (`editor/draft/names.ts`), usada pelo canvas e pela grade;
  - a ADR 0037 passa a citar o `base.css` do React Flow.
- Aceite: um teste que edita um bloco e confere que os outros nós mantêm a mesma referência (sem novo render); um teste para cada item de teclado e de leitor de tela; os testes da F51 e da F54 seguem verdes.

**F80 · Manutenção: marca da sessão nas mutações que gravam no cache (pendência da F76)**
- dep: F76
- modelo: sonnet
- revisão: sim
- arquivos: `packages/react/src/admin/security/queries.ts`, `packages/react/src/catalog/connections/queries.ts`, `packages/react/src/catalog/datasets/queries.ts`, `packages/react/src/catalog/files/queries.ts`, `packages/react/src/workflows/queries.ts`, e os testes ao lado de cada um (`*.test.ts`)
- Fazer (decidido pela sessão global em 2026-11-20): cada mutação que grava no cache no `onSuccess` guarda a marca no `onMutate` (`sessionDataMark`) e só grava se `sameSessionData` ainda for verdadeiro, como o `useSwitchTenant` e o salvamento do rascunho da F76. A lista do relatório da F76 é o ponto de partida; uma busca por `setQueryData` e `setQueriesData` fora dos testes confirma que não falta nenhuma.
- Aceite: para cada arquivo, um teste em que a resposta chega depois da limpeza e nada é gravado; a busca no relatório mostra que todos os `setQueryData` depois de requisição usam a marca.

**F81 · Manutenção: médios das revisões da F79, da F76 e da F53**
- dep: F53, F76, F79
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/editor/canvas/`, `packages/react/src/editor/properties/`, `packages/react/src/session/`
- Fazer (decidido pela sessão global em 2026-11-20):
  - **canvas (F79):**
    - o diálogo de remover não reabre sozinho quando o bloco some com Ctrl Z e volta com o mesmo id;
    - o anúncio "removido" não sai com o editor só para leitura;
    - a troca de "Conferindo…" para o número é anunciada;
    - um anúncio igual ao anterior é lido de novo;
    - a poda do cache sai de dentro do `useMemo`;
  - **sessão (F76):** um teste da troca de tenant que responde depois de um logout, sem gravar nada. O caso das telas avulsas em modo cookie fica documentado na ADR 0048, sem código;
  - **propriedades (F53):**
    - o `mergeKey` do Cálculo é pelo id do bloco, não pela posição;
    - o desfazer devolve o texto inválido digitado;
    - os testes de foco esperam o evento, sem tempo fixo;
    - campos de mesmo nome têm `aria-label` distinto (com o nome do bloco ou da entrada).
- Aceite: um teste para cada item; os testes da F51, da F53, da F76 e da F79 seguem verdes.

**F82 · Manutenção: lint recusa caractere NUL e de controle no código**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `scripts/check-control-chars.mjs`, `package.json`, `README.md`
- Fazer (decidido pela sessão global em 2026-11-20; o NUL apareceu no código da F52 e da F57): um script que procura NUL (`\u0000`) e outros caracteres de controle (exceto tab, LF e CR) nos arquivos versionados de texto (`git ls-files`, ignorando binários) e falha apontando arquivo e linha. Ele entra no `pnpm lint`.
- Aceite: um arquivo de teste temporário com NUL faz o `pnpm lint` falhar com o caminho e a linha; sem ele, o lint passa; a busca roda em menos de 5 s no repositório.

**F83 · Manutenção: troca de tenant dentro do workflow e anúncios das camadas (revisão da F57)**
- dep: F57
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/module/`, `packages/react/src/editor/layers/`
- Fazer (decidido pela sessão global em 2026-11-20):
  - ao trocar de tenant com um workflow aberto (qualquer rota `/workflows/:id…`), o módulo vai para `/workflows` do tenant novo, e a barra nunca mostra o workflow do tenant antigo;
  - **menu no nível do workflow (E4-25, estilos §12):** o menu do workflow **substitui** o do tenant, como no Vercel. A volta ao nível do tenant é pelo seletor de contexto, em que o nome do tenant é clicável e leva ao Início. Confira que isso existe e funciona pelo teclado;
  - as camadas usam o `useAnnouncement` para os anúncios de incluir e remover, e um anúncio igual ao anterior é lido de novo.
- Aceite: um teste para cada item; os testes da F57 e da F79 seguem verdes.

**F84 · Manutenção: marca da sessão também nas invalidações (revisão da F80)**
- dep: F80
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/session/`, `packages/react/src/admin/security/queries.ts`, `packages/react/src/catalog/connections/queries.ts`, `packages/react/src/catalog/datasets/queries.ts`, `packages/react/src/catalog/files/queries.ts`, `packages/react/src/workflows/queries.ts`, e os testes ao lado de cada um (`*.test.ts`)
- Fazer (MÉDIOS da revisão da F80, decididos pela sessão global em 2026-11-20):
  - `useDeleteConnection`, `useCreateSheetDataset`, `useDeleteExcelFile` e `useDeleteWorkflow` também conferem a marca antes de invalidar ou remover;
  - os `onError` que invalidam usam a marca;
  - um helper único `isSameSessionData`, exportado por `session`, no lugar das cópias de `isCurrent` e das condições escritas na hora;
  - testes mais fortes: o caso do `useDeleteDataset`, a asserção de `invalidated` nos casos negativos, um controle positivo por hook, a chave específica conferida (em vez de `getAll().toHaveLength(0)`) e fixtures tipadas (sem `as never`).
- Aceite: os itens acima com teste; nenhuma condição de sessão escrita à mão fora do helper (busca no relatório).

**F85 · Manutenção: marca da sessão no rascunho e na administração (revisão da F84)**
- dep: F84
- modelo: sonnet
- revisão: sim
- arquivos: `packages/react/src/editor/draft/queries.ts`, `packages/react/src/editor/draft/queries.test.ts`, `packages/react/src/session/`, `packages/react/src/admin/users/`, `packages/react/src/admin/roles/`, `packages/react/src/admin/integration/`, `docs/adr/0049-*.md`
- Fazer (decidido pela sessão global em 2026-11-20):
  - `editor/draft/queries.ts` usa o `isSameSessionData`, e o `sameSessionData` deixa de ser exportado pelo `session`;
  - as mutações de `admin/users`, `admin/roles` e `admin/integration` que gravam ou invalidam o cache usam a marca, inclusive nos `onError`, como as outras (ADR 0049 complementada).
  - a ADR 0049 passa a citar o `isSameSessionData` como o contrato (marca ausente conta como diferente, e vale para o `onError`), no lugar do `sameSessionData`.
- Aceite: um teste de resposta atrasada depois da limpeza por hook tocado; a busca no relatório mostra que nenhum `setQueryData`, `invalidateQueries` ou `removeQueries` depois de requisição fica sem a marca, em todo `packages/react/src/`.

**F86 · Manutenção: médios da revisão da F83 (menu compacto e troca de tenant)**
- dep: F83
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/module/`
- Fazer (decidido pela sessão global em 2026-11-20):
  - o teste do menu compacto afirma a classe dentro de `.fc-shell-compact` e o foco pelo Tab no link e no botão de troca (o jsdom não aplica `display:none`);
  - o teste da troca de tenant afirma que nenhum `alert` nem erro do workflow aparece;
  - no menu compacto, o link "Início de {tenant}" e o botão "Trocar cliente" ganham `Tooltip` com o nome do tenant, como o comentário do `shell.css` promete.
- Aceite: os três itens com teste; os testes da F57 e da F83 seguem verdes.

**F87 · Manutenção: marca da sessão antes do cancelamento (revisão da F85)**
- dep: F85
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/session/useSession.ts`, `packages/react/src/session/session.test.tsx`
- Fazer (MÉDIOS da revisão da F85, decididos pela sessão global em 2026-11-20):
  - no `useSession.ts`, a marca é pega **antes** do `getQueryData` e conferida de novo depois do `await cancelQueries`, e uma limpeza nesse intervalo nunca passa;
  - os testes que provam a ausência de gravação esperam de forma determinística (a promise da requisição resolvida e o `queryClient` sem tarefas pendentes), sem `setTimeout` com tempo fixo.
- Aceite: um teste que limpa a sessão durante o `cancelQueries` e confere que nada é gravado; nenhum `setTimeout` com tempo fixo no `session.test.tsx`.

**F89 · Correção da integração do épico 4: texto real do erro de tipo**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `e2e/support/contract.ts`, `e2e/epic-4/support/formula.ts`, `e2e/epic-4/type-error.spec.ts`, `packages/react/src/editor/canvas/canvas.test-support.tsx`, `packages/react/src/editor/draft/editor.test-support.tsx`, `packages/react/src/editor/Editor.test.tsx`, `packages/react/src/editor/properties/CalculationProperties.test.tsx`, `packages/react/src/editor/unit-run/unit-run.test-support.tsx`
- Fazer: a integração do CK4 reprovou no `type-error.spec.ts`: o front copiou do exemplo do contrato o texto "categoria é texto e não entra em conta.", e a API real devolve "Esperava um número, mas categoria é um texto." (D53; a B123 corrige o contrato). Troque o texto antigo pelo real em todos os arquivos acima (motor simulado, dados do contrato e testes). A tela mostra o `message` que vier da API, nunca um texto próprio. O `e2e/support/contract.ts` também acompanha as mudanças que a B121 fez no `openapi.yaml` do back: o `title` dos exemplos 413 e 422 passou a ser o título da categoria ("Dados inválidos", "Arquivo grande demais") e o `detail` do `DefinitionTooLarge` ficou neutro; vale o `openapi.yaml` da `main` do back.
- Aceite: o `e2e/contract-examples.spec.ts` passa contra o `openapi.yaml` da `main` do back (depois da B123); nenhum "não entra em conta" sobra no front (fora de relatórios); `pnpm e2e:real e2e/epic-4/type-error.spec.ts` passa com o back real; os testes unitários do editor passam.

**F90 · Correção da integração do épico 4: teste ponta a ponta do limite de "Testar" (roteiro 10)**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `e2e/epic-4/connection-test-limit.spec.ts` (novo)
- Fazer: o roteiro 10 do épico 4 ficou sem teste na integração. Em Catálogo › Conexões, o teste clica em "Testar" na conexão de exemplo além do limite da release (`FLUXO_CONNECTION_TEST_LIMIT_PER_MIN`) e confere o aviso de espera (o `CooldownNotice`) com o tempo do `Retry-After`, e que o botão volta depois do tempo. Roda no simulado e no `e2e:real`.
- Aceite: o teste passa no simulado e com o back real; com o limite não atingido, nenhum aviso aparece.

**F59 · Portão do épico 4**
- tipo: portao
- dep: F46, F47, F48, F49, F50, F51, F52, F53, F54, F55, F56, F57, F58, F61, F72, F73, F74, F75, F76, F77, F78, F79, F80, F81, F82, F83, F84, F85, F86, F87, F89, F90
- modelo: sonnet
- Aceite: o mesmo do F12, com as telas do épico 4 (lista, Visão geral, editor com canvas, propriedades, grade e Calcular, nos dois temas e nas faixas de largura do estilos §15); a entrada principal do pacote sem o Monaco (como na F47).

### Épico 5 — Fontes, grupos e execução unitária com trace

As decisões E5-1 a E5-15, o esquema na versão 2, a prévia e o trace estão no plano do back (`../backend/docs/plano.md`, épico 5, e Contratos, "Fontes, grupos e execução unitária com trace"). O contrato é o da B90. Decisões do front, tomadas pela sessão global em 2026-11-20:
- **E5-16, onde fica cada coisa:** tudo dentro da vertical `editor/`, numa pasta por funcionalidade:
  - `editor/sources/`: propriedades da fonte do lote e do bloco Fonte;
  - `editor/groups/`: grupo no canvas e nas camadas;
  - `editor/preview/`: aba Prévia;
  - `editor/unit-run/`: Calcular com registro real e trace;
  - `editor/canvas/`: valores nos nós.
  - O catálogo (datasets e variáveis) é lido pelo `catalog/index.ts`.
  - Motivo: ADR 0003; o que muda junto fica junto.
- **E5-17, fonte do lote no canvas:** a barra **Entradas** da esquerda vira **Fonte do lote** quando ela existe, com o dataset, a chave (ícone de chave) e as variáveis.
  - O workflow escolhe uma vez, no painel do workflow: **Entradas declaradas** (valores digitados) ou **Fonte do lote**.
  - Trocar de uma para a outra pede confirmação, que diz o que se perde.
  - Motivo: E5-2; uma só barra de Input, como no design §6.
- **E5-18, bloco Fonte:** quadrado `--fc-cat-source` no canvas.
  - **Modo:** controle segmentado Linear | Filtro (o Múltiplo entra no épico 8).
  - **Ligações:** uma lista "variável visível → variável do dataset", com o tipo das duas e o aviso de tipo.
  - **Filtros:** linhas com variável, operador e valor.
  - **Ordenação:** obrigatória no Linear, com variável e direção, reordenável.
  - **Sem correspondência e mais de uma linha:** seleções com o texto do design. Trocar para "Aceitar a primeira linha" abre a confirmação "Você assume que vale a primeira linha pela ordenação. Isso fica registrado na auditoria.".
  - **Saída:** caixas por variável, com o nome no workflow editável.
- **E5-19, grupos:**
  - o grupo é um contêiner no canvas, com uma barra de Input (derivado, só leitura) à esquerda e uma de Output à direita;
  - **recolher e expandir:** pelo cabeçalho, gravados em `collapsed`;
  - **criar:** "Agrupar" na barra de ferramentas e no menu do bloco, com a seleção de vários blocos; "Desagrupar" devolve os blocos ao pai;
  - **camadas:** árvore aninhada;
  - **sem arrastar para dentro:** mover um bloco para dentro de um grupo é pelo menu "Mover para o grupo…". Isso evita que um arrasto distraído mude a visibilidade.
  - Motivo: a visibilidade muda o sentido das fórmulas, então a mudança tem de ser deliberada.
- **E5-20, prévia e Calcular:** o painel inferior ganha a aba **Prévia**, entre Problemas e Calcular. Com fonte do lote, o Calcular troca o formulário por "Escolher registro".
  - **Escolher registro:** pela amostra da prévia ou digitando a chave.
  - **Resultado:** o trace, com Entradas (valor e origem), Blocos (aninhados por grupo) e Saída.
  - Motivo: design §6 (prévia por bloco e por grupo) e §10 (unitário com trace).
- **E5-21, valores no canvas:** depois de um Calcular, cada nó mostra o valor da saída em `mono-12` embaixo do nome.
  - **Cores:** verde (`--fc-green-700`) para executado, vermelho para o que falhou, cinza para o que não rodou; na Tabela de Decisão, "Regra N" em destaque.
  - **Grupos:** recolhidos mostram o Output; expandidos mostram os nós de dentro.
  - **Limpeza:** os valores somem ao editar qualquer coisa ("Os valores são do último cálculo" + **Limpar**).
  - Motivo: design §12 (tela de debug), antecipado para a execução unitária.

**F62 · Tipos da API do épico 5**
- tipo: contrato
- dep: B90
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`, e (D20, 2026-11-21) `packages/react/src/editor/canvas/`, `packages/react/src/editor/decision-table/`, `packages/react/src/editor/draft/`, `packages/react/src/editor/layers/`, `packages/react/src/editor/properties/`, `packages/react/src/editor/unit-run/` e os testes de `packages/react/src/formula/`, só para o ajuste mínimo de tipo (`group_id: null`, `groups: []` e campos novos obrigatórios), sem comportamento novo; a F62 entra com typecheck, build e e2e verdes; e (ratificado pela global em 2026-11-21) `e2e/epic-4/support/engine.ts` e `e2e/epic-4/support/simulation.ts`, só para a API simulada devolver o `UnitRunTrace` do contrato da B90
- Fazer: gerar os tipos do contrato da B90 (`pnpm generate:api`) e acrescentar os exemplos do épico 5 ao contrato simulado do e2e. A regeneração também traz o cabeçalho `Retry-After` do 429 (B108), que ficou fora dos tipos no portão F59.
- Aceite: `pnpm typecheck` e o `contract-examples` verdes; os tipos do rascunho na versão 2, da prévia e do trace aparecem no gerado.

**F63 · Editor: fonte do lote e entradas declaradas**
- dep: F62
- modelo: opus
- arquivos: `packages/react/src/editor/sources/batch-source/`, `packages/react/src/editor/properties/workflow/`, e (D21, ratificado) uma linha em `packages/react/src/editor/properties/PropertiesPanel.tsx` e uma em `packages/react/src/editor/properties/index.ts` (o `WorkflowProperties` mudou de pasta) e as exportações novas em `packages/react/src/catalog/index.ts` (`useDatasetList`, `useDatasetVariables`, `Dataset`, `Variable`, `DATASET_TYPE_LABELS`); quem entrar depois resolve o conflito no rebase
- Fazer (E5-17):
  - no painel do workflow, a escolha Entradas declaradas | Fonte do lote, com a confirmação;
  - **propriedades da fonte do lote:**
    - o dataset, numa busca nos datasets do catálogo, com o tipo (tabela, SQL, Excel);
    - as variáveis de saída (caixas, com o nome no workflow editável, cujo padrão é o nome no catálogo);
    - a chave (uma ou mais variáveis da saída);
    - os filtros (componente da F64);
    - a ordenação (variável e direção, com setas para reordenar, e a nota "A chave entra como último critério");
  - na barra **Fonte do lote** do canvas, o dataset, a chave e as variáveis;
  - os problemas de cada campo aparecem pelo `path`;
  - só leitura: tudo desabilitado, com o motivo.
- Aceite: testes de escolher o dataset, marcar as variáveis e a chave, trocar o nome, reordenar a ordenação, a confirmação ao trocar de modo, o problema `missing_batch_source_key` no campo e o modo só leitura.

**F64 · Editor: bloco Fonte**
- dep: F62
- modelo: opus
- arquivos: `packages/react/src/editor/sources/source-block/`, `packages/react/src/editor/sources/filters/`, `packages/react/src/editor/sources/index.ts`, e (D22, ratificado) uma linha de export em `packages/react/src/catalog/index.ts` e uma em `packages/react/src/catalog/datasets/index.ts` (`useDatasetList` e `useDatasetVariables`)
- Fazer (E5-18):
  - **propriedades do bloco Fonte:** dataset, modo, ligações, filtros, ordenação, sem correspondência, mais de uma linha (com a confirmação do aceite) e saída;
  - o componente de filtros, também usado pela F63: operador pelo tipo da variável (texto só `=`, `<>`, `em` e nulo); valor no padrão brasileiro para número (E4-24); `entre` com dois campos; `em` com uma lista; `@` mostra o aviso "Parâmetros chegam no épico 6";
  - no modo Filtro, só dataset, ligações, filtros e EXISTE / NÃO EXISTE;
  - "Tabela de parâmetros" quando não há ligação, com a nota "O dataset precisa ter exatamente uma linha depois dos filtros".
- Aceite: testes de cada campo, do aceite com confirmação, do modo Filtro (campos escondidos), do operador pelo tipo, do `entre`, do `em`, dos problemas `link_to_calculated`, `link_type_mismatch` e `not_visible` no campo certo, e do modo só leitura.

**F65 · Editor: grupos no canvas e nas camadas**
- dep: F62
- modelo: opus
- arquivos: `packages/react/src/editor/groups/`, `packages/react/src/editor/canvas/`, `packages/react/src/editor/layers/`, e (D23, ratificado) `packages/react/src/editor/draft/` (`DraftEditor.tsx`, `queries.ts`, `index.ts`), só para o `useDraftEditor()` expor `groups`, com o complemento da ADR 0042 escrito pelo registrador
- Fazer (E5-19):
  - **o nó de grupo no React Flow:**
    - contêiner com borda `gray-400` e cabeçalho com nome e contagem de blocos;
    - barras de Input (derivado da análise, com o ícone de "derivado") e de Output;
    - recolher e expandir;
  - **o bloco Fonte no canvas:** quadrado `--fc-cat-source`, portas de ligação e de saída;
  - **ações:** Agrupar (com a seleção múltipla por Shift + clique e por laço), Desagrupar, "Mover para o grupo…" e "Tirar do grupo";
  - **Output do grupo:** nas propriedades do grupo, escolhido entre as variáveis lineares produzidas dentro dele;
  - **camadas:** a árvore aninhada, com expandir e recolher pelo teclado (setas);
  - as ligações entram e saem do grupo pelas barras.
- Aceite: testes de agrupar e desagrupar (as posições se mantêm), mover para dentro e para fora pelo menu, recolher e expandir (gravado no rascunho), o Input derivado vindo da análise, a árvore das camadas pelo teclado e um rascunho com grupo dentro de grupo desenhado certo.

**F66 · Editor: aba Prévia**
- dep: F62
- modelo: opus
- arquivos: `packages/react/src/editor/preview/`
- Fazer (E5-11, E5-20):
  - **a aba Prévia:** **Rodar prévia** salva o rascunho pendente e chama a rota. Fica desabilitado com o motivo enquanto houver problema ou faltar a fonte do lote;
  - **por bloco Fonte:**
    - as contagens com ponto e palavra ("480 encontrados", "12 sem correspondência", "8 com mais de uma linha (máx. 3)");
    - as chaves de exemplo;
    - a amostra das linhas, numa tabela `mono-13` com rolagem horizontal;
  - **por grupo:** os registros de exemplo com Input e Output lado a lado;
  - a nota "Contagens sobre os primeiros 500 registros.";
  - o nome do bloco seleciona-o no canvas;
  - **erros:** `schema_drift`, `source_read_denied` e `parameter_table_rows`, com a mensagem da API e o nome do bloco.
- Aceite: testes de cada estado (vazio, carregando com esqueleto, erro, resultado), do botão desabilitado com motivo, da seleção ligada ao canvas e de cada erro de leitura.

**F67 · Editor: Calcular com registro real e trace**
- dep: F62
- modelo: opus
- arquivos: `packages/react/src/editor/unit-run/`
- Fazer (E5-12, E5-20):
  - **com fonte do lote**, o Calcular mostra "Escolher registro": a lista da amostra da última prévia (se houver) ou os campos da chave para digitar;
  - **o resultado é o trace:**
    - status com ponto e palavra (os cinco status, `ignored` como "ignorado" e `filtered` como "filtrado");
    - Entradas, com valor e origem (conexão › dataset › coluna, chave da linha), copiáveis;
    - Blocos, aninhados por grupo, com valores, "Regra N", linhas encontradas, avisos e erro;
    - Saída e os hashes (encurtados, com cópia);
  - **sem fonte do lote**, o formulário do épico 4 continua igual;
  - `record_not_found` mostra "Nenhum registro com essa chave." no campo.
- Aceite: testes de escolher pela amostra e pela chave digitada, de cada status, do trace aninhado, de `record_not_found` e do formulário do épico 4 intacto (os testes da F55 seguem verdes).

**F68 · Editor: valores no canvas**
- dep: F65, F67, F94
- modelo: opus
- arquivos: `packages/react/src/editor/canvas/run-values/`, e (D27) `packages/react/src/editor/canvas/nodes.tsx`, `packages/react/src/editor/canvas/WorkflowCanvas.tsx`, `packages/react/src/editor/groups/GroupBoxNode.tsx`, e no `packages/react/src/editor/unit-run/` só o store em memória do último trace com o `useLastUnitRun` exportado pelo `index.ts` (padrão das ADRs 0045 e 0056; o canvas depende do unit-run, nunca o contrário)
- Fazer (E5-21): depois de um Calcular, os valores do trace no canvas:
  - as cores por status;
  - a "Regra N" na Tabela;
  - o Output no grupo recolhido;
  - a faixa "Os valores são do último cálculo", com **Limpar**;
  - qualquer edição limpa os valores.
  - Acessibilidade: o status de cada nó vai também em texto (`aria-label`), não só na cor.
- Aceite: testes das cores por status, do grupo recolhido e expandido, da limpeza ao editar e do texto acessível.

**F69 · Integração do épico 5: editor e interface pública**
- dep: F63, F64, F65, F66, F67, F68
- modelo: sonnet
- arquivos: `packages/react/src/editor/index.ts`, `packages/react/src/editor/Editor.tsx`, `packages/react/src/editor/editor.css`, `packages/react/src/editor/properties/`, `packages/react/src/editor/layout/`, `packages/react/src/editor/canvas/` (D21: só a ligação da `BatchSourceBar` da F63 no canvas, a seleção dela abrindo o `BatchSourceProperties` e os filtros da F64 pela prop `renderFilters`, sem mudar o resto do canvas da F65), `docs/glossario.md`, `README.md`, `.changeset/`; e (D29) `packages/react/src/editor/decision-table/tableModel.ts` e o teste dela, e no `packages/react/src/editor/draft/DraftEditor.tsx` só o `itemExists`, para a busca da Tabela de Decisão descer nos grupos; e `packages/react/src/editor/layers/Layers.tsx` (ratificado: "Entradas" vira "Fonte do lote" quando há fonte do lote)
- Fazer:
  - o `<Editor>` mostra as propriedades da fonte do lote, do bloco Fonte e do grupo;
  - a barra de ferramentas ganha Fonte e Agrupar;
  - o painel inferior ganha a aba Prévia;
  - o Calcular troca de modo pela fonte do lote;
  - os valores aparecem no canvas;
  - os nomes novos vão para o glossário, com um changeset `minor`.
- Aceite: testes por papel (o Configurador monta fontes e grupos; o Aprovador roda a prévia e o Calcular e não edita; o Auditor vê tudo só para leitura, sem Prévia e sem Calcular); `pnpm build` verde.

**F70 · Testes ponta a ponta do épico 5**
- dep: F69
- modelo: opus
- arquivos: `e2e/epic-5/`, `e2e/support/`, `README.md`
- Fazer:
  - (sugestão do verificador da F67) o caminho Prévia → amostra guardada → Calcular com "Escolher registro" pela amostra real, ponta a ponta;
  - os fluxos do épico 5 do plano global, no modo simulado:
    - montar o workflow da campanha de referência com fonte do lote, fontes lineares, filtro e grupo;
    - rodar a prévia e conferir as contagens;
    - calcular um registro e conferir o trace e o valor esperado;
    - ver os valores no canvas;
  - **no modo real**, usar o workflow "Campanha de referência" do `prepare-local` e os registros e valores esperados do `backend/tests/reference_campaign/`.
- Aceite: `pnpm e2e` passa. O modo real é exercitado no teste de integração do CK5.
- D31 (2026-11-21): a tela Auditoria › Configuração não existe; o fluxo do aceite da primeira linha vai até salvar o aceite no rascunho, e o evento fica provado pelos testes do back (B96). A tela entra no épico 10.

**F88 · Prova visual das telas nos dois temas e nas três larguras**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `e2e/visual/`, `playwright.config.ts`, `README.md`, e (D18) `package.json` da raiz (só o script `e2e:visual`), `packages/react/src/editor/canvas/WorkflowCanvas.tsx` (só a cor da atribuição "React Flow") e `packages/react/src/editor/decision-table/decision-table.css` (só a cor do número da regra), com cores do `estilos.md` que passem 4,5:1 nos dois temas
- Fazer (ressalva do portão F59, decidida pela sessão global em 2026-11-20): um projeto do Playwright, `visual`, que abre as telas dos épicos 1 a 4 (login, Início, Administração, Catálogo, lista de workflows, Visão geral e editor com canvas, propriedades, grade e Calcular) no modo simulado, nos temas claro e escuro (`colorScheme`) e nas larguras de 1440, 1180 e 900 px. Ele guarda as capturas em `e2e/visual/__screenshots__/` e confere:
  - nenhuma barra de rolagem horizontal na página;
  - o contraste de texto mínimo do estilos.md nas cores calculadas;
  - o menu só com ícones abaixo de 1180 px.
  Ele roda com `pnpm e2e:visual`, fora do `pnpm e2e`.
- Aceite: as capturas geradas e conferidas a olho pelo verificador contra o estilos §12 a §16; as três checagens automáticas verdes; o portão de cada épico passa a rodar o `pnpm e2e:visual`.

**F91 · Manutenção: texto essencial nunca no terciário (achado da F88)**
- dep: F88
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/design-system/form/button.css` e `packages/react/src/design-system/form/Button.tsx` (D19: só o `.fc-button-reason` no `--fc-text-secondary`; o override do `unit-run.css` sai), `packages/react/src/module/shell/shell.css`, `packages/react/src/design-system/display/menu.css`, `packages/react/src/session/sign-in/SignInScreen.tsx`, `packages/react/src/editor/unit-run/unit-run.css`, `packages/react/src/editor/layout/editor-layout.css`, `e2e/visual/`
- Fazer (D18, decidida pela sessão global em 2026-11-21): o `--fc-text-tertiary` (3,23:1 no tema claro) só vale para informação não essencial (estilos §11). Os textos que a F88 anotou como essenciais passam a usar o `--fc-text-secondary`: o e-mail no menu da conta, o aviso da tela de login e o motivo de um botão ou item desabilitado (no menu e no Calcular). O resto do terciário (legendas, tipos das portas, ajuda abaixo do campo) fica como está.
- Aceite: o `pnpm e2e:visual` não anota mais nenhum texto essencial no terciário, nos dois temas; os testes unitários e o build passam.

**F92 · Contrato: tipos do bloco Fonte com os dois modos (B126)**
- tipo: contrato
- dep: B126, F64
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`, `packages/react/src/editor/sources/source-block/`, e (D24) `packages/react/src/editor/canvas/graph.ts` e `packages/react/src/editor/groups/tree.ts`, só para ler `outputs` estreitando por `mode` (o Filtro não produz variáveis); e (D26) `packages/react/src/editor/preview/PreviewResult.tsx` e `packages/react/src/editor/preview/preview.test-support.tsx`, só para ler `no_match` e `multiple_rows` estreitando por `mode` (no Filtro, o ponto das contagens fica na cor neutra), com um teste do Filtro
- Fazer: regenerar os tipos com o `SourceNode` em `oneOf` (B126) e trocar o `Reflect.deleteProperty` da F64 pelo tipo do modo Filtro, que não tem `no_match` nem `multiple_rows`. Sem cast, sem `any`.
- Aceite: nenhum `Reflect.deleteProperty` sobra no bloco Fonte; typecheck, testes e `pnpm e2e` verdes.

**F93 · Manutenção: data e hora inexistente recusada no filtro (revisão da F64)**
- dep: F64
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/editor/sources/filters/`
- Fazer: o `isIsoDateTime` (`filterRules.ts`) aceita um dia que não existe, como `2026-02-30T08:00-03:00`, porque o `Date.parse` passa para o mês seguinte. A conferência passa a montar a data pelos números do texto e a comparar de volta (ano, mês, dia, hora e minuto iguais), sem depender do `Date.parse`; o aviso no campo é o mesmo da data inválida.
- Aceite: `2026-02-30T08:00-03:00`, `2026-13-01T00:00Z` e `2026-04-31T10:00+00:00` são recusados; `2028-02-29T08:00-03:00` passa.

**F94 · Manutenção: formatadores de valores num nível comum do editor (D25)**
- dep: F66, F67
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/editor/values/` (novo), `packages/react/src/editor/preview/`, `packages/react/src/editor/unit-run/values.ts`, `packages/react/src/editor/unit-run/`
- Fazer: os formatadores de número da API e de data e hora descem para `editor/values/`, usados pelo `preview` e pelo `unit-run`; saem as cópias locais da F66. O sentido de dependência fica: `unit-run` → `preview` (amostra da última prévia, F67), e os dois → `values`; nunca `preview` → `unit-run`.
- Aceite: nenhum formatador duplicado; nenhum import de `../unit-run` no `preview`; os testes dos dois e o `pnpm e2e` passam sem mudar o que aparece na tela.

**F95 · Manutenção: achados da revisão da F68 (valores no canvas)**
- dep: F68
- modelo: sonnet
- arquivos: `packages/react/src/editor/canvas/run-values/`, `packages/react/src/editor/unit-run/values.ts`, `packages/react/src/editor/unit-run/index.ts`, `packages/react/src/editor/values/`, `packages/react/src/editor/sources/filters/filterRules.ts`
- Fazer:
  - o `useRunValues` só esquece um cálculo quando a `definition` ou a `revision` divergem; o estado `saved` serve só para mostrar. Um canvas que remonta durante um save em andamento não perde o cálculo válido;
  - o despacho de formatação por tipo, hoje duplicado em `canvas/run-values/views.ts` e `unit-run/values.ts`, vai para `editor/values/`, e as duas cópias saem (o "A fazer" da ADR 0058);
  - o `filterRules.ts` passa a importar `formatApiNumber` e `readBrazilianNumber` de `../../values`, e o reexport sai do `unit-run/index.ts` (pendência da ADR 0057).
- Aceite: um teste do canvas remontando durante o save; nenhum formatador duplicado; nenhum import do `unit-run` em `sources/filters/`.

**F96 · Manutenção: achados da revisão da F69 (integração do épico 5)**
- dep: F69, F95
- modelo: sonnet
- arquivos: `packages/react/src/editor/decision-table/tableProblems.ts`, `packages/react/src/editor/sources/batch-source/`, `packages/react/src/editor/sources/filters/`, `packages/react/src/editor/sources/source-block/`, `packages/react/src/editor/properties/definition.ts`, `packages/react/src/editor/properties/workflow/`
- Fazer:
  - numa Tabela dentro de grupo, em qualquer nível, o problema de célula cai na célula certa, e não na tabela inteira;
  - a fonte do lote tem um fieldset "Filtros" só, sem aninhar dois;
  - o problema da fonte do lote sem `path` (casado pelo `code`, D21) aparece no item da fonte do lote, e não no do workflow;
  - o `producedNames` e o `allNodes` de `properties/definition.ts` e os padrões do `newSourceBlock` deixam de ser duplicados (o "A fazer" da ADR 0059).
- Aceite: um teste por item; `pnpm e2e` verde.

**F71 · Portão do épico 5**
- tipo: portao
- dep: F62, F63, F64, F65, F66, F67, F68, F69, F70, F88, F91, F92, F93, F94, F95, F96, F107, F108, F112, F113
- modelo: sonnet
- Aceite: o mesmo da F59, com as telas do épico 5 (propriedades das fontes, grupos no canvas, Prévia, trace e valores no canvas, nos dois temas e nas faixas de largura do estilos §15), provadas pelo `pnpm e2e:visual` da F88, com as telas do épico 5 incluídas nele.

**F107 · Manutenção: barra da fonte do lote sem permissão para ver o dataset (D31)**
- dep: F69
- modelo: sonnet
- arquivos: `packages/react/src/editor/sources/batch-source/`
- Fazer: quem não tem `connections.view` (o Aprovador) não lê o catálogo. Hoje a `BatchSourceBar` fica em "Carregando dataset" para sempre. Ela passa a tratar o erro como as propriedades já tratam: mostra "Sem permissão para ver o dataset" (e o motivo de outros erros), nunca um carregando sem fim; a chave e as variáveis do workflow continuam aparecendo pelo nome no workflow.
- Aceite: testes da barra com 403, com outro erro e com sucesso; o e2e do Aprovador (F70) passa a conferir o texto da barra.

**F108 · Manutenção: texto da barra no e2e do Aprovador e formatação de valores num lugar só**
- dep: F96, F107
- modelo: sonnet
- arquivos: `e2e/epic-5/roles.spec.ts`, `packages/react/src/editor/unit-run/values.ts`, `packages/react/src/editor/unit-run/UnitRunResult.tsx`, `packages/react/src/editor/preview/`, `packages/react/src/editor/values/`, e (D32) `packages/react/src/editor/problems/problemGroups.ts` e o teste dele
- Fazer:
  - o e2e do Aprovador confere o texto "Sem permissão para ver o dataset" na barra da fonte do lote (aceite da F107);
  - (D32, item 1 da F96) o problema da fonte do lote sem `path` de nó cai no item da fonte do lote, não no do workflow; o `problemItem` reconhece blocos dentro de grupos (`root.nodes[i].nodes[k]...`, em qualquer nível), e o problema sem `node_id` de um bloco dentro de um grupo cai no bloco, não no grupo;
  - a formatação de valores fica só em `editor/values/`: o `unit-run/values.ts` deixa de reexportar o `formatValue` (o `UnitRunResult.tsx` importa direto), e o `preview/values.ts` perde a sua `formatValue` e o `variableTypes` duplicados.
- Aceite: o e2e do Aprovador confere o texto; `git grep` acha uma definição só de `formatValue` e de `variableTypes` no editor; testes e e2e verdes.

**F112 · Correção da integração do épico 5: Calcular quebra com o trace real**
- dep: F69
- modelo: opus
- arquivos: `packages/react/src/editor/unit-run/`, `packages/react/src/editor/values/`, `packages/react/src/editor/canvas/`, `e2e/epic-4/support/engine.ts`, `e2e/epic-4/support/simulation.ts`, `e2e/support/`
- Fazer: no modo real, o painel do Calcular quebra com "TypeError: Cannot convert undefined or null to object" num `Object.keys`, logo depois do `POST /draft/unit-runs` 200, e fica como esqueleto de carregamento (relatório `.orquestracao/integracao/epico-5.md`). A resposta real segue o contrato: o nó `group` (`TraceGroupNode`) tem `inputs`, `outputs` e `nodes`, mas não tem `values`. O painel e os valores no canvas tratam cada tipo de nó pelo esquema do contrato, sem supor campos que ele não tem. A API simulada do e2e passa a devolver o trace exatamente como o contrato (conferido contra o esquema em `contract-examples`), para o modo simulado não esconder mais esse tipo de divergência.
- Aceite: começa por um teste que reproduz a falha, renderizando o `UnitRunResult` e os valores no canvas com o trace real da campanha (grupo sem `values`), que falha antes e passa depois; a API simulada valida as respostas de `unit-runs` e `previews` contra o esquema; `pnpm e2e:real e2e/epic-5/preview-and-calculate.spec.ts` passa.

**F113 · Correção da integração do épico 5: "Gerar erro" em "Mais de uma linha" não salva**
- dep: F69
- modelo: sonnet
- arquivos: `packages/react/src/editor/sources/source-block/`, `e2e/epic-5/accept-first-row.spec.ts`, `e2e/epic-5/support/`, `e2e/support/`
- Fazer: no modo real, ao escolher "Gerar erro" na lista "Mais de uma linha" de um bloco Fonte que estava em "Aceitar a primeira linha", a lista continua aberta e nenhum `PUT /draft` sai (relatório `.orquestracao/integracao/epico-5.md`). Descobrir se a causa é o componente de seleção, o localizador do teste (opção cortada no painel de propriedades) ou o autosave, e corrigir a causa no lugar certo. Os workflows criados pelos testes do modo real ("Campanha aceite e2e ...", "Campanha valores e2e ...") são apagados no fim de cada teste.
- Aceite: começa por um teste que reproduz a falha e passa depois; `pnpm e2e:real e2e/epic-5/accept-first-row.spec.ts` passa duas vezes seguidas; depois do e2e real, nenhum workflow de teste fica no banco.

### Épico 6 — Execução em lote e entrega em CSV

As decisões E6-1 a E6-15, o esquema na versão 3, os parâmetros, os estados da execução, o CSV e o trace guardado estão no plano do back (`../backend/docs/plano.md`, épico 6, e Contratos, "Execução em lote e entrega em CSV"). O contrato é o da B132. Decisões do front, tomadas pela sessão global em 2026-11-21:
- **E6-16, onde fica cada coisa:**
  - `executions/`: a lista, o disparo, o painel da execução, os registros e o formulário de parâmetros (`executions/parameter-form/`, exportado pelo `executions/index.ts`, porque o editor também o usa);
  - `editor/parameters/`: a declaração dos parâmetros e as configurações de execução do workflow;
  - `formula/`: o `@nome` no Monaco;
  - o trace de um registro usa o componente do trace da execução unitária, exportado pelo `editor/index.ts`.
  - Motivo: ADR 0003; a execução é uma vertical própria, como no design §15 (tela Execuções).
- **E6-17, parâmetros no editor:** o painel do workflow ganha a seção **Parâmetros**, com a lista, "Adicionar parâmetro" e, em cada parâmetro:
  - **nome e tipo:** o tipo aparece com o rótulo em pt-BR, e `Período` está entre eles;
  - **Lista:** caixa de marcar, escondida no Período e no Booleano;
  - **Obrigatório;**
  - **Padrão:** Nenhum, Fixo ou Relativo. Os rótulos dos relativos são "Hoje", "Ontem", "Primeiro dia do mês atual", "Primeiro dia do mês anterior", "Último dia do mês anterior", "Agora", "Mês atual", "Mês anterior", "Últimos 7 dias" e "Últimos 30 dias", só os que servem ao tipo;
  - **Valores permitidos:** lista opcional;
  - **Descrição.**
  - A seção **Execução** do painel do workflow ganha o limite de erro (%) e o nível do trace (Mínimo, Padrão ou Completo), cada um com uma linha de explicação.
  - Motivo: design §10 e §12.
- **E6-18, `@` na fórmula e nos filtros:**
  - no Monaco, `@` abre o autocomplete dos parâmetros e, depois do ponto, de `inicio` e `fim` no Período; o `@nome` tem realce próprio;
  - nos filtros, o valor aceita `@` com a mesma lista, e o aviso "Parâmetros chegam no épico 6" sai.
- **E6-19, disparo:** o botão **Executar lote** (estilos.md §13, D37) fica no cabeçalho do editor, na Visão geral do workflow e na lista de execuções do workflow (com `executions.trigger`). Ele abre um diálogo com:
  - o formulário de parâmetros, já com os padrões (o relativo aparece pelo rótulo, "Mês anterior");
  - a nota "Executa o rascunho salvo (revisão N). Mudanças feitas depois não entram nesta execução.";
  - com problemas no rascunho, o botão desabilitado com o motivo e o link para a aba Problemas.
  - Ao confirmar, o diálogo abre o painel da execução nova.
- **E6-20, lista de execuções:**
  - **onde:** o menu principal ganha **Execuções** (com `executions.view`), e o menu do workflow ganha **Execuções**, ao lado de Visão geral;
  - **tabela:** workflow, status (selo com a cor do estilos.md), disparado por, início, duração, registros (ok, com erro) e parâmetros resumidos;
  - **filtros:** status e workflow; paginação por cursor;
  - **atualização:** a cada 5 s enquanto houver execução em andamento na página.
- **E6-21, painel da execução:**
  - **cabeçalho:** status e motivo do aborto; as fases Carga → Cálculo → Entrega, com a barra de progresso (registros feitos sobre o total) e "Aguardando a fonte (nova tentativa às 14:32)" no `awaiting_source`;
  - **resumo:** parâmetros resolvidos ("Período: 01/10/2026 a 31/10/2026"), o "agora", o nível do trace, o limite de erro e quem disparou;
  - **totais:** lidos, ok, com avisos, com erro, ignorados e filtrados;
  - **erros agrupados:** por bloco e código; clicar num grupo filtra os registros;
  - **registros:** tabela com status, chave e erro (com `traces.view`). Clicar num registro abre o trace numa gaveta lateral; no nível Mínimo, a gaveta mostra só os hashes, com "Esta execução guardou o trace mínimo.";
  - **ações:** **Baixar CSV**, desabilitado com o motivo (rodando, abortada, cancelada ou expirada), e **Cancelar**, com confirmação, enquanto não termina;
  - **atualização:** a cada 2 s até um estado final.
  - Motivo: design §15 ("painel por execução (totais, alertas, erros agrupados)"); a tela de debug com o canvas é do épico 11.
- **E6-22, Prévia e Calcular com parâmetros:** com parâmetros declarados, a Prévia e o Calcular mostram o formulário de parâmetros entre o cabeçalho (título e botão) e o resultado (D42), com os padrões e lembrando os últimos valores usados na sessão.

**F109 · Manutenção: nomes e padrões do editor num lugar só (D32, itens 2 e 3 da F96)**
- dep: —
- modelo: sonnet
- arquivos: `packages/react/src/editor/properties/index.ts`, `packages/react/src/editor/groups/tree.ts`, `packages/react/src/editor/unit-run/values.ts`, `packages/react/src/editor/sources/index.ts`, `packages/react/src/editor/canvas/blocks.ts`, `packages/react/src/editor/shared/` (nova), `docs/adr/`
- Fazer:
  - uma pasta comum do editor (`editor/shared/`), com uma ADR nova que diz o que pode entrar nela, para `producedNames`, `allNodes`, `variableNameCounts` e `locateNode`, usados pelo `groups/tree.ts` e pelo `unit-run/values.ts` sem cópia;
  - os padrões do bloco Fonte novo (`defaultOutputs`, `defaultOrder`, `toLinearMode`) exportados pelo `sources/index.ts` e usados pelo `canvas/blocks.ts`, com a ADR 0059 ampliada para permitir `canvas` → `sources/source-block` por essa entrada.
- Aceite: `git grep` acha uma definição só de cada função; lint das fronteiras verde; testes e build verdes.

**F110 · Manutenção: canvas a 900 px abre com o grafo cortado (portão F71)**
- dep: —
- modelo: sonnet
- arquivos: `packages/react/src/editor/canvas/`
- Fazer: na abertura do editor e depois de redimensionar a janela, o canvas enquadra o grafo inteiro (o ajuste de vista roda depois que a área tem o tamanho final), em todas as faixas de largura do estilos §15.
- Aceite: teste do ajuste de vista com a área mudando de tamanho; o `pnpm e2e:visual` a 900 px mostra o grafo inteiro.

**F111 · Manutenção: e2e estável sob carga (portão F71)**
- dep: —
- modelo: sonnet
- arquivos: `playwright.config.ts`, `e2e/support/`, `README.md`
- Fazer: o modo simulado do e2e roda com menos workers (o número sai de uma variável, com um padrão que não sature a CPU no primeiro carregamento do shell), e os testes que estouraram o tempo sob carga (`configurator-and-reset-link.spec.ts:24`, `sign-out.spec.ts:6`, `draft-autosave.spec.ts:54`) esperam pelo estado da tela, nunca por tempo fixo.
- Aceite: três rodadas seguidas do `pnpm e2e` com duas worktrees rodando ao mesmo tempo, sem estouro de tempo.

**F114 · Manutenção: lista do Select acompanha o campo quando o painel cresce (F113)**
- dep: —
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/design-system/form/Select.tsx`, `packages/react/src/design-system/form/Select.test.tsx`
- Fazer: o `Select` usa `position="popper"` sem `updatePositionStrategy="always"`. Quando o painel cresce embaixo de uma lista aberta, a lista fica para trás e sai da janela. A lista passa a se reposicionar sempre que o campo se move, sem mudar mais nada no componente.
- Aceite: um teste que move o campo com a lista aberta e confere a lista acompanhando; os testes do design system e o `pnpm e2e:visual` verdes.

**F97 · Tipos da API do épico 6**
- tipo: contrato
- dep: B132
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`, e os pontos do editor que quebrarem com a versão 3 (`packages/react/src/editor/draft/`), só para o ajuste mínimo de tipo (`schema_version: 3`, `parameters: []` e os dois campos novos de `settings`), sem comportamento novo
- Fazer: gerar os tipos do contrato da B132 (`pnpm generate:api`) e acrescentar os exemplos do épico 6 ao contrato simulado do e2e.
- Aceite: `pnpm typecheck` e o `contract-examples` verdes; os tipos da execução, dos registros e dos parâmetros aparecem no gerado.

**F98 · Editor: parâmetros e configurações de execução do workflow**
- dep: F97, F116
- modelo: opus
- arquivos: `packages/react/src/editor/parameters/` (nova), `packages/react/src/editor/properties/workflow/`
- Fazer (E6-17): a seção Parâmetros e a seção Execução do painel do workflow, com os problemas de cada campo pelo `path` e o modo só leitura.
- Aceite: testes de criar um parâmetro de cada tipo, do padrão fixo e do relativo (só os rótulos que servem ao tipo), da lista escondida no Período, dos valores permitidos, do limite e do nível do trace, dos problemas `invalid_parameter_default` e `invalid_allowed_value` no campo certo e do modo só leitura.

**F99 · Fórmula e filtros: `@parametro`**
- dep: F97
- modelo: opus
- arquivos: `packages/react/src/formula/`, `packages/react/src/editor/sources/filters/`
- Fazer (E6-18): o autocomplete e o realce do `@` no Monaco e no campo de texto simples de reserva (E4-21), a partir dos parâmetros do rascunho e da sintaxe do `GET /v1/formula-language`; o `@` nos valores dos filtros, com o tipo conferido no front só como dica (quem decide é a análise do back).
- Aceite: testes de `@` abrir a lista, de `@periodo.` oferecer `inicio` e `fim`, do realce, do filtro aceitar `@lojas` no `em`, e dos problemas `unknown_parameter`, `period_without_part` e `list_outside_in` sublinhados na posição do back.

**F100 · Formulário de parâmetros**
- dep: F97
- modelo: sonnet
- arquivos: `packages/react/src/executions/parameter-form/` (nova), `packages/react/src/executions/index.ts`
- Fazer: o formulário gerado a partir da declaração:
  - um campo por tipo, com número e data no padrão brasileiro (E4-24) e o valor enviado no formato da API;
  - o Período com duas datas;
  - a lista com a seleção múltipla (de `allowed_values`) ou com etiquetas;
  - o relativo mostrado pelo rótulo, com "Trocar por um valor fixo";
  - os erros `missing_parameter` e `invalid_parameter` do back no campo certo.
- Aceite: testes de cada tipo, do Período com início depois do fim (aviso no front e o 422 do back no campo), da lista, do relativo e do envio no formato da API.

**F101 · Execuções: lista e disparo**
- dep: F100
- modelo: opus
- arquivos: `packages/react/src/executions/list/`, `packages/react/src/executions/trigger/`, `packages/react/src/executions/api/`, `packages/react/src/executions/index.ts`
- Fazer (E6-19, E6-20): a lista global e a do workflow (o mesmo componente, com o filtro do workflow fixo), a atualização a cada 5 s e o diálogo de disparo com os erros `draft_conflict`, `draft_has_problems` e `no_batch_source` explicados.
- Aceite: testes da lista com cada status, dos filtros, da paginação, da atualização (com relógio falso), do disparo com sucesso abrindo o painel, de cada erro do disparo e do botão escondido sem `executions.trigger`.

**F102 · Execuções: painel, registros e trace**
- dep: F97
- modelo: opus
- arquivos: `packages/react/src/executions/detail/`, `packages/react/src/executions/records/`, `packages/react/src/executions/api/`, `packages/react/src/executions/index.ts`, e uma linha de export em `packages/react/src/editor/index.ts` (o componente do trace da `editor/unit-run/`)
- Fazer (E6-21): o painel, os erros agrupados, a tabela de registros com filtro, a gaveta do trace, Baixar CSV (download pelo navegador, com o nome do arquivo do back) e Cancelar.
- Aceite: testes de cada estado (inclusive `awaiting_source` e cada `abort_reason`), do progresso, de clicar num grupo de erro e filtrar os registros, da gaveta no nível Padrão e no Mínimo, do download desabilitado em cada motivo, do cancelamento com confirmação, da atualização parando no estado final e da tabela de registros escondida sem `traces.view`.

**F103 · Editor: Prévia e Calcular com parâmetros**
- dep: F100, F116
- modelo: sonnet
- arquivos: `packages/react/src/editor/preview/`, `packages/react/src/editor/unit-run/`
- Fazer (E6-22): o formulário de parâmetros na Prévia e no Calcular, enviado em `parameters`, lembrando os últimos valores na sessão.
- D42 (2026-11-22): o aviso de resultado desatualizado também considera a mudança só nos parâmetros (o resultado é do cálculo com os valores usados).
- Aceite: testes da Prévia e do Calcular com e sem parâmetros, do 422 no campo e dos valores lembrados ao trocar de aba.

**F104 · Integração do épico 6: módulo, editor e interface pública**
- dep: F98, F99, F101, F102, F103, F117
- modelo: sonnet
- arquivos: `packages/react/src/module/`, `packages/react/src/workflows/overview/`, `packages/react/src/editor/Editor.tsx`, `packages/react/src/editor/layout/`, `packages/react/src/editor/properties/PropertiesPanel.tsx`, `packages/react/src/editor/index.ts`, `docs/glossario.md`, `README.md`, `.changeset/`
- Fazer:
  - as rotas `/executions` e `/executions/:id` e a rota da lista do workflow (`/workflows/:id/executions`);
  - o item Execuções no menu principal (por permissão) e no menu do workflow;
  - o botão Executar no cabeçalho do editor e na Visão geral;
  - a seção Parâmetros no painel do workflow;
  - os nomes novos no glossário, com um changeset `minor`.
- Aceite: testes por papel (o Operador dispara e acompanha; o Aprovador vê a lista e o painel e não dispara; o Auditor vê o painel e o trace, sem Executar nem Cancelar); `pnpm build` verde.

**F105 · Testes ponta a ponta do épico 6**
- dep: F104
- modelo: opus
- arquivos: `e2e/epic-6/`, `e2e/support/`, `e2e/visual/`, `README.md`
- Fazer: **todos** os fluxos do épico 6 do plano global ("Fluxos ponta a ponta" e "Roteiro de teste"), no modo simulado. A lista abaixo é o mínimo; se o plano global tiver mais, eles também entram (D30):
  - declarar o parâmetro `periodo` no workflow da campanha e usá-lo no filtro da fonte do lote e numa fórmula;
  - rodar a Prévia e o Calcular com o parâmetro;
  - disparar a execução com o padrão "Mês anterior" e com um período fixo, acompanhar as fases até `completed` e baixar o CSV;
  - ver uma execução com erros dentro do limite (`completed_with_errors`), abrir um grupo de erro e o trace de um registro;
  - ver uma execução `aborted` pelo limite de erro, sem CSV;
  - cancelar uma execução em andamento;
  - ver uma execução em `awaiting_source` voltar a andar;
  - o Aprovador vê e não dispara; o Auditor vê o trace e não cancela;
  - as telas do épico 6 (lista, painel, gaveta do trace, diálogo de disparo, seção Parâmetros) entram no `pnpm e2e:visual`, nos dois temas e nas faixas de largura do estilos §15.
  - **No modo real**, usar o workflow "Campanha de referência" do `prepare-local` com um worker no ar, os valores esperados de `backend/tests/reference_campaign/` e o workflow de defeitos. A queda do worker no meio é do roteiro manual e do teste do back (B144), não do e2e.
- Aceite: `pnpm e2e` e `pnpm e2e:visual` passam. O modo real é exercitado no teste de integração do CK6.

**F115 · Manutenção: formatadores num lugar só e tokens no formulário de parâmetros (revisão da F100)**
- dep: F98, F100
- modelo: sonnet
- arquivos: `packages/react/src/design-system/format/` (nova), `packages/react/src/design-system/index.ts`, `packages/react/src/executions/parameter-form/`, `packages/react/src/executions/index.ts`, `packages/react/src/editor/values/`, `packages/react/src/editor/parameters/`, `docs/adr/`
- Fazer:
  - a leitura e a formatação de número e data no padrão brasileiro (`readBrazilianNumber`, `formatApiNumber`, `formatDate`) ficam só em `design-system/format/`, que qualquer vertical pode usar (uma ADR curta); o `editor/values/` e o `executions/parameter-form/` passam a importar de lá, sem cópia;
  - os rótulos dos padrões relativos (`RELATIVE_LABELS`) ficam só em `executions/`, exportados pelo `executions/index.ts`, e a seção Parâmetros do editor (F98) os importa por ali (sentido editor → executions, E6-16);
  - o `parameter-form.css` troca os px crus (fontes de 12 e 13 px, margem de 26 px, altura mínima de 32 px, raio de 6 px) pelos tokens do `estilos.md`.
  - (revisão da F98) o `fromLiteral` de `date` em `parameterRules.ts` confere o calendário (`isCalendarDate`) e devolve nulo para `DATA(2026, 2, 30)` ou `DATA(2026, 13, 1)`, com o campo caindo no modo texto e na dica, com teste;
  - (revisão da F98) o `LiteralList.tsx` limpa a marca `focusAfterRemove` também quando a mudança não altera a lista, para nenhum render depois roubar o foco, com teste.
- Aceite: `git grep` acha uma definição só de cada formatador e de `RELATIVE_LABELS`; nenhum px cru no `parameter-form.css`; lint das fronteiras, testes e `pnpm e2e:visual` verdes.

**F116 · Manutenção: todo o simulado do e2e no contrato v3 (D38, reprovação da F98)**
- dep: F97
- modelo: sonnet
- revisão: não
- arquivos: `e2e/support/contract.ts` (só os exemplos de rascunho e de definição), `e2e/epic-4/support/`, `e2e/epic-5/support/`
- Fazer: todas as definições servidas pela API simulada passam à versão 3 do contrato (`schema_version: 3`, `parameters: []` e os campos novos de `settings`): o `EXAMPLES.DraftEmpty` e os outros rascunhos do `contract.ts`, o `isDefinition` e as definições do `e2e/epic-4/support/simulation.ts` e o `e2e/epic-5/support/` (já com o que a F99 fez). Validadas contra o esquema (ADR 0060). Nada de mascarar no componente com `?? []`.
- Aceite: `pnpm e2e` de `e2e/epic-4` e `e2e/epic-5` verde no modo simulado, com as respostas validadas contra o contrato; a F98 (tentativa 2) passa no e2e em cima dela.

**F117 · Correção: o editor grava a definição sempre na versão 3 (achado da F116)**
- dep: F97, F116
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/editor/sources/batch-source/batchSource.ts`, `packages/react/src/editor/sources/batch-source/batchSource.test.ts`, `packages/react/src/editor/draft/`
- Fazer: o `BATCH_SOURCE_SCHEMA_VERSION = 2` some. O editor lê rascunhos nas versões 1, 2 e 3 e grava sempre `schema_version: 3`, com `parameters` (vazio se não houver) e os campos novos de `settings` com os padrões do contrato. Uma constante só para a versão gravada, no lugar onde o rascunho é salvo. No back real, uma definição v2 com `parameters` é recusada, então nada pode sair na v2.
- Aceite: começa por um teste que salva um rascunho aberto na v2 e falha antes (grava 2) e passa depois (grava 3, com `parameters: []`); `git grep` não acha outra versão gravada fixa no editor.

**F118 · Execuções: gaveta do trace com a definição congelada (D40)**
- dep: B154, F102, F103
- modelo: sonnet
- arquivos: `packages/react/src/executions/detail/`, `packages/react/src/executions/records/`, `packages/react/src/executions/api/`, `packages/react/src/editor/unit-run/` (só para deixar opcionais as props que só o editor usa, como a seleção no canvas), `packages/react/src/api/generated/`, `e2e/support/contract.ts`
- Fazer: a gaveta do trace do painel da execução lê a definição congelada (`GET /v1/executions/{id}/definition`, B154) e mostra o trace com o nome dos blocos e os números no padrão brasileiro, como o Calcular do editor. A ligação continua pela render prop da F102, ligada no `module/` pela F104 (ADR 0062). Os erros sem nó filtram com `without_node=true`, e o nome do CSV vem do `Content-Disposition`.
- Também (pendências da F102): o `UnitRunResult` passa a importar o próprio `unit-run.css`, para a gaveta fora do editor ter os estilos; e o painel mostra a hora da próxima tentativa no `awaiting_source` pelo `next_retry_at` (B154).
- Aceite: testes da gaveta com a definição congelada (nomes e números no padrão brasileiro), do grupo de erro sem nó filtrando por `without_node=true` e do nome do arquivo; o editor continua igual (os testes do unit-run passam).

**F119 · Manutenção: espelho dos exemplos de rascunho na v3 da B153**
- dep: B153, F116
- modelo: sonnet
- revisão: não
- arquivos: `e2e/support/contract.ts` (só os exemplos de rascunho e de definição)
- Fazer: depois que a B153 levar os exemplos do contrato à v3, o espelho do `e2e/support/contract.ts` passa a ser igual a eles, sem a conversão que a F116 fez no simulado para esses exemplos.
- Aceite: o `contract-examples.spec.ts` com `FLUXO_BACKEND_DIR` fica verde; o `pnpm e2e` simulado continua verde.

**F120 · Manutenção: tokens de raio e fim dos reexports dos formatadores (revisão da F115)**
- dep: F115
- modelo: sonnet
- revisão: não
- arquivos: `packages/react/src/design-system/tokens.css`, `packages/react/src/executions/parameter-form/`, `packages/react/src/editor/values/index.ts`, e os arquivos que importam os formatadores pelos reexports (só a troca do caminho para `design-system/format/`)
- Fazer:
  - o `tokens.css` ganha `--fc-radius-6` e `--fc-radius-12`, com os valores do `estilos.md`, e o `parameter-form.css` troca o `--fc-space-6` usado como raio por `--fc-radius-6`;
  - os reexports dos formatadores em `editor/values/index.ts` e `executions/parameter-form/literals.ts` saem, e quem importava por eles passa a importar de `design-system/format/` (o "a fazer" da ADR 0069).
- Aceite: nenhum token de espaço usado como raio; `git grep` não acha reexport dos formatadores; lint das fronteiras, testes e `pnpm e2e:visual` verdes.

**F121 · Manutenção: componentes avulsos de execuções no e2e e workflow com execuções (pendências da F105)**
- dep: F105, B157, B144, B165
- modelo: sonnet
- revisão: não
- arquivos: `apps/shell/src/embed-test.tsx`, `e2e/epic-6/`, `e2e/support/`, `packages/react/src/workflows/`
- Fazer:
  - a página de teste de incorporação monta o `<Executions>` e o `<Workflows>` avulsos (ADR 0070), e o e2e cobre os dois sozinhos: listar, abrir o painel, Executar lote pelo workflow e voltar;
  - apagar um workflow que já tem execuções mostra a mensagem do `409 workflow_has_executions` (B157) no diálogo de excluir; a fixture do e2e real aceita o 409 nas cópias que executaram e as nomeia de um jeito reconhecível.
  - (B165, D99-global) o `409 workflow_busy` mostra a mensagem da API no diálogo de excluir o workflow, no Executar lote e no renomear (B189), sem quebrar a tela; a F121 passa a depender também da B165.
  - (B144) o exemplo `ExecutionDraftHasProblems` de `e2e/support/contract.ts` passa a trazer o texto novo do `openapi.yaml` do back (o texto do motor, pela D53), validado contra o contrato (ADR 0060).
- Aceite: `pnpm e2e` verde com os avulsos montados; teste do diálogo de excluir com o 409.

**F135 · Correção da integração do épico 6: editor em branco com os filtros da fonte do lote**
- dep: F121
- modelo: sonnet
- arquivos: `packages/react/src/editor/sources/filters/`, `packages/react/src/formula/parameters.ts`, `packages/react/src/formula/` (só o teste do `readParameterReference`), `e2e/support/contract.ts`, `e2e/epic-6/support/simulation.ts`, e (D44 do front) `packages/react/src/editor/parameters/` e `packages/react/src/design-system/format/` (só o teste do `readBrazilianNumber` com valor ausente)
- Fazer: o editor abre o rascunho real da Campanha de referência sem quebrar. No `batch_source` do contrato, os filtros apontam a variável por `variable` (nome), não por `variable_id`, e o `LiteralField` e o `readParameterReference` recebiam `undefined` (`TypeError ... reading 'trim'`).
  - O filtro da fonte do lote é lido pela forma do contrato.
  - O `readParameterReference` aceita valor ausente sem quebrar.
  - A simulação e os exemplos do `contract.ts` passam a ter um `batch_source` com filtros por `variable` e `values` com parâmetro (`["@periodo.inicio"]`), validado contra o `openapi.yaml` (ADR 0060), para o simulado pegar essa forma.
- (D44 do front) A causa real: o rascunho real chega com `settings` sem `error_limit_percent` e sem `trace_level`, e o `readBrazilianNumber` quebra em `readErrorLimit` e `validateLimit`. O editor lê os padrões do contrato quando o campo falta (`"5"` e `standard`) e grava sempre os dois. O back passa a servir os padrões (B193); a leitura tolerante fica no front do mesmo jeito, para rascunhos antigos. O `contract.ts` e a simulação ganham também um rascunho com `settings` incompleto, marcado como forma legada.
- Aceite: começa por um teste que monta o editor com o rascunho no formato real e falha antes (tela em branco, `TypeError`) e passa depois; o `declare-parameter` e o `preview-and-calculate` passam no simulado com a forma nova.

**F136 · Correção da integração do épico 6: e2e real com o mês dos dados e o nome da conta (D105-global)**
- dep: F121
- modelo: sonnet
- revisão: não
- arquivos: `e2e/epic-6/`, `README.md` (só a seção do épico 6)
- Fazer (D105-global):
  - os dados da campanha são de fevereiro de 2026 e não mudam (B98 e B100). O `DATA_MONTH` passa a ser fixo, `2026-02-01` a `2026-02-28`, numa constante só. Todo teste que confere totais, erros, trace ou CSV dispara com esse período fixo;
  - o padrão "Mês anterior" tem um teste próprio, que confere só o período resolvido pela API (o mês anterior ao dia do teste), sem conferir totais;
  - o `roles.spec.ts` usa o nome da conta que o `prepare-local` cria no modo real ("Admin Demonstração"), e o da simulação no simulado, sem texto fixo duplicado;
  - o `README.md` da raiz, na seção do épico 6, troca o aviso "ajuste as datas" pela regra nova. Cancelar no meio e derrubar o worker continuam cobertos pelo simulado e pelos testes do back (B144), não pelo real.
- Aceite: o `pnpm e2e:real e2e/epic-6` passa contra o back real em qualquer dia do ano, com os totais da B100 (58 lidos, 44 ok, 4 avisos, 2 erros, 6 ignorados, 2 filtrados); o simulado continua verde.

**F138 · Correção da integração do épico 6, rodada 2: três specs reais desalinhados**
- dep: F136
- modelo: sonnet
- revisão: não
- arquivos: `e2e/epic-6/`
- Fazer (relatório `.orquestracao/integracao-epico-6-r2.md`):
  - `preview-and-calculate.spec.ts`: o editor real mostra o período como dois filtros, "Valor (filtro 2)" com `@periodo.inicio` e "Valor (filtro 3)" com `@periodo.fim`, e não "De/Até (filtro 2)". O spec segue a forma real, e a simulação também, para os dois modos baterem;
  - `defects-and-abort.spec.ts`: os dois testes passam a disparar pelo `openTriggerForDataMonth` (fevereiro de 2026, D105-global);
  - `expected.ts`: o `DEFECTS_TOTALS` passa ao valor real do lote de defeitos em fevereiro de 2026 (8 lidos, 6 ok e 2 erros, chave repetida e chave nula), que passa do limite de 5% e termina `aborted` com `error_limit_exceeded`, sem CSV. Confira contra o `backend/docs/campanha-de-referencia.md`;
  - procurar no `e2e/epic-6/` qualquer outro `openTrigger` que confira totais e trocar também.
- Aceite: o `pnpm e2e:real e2e/epic-6` passa contra o back real (no banco `fluxo_int6`), e o simulado continua verde.

**F106 · Portão do épico 6**
- tipo: portao
- dep: F97, F98, F99, F100, F101, F102, F103, F104, F105, F109, F110, F111, F114, F115, F116, F117, F118, F119, F120, F121, F135, F136, F138
- modelo: sonnet
- Aceite: o mesmo da F71, com as telas do épico 6 provadas pelo `pnpm e2e:visual`.

### Épico 7 — Pré-validação, agendamento e arquivo de referência

As decisões E7-1 a E7-19, o esquema na versão 4, a pré-validação, a sobreposição, os agendamentos, o arquivo de referência, a comparação e o sino estão no plano do back (`../backend/docs/plano.md`, épico 7, e Contratos, "Pré-validação, agendamento e arquivo de referência"). O contrato é o da B166. Decisões do front, tomadas pela sessão global em 2026-11-24:
- **E7-20, onde fica cada coisa:**
  - `executions/`: a pré-validação e a decisão no painel (`detail/`), a sobreposição no disparo (`trigger/`), a comparação (`comparison/`, nova), os agendamentos (`schedules/`, nova) e o formulário de parâmetros com a busca e o modo agendamento (`parameter-form/`);
  - `editor/parameters/`: os valores permitidos por consulta e o alerta da pré-validação;
  - `test-cases/reference-files/`: o arquivo de referência, na tela Testes do workflow;
  - `notifications/`: o sino;
  - `module/`: rotas, menus, abas e a barra do conteúdo.
  - Motivo: ADR 0003. As verticais `test-cases` ("casos de teste do workflow e arquivo de referência") e `notifications` ("sino") já existem vazias para isso; os agendamentos são uma aba da tela Execuções e usam o formulário de parâmetros.
- **E7-21, estados e pré-validação no painel:**
  - **rótulos:** `pre_validating` e `comparing` → "Calculando" (estilos §7.3, linha de PRÉ-VALIDANDO); `awaiting_decision` → "Aguardando decisão", ponto `amber-700` sem pulsar, como as esperas do §7.3 (decidido sem base no design); a simulação que termina sem erros → "Sem entrega" (§7.3);
  - **fases:** Carga → Pré-validação → Cálculo → Entrega, ou → Comparação na simulação;
  - **em `awaiting_decision`:** uma nota âmbar (estilos §7.7) "A pré-validação encontrou campos vazios acima do limite.", com a lista ("quantidade: 22,22% vazios, limite 1%"), o prazo ("Sem resposta até 25/11 às 14:30, a execução é cancelada.") e as ações **Prosseguir** (principal) e **Cancelar** (secundária, com a confirmação da E6-21). Sem a permissão do modo, a nota aparece sem os botões, com "Só quem executa lotes pode decidir." (ou "simulações", na simulação);
  - **resumo da pré-validação:** registros, linhas vazias, chaves nulas, chaves repetidas (até 5 exemplos em mono) e vazios por variável;
  - **seção Fontes:** as contagens por bloco Fonte, com ponto e palavra, como a aba Prévia (F66);
  - **agendada:** "Agendada · Fechamento mensal" no lugar de quem disparou, na lista e no painel (estilos §7.6);
  - **sobreposição confirmada:** "Executada de novo sobre a execução de 03/11 às 02:00", com link;
  - **lista:** ganha o filtro de modo (Lotes, Simulações).
  - Motivo: design §10 ("alerta → Prosseguir ou Cancelar") e estilos §7.3.
- **E7-22, sobreposição no disparo:** o `409 scope_already_delivered` não fecha o diálogo de **Executar lote**. Ele mostra uma nota âmbar ("Este escopo já foi entregue. Executar de novo entrega tudo outra vez, com uma revisão nova. O reprocessamento só do que mudou chega depois.") com as execuções (status, quando, quem ou "Agendada", com link). O botão principal continua **Executar lote** e agora envia `confirm_overlap`. Mudar qualquer parâmetro tira a nota.
  - Motivo: estilos §13 (um rótulo por ação); design §10 ("avisa").
- **E7-23, valores permitidos por consulta:**
  - **no editor:** "Valores permitidos" vira um controle segmentado Nenhum | Lista | Consulta (só em Texto, Inteiro e Data). Na Consulta: o dataset (a busca no catálogo da fonte do lote), a variável (só as do tipo do parâmetro) e os filtros (o componente da F64, sem `@`). Trocar de Lista para Consulta, ou o contrário, pede confirmação do que se perde;
  - **no formulário:** o campo vira uma busca (combobox) com os valores da API, pedidos 300 ms depois da última tecla. Com `truncated`, a nota "Mostrando os primeiros 1.000. Digite para filtrar."; numa lista, várias escolhas, como etiquetas;
  - **seção Execução do editor:** ganha "Alerta de campos vazios (%)", com a explicação "A pré-validação avisa quando uma variável da fonte do lote tem mais vazios que isso.".
  - Motivo: design §10 ("lista fechada ou consulta a um dataset do catálogo") e E6-17.
- **E7-24, agendamentos:**
  - **onde:** a tela Execuções (a global e a do workflow) ganha as abas **Execuções** e **Agendamentos** (ADR 0027), com rota própria para a aba (`/executions/schedules` e `/workflows/:id/executions/schedules`). Não há item novo no menu: o design §15 não lista um;
  - **lista:** nome, workflow (só na global), recorrência em texto ("Todo dia 1 às 02:00", "Toda segunda e quinta às 08:00", "Todo último dia do mês às 23:00"), parâmetros resumidos ("Período: Mês anterior"), próxima execução, último disparo (resultado com ponto e palavra e link para a execução) e um switch Ativo (com `executions.schedule`);
  - **Novo agendamento** (com `executions.schedule`, só na aba do workflow): diálogo com o nome; a recorrência (Diária | Semanal | Mensal, o horário, os dias da semana ou o dia do mês, com "Último dia"); o fuso, só como texto ("Horário de America/Sao_Paulo"); o formulário de parâmetros no modo agendamento (cada parâmetro Fixo ou Relativo); e Ativo;
  - **revisão:** a nota "Roda a revisão 42 do rascunho salvo."; quando o rascunho andou, "O rascunho está na revisão 57." e **Usar a revisão atual**;
  - **apagar:** pelo menu "…", com confirmação;
  - **Visão geral do workflow:** "Próxima execução: 01/12 às 02:00 · Fechamento mensal" (estilos §16).
  - Motivo: design §10 ("o agendamento guarda valores fixos ou relativos") e estilos §16. O rótulo **Novo agendamento** segue o "Criar → Novo …" do estilos §13.
- **E7-25, Testes e arquivo de referência:**
  - o menu do workflow ganha **Testes** (rota `/workflows/:id/tests`, com `workflows.view`), com só a seção **Arquivo de referência** neste épico. Os testes em linha entram no épico 10;
  - **envio** (com `test_cases.edit`): arrastar ou escolher um `.csv`, com a barra de progresso (ADR 0035), e a nota do formato ("As colunas da chave do registro e os campos da saída. Um CSV entregue serve."). O `422 invalid_reference_file` mostra a lista de erros por linha e coluna;
  - **lista:** nome, registros, quem enviou e quando, SHA-256 encurtado com cópia, e a última comparação ("100% iguais", com link para a simulação);
  - **Simular** (com `simulations.run`): diálogo com o formulário de parâmetros e a nota "Simula o rascunho salvo (revisão N) e compara com o arquivo. Nada é entregue."; ao confirmar, abre o painel da simulação. O `409 reference_file_mismatch` aparece no diálogo, com a mensagem da API;
  - **apagar** (com `test_cases.edit`): pelo menu "…", com confirmação;
  - vazio: "Nenhum arquivo de referência" · "Envie um CSV com os resultados que você já conhece." · **Enviar arquivo**.
  - Motivo: design §15 ("Testes: … importação de arquivo de referência") e estilos §13 (**Simular** é o rótulo do lote sem entrega).
- **E7-26, comparação no painel:** na simulação com arquivo, a seção **Comparação com o arquivo de referência** fica no topo do painel:
  - **resumo:** "100% iguais · 58 de 58 registros" ou "98,27% iguais · 57 de 58 registros", com o percentual da API, nunca recalculado; e as contagens por resultado: iguais, diferentes, status diferente, fora do resultado, fora do arquivo e fora da comparação;
  - **tabela** (com `simulations.run` ou `traces.view`): a chave, o resultado (ponto + palavra) e, para cada campo diferente, esperado × obtido em mono, com números no padrão brasileiro e o nulo como "vazio"; filtro por resultado; paginação por cursor;
  - clicar num registro abre a gaveta do trace (F118);
  - **Baixar CSV** fica desabilitado, com "A simulação não entrega arquivo.".
  - Motivo: design §12 ("compara registro a registro, com o diff").
- **E7-27, sino:**
  - **onde:** na barra do conteúdo do casca (56 px, à direita, estilos §9), que nasce neste épico só com o sino (o caminho e a busca Ctrl K ficam para depois); no incorporado, no fim da linha das abas. Só com `executions.view`;
  - **botão:** ícone de sino (só ícone, com `aria-label` "Alertas, 3 não lidos") e a contagem de não lidos num badge neutro (estilos §7.4, contagens);
  - **lista** (popover Radix, dentro da raiz do módulo): ponto + título, o detalhe, quando ("há 2 h") e o link (abre a execução ou a aba Agendamentos); abrir um alerta o marca como lido; **Marcar todos como lidos**; vazio: "Nenhum alerta";
  - **atualização:** a cada 30 s (ADR 0067).
  - Motivo: design §15 ("Sino: alertas de pré-validação, execuções com erro ou abortadas") e estilos §9.

**F122 · Tipos da API do épico 7**
- tipo: contrato
- dep: B166, F106
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`, `e2e/epic-4/support/`, `e2e/epic-5/support/`, `e2e/epic-6/support/`, `packages/react/src/editor/draft/` (só a versão gravada passar a 4, com `pre_validation_alert_percent`, como a F117), `packages/react/src/executions/api/` (só o ajuste mínimo de tipo: os estados novos com os rótulos da E7-21 e o `triggered_by` nulo)
- Fazer: gerar os tipos do contrato da B166 (`pnpm generate:api`); acrescentar os exemplos do épico 7 ao contrato simulado do e2e; passar **todas** as definições do simulado (épicos 4 a 6) à versão 4, validadas contra o esquema (ADR 0060); o editor lê rascunhos nas versões 1 a 4 e grava sempre a 4, pela constante única da F117. Nada de mascarar no componente com `?? []`.
- (D99 do back, B194) os tipos também trazem o motivo de aborto novo `excel_file_unreadable`; o painel da execução mostra a mensagem da API para ele, como para os outros motivos, com um teste.
- Aceite: `pnpm typecheck` e o `contract-examples` verdes; o `pnpm e2e` dos épicos 4 a 6 verde no simulado; um teste que abre um rascunho v3 e grava v4, com `pre_validation_alert_percent: "1"`; `git grep` não acha outra versão gravada fixa no editor.

**F123 · Editor: valores permitidos por consulta e alerta da pré-validação**
- dep: F122
- modelo: opus
- arquivos: `packages/react/src/editor/parameters/`, e (só se ainda faltar) a exportação do componente de filtros em `packages/react/src/editor/sources/index.ts`
- Fazer (E7-23):
  - em cada parâmetro de Texto, Inteiro ou Data, "Valores permitidos" com Nenhum | Lista | Consulta; na Consulta, o dataset, a variável (só as do tipo) e os filtros sem `@`;
  - a seção Execução ganha "Alerta de campos vazios (%)";
  - os problemas `allowed_values_type_mismatch`, `parameter_in_allowed_values`, `unknown_dataset` e `variable_not_from_dataset` no campo certo, pelo `path`;
  - só leitura: tudo desabilitado, com o motivo.
- Aceite: testes de trocar Lista por Consulta com a confirmação, de escolher o dataset e a variável (as de outro tipo não aparecem), do filtro que recusa `@`, de cada problema no campo, do alerta com 3 casas recusado no front, e do modo só leitura; os testes da F98 seguem verdes.

**F124 · Formulário de parâmetros: valores por consulta e modo agendamento**
- dep: F122
- modelo: opus
- arquivos: `packages/react/src/executions/parameter-form/`, `packages/react/src/executions/index.ts`, e (ratificado pela global) uma linha em `packages/react/src/executions/trigger/TriggerExecutionDialog.tsx` e uma em `packages/react/src/editor/preview/parameters.ts`, só para passar `{ workflowId }`
- Fazer (E7-23, E7-24):
  - o campo de um parâmetro com consulta vira a busca com os valores de `GET .../allowed-values`, com o `truncated` e, na lista, várias escolhas; os erros de leitura com a mensagem da API;
  - o modo agendamento (`mode="schedule"`): cada parâmetro com Fixo | Relativo (só os relativos que servem ao tipo, pelos `RELATIVE_LABELS`), enviado como `{kind, value}`;
  - o `422 invalid_parameter` "não está entre os valores permitidos" no campo.
- Aceite: testes da busca (com relógio falso para os 300 ms), do `truncated`, da lista com várias escolhas, do modo agendamento em cada tipo (o Relativo só aparece no tipo que tem), do envio no formato de Contratos e do 422 no campo; os testes da F100 seguem verdes.

**F125 · Execuções: pré-validação, decisão e os estados novos no painel e na lista**
- dep: F122
- modelo: opus
- arquivos: `packages/react/src/executions/detail/`, `packages/react/src/executions/list/`, `packages/react/src/executions/api/`, e (ratificado pela global) em `packages/react/src/module/screens.tsx` só o `onOpenExecution` passado ao `ExecutionPanel`, e a fixture de `packages/react/src/module/standalone/StandaloneScreens.test.tsx`
- Fazer (E7-21): as fases; a nota de `awaiting_decision` com **Prosseguir** e **Cancelar** (com a permissão pelo modo) e o `409 not_awaiting_decision` relendo a execução; o resumo da pré-validação; a seção Fontes; o aborto `duplicate_record_key` com os exemplos; "Agendada" e o nome do agendamento; a sobreposição confirmada; a simulação ("Sem entrega" e Baixar CSV desabilitado com o motivo); o filtro de modo na lista.
- Aceite: testes de cada estado novo (ponto e palavra), da decisão (Prosseguir, Cancelar com confirmação, botões escondidos sem permissão e o 409), do resumo, das Fontes, do aborto por chave repetida, da agendada e da simulação; a atualização a cada 2 s continua em `awaiting_decision` e para no estado final; os testes da F101 e da F102 seguem verdes.

**F126 · Execuções: sobreposição de escopo no disparo**
- dep: F122
- modelo: sonnet
- arquivos: `packages/react/src/executions/trigger/`
- Fazer (E7-22): o `409 scope_already_delivered` vira a nota no próprio diálogo, com as execuções e os links; **Executar lote** de novo envia `confirm_overlap: true`; mudar um parâmetro tira a nota.
- Aceite: testes do 409 com uma e com cinco execuções, do reenvio com `confirm_overlap`, da nota que some ao trocar o período e do link que abre o painel; os testes da F101 seguem verdes.

**F127 · Execuções: comparação com o arquivo de referência no painel**
- dep: F125
- modelo: opus
- arquivos: `packages/react/src/executions/comparison/` (nova), `packages/react/src/executions/detail/` (só a inclusão da seção no painel da simulação)
- Fazer (E7-26): o resumo, as contagens, a tabela do diff com filtro e cursor e a gaveta do trace ao clicar.
- Aceite: testes do resumo a 100% e com divergências (o percentual no padrão brasileiro, como veio da API), do filtro por resultado, de esperado × obtido (números no padrão brasileiro e nulo como "vazio"), dos estados vazio ("Nenhuma divergência"), carregando e erro, e da tabela escondida sem `simulations.run` nem `traces.view`; clicar abre a gaveta do trace.

**F128 · Execuções: agendamentos**
- dep: F124
- modelo: opus
- arquivos: `packages/react/src/executions/schedules/` (nova), `packages/react/src/executions/index.ts`
- Fazer (E7-24): a lista (global e do workflow, o mesmo componente com o filtro do workflow fixo); o switch Ativo; **Novo agendamento** e a edição no diálogo, com a recorrência e o formulário no modo agendamento; **Usar a revisão atual**; apagar com confirmação; os erros `schedule_name_taken`, `too_many_schedules`, `draft_conflict`, `draft_has_problems`, `missing_parameter` e `invalid_parameter` no lugar certo; o texto da recorrência; e, para a Visão geral, o componente da próxima execução, exportado pelo `executions/index.ts`.
- Aceite: testes da lista com cada resultado do último disparo, do texto de cada recorrência (inclusive "Último dia"), de criar um agendamento de cada recorrência com parâmetro relativo e fixo, de ativar e desativar, da revisão desatualizada e do **Usar a revisão atual**, de cada erro, de apagar e dos controles escondidos sem `executions.schedule`.

**F129 · Testes do workflow: arquivo de referência**
- dep: F122, F124
- modelo: opus
- arquivos: `packages/react/src/test-cases/`, e (ratificado pela global) `packages/react/src/api/client/upload.ts` e o teste dele, só para o `pathParams`
- Fazer (E7-25): a seção Arquivo de referência (envio com progresso, erros por linha, lista, apagar) e o diálogo **Simular**, que usa o formulário de parâmetros pelo `executions/index.ts` e abre o painel da simulação ao confirmar; a tela exportada pelo `test-cases/index.ts`.
- Aceite: testes do envio com progresso, do 422 com três erros, do 413, da lista com e sem comparação, do **Simular** com sucesso, com o 409 `reference_file_mismatch` e com o 422 de parâmetro, de apagar e dos controles escondidos sem `test_cases.edit` e sem `simulations.run`; os quatro estados da lista.

**F130 · Sino de alertas**
- dep: F122
- modelo: opus
- arquivos: `packages/react/src/notifications/`, e (ratificado pela global, E7-27) `packages/react/package.json` e `pnpm-lock.yaml` só para a dependência `@radix-ui/react-popover`
- Fazer (E7-27): o botão do sino com a contagem, o popover com a lista, os links (pela render prop de navegação, sem importar `module/`), marcar como lido ao abrir, **Marcar todos como lidos** e a atualização a cada 30 s.
- Aceite: testes da contagem, da lista com cada tipo, do vazio, do carregando e do erro, de abrir um alerta (marca como lido e navega), de marcar todos, da atualização (com relógio falso), do teclado (abre com Enter, fecha com Esc e devolve o foco ao botão) e do `aria-label` com a contagem.

**F131 · Integração do épico 7: módulo, menus, sino e interface pública**
- dep: F123, F125, F126, F127, F128, F129, F130
- modelo: sonnet
- arquivos: `packages/react/src/module/`, `packages/react/src/workflows/overview/`, `docs/glossario.md`, `README.md`, `.changeset/`, e (ratificado pela global na tentativa 2) `e2e/support/` (a API simulada responde `GET /v1/notifications` e `GET /v1/schedules` com os exemplos do contrato, como nas D11 e D14) e 6 linhas em `packages/react/src/workflows/Workflows.tsx` (o `tab` repassado ao `WorkflowExecutions`); também as simulações `e2e/epic-2/support/simulation.ts` a `e2e/epic-6/support/simulation.ts` (só `GET /v1/notifications` e `GET /v1/schedules` nas rotas conhecidas, e no épico 2 em `AUTHENTICATED_ROUTES`) e `e2e/visual/__screenshots__/` (regravar as 71 baselines que mudam só pela barra do conteúdo com o sino, 56 px; o relatório lista as telas)
- Fazer:
  - a rota `/workflows/:id/tests` e o item **Testes** no menu do workflow (com `workflows.view`);
  - as abas Execuções | Agendamentos nas duas telas de execuções, com as rotas das abas;
  - a barra do conteúdo do casca, com o sino à direita, e o sino no fim da linha das abas do incorporado (sem `executions.view`, sem sino);
  - os destinos dos links do sino (a execução e a aba Agendamentos);
  - a "Próxima execução" na Visão geral do workflow;
  - os nomes novos no glossário, com um changeset `minor`.
- Aceite: testes por papel (o Operador agenda e decide o alerta do lote; o Configurador envia o arquivo e simula; o Aprovador simula e vê o diff, sem agendar; o Auditor vê tudo só para leitura, inclusive o sino); `pnpm build` verde; a barra do conteúdo nas três faixas de largura do estilos §15.

**F132 · Testes ponta a ponta do épico 7**
- dep: F131
- modelo: opus
- arquivos: `e2e/epic-7/` (nova), `e2e/support/`, `e2e/visual/`, `e2e/epic-6/` (só o `defects-and-abort.spec.ts`, que no modo real passa a esperar o bloqueio `duplicate_record_key` da pré-validação, E7-2, e os disparos que repetem o mesmo período no mesmo workflow, que passam a confirmar a sobreposição), `README.md`
- Fazer: **todos** os fluxos do épico 7 do plano global ("Fluxos ponta a ponta" e "Roteiro de teste"), no modo simulado. A lista abaixo é o mínimo (D30):
  - enviar o arquivo de referência da campanha, **Simular** e ver 100% de igualdade; um arquivo com um valor mudado e uma linha a menos, com o diff; um arquivo com erros de linha;
  - um agendamento que dispara sozinho e aparece como "Agendada"; um com período relativo; um pulado pela sobreposição, com o alerta no sino;
  - a "Campanha de referência — vazios" com Prosseguir e com Cancelar; a de defeitos bloqueada pela chave repetida;
  - a sobreposição no disparo, confirmada;
  - um parâmetro com valores por consulta, no editor e no formulário;
  - o sino: alertas, abrir um e marcar todos;
  - os papéis;
  - as telas do épico 7 (painel com a decisão e com a comparação, diálogo de sobreposição, aba Agendamentos e o diálogo, tela Testes, sino aberto e a barra do conteúdo) no `pnpm e2e:visual`, nos dois temas e nas faixas de largura do estilos §15.
  - **No modo real:**
    - o `FLUXO_BACKEND_DIR` dá o `tests/fixtures/reference_campaign/expected.csv`;
    - o agendamento é uma cópia da campanha com o período fixo de fevereiro de 2026, marcada para o minuto seguinte no fuso `E2E_BUSINESS_TIMEZONE`, com espera de até 3 min;
    - as cópias evitam cruzar a sobreposição com os testes do épico 6.
  - **README (achado da F134):** a seção do `e2e:visual` (hoje linhas 109 a 114) ainda diz que ele só salva capturas e fica fora da posse. Atualize-a: desde a F134 (ADR 0071), ele compara pixels com `toHaveScreenshot` e usa máscara nas áreas que mudam (data, hora, duração e id).
- Aceite: `pnpm e2e` e `pnpm e2e:visual` passam, com os épicos 4 a 6 verdes. O modo real é exercitado no teste de integração do CK7.

**F134 · Manutenção: baselines do e2e:visual defasados (achado da F121)**
- dep: F106
- modelo: sonnet
- revisão: não
- arquivos: `e2e/visual/`, `playwright.config.ts` (só o projeto do `e2e:visual`)
- Fazer: os baselines de `epic5-*`, `editor-canvas`, `editor-properties`, `editor-calculate`, `overview` e `epic6-trace-drawer` estão com 11% a 12% de diferença real de tela. Para cada um:
  - achar a tarefa que mudou a tela (`git log` dos componentes) e conferir, pelo `docs/estilos.md` e pela tarefa, que a mudança era esperada;
  - só então regravar.
  Uma diferença que não tenha tarefa por trás é regressão: não regrave, e avise a global.
  Se a tolerância do `e2e:visual` deixou passar 11% de mudança, ajuste-a para um valor que pegue uma mudança real e não pegue ruído de renderização.
- (D45 do front, opção C) O `e2e:visual` hoje só salva as capturas, e a diferença medida é de 0% a 2%. Ele passa a comparar pixels (`toHaveScreenshot`) só nas telas estáveis, com máscara nas áreas que variam (datas, ids, horários) e uma tolerância pequena. As telas que não estabilizam continuam só salvando a captura, listadas no cabeçalho do spec com o motivo.
- Aceite: o relatório lista cada baseline com a tarefa que explica a mudança; o `pnpm e2e:visual` fica verde com a tolerância nova e falha numa mudança de tela feita de propósito numa tela estável; rodar duas vezes seguidas sem mudança não acusa diferença.

**F137 · Manutenção: tipos do e2e checados no `pnpm typecheck` (achado da F135)**
- dep: F106
- modelo: sonnet
- revisão: não
- arquivos: `e2e/`, `package.json` (só o script `typecheck`)
- Fazer: o `tsc -p e2e/support/tsconfig.json` dá 9 erros na main e o `pnpm typecheck` não checa o e2e. Corrigir os 9 (8 antigos em epic-4 e epic-5: `settings` e `batch_source` desatualizados e chaves duplicadas; 1 da F135, o cast do `LEGACY_DRAFT_EMPTY` em `e2e/support/contract.ts`); usar o `LEGACY_DRAFT_EMPTY` num teste ou apagá-lo; pôr o tsconfig do e2e no `pnpm typecheck`.
- Aceite: o `pnpm typecheck` checa o e2e e fica verde; um erro de tipo posto de propósito num spec faz o `pnpm typecheck` falhar.

**F139 · Manutenção: acabamentos agrupados do épico 7 (achados médios e baixos)**
- dep: F131
- modelo: sonnet
- arquivos: `packages/react/src/editor/parameters/`, `packages/react/src/editor/sources/filters/`, `packages/react/src/editor/properties/workflow/`, `packages/react/src/executions/parameter-form/`, `packages/react/src/executions/detail/`, `packages/react/src/executions/list/`, `packages/react/src/editor/layout/EditorScreen.test.tsx`, `packages/react/src/editor/layout/EditorBar.tsx`, `packages/react/src/workflows/overview/WorkflowOverview.tsx`, `packages/react/src/executions/trigger/`, `packages/react/src/catalog/Catalog.test.tsx`, `e2e/epic-2/configurator-and-reset-link.spec.ts`, `packages/react/src/executions/comparison/`, `packages/react/src/notifications/`, `packages/react/src/catalog/datasets/DatasetVariables.test.tsx`, `packages/react/src/executions/schedules/`, `packages/react/src/executions/index.ts`, `packages/react/src/test-cases/`, `packages/react/src/module/workflowsByRole.test.tsx`, `e2e/epic-2/api-key-and-embed.spec.ts`, `packages/react/src/module/`, `docs/adr/0073-formulario-de-parametros-exige-workflow-id-e-modo-agendamento-irmao.md`, e (ratificado pela global) `packages/react/src/executions/records/ExecutionRecords.tsx`, `packages/react/src/editor/layout/EditorBar.test.tsx` e `packages/react/src/workflows/overview/WorkflowOverview.test.tsx`, e `e2e/visual/__screenshots__/` só para as telas que a F139 muda (painel da simulação, Fontes sem `traces.view`, título focável), regravadas depois de a F132 entrar na `main`
- Fazer (a global acrescenta itens aqui enquanto a tarefa estiver pendente):
  - (F123) as setas do seletor Nenhum | Lista | Consulta não gravam no rascunho nem tiram o foco; só a escolha confirmada grava;
  - (F123) as marcas de problema velhas no dataset e na variável da consulta somem quando a análise volta (ADR 0044);
  - (F123) os problemas de `allowed_values` têm lugar na tela enquanto se escolhe a consulta;
  - (F123) o `＠` recusado no `LiteralField` não some quando a análise volta;
  - (F123) o `requestAnimationFrame` do foco é cancelado ao desmontar;
  - (F123) `pre_validation_alert_percent` entra no `SHOWN` do `WorkflowProperties`;
  - (F123) na consulta dos valores permitidos, o texto "A fonte aceita até 20 filtros" passa a falar da consulta, não da fonte.
  - (F124) durante o debounce e a busca em voo, a lista antiga de valores não fica ativa: Enter e as setas não escolhem um valor que não bate com o texto, o `active` não guarda um índice velho, e aparece "Carregando" mesmo com `keepPreviousData`;
  - (F124) no Safari, clicar em "Tentar de novo" ou em "Remover" não fecha o popup antes do clique (`onMouseDown` com `preventDefault` no popup);
  - (F124) o campo de consulta recebe `onBlur` e `touched` como os outros campos;
  - (F124) ir de Relativo para Fixo e voltar para Relativo mantém o relativo escolhido;
  - (F124) o erro do Fixo "tocado" não reaparece ao voltar de Relativo;
  - (F124) o ícone svg usa o token de tamanho, não `14` cru;
  - (F124) o `relativesFor` duplicado usa o de `editor/parameters/parameterRules.ts`.
  - (F125) o erro do Prosseguir some quando a execução sai de `awaiting_decision` (`proceed.reset`, ou mostrar só enquanto aguarda);
  - (F125) o Cancelar do alerta e o do cabeçalho usam uma instância estável do diálogo: o 409 `execution_finished` mostra o erro sem desmontar o diálogo e sem mandar o foco ao `body`;
  - (F125) o diálogo de cancelar, na pré-validação e em `awaiting_decision`, não diz "Os registros já calculados não são entregues", porque nada foi calculado; ele usa um texto próprio dessa fase;
  - (F125) o motivo do CSV na simulação termina com ponto final;
  - (F125) o filtro "Entregue" da lista não traz as simulações "Sem entrega";
  - (F125, D111-global) em Fontes, a cor das contagens segue o valor, com ou sem `traces.view`: `no_match` ou `multiple_rows` > 0 ficam na cor de aviso, e sem a permissão some só o link para os registros;
  - (F125) o `toHaveFocus` de `EditorScreen.test.tsx:279`, que falhou uma vez com a suíte sob carga, passa a esperar o foco (`waitFor`), sem afrouxar o que confere.
  - (F126) a prop `onOpenExecution` do disparo e do diálogo é passada pelo `EditorBar.tsx`, pelo `WorkflowOverview.tsx` e pelas duas ocorrências do `ExecutionList.tsx`, e as execuções da nota de sobreposição viram links que abrem a execução;
  - (F126) a nota de sobreposição some ao mudar um parâmetro por um sinal explícito do formulário, e não pela identidade de `form.formProps.values` do `useParameterForm`;
  - (F126) o JSDoc do `TriggerExecutionDialog` fica curto;
  - (F126) o e2e `epic-2/configurator-and-reset-link.spec.ts:24` e o `catalog/Catalog.test.tsx`, que falharam uma vez com a máquina sob carga, passam a esperar o estado certo (`waitFor` ou `expect.poll`), sem afrouxar o que conferem.
  - (F127) o foco não vai ao `body` quando "Carregar mais registros" some na última página: ele vai para a última linha carregada ou para o título da tabela;
  - (F127) a troca de filtro e a paginação são anunciadas por um `role="status"` sempre montado, inclusive "Nenhum registro"; o Notice de erro da primeira página também é anunciado;
  - (F127) o erro `invalid_data` do filtro oferece "Ver as divergências" (volta ao filtro padrão), e não só "Tentar de novo";
  - (F127) sem `aria-label` no `<dl>` (o mesmo padrão do `RecordTraceDrawer` fica para o épico 14);
  - (F127) testes que faltam: cursor com troca de filtro e resposta tardia, `invalid_cursor`, erro em "Carregar mais" e a gaveta só com `simulations.run`.
  - (F130) a sondagem de 30 s fica pausada enquanto houver um "marcar como lido" pendente, para não desfazer o "lido" otimista;
  - (F130) o `invalidate` do `onSettled` não retoma a sondagem com a lista em erro; só "Tentar de novo" retoma (ADR 0067);
  - (F130) sem portal (`useFluxoPortal` nulo), o popover não abre vazio com `aria-expanded=true`: ele cai no `body` ou não abre;
  - (F130) testes que faltam: marcar como lido com sondagem em voo, troca de sessão e retomada depois de "Tentar de novo";
  - (F130) o `DatasetVariables.test.tsx:103`, que falhou uma vez com a máquina sob carga, passa a esperar o estado certo, sem afrouxar o que confere.
  - (F128) o 409 `draft_conflict`, o `draft_has_problems` e o `schedule_name_taken` no diálogo de edição invalidam a lista e derivam o agendamento do cache, sem repetir o conflito; o `draft_conflict` tem um texto próprio;
  - (F128) a troca de `workflowId` com a lista montada limpa o diálogo e o `changeError`;
  - (F128) o `format.ts` avisa quando o `Intl` não conhece o fuso, em vez de cair em silêncio no fuso do navegador;
  - (F128) o `useScheduleDraft` não troca a revisão sob o diálogo aberto (sem `refetchOnWindowFocus` enquanto ele estiver aberto);
  - (F128) o erro de `recurrence.day` aparece sob o dia, não sob o horário;
  - (F129) o `DeleteReferenceFileDialog` chama `onDeleted` com a marca da sessão (ADR 0015); o diálogo de remoção trava Esc e Cancelar durante a requisição; o cancelamento do envio é anunciado; a "última comparação" ganha o ponto de status (`statusPresentation` exportado pelo `executions/index.ts`);
  - (F129) a ADR 0073 passa a citar o `useParameterForm`, que é o que a F129 usa;
  - (F129) o `workflowsByRole.test.tsx:89`, que falhou uma vez com a máquina sob carga, passa a esperar o estado certo, sem afrouxar o que confere.
  - (F128) o switch Ativo da lista não mostra a mensagem crua da API num 409: o `changeErrorMessage` ganha os códigos de conflito do contrato, com texto próprio;
  - (F129) teste de que o cancelamento do envio no desmonte não invalida a lista quando a marca da sessão muda;
  - (F130) o e2e `epic-2/api-key-and-embed`, que falhou uma vez com a máquina sob carga, passa a esperar o estado certo, sem afrouxar o que confere.
  - (F131) os filtros da `ExecutionList` não zeram ao trocar entre as abas Execuções e Agendamentos;
  - (F131) o "Voltar" do painel volta à origem: `state.from` também em `/executions/schedules` e nos links do sino;
  - (F131) no incorporado, o sino fica na barra das abas (`margin-left: auto`), e não em overlay absoluto que cobre abas em largura estreita;
  - (F131) no incorporado, as duas fileiras de abas com painéis focáveis seguem o fluxo de Tab da ADR 0027;
  - (F131) depois de abrir um alerta, o foco vai para a tela de destino, não volta ao sino (`onCloseAutoFocus` no `notifications/`).
  - (F132) na lista de Testes, em 900 px, o nome de quem enviou o arquivo não quebra no meio da palavra (quebra entre palavras ou reticências);
  - (F132) a nota de sobreposição mostra a data no formato do estilos §10 (com "às" e sem segundos).
- Aceite: um teste por item, que falha antes e passa depois; `pnpm typecheck`, `pnpm lint` e `pnpm build` verdes.

**F140 · Correção: e2e real do épico 6 com a sobreposição do épico 7**
- dep: F132
- modelo: sonnet
- arquivos: `e2e/epic-6/` (menos o `defects-and-abort.spec.ts`, que já é da F132), `e2e/epic-6/support/`
- Fazer: no modo real, os specs do épico 6 que disparam fevereiro na "Campanha de referência" compartilhada (`trigger-and-download`, `roles`, `awaiting-source`, `cancel`, e o `errors-and-trace`, que já usa cópia) deixam de falhar com `409 scope_already_delivered` depois do épico 7: cada um usa uma cópia própria da campanha ou confirma a sobreposição, como o `defects-and-abort.spec.ts` da F132.
- Aceite: `pnpm e2e:real e2e/epic-6` verde duas vezes seguidas no mesmo banco, com o back do épico 7; o modo simulado continua verde.

**F133 · Portão do épico 7**
- tipo: portao
- dep: F122, F123, F124, F125, F126, F127, F128, F129, F130, F131, F132, F134, F137, F139, F140
- modelo: sonnet
- Aceite: o mesmo da F106, com as telas do épico 7 provadas pelo `pnpm e2e:visual`.

### Épico 8 — Fonte Múltipla e agregações

As decisões E8-1 a E8-16, o esquema na versão 5, o modo Múltiplo, os filtros com variável e data relativa, o `onde`, a prévia, as contagens e o trace estão no plano do back (`../backend/docs/plano.md`, épico 8, e Contratos, "Fonte Múltipla e agregações"). O contrato é o da B198. Decisões do front, propostas pela sessão global em 2026-11-25:
- **E8-17, onde fica cada coisa:**
  - `editor/sources/source-block/`: o modo Múltiplo nas propriedades do bloco Fonte, e `editor/canvas/NewSourceDialog.tsx` (a escolha do modo ao criar);
  - `editor/sources/filters/`: o valor do filtro com variável do registro e a data relativa;
  - `formula/`: o `onde` no Monaco e no campo simples;
  - `editor/canvas/` e `editor/layers/`: o bloco Múltiplo no canvas, na barra de ferramentas e nas camadas;
  - `editor/preview/`: as contagens do Múltiplo na aba Prévia;
  - `editor/unit-run/`: os itens do Múltiplo no trace do Calcular;
  - `executions/detail/` e `executions/records/`: as contagens no painel (seção Fontes) e os itens no trace guardado.
  - Motivo: ADR 0003 e a mesma divisão das E5-16 a E5-21. Nenhuma vertical nova.
- **E8-18, bloco Fonte no modo Múltiplo:**
  - o controle segmentado do modo passa a **Linear | Múltiplo | Filtro** (estilos §7.2, que já traz o exemplo);
  - **campos, nesta ordem:** Dataset; Nome da lista (mono, com `[]` mostrado depois do nome, sugerido pelo id do bloco); Ligações; Filtros; Ordenação (obrigatória, com a ajuda "Define a ordem dos itens da lista."); Sem itens (Lista vazia | Gerar erro | Descartar o registro); Limite de itens por registro (número, padrão 10.000, com a ajuda "Acima disso, o registro dá erro."); Registro atual (Excluir | Incluir, só quando o dataset é o da fonte do lote, com a ajuda "Excluir evita contar o registro corrente duas vezes."); Saídas, mostradas como campos da lista (`valor_compra[]`);
  - **trocar de modo** com saídas usadas em fórmulas pede confirmação: "As fórmulas que usam as saídas deste bloco vão mostrar problemas até você ajustá-las." (decidido sem base no design);
  - os problemas `multiple_in_link`, `not_visible`, `link_to_calculated`, `filter_type_mismatch` e `duplicate_name` (do nome da lista) aparecem no campo certo, pelo `path`;
  - só leitura: tudo desabilitado, com o motivo.
  - Motivo: design §7 (tabela de configuração) e estilos §7.2. Os textos vêm da D-E8-9 e da D-E8-4.
- **E8-19, canvas e camadas:**
  - o bloco Múltiplo usa a categoria `--fc-cat-multi` (estilos §2), com o tipo "Múltiplo" no cabeçalho;
  - as portas de saída mostram `campo[]` em `mono-12`; a porta da lista mostra `pontuacoes[]`;
  - a barra de ferramentas ganha **Fonte Múltiplo**, com o quadrado da categoria, e o diálogo de fonte nova passa a oferecer os três modos;
  - na árvore de camadas e no painel Variáveis, os campos da lista aparecem com `[]` e o quadrado `cat-multi`;
  - depois de um Calcular, o bloco mostra "2 itens" no lugar dos valores (os valores do canvas, E5-21).
  - Motivo: estilos §2 e §8; design §8 (a referência a um múltiplo leva `[]`).
- **E8-20, filtros com variável e data relativa:**
  - o valor do filtro de um bloco Fonte ganha um seletor **Valor | Variável | Data relativa**, ao lado do botão `@` que já existe (F99);
  - **Variável:** uma busca com as variáveis lidas e visíveis naquele ponto, só do tipo da coluna (inteiro e decimal juntos), em mono;
  - **Data relativa** (só em colunas de data e data e hora; operador "Nos últimos"): "Nos últimos [30] dias antes de [Hoje | @periodo.inicio | …]", com a explicação "Da data − 30 dias até a véspera." (texto ligado à resposta da D-E8-5);
  - a fonte do lote não ganha nada disso (D-E8-6).
  - Motivo: design §6 e §7 (filtros com valor fixo, variável, parâmetro e data relativa).
- **E8-21, `onde` na fórmula:**
  - `onde` e `e` são palavras-chave, em `cat-decision` (estilos §8);
  - depois de `onde`, o autocomplete oferece primeiro os campos da lista da agregação, **sem** `[]`, e depois as variáveis lineares e os parâmetros;
  - os operadores do `onde` vêm do `GET /v1/formula-language` (bloco `where`), nunca fixos no front (E4-17);
  - os problemas `where_outside_aggregation` e os do `onde` sublinham o trecho, como os outros.
  - Motivo: estilos §8 ("palavras-chave em `cat-decision`") e E4-17.
- **E8-22, prévia:**
  - na aba Prévia, o bloco Múltiplo mostra "29 com itens · 19 sem itens · média de 0,98 item por registro · máximo de 2", com ponto e palavra como as outras fontes (F66); `item_limit_exceeded` > 0 aparece em vermelho, com "3 acima do limite";
  - o máximo traz as chaves de exemplo em mono;
  - a amostra mostra os itens com a coluna da chave do registro primeiro;
  - os números vêm da API, no padrão brasileiro, nunca recalculados (E4-24).
  - Motivo: design §6 ("no modo Múltiplo: média e máximo de itens por registro").
- **E8-23, trace do Calcular:** o nó Múltiplo mostra "2 itens" e uma tabela compacta com os itens (até 100; acima disso, "Mostrando 100 de 250 itens.", D-E8-8), com os números no padrão brasileiro e o nulo como "vazio"; os erros `no_items` e `item_limit_exceeded` aparecem no nó, com a mensagem da API.
  - Motivo: design §12 (trace com os múltiplos).
- **E8-24, execuções:**
  - na seção Fontes do painel, o bloco Múltiplo mostra com itens, sem itens, acima do limite, média e máximo, com a cor de aviso quando sem itens ou acima do limite passa de 0 (a regra da D111-global);
  - na gaveta do trace do registro, o nó Múltiplo mostra "2 itens" e o hash; no nível completo, também a tabela dos itens; nos outros, a nota "Os itens só ficam guardados no nível de trace completo.".
  - Motivo: design §12 (níveis do trace) e E7-21 (seção Fontes).

**F141 · Tipos da API do épico 8**
- tipo: contrato
- dep: B198, F133
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `e2e/support/contract.ts`, `e2e/epic-4/support/`, `e2e/epic-5/support/`, `e2e/epic-6/support/`, `e2e/epic-7/support/`, `packages/react/src/editor/draft/` (só a versão gravada passar a 5, como a F122)
- Fazer: gerar os tipos do contrato da B198 (`pnpm generate:api`); acrescentar os exemplos do épico 8 ao contrato simulado do e2e; passar **todas** as definições do simulado (épicos 4 a 7) à versão 5, validadas contra o esquema (ADR 0060); o editor lê rascunhos nas versões 1 a 5 e grava sempre a 5, pela constante única da F117. Nada de mascarar no componente com `?? []`.
  - (achado da B185, D53 do back) a B185 mudou o texto de 3 exemplos dos valores permitidos no `contracts/openapi.yaml`; se o simulado ou o `e2e/support/contract.ts` copia esses exemplos, alinhar com o contrato novo.
- Aceite: `pnpm typecheck` e o `contract-examples` verdes; o `pnpm e2e` dos épicos 4 a 7 verde no simulado; um teste que abre um rascunho v4 e grava v5; `git grep` não acha outra versão gravada fixa no editor.

**F142 · Editor: bloco Fonte no modo Múltiplo**
- dep: F141
- modelo: opus
- arquivos: `packages/react/src/editor/sources/source-block/`, `packages/react/src/editor/canvas/NewSourceDialog.tsx`, e (só se ainda faltar) a exportação em `packages/react/src/editor/sources/index.ts`
- Fazer (E8-18): o modo Múltiplo nas propriedades do bloco Fonte, com os campos, a ordem e os textos da E8-18; o Registro atual só com o dataset da fonte do lote; a confirmação ao trocar de modo; o diálogo de fonte nova com os três modos; os problemas no campo pelo `path`; o só leitura.
- Aceite: testes de criar um Múltiplo pelo diálogo; de cada campo gravando no rascunho no formato do contrato (`list_name`, `no_items`, `row_limit`, `current_record`); do limite fora de 1 a 10.000 recusado no front; do Registro atual escondido em outro dataset e visível no da fonte do lote; da troca Linear → Múltiplo com a confirmação; de cada problema no campo; e do só leitura. Os testes da F64 seguem verdes.

**F143 · Editor: filtros com variável do registro e data relativa**
- dep: F141
- modelo: opus
- arquivos: `packages/react/src/editor/sources/filters/`
- Fazer (E8-20): o seletor Valor | Variável | Data relativa nos filtros do bloco Fonte (nos três modos), com a busca das variáveis visíveis do tipo e o "Nos últimos N dias antes de …" com a âncora Hoje ou um parâmetro de data (ou `.inicio` e `.fim` de um período); o envio no formato do contrato (`values` com o nome; `last_days` com `anchor`); os problemas no campo; a fonte do lote sem as opções novas.
- Aceite: testes de escolher uma variável (só as do tipo, inclusive inteiro com decimal); da data relativa com "Hoje" e com `@periodo.inicio` (o envio é `{"operator": "last_days", "values": ["30"], "anchor": "@periodo.inicio"}`); de N fora de 1 a 3.650 recusado; da data relativa só em colunas de data; de cada problema no campo; da fonte do lote sem as opções; os testes da F64 e da F99 seguem verdes.

**F144 · Fórmula: `onde` nas agregações**
- dep: F141
- modelo: opus
- arquivos: `packages/react/src/formula/`
- Fazer (E8-21): `onde` e `e` como palavras-chave no realce; o autocomplete depois de `onde` (os campos da lista sem `[]`, depois os lineares e os parâmetros); os operadores do bloco `where` do `formula-language`; os problemas novos sublinhados; o mesmo no campo simples (sem Monaco).
- Aceite: testes do realce; do autocomplete dentro de `SOMA(valor_compra[] * taxa[] onde |)` (oferece `campanha_id`, `valor_compra` e `taxa` sem `[]`, antes dos lineares); dos operadores lidos da API (um operador a menos na resposta simulada some da lista); do `where_outside_aggregation` sublinhado; e do campo simples. Os testes da fórmula do épico 4 e da F99 seguem verdes.

**F145 · Canvas e camadas: o bloco Múltiplo**
- dep: F141
- modelo: opus
- arquivos: `packages/react/src/editor/canvas/` (menos o `NewSourceDialog.tsx`, da F142), `packages/react/src/editor/layers/`
- Fazer (E8-19): o bloco Múltiplo com a categoria `cat-multi` e o tipo "Múltiplo"; as portas com `[]`; **Fonte Múltiplo** na barra de ferramentas; as camadas e o painel Variáveis com os campos da lista; "2 itens" no bloco depois do Calcular.
- Aceite: testes do bloco (cor, tipo e portas), da barra de ferramentas criando um Múltiplo, das camadas com o ícone e os campos `[]`, e do "N itens" depois de um Calcular (some na próxima edição, E5-21); a ligação desenhada vem da referência, como sempre (E4-9). Os testes da F65 e da F68 seguem verdes.

**F146 · Prévia: média e máximo de itens**
- dep: F141
- modelo: sonnet
- arquivos: `packages/react/src/editor/preview/`
- Fazer (E8-22): as contagens do Múltiplo na aba Prévia, com o máximo e as chaves de exemplo, o "acima do limite" e a amostra de itens com a chave do registro.
- Aceite: testes com a prévia do exemplo do contrato ("29 com itens · 19 sem itens · média de 0,98 item por registro · máximo de 2"); com `item_limit_exceeded` 3 em vermelho; com nenhum registro no bloco (média "—"); e a amostra com a chave primeiro. Os testes da F66 seguem verdes.

**F147 · Calcular: os itens do Múltiplo no trace**
- dep: F141
- modelo: sonnet
- arquivos: `packages/react/src/editor/unit-run/`
- Fazer (E8-23): o nó Múltiplo no resultado do Calcular, com a contagem, a tabela dos itens (até 100, com a nota do corte), o nulo como "vazio" e os erros `no_items` e `item_limit_exceeded` no nó. O componente da tabela de itens fica exportável para a F148 pelo `editor/unit-run/index.ts`.
- Aceite: testes com o registro (1, 1) do exemplo do contrato (2 itens, "200,00" e "100,00", na ordem da API); com 101 itens (a nota "Mostrando 100 de 101 itens."); com `item_limit_exceeded`; com `no_items`; e o teclado da tabela. Os testes da F67 seguem verdes.

**F148 · Execuções: o Múltiplo em Fontes e no trace do registro**
- dep: F141, F147
- modelo: sonnet
- arquivos: `packages/react/src/executions/detail/`, `packages/react/src/executions/records/`
- Fazer (E8-24): os campos do Múltiplo na seção Fontes (com a cor de aviso da D111-global) e o nó Múltiplo na gaveta do trace (contagem e hash; a tabela de itens da F147 só no nível completo; a nota nos outros níveis).
- Aceite: testes das Fontes com o exemplo do contrato; das cores com sem itens e acima do limite; da gaveta no `standard` (com a nota) e no `full` (com a tabela); e do `no_items` nos grupos de erro. Os testes da F118 e da F125 seguem verdes.

**F149 · Integração do épico 8: interface pública, simulado e glossário**
- dep: F142, F143, F144, F145, F146, F147, F148
- modelo: sonnet
- arquivos: `packages/react/src/editor/index.ts`, `packages/react/src/module/`, `e2e/support/` (a API simulada responde a análise, a prévia e o Calcular da "Campanha de referência — histórico" com os exemplos do contrato), `docs/glossario.md`, `README.md`, `.changeset/`, e `e2e/visual/__screenshots__/` só para as telas que mudam pelo modo Múltiplo (o relatório lista as telas)
- Fazer: ligar as peças do épico no editor e no módulo (o diálogo de fonte nova, a barra de ferramentas, as propriedades, a Prévia, o Calcular e o painel); a API simulada com o workflow do histórico; os nomes novos no glossário (Fonte Múltiplo, lista, item, `onde`, data relativa, âncora, registro atual), com um changeset `minor`.
- Aceite: um teste de ponta a ponta no editor simulado: criar um Múltiplo, ligar, escrever `EXISTE(pontuacoes[] onde campanha_id = 1)` na Tabela, ver a Prévia e o Calcular; `pnpm build` verde; o Auditor vê o bloco e o trace só para leitura.

**F150 · Testes ponta a ponta do épico 8**
- dep: F149
- modelo: opus
- arquivos: `e2e/epic-8/` (nova), `e2e/support/`, `e2e/visual/`, `README.md`
- Fazer: **todos** os fluxos do épico 8 do plano global ("Fluxos ponta a ponta" e "Roteiro de teste"), no modo simulado. A lista abaixo é o mínimo (D30):
  - abrir a "Campanha de referência — histórico", ver o bloco "Pontuações anteriores" e a Prévia com fevereiro de 2026 (29 com itens, 19 sem itens, média 0,98, máximo 2);
  - Calcular (1, 1), (2, 2), (5, 1) e (17, 2), com os itens e os valores da tabela de Contratos;
  - executar o lote com fevereiro de 2026 e ver as Fontes no painel; baixar o CSV;
  - na tela Testes, enviar o `expected_history.csv` e **Simular**: 100% iguais;
  - numa cópia, o limite 1 e o Calcular de (1, 1) com o erro; o Sem itens "Descartar o registro" e o Calcular de (3, 1) ignorado;
  - escrever um `onde` errado e ver o problema; o `onde` fora de agregação;
  - uma execução com o trace completo, com os itens na gaveta, e uma com o padrão, com a nota;
  - as telas do épico 8 (propriedades do Múltiplo, filtro com data relativa, autocomplete do `onde`, Prévia, Calcular e gaveta do trace) no `pnpm e2e:visual`, nos dois temas e nas faixas de largura do estilos §15.
  - **No modo real:**
    - o `FLUXO_BACKEND_DIR` dá o `tests/fixtures/reference_campaign/expected_history.csv`;
    - as mudanças de limite, de Sem itens e de nível do trace são feitas em cópias do workflow do histórico, criadas pelo teste, para não cruzar a sobreposição (E7-6) nem mudar a campanha que os outros specs usam.
- Aceite: `pnpm e2e` e `pnpm e2e:visual` passam, com os épicos 4 a 7 verdes. O modo real é exercitado no teste de integração do CK8.

**F151 · Manutenção: acabamentos agrupados do épico 8 (achados médios e baixos)**
- dep: F149
- modelo: sonnet
- arquivos: (a global preenche ao acrescentar cada item, sem sobrepor uma tarefa do épico que ainda esteja rodando)
- Fazer (a global acrescenta itens aqui enquanto a tarefa estiver pendente): os achados médios e baixos dos verificadores e revisores das tarefas F141 a F150, um item por achado, com a tarefa de origem entre parênteses.
- Aceite: um teste por item, que falha antes e passa depois; `pnpm typecheck`, `pnpm lint` e `pnpm build` verdes.

**F152 · Portão do épico 8**
- tipo: portao
- dep: F141, F142, F143, F144, F145, F146, F147, F148, F149, F150, F151
- modelo: sonnet
- Aceite: o mesmo da F133, com as telas do épico 8 provadas pelo `pnpm e2e:visual`.
