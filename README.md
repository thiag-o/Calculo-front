# Fluxo de Cálculo · frontend

Repositório do front: o pacote **`@fluxo/react`**, que é o produto incorporável, e o **app casca**, o app próprio que usa esse pacote (o "hospedeiro zero").
O backend fica num repositório separado (`../backend`). O desenho do produto está em `../docs/design.md`, fora deste repositório.

> **Estado atual: só scaffold.** Ainda não há código de produto nem dependências instaladas; isso começa na fase 1 (Fundação).

## Estrutura

```
frontend/
├── packages/react/   @fluxo/react: o produto, organizado por verticais (ADR 0003)
├── apps/casca/       app próprio: login + layout, usando o pacote (ADR 0002)
├── docs/
│   ├── ambientes.md  local, homologação, produção e variáveis
│   └── adr/          decisões de arquitetura (índice em docs/adr/README.md)
├── .changeset/       versões do pacote (Changesets)
└── .github/workflows ci.yml · publicar.yml · deploy-casca.yml (desligado)
```

## Ferramentas

| O quê | Versão |
|---|---|
| Node | 24 LTS (`.nvmrc`) |
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
