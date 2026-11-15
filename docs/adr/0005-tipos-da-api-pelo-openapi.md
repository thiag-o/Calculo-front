# 0005. Tipos da API gerados do contrato OpenAPI do backend

- **Status:** aceita
- **Data:** 2026-11-15
- **Quem decidiu:** dono do produto (resposta G7 do plano global, 2026-11-15)
- **Relacionadas:** backend ADR 0005; [0003](0003-codigo-por-verticais.md)

## Contexto

Front e back ficam em repositórios separados e são construídos em paralelo. Sem um contrato comum, os tipos das respostas da API seriam escritos à mão dos dois lados e se desencontrariam sem ninguém perceber. O backend escreve o contrato **antes** de implementar cada épico (backend ADR 0005).

## Decisão

- **O contrato é o `../backend/contratos/openapi.yaml`.** O front não escreve à mão os tipos de requisição e resposta.
- **Geração:**
  - `pnpm gerar:api` gera os tipos com **openapi-typescript** em `packages/react/src/api/gerado/`;
  - as chamadas usam **openapi-fetch**, tipado por esses tipos.
- **Arquivos gerados ficam versionados.** Uma mudança na API aparece no diff do front.
- **Portão e CI do front:** falham se rodar o `pnpm gerar:api` mudar algum arquivo (tipos desatualizados).
- **Erros:** problem+json com `codigo` estável; as telas decidem pelo `codigo`, nunca pelo texto da mensagem.

## Alternativas consideradas

- **Tipos escritos à mão:** simples no começo, mas se desencontram com o tempo.
- **orval** (gera também hooks do TanStack Query): mais código gerado e menos controle sobre as consultas de cada vertical.
- **Pacote de tipos compartilhado entre os repositórios:** exige publicar um terceiro pacote.
- **GraphQL ou tRPC:** muda a stack decidida (FastAPI com REST).

## Consequências

- **Bom:**
  - mudança incompatível na API vira erro de tipo no front;
  - o front anda contra o contrato, com dados simulados, antes de o back estar pronto.
- **Ruim:** o front depende de ler o arquivo do repositório vizinho. Na publicação do pacote, o contrato usado precisa estar commitado nos dois repositórios.
