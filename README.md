# Fluxo de Cálculo · frontend

Repositório do front: o pacote **`@fluxo/react`**, que é o produto incorporável, e o **app casca**, o app próprio que usa esse pacote (o "hospedeiro zero").
O backend fica num repositório separado (`../backend`). O desenho do produto está em `../docs/design.md`, fora deste repositório.

> **Estado atual: só scaffold.** Ainda não há código de produto nem dependências instaladas; isso começa na fase 1 (Fundação).

Para incorporar o módulo num sistema hospedeiro, veja o [guia de incorporação](docs/incorporacao.md).

## Estrutura

```
frontend/
├── packages/react/   @fluxo/react: o produto, organizado por verticais (ADR 0003)
├── apps/casca/       app próprio: login + layout, usando o pacote (ADR 0002)
├── docs/
│   ├── ambientes.md  local, homologação, produção e variáveis
│   ├── incorporacao.md  guia para quem incorpora o @fluxo/react
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
2. Copie `apps/casca/.env.example` para `apps/casca/.env`.
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
| `pnpm gerar:api` | Gera os tipos da API a partir do OpenAPI do backend (ADR 0005) |
| `pnpm e2e` | Testes ponta a ponta (Playwright) contra a API **simulada** |
| `pnpm e2e:real` | Os mesmos testes contra o back de verdade (veja abaixo) |

## Testes ponta a ponta no modo real

O `pnpm e2e:real` roda os testes de `e2e/` no casca contra o back de verdade, com o paralelismo padrão do Playwright.

1. Suba o back (veja `../backend/README.md`): `docker compose up -d` e depois os comandos abaixo, na pasta `backend`.

```bash
uv run python -m fluxo.inicializacao migrar
uv run python -m fluxo.inicializacao preparar-local
uv run python -m fluxo.inicializacao api
```

2. Exporte o endereço da API (sem o `/v1`) e as contas que o `preparar-local` imprime (também em `../backend/docs/ambientes.md`):

```bash
export E2E_API_URL=http://localhost:8000
export E2E_ADMIN_EMAIL=admin@demo.local
export E2E_ADMIN_SENHA=demo-admin-local
export E2E_DOIS_TENANTS_EMAIL=dois.tenants@demo.local
export E2E_DOIS_TENANTS_SENHA=demo-dois-tenants-local
```

No PowerShell: `$env:E2E_API_URL='http://localhost:8000'`, e assim por diante.

3. Rode:

```bash
pnpm e2e:real
```

- **Só `E2E_API_URL` basta.** O `playwright.config.ts` sobe o casca com `VITE_API_URL` igual a `E2E_API_URL`. Se já houver um casca aberto em `localhost:5173`, o Playwright o reaproveita com o `VITE_API_URL` que ele tiver; se for outra API, os testes reprovam e dizem isso. Nesse caso, feche esse casca.
- **Espere 60 s entre duas rodadas.** O back aceita 20 tentativas de login por minuto vindas de um mesmo IP, e uma rodada faz cerca de 13. A segunda rodada logo em seguida recebe `429 muitas_tentativas`. As tentativas ficam gravadas no banco, então reiniciar a API não zera a contagem.
- **O teste de bloqueio não atinge as contas acima.** Ele erra a senha de um e-mail novo a cada rodada.
