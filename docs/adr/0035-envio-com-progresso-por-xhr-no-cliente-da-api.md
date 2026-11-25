# 0035. Envio de arquivo com progresso por `client.upload` (XMLHttpRequest) no cliente da API

- **Status:** aceita, revisar no checkpoint (complementada por [0078](0078-vertical-test-cases-e-path-params-no-upload.md))
- **Data:** 2026-11-17
- **Quem decidiu:** orquestração (tarefa F32)
- **Relacionadas:** [0005](0005-tipos-da-api-pelo-openapi.md), [0008](0008-consumo-da-api-pelas-verticais.md), [0015](0015-cache-na-troca-de-identidade-e-tenant.md), [0031](0031-codigo-em-ingles.md)

## Contexto

O envio de planilhas (`POST /v1/excel-files`, `multipart/form-data`, até 20 MB) precisa mostrar o progresso. O `fetch` não informa quanto do corpo já saiu; o `XMLHttpRequest` informa (`upload.onprogress`). O cliente da API (ADR 0005 e 0008) só falava por `fetch` via openapi-fetch. Outras verticais com envio de arquivo vão repetir o caso.

## Decisão

- O `ApiClient` ganha `client.upload(path, formData, { onProgress, signal })`, em `packages/react/src/api/client/upload.ts`. É o **único** ponto do front que usa `XMLHttpRequest`; ele é lido de `globalThis` na hora da chamada, para os testes trocarem por um falso.
- Só para envio com progresso. Todo o resto continua em `dataOrError(client.METHOD(...))` (ADR 0008).
- Mesmo contrato do resto do cliente:
  - modo cookie: `withCredentials` e `X-CSRF-Token` lido de `fc_csrf` no momento do envio; modo token: `Authorization: Bearer`, sem cookies (critério `token !== undefined`);
  - erros como `ApiError` pelo problem+json, mais `unexpected_response` e `no_connection` (sem resposta);
  - `401 no_session` chama `notifySessionExpired`, agora compartilhado com o middleware do `fetch`, então a ADR 0019 e a 0024 valem igual;
  - `signal` cancela e rejeita com `AbortError`.
- Tipos pelo contrato gerado (ADR 0005): só aceita caminhos com POST `multipart/form-data` (`MultipartPath`), e o retorno é o corpo do `201`.
- Testes e e2e: nos testes unitários o XHR é trocado por um falso; no e2e, `page.route` do Playwright também intercepta XHR (ADR 0030).

## Alternativas consideradas

- **`fetch` sem progresso:** a pessoa fica sem retorno em arquivos de até 20 MB; a definição da tarefa pedia a barra.
- **`fetch` com `ReadableStream` no corpo:** exige HTTP/2 e `duplex: 'half'`, não funciona em todos os navegadores e não dá o total do `multipart`.
- **Biblioteca (axios, tus etc.):** dependência nova para um método só, e uma segunda pilha de autenticação e de erros.
- **XHR direto na vertical:** repetiria CSRF, Bearer, erros e aviso de sessão fora do cliente.

## Consequências

- **Bom:** vertical nenhuma toca em XHR; autenticação, erros e sessão iguais aos demais; envio tipado pelo contrato.
- **Ruim:** dois caminhos de rede no cliente; mudança de autenticação ou de formato de erro precisa mexer nos dois. Sem repetição automática (como as mutações). O envio não passa pelo middleware do openapi-fetch.
- **A fazer:** o e2e da F35 intercepta `POST /v1/excel-files`. Novo envio com progresso deve usar `client.upload`, não um XHR novo.
