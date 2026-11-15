# 0004. Monorepo pnpm, Vite em modo biblioteca, Changesets e GitHub Packages

- **Status:** aceita
- **Data:** 2026-11-15
- **Quem decidiu:** dono do produto
- **Relacionadas:** design.md §16, subseção "Ambientes e repositórios"; [0002](0002-pacote-react-sem-iframe.md); [docs/ambientes.md](../ambientes.md)

## Contexto

O repositório tem duas coisas que evoluem juntas, o pacote `@fluxo/react` e o app casca. O pacote é publicado com versão e instalado por outros sistemas. Front e back ficam em **repositórios git separados**, cada um com CI próprio no **GitHub Actions**. Homologação e produção ficam na **AWS**.

## Decisão

- **pnpm workspaces**, com `packages/react` (o produto) e `apps/casca` (o hospedeiro zero). O casca usa o pacote por `workspace:*`, sem publicar.
- **Node 26** e **pnpm 10**. (Antes era Node 24 LTS; mudou para 26 pela resposta G6 do dono do produto, em 2026-11-15.)
- **Vite em modo biblioteca** para o pacote: ESM e tipos `.d.ts`, com React fora do pacote (peer dependency).
- **Changesets** para versão e CHANGELOG. Uma mudança incompatível só sai em versão maior. O casca fica fora do versionamento.
- **GitHub Packages** como registro privado (`.npmrc`). Os hospedeiros instalam com um token `read:packages`.
- **CI (GitHub Actions):**
  - `ci.yml`: lint (com fronteiras), tipos, testes e build a cada push e PR;
  - `publicar.yml`: o PR de versão e a publicação;
  - `deploy-casca.yml`: o casca em S3 + CloudFront, desligado até a infraestrutura existir.
- **Ambientes do casca:**
  - homologação a cada push na `main`;
  - produção a cada tag `v*`, com aprovação manual no environment `producao`;
  - deploy por OIDC, sem chave AWS guardada no GitHub.
- **Bibliotecas do produto** (design.md §16): React Flow, Monaco, TanStack Query e Table, zustand, react-hook-form com zod e Radix.

## Alternativas consideradas

- **npm público:** deixaria o código do pacote visível para qualquer pessoa, e os primeiros hospedeiros são internos.
- **Front e back no mesmo repositório:** descartado pelo dono do produto. Cada lado tem versões e CI próprios.
- **Turborepo ou Nx:** com dois projetos, os scripts do pnpm bastam; podem entrar depois, se o build ficar lento.
- **semantic-release:** decide a versão pelas mensagens de commit; o Changesets deixa essa decisão explícita no PR.

## Consequências

- **Bom:** o casca sempre roda a versão atual do pacote; as versões são claras para os hospedeiros.
- **Ruim:**
  - **o escopo no GitHub Packages precisa ser o nome do dono do repositório no GitHub**. A organização se chama `fluxo` (confirmado em 2026-11-15), então `@fluxo/react` funciona; se os repositórios mudarem de organização, o nome do pacote muda junto;
  - todo hospedeiro precisa de token para instalar.
- **A fazer:**
  - instalar as dependências (fase 1);
  - fixar as versões das actions.
