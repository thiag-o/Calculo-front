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

## Pendentes (sem ADR ainda)

- Nenhuma no momento. Novas decisões de arquitetura tomadas durante a construção viram ADR automaticamente (skill `orquestrar-frente`, desenho da orquestração §9).
