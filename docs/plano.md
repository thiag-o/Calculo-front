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
- arquivos: `packages/react/src/admin/`, `packages/react/src/catalog/datasets/`, `packages/react/vite.config.ts`
- Fazer (achado da verificação da F31, decidido pela sessão global):
  - no `pnpm test` completo sob carga, testes da Administração (como `admin/users/UserDialog.test.tsx`) e o "Carregar mais" de `catalog/datasets/` estouram o tempo e passam sozinhos;
  - achar a causa em cada um (espera fixa, `waitFor` sem consulta assíncrona, `userEvent` com atraso, renderização pesada) e corrigir no teste ou no componente;
  - aumentar o tempo limite global só se a causa for comprovadamente a máquina, e com o motivo num comentário.
- Aceite: `pnpm test` completo três vezes seguidas, sem nenhuma falha por tempo, com a máquina ocupada pelo e2e simulado rodando em paralelo numa das vezes; lint, typecheck e build verdes.

**F60 · Catálogo — credencial ilegível (D44)**
- dep: F45, B73
- modelo: sonnet
- arquivos: `packages/react/src/api/generated/`, `packages/react/src/catalog/connections/`
- Fazer (D44 do back, decidida pela sessão global em 2026-11-18):
  - `pnpm generate:api` com o contrato da B73;
  - quando testar a conexão, abrir os objetos ou ver as colunas responder `409 connection_credential_unreadable`, mostrar a mensagem da API e oferecer a ação que já existe de trocar a credencial, para quem tem `credentials.manage`. Quem não tem essa permissão vê só a mensagem;
  - a lista e o detalhe continuam mostrando a conexão quando o `target` vem `null`. Esse caso já existe para quem não tem `credentials.manage`; confira que ele também cobre quem tem a permissão.
- Aceite: testes do componente com o 409 nas três ações, com e sem `credentials.manage`, e com o `target` nulo para quem tem a permissão; tipos, lint, testes e build verdes.

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
- dep: F50
- modelo: opus
- arquivos: `packages/react/src/editor/canvas/`, `packages/react/src/editor/layers/`
- Fazer (React Flow; estilos §8 e §11):
  - **blocos** Cálculo e Tabela de Decisão: quadrado da categoria (`--fc-cat-calc`, `--fc-cat-decision`), nome em `mono-13`, tipo em 11px;
    - portas de entrada à esquerda (as variáveis que o bloco lê) e de saída à direita (as que ele produz), com o tipo em `mono-12`;
    - ícone vermelho e número de problemas no cabeçalho;
  - **entradas e saída:** uma barra **Entradas** à esquerda (as entradas declaradas, com a múltipla mostrando os campos) e uma barra **Saída** à direita (os campos de saída), como as barras de Input e Output do grupo;
  - **ligações:** vêm dos `symbols` e das referências da análise (E4-9), nunca são desenhadas à mão. As do bloco selecionado em `gray-1000`; as outras em `gray-500`;
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
- dep: F50, F52
- modelo: opus
- arquivos: `packages/react/src/editor/properties/`
- Fazer:
  - **Cálculo:**
    - nome do bloco, descrição curta e a fórmula no `<FormulaEditor>`;
    - a saída: nome da variável, tipo `integer` ou `decimal` e casas (padrão: as casas do workflow);
    - modo de arredondamento e política de erro, cada um com "Herdar do workflow"; o valor padrão aparece só com "Usar valor padrão";
  - **Entradas:**
    - lista das entradas declaradas: nome, Linear ou Múltiplo (segmented control), tipo e casas;
    - a múltipla tem os campos (nome, tipo, casas);
    - incluir, remover (com aviso de quantos blocos usam a entrada) e reordenar;
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
- arquivos: `packages/react/src/design-system/`, `packages/react/src/catalog/connections/`, `packages/react/src/admin/integration/queries.ts`, `packages/react/src/admin/roles/queries.ts`, `packages/react/src/admin/security/queries.ts`, `packages/react/src/admin/users/queries.ts`, `packages/react/src/api/client/apiError.ts`, `packages/react/src/module/FluxoCalculo.tsx`, `packages/react/src/module/FluxoCalculo.test.tsx`, `packages/react/src/session/reset-password/passwordReset.ts`, `e2e/epic-1/csrf.spec.ts`, `e2e/epic-2/support/screens.ts`, `e2e/epic-3/credential-never-returned.spec.ts`
- Fazer (pendências adiáveis do CK3, decididas pela sessão global):
  - **px crus no design system:** os espaços em px dos CSS de `design-system/` (por exemplo, `tabs.css`, `menu.css`, `card.css`) passam a usar os tokens `--fc-space-*`; medidas que não são espaço (borda de 1px, alturas de controle, tamanhos de fonte) ficam como estão, se já forem tokens ou exceções listadas no `estilos.md`;
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
- arquivos: `packages/react/src/editor/index.ts`, `packages/react/src/editor/Editor.tsx`, `packages/react/src/editor/editor.css`, `packages/react/src/workflows/index.ts`, `packages/react/src/workflows/Workflows.tsx`, `packages/react/src/module/`, `packages/react/src/home/`, `packages/react/src/index.ts`, `apps/shell/src/`, `docs/incorporacao.md`, `docs/glossario.md`, `README.md`, `.changeset/`
- Fazer:
  - **editor:** `<Editor>` monta o layout da F50 com o canvas e as camadas (F51), as propriedades por tipo de item (F53 e as da Tabela, da F54), a grade da F54 no lugar do canvas e as abas Problemas e Calcular (F50, F55);
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

**F59 · Portão do épico 4**
- tipo: portao
- dep: F46, F47, F48, F49, F50, F51, F52, F53, F54, F55, F56, F57, F58
- modelo: sonnet
- Aceite: o mesmo do F12, com as telas do épico 4 (lista, Visão geral, editor com canvas, propriedades, grade e Calcular, nos dois temas e nas faixas de largura do estilos §15); a entrada principal do pacote sem o Monaco (como na F47).
