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
    - `'url'`, no casca: as rotas internas sincronizadas com a URL, com `basename`;
    - `'memoria'`, padrão quando incorporado: não toca a URL do hospedeiro.
- **Componentes por tela**, para quem quer só uma parte: épico 1 `<Inicio>`; épico 2 `<Administracao>` e `<Auditoria>`.
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

**F12 · Portão do épico 1**
- tipo: portao
- dep: F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F24, F25
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
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/sessao/`
- Fazer:
  - tela `<RedefinirSenha token>` (nova senha e confirmação; regras da senha mostradas; `link_invalido`);
  - no modo token, a sessão vem de `GET /v1/sessao` com Bearer, e o token vencido chama `onSessaoExpirada`.
- Aceite: testes da tela e do modo token.

**F18 · Auditoria: acessos**
- dep: F13
- modelo: opus
- arquivos: `packages/react/src/auditoria/`
- Fazer: tela de acessos com filtro por tipo e por período, paginação por cursor, e status por ponto + palavra para os tipos de evento.
- Aceite: testes dos filtros, da paginação e dos estados.

**F19 · Módulo: menu por permissão, rotas e abas**
- dep: F14, F15, F16, F18, F23
- modelo: opus
- arquivos: `packages/react/src/modulo/`, `packages/react/src/administracao/index.ts`
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
- arquivos: `e2e/epico-2/`
- Fazer: os fluxos do épico 2 do plano global (usuário Configurador sem Administração, papel personalizado, link de redefinição de uso único, chave de API e incorporação, chave revogada, configuração de segurança, auditoria de acessos). O CORS de domínio não autorizado só roda no modo real.
- Aceite: `pnpm e2e` passa.

**F22 · Portão do épico 2**
- tipo: portao
- dep: F13, F14, F15, F16, F17, F18, F19, F20, F21, F23
- modelo: sonnet
- Aceite: o mesmo do F12, com as telas do épico 2.
