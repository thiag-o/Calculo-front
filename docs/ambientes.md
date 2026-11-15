# Ambientes · frontend

Há três ambientes: **local**, **homologação** e **produção**. O backend descreve os dele em `../backend/docs/ambientes.md`.
Decisões por trás disto: [ADR 0004](adr/0004-monorepo-pnpm-vite-changesets.md).

## O que existe em cada ambiente

| | Local | Homologação | Produção |
|---|---|---|---|
| **App casca** | `pnpm dev` em `localhost:5173` | S3 + CloudFront, deploy a cada push na `main` | S3 + CloudFront, deploy a cada tag `v*`, com aprovação manual |
| **API usada** | `localhost:8000` | API de homologação | API de produção |
| **Pacote `@fluxo/react`** | código do workspace (`workspace:*`) | idem | idem |
| **Hospedeiros externos** | — | instalam versões do GitHub Packages | instalam versões do GitHub Packages |

- **O pacote não tem ambiente.** Ele é publicado no GitHub Packages a cada versão aprovada (Changesets) e recebe o endereço da API e o token de quem o usa.
- **Os ambientes valem para o app casca.** É só ele que tem deploy.
- Região AWS de homologação e produção: `sa-east-1` (São Paulo).

## Variáveis

Toda variável `VITE_*` é embutida no JavaScript enviado ao navegador. **Nenhuma pode ser segredo.**

| Variável | Para que serve | Local | Homologação / produção |
|---|---|---|---|
| `VITE_API_URL` | Endereço da API | `.env` (`http://localhost:8000`) | variável do environment no GitHub, usada no build |
| `VITE_AMBIENTE` | Nome do ambiente, mostrado fora de produção | `.env` (`local`) | variável do environment no GitHub |

## GitHub (CI e deploy)

| Onde | Nome | Para que serve |
|---|---|---|
| Repositório · variável | `DEPLOY_HABILITADO` | Liga o `deploy-casca.yml` (`true`). Fica desligado até a infraestrutura existir |
| Environment `homologacao` e `producao` · variáveis | `AWS_ROLE_ARN`, `S3_BUCKET_CASCA`, `CLOUDFRONT_ID`, `VITE_API_URL`, `VITE_AMBIENTE` | Deploy por OIDC (sem chave AWS guardada no GitHub) |
| Environment `producao` · regra | revisor obrigatório | Ninguém publica em produção sem aprovação |
| Automático | `GITHUB_TOKEN` | Instala e publica no GitHub Packages |

## Pontos de atenção

- **Escopo do pacote:** no GitHub Packages, o escopo precisa ser o nome do dono do repositório no GitHub. Os repositórios ficam na organização **`fluxo`**, por isso o pacote se chama `@fluxo/react`. Se os repositórios mudarem de organização, mudam também o nome do pacote, o `.npmrc` e os workflows.
- **Hospedeiros externos:** quem instala o pacote precisa de um token com `read:packages` e do mesmo `.npmrc`.
- **CORS:** o domínio do casca em cada ambiente entra na lista de domínios autorizados do backend.
