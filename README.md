# Fluxo de Cálculo · frontend

Repositório do front: o pacote **`@fluxo/react`**, que é o produto incorporável, e o **app casca**, o app próprio que usa esse pacote (o "hospedeiro zero").
O backend fica num repositório separado (`../backend`). O desenho do produto está em `../docs/design.md`, fora deste repositório.

> **Estado atual: só scaffold.** Ainda não há código de produto nem dependências instaladas; isso começa na fase 1 (Fundação).

Para incorporar o módulo num sistema hospedeiro, veja o [guia de incorporação](docs/incorporacao.md).

**Código em inglês** (ADR [0031](docs/adr/0031-codigo-em-ingles.md)): pastas, arquivos, identificadores, comentários, classes `fc-`, rotas da URL e scripts ficam em inglês; textos para pessoas (rótulos, mensagens, descrições de teste) e a documentação ficam em pt-BR. Os nomes estão no [glossário do front](docs/glossario.md) e, para a API, no `../backend/docs/glossario.md`.

## Estrutura

```
frontend/
├── packages/react/   @fluxo/react: o produto, organizado por verticais (ADR 0003); exporta <FluxoCalculo> e as telas avulsas <Home>, <Catalog>, <Audit> e <Admin>
├── apps/shell/       app casca (próprio): login + layout, usando o pacote (ADR 0002)
├── docs/
│   ├── ambientes.md  local, homologação, produção e variáveis
│   ├── incorporacao.md  guia para quem incorpora o @fluxo/react
│   ├── glossario.md  nomes do código do front (português → inglês)
│   └── adr/          decisões de arquitetura (índice em docs/adr/README.md)
├── .changeset/       versões do pacote (Changesets)
└── .github/workflows ci.yml · publicar.yml · deploy-casca.yml (desligado)
```

## Ferramentas

| O quê | Versão |
|---|---|
| Node | 26 (`.nvmrc`; mudança de 24 para 26 vinda da resposta G6 do dono do produto) |
| pnpm | 10 (workspaces: `pnpm-workspace.yaml`) |
| Registro do pacote | GitHub Packages (`.npmrc`) |

## Começar (a partir da fase 1)

1. Crie um token pessoal do GitHub com `read:packages` e exporte como `NODE_AUTH_TOKEN`.
2. Copie `apps/shell/.env.example` para `apps/shell/.env`.
3. Suba o backend (veja `../backend/README.md`).
4. Instale e rode:

```bash
pnpm install
```

```bash
pnpm dev
```

### Dependências previstas (instaladas na fase 1)

- **`@fluxo/react`:** `@xyflow/react`, `@monaco-editor/react`, `@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `react-hook-form`, `zod`, Radix (portais dentro da raiz do módulo).
- **Desenvolvimento:** `typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-dts`, `vitest`, `@testing-library/react`, `eslint`, `typescript-eslint`, `eslint-plugin-boundaries`, `@changesets/cli`, gerador de tipos do OpenAPI (ADR 0005).

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Roda o app casca em `http://localhost:5173` |
| `pnpm build` | Compila o pacote e o casca |
| `pnpm lint` | ESLint, incluindo as fronteiras entre verticais |
| `pnpm typecheck` | Checagem de tipos |
| `pnpm test` | Testes (Vitest) |
| `pnpm changeset` | Registra uma mudança do pacote para a próxima versão |
| `pnpm generate:api` | Gera os tipos da API a partir do OpenAPI do backend (ADR 0005), em `packages/react/src/api/generated/` |
| `pnpm e2e` | Testes ponta a ponta (Playwright) contra a API **simulada** |
| `pnpm e2e:real` | Os mesmos testes contra o back de verdade (veja abaixo) |

## Testes ponta a ponta no modo real

O `pnpm e2e:real` roda os testes de `e2e/` no casca contra o back de verdade, com **2 workers**, fixados no próprio script do `package.json`. Nesta máquina, 6 navegadores em paralelo, o Vite dev e a API juntos saturam CPU e memória, e os logins estouram o tempo limite. Rode o comando como está, sem mudar os workers na mão. No modo real, cada teste e cada `expect` têm 60 s de tempo limite, porque o fluxo da auditoria chegou a 33 s sozinho, com a máquina carregada. O `pnpm e2e` (simulado) segue com o paralelismo padrão e os tempos limite padrão.

O Playwright sobe dois servidores, nos dois modos:
- o casca em `http://localhost:5173`;
- a página de teste de incorporação em `http://localhost:5274/embed-test.html` (`apps/shell/vite.embed.config.ts`). Ela é o "hospedeiro" dos testes de incorporação, numa origem diferente da do casca. É a origem que o `prepare-local` do back cadastra como domínio autorizado.

1. Suba o back (veja `../backend/README.md` e `../backend/docs/ambientes.md`): copie o `.env.example` do back para `.env`, rode `docker compose up -d` e depois os comandos abaixo, na pasta `backend`.

```bash
uv run python -m fluxo.bootstrap migrate
uv run python -m fluxo.bootstrap prepare-local
uv run python -m fluxo.bootstrap api
```

   Variáveis do back que o modo real exige (os nomes estão em inglês desde a B49; os antigos estão no `../backend/docs/glossario.md`):

   | Variável do back | Valor no modo real | Por quê |
   |---|---|---|
   | `FLUXO_SHELL_URL` | `http://localhost:5173` | Base do link de redefinição de senha: `<FLUXO_SHELL_URL>/reset-password?token=...`. |
   | `FLUXO_CORS_ORIGINS` | `http://localhost:5173` | A origem do casca; sem ela, todo login dá preflight 400. |
   | `FLUXO_SESSION_SECRET` | qualquer texto longo | Assina o token de incorporação; sem ela, a `api` não sobe. |
   | `FLUXO_LOGIN_IP_LIMIT_PER_MIN` | `1000` | Veja "Limite de logins por IP", abaixo. |

2. Exporte o endereço da API (sem o `/v1`) e as contas que o `prepare-local` imprime (também em `../backend/docs/ambientes.md`):

```bash
export E2E_API_URL=http://localhost:8000
export E2E_ADMIN_EMAIL=admin@demo.local
export E2E_ADMIN_PASSWORD=demo-admin-local
export E2E_TWO_TENANTS_EMAIL=dois.tenants@demo.local
export E2E_TWO_TENANTS_PASSWORD=demo-dois-tenants-local
```

No PowerShell: `$env:E2E_API_URL='http://localhost:8000'`, e assim por diante.

| Variável do e2e | Obrigatória | O que é |
|---|---|---|
| `E2E_API_URL` | sim | Endereço da API, sem o `/v1`. |
| `E2E_ADMIN_EMAIL` | não (padrão `admin@demo.local`) | E-mail do Admin de demonstração. |
| `E2E_ADMIN_PASSWORD` | sim | Senha do Admin de demonstração. |
| `E2E_TWO_TENANTS_EMAIL`, `E2E_TWO_TENANTS_PASSWORD` | sim | Conta com acesso aos dois tenants de demonstração (troca de tenant). |
| `E2E_SHELL_URL` | não (padrão `http://localhost:5173`) | Endereço do casca que o Playwright abre. |

As variáveis do e2e estão em inglês desde a F42 (eram `E2E_ADMIN_SENHA`, `E2E_DOIS_TENANTS_EMAIL`, `E2E_DOIS_TENANTS_SENHA` e `E2E_CASCA_URL`). As credenciais do banco de exemplo (`postgres-sample`), que os testes do catálogo (épico 3) vão usar, seguem o mesmo padrão, com o prefixo `E2E_SAMPLE_`; elas entram nesta tabela com esses testes.

3. Rode:

```bash
pnpm e2e:real
```

- **Só `E2E_API_URL` basta para o endereço.** O `playwright.config.ts` sobe o casca e a página de teste com `VITE_API_URL` igual a `E2E_API_URL`. Se já houver um casca aberto em `localhost:5173`, ou uma página de teste em `localhost:5274`, o Playwright os reaproveita com o `VITE_API_URL` que tiverem. Se o casca chamar outra API, os testes reprovam e dizem isso. Nesse caso, feche esse servidor.
- **O casca usa o pacote compilado.** O `apps/shell` importa o `@fluxo/react` do `dist/`: rode `pnpm build` antes do `pnpm e2e` ou do `pnpm e2e:real` depois de mudar o pacote.
- **Limite de logins por IP.** A suíte faz cerca de 27 logins por minuto do mesmo IP, e o back aceita 20 por padrão. Suba a `api` com `FLUXO_LOGIN_IP_LIMIT_PER_MIN=1000`: nenhum fluxo testa esse limite. Com o limite padrão, parte dos logins recebe `429 too_many_attempts`. As tentativas ficam gravadas no banco, então reiniciar a API não zera a contagem.
- **O teste de bloqueio não atinge as contas acima.** Ele erra a senha de um e-mail novo a cada rodada.
