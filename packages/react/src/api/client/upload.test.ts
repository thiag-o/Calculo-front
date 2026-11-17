import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './createApiClient';
import { ApiError, NO_CONNECTION_CODE, UNEXPECTED_RESPONSE_CODE } from './apiError';

const API = 'https://api.teste';

const EXCEL_FILE = {
  id: '50000000-0000-0000-0000-000000000001',
  file_name: 'metas.xlsx',
  size_bytes: 10,
  sha256: 'a'.repeat(64),
  uploaded_at: '2026-11-12T10:00:00Z',
  sheets: [],
};

/** XMLHttpRequest simulated: records what was sent; the test decides the progress and the answer. */
class FakeXMLHttpRequest {
  static sent: FakeXMLHttpRequest[] = [];
  method = '';
  url = '';
  headers: Record<string, string> = {};
  withCredentials = false;
  responseType = '';
  status = 0;
  responseText = '';
  body: unknown;
  aborted = false;
  readonly upload = new EventTarget();
  private readonly events = new EventTarget();

  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
    FakeXMLHttpRequest.sent.push(this);
  }
  abort() {
    this.aborted = true;
    this.events.dispatchEvent(new Event('abort'));
  }

  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.dispatchEvent(new ProgressEvent('progress', { loaded, total, lengthComputable }));
  }
  respond(status: number, body?: unknown) {
    this.status = status;
    this.responseText = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
    this.events.dispatchEvent(new Event('load'));
  }
  fail() {
    this.events.dispatchEvent(new Event('error'));
  }
}

function lastRequest(): FakeXMLHttpRequest {
  const request = FakeXMLHttpRequest.sent.at(-1);
  if (!request) throw new Error('nenhum envio foi feito');
  return request;
}

function formWithFile(): FormData {
  const form = new FormData();
  form.append('file', new File(['conteudo'], 'metas.xlsx'));
  return form;
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { type: 'about:blank', title: 'Erro', status, detail: `Mensagem de ${code}.`, code, ...extra };
}

beforeEach(() => {
  FakeXMLHttpRequest.sent = [];
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('envio multipart com progresso', () => {
  it('faz POST do FormData no caminho da API e devolve o corpo do 201', async () => {
    const client = createApiClient({ apiUrl: `${API}/` });
    const form = formWithFile();

    const result = client.upload('/v1/excel-files', form);
    const request = lastRequest();
    expect(request.method).toBe('POST');
    expect(request.url).toBe(`${API}/v1/excel-files`);
    expect(request.body).toBe(form);
    // The browser sets the multipart Content-Type with the boundary: the client never sets it.
    expect(request.headers['Content-Type']).toBeUndefined();

    request.respond(201, EXCEL_FILE);
    await expect(result).resolves.toEqual(EXCEL_FILE);
  });

  it('avisa o progresso do corpo enviado, só quando o total é conhecido', async () => {
    const onProgress = vi.fn();
    const client = createApiClient({ apiUrl: API });

    const result = client.upload('/v1/excel-files', formWithFile(), { onProgress });
    const request = lastRequest();
    request.progress(3, 10, false);
    request.progress(4, 10);
    request.progress(10, 10);
    request.respond(201, EXCEL_FILE);
    await result;

    expect(onProgress.mock.calls).toEqual([[{ loaded: 4, total: 10 }], [{ loaded: 10, total: 10 }]]);
  });

  it('modo cookie: envia o cookie e o X-CSRF-Token lido na hora do envio', async () => {
    const client = createApiClient({ apiUrl: API });
    document.cookie = 'fc_csrf=csrf-1; path=/';

    void client.upload('/v1/excel-files', formWithFile()).catch(() => {});
    const request = lastRequest();

    expect(request.withCredentials).toBe(true);
    expect(request.headers['X-CSRF-Token']).toBe('csrf-1');
    expect(request.headers.Authorization).toBeUndefined();
    request.respond(201, EXCEL_FILE);
  });

  it('modo cookie sem o fc_csrf: não inventa o cabeçalho', async () => {
    const client = createApiClient({ apiUrl: API });

    void client.upload('/v1/excel-files', formWithFile());
    const request = lastRequest();

    expect(request.headers['X-CSRF-Token']).toBeUndefined();
    request.respond(201, EXCEL_FILE);
  });

  it('modo token: manda Authorization: Bearer, sem cookies e sem CSRF', async () => {
    document.cookie = 'fc_csrf=csrf-1; path=/';
    const client = createApiClient({ apiUrl: API, token: 'tok-9' });

    void client.upload('/v1/excel-files', formWithFile());
    const request = lastRequest();

    expect(request.withCredentials).toBe(false);
    expect(request.headers.Authorization).toBe('Bearer tok-9');
    expect(request.headers['X-CSRF-Token']).toBeUndefined();
    request.respond(201, EXCEL_FILE);
  });

  it('converte o problem+json em ApiError, com status, code e fields', async () => {
    const client = createApiClient({ apiUrl: API });

    const result = client.upload('/v1/excel-files', formWithFile());
    lastRequest().respond(422, problem(422, 'invalid_header', { fields: { 'Vendas!C1': 'Coluna sem nome.' } }));

    const error = await result.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'invalid_header',
      message: 'Mensagem de invalid_header.',
      fields: { 'Vendas!C1': 'Coluna sem nome.' },
    });
  });

  it('erro sem problem+json vira unexpected_response, com o status real', async () => {
    const client = createApiClient({ apiUrl: API });

    const result = client.upload('/v1/excel-files', formWithFile());
    lastRequest().respond(502, '<html>Bad gateway</html>');

    await expect(result).rejects.toMatchObject({ status: 502, code: UNEXPECTED_RESPONSE_CODE });
  });

  it('sem resposta (rede) vira no_connection, com status 0', async () => {
    const client = createApiClient({ apiUrl: API });

    const result = client.upload('/v1/excel-files', formWithFile());
    lastRequest().fail();

    await expect(result).rejects.toMatchObject({ status: 0, code: NO_CONNECTION_CODE });
  });

  it('o signal cancela o envio com AbortError, sem virar ApiError', async () => {
    const client = createApiClient({ apiUrl: API });
    const controller = new AbortController();

    const result = client.upload('/v1/excel-files', formWithFile(), { signal: controller.signal });
    controller.abort();

    const error = await result.catch((caught: unknown) => caught);
    expect(lastRequest().aborted).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: 'AbortError' });
  });

  it('com o signal já cancelado, nem começa o envio', async () => {
    const client = createApiClient({ apiUrl: API });
    const controller = new AbortController();
    controller.abort();

    await expect(client.upload('/v1/excel-files', formWithFile(), { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(FakeXMLHttpRequest.sent).toHaveLength(0);
  });

  it('401 no_session avisa quem escuta a sessão expirada; outro 401 não', async () => {
    const client = createApiClient({ apiUrl: API });
    const listener = vi.fn();
    client.onSessionExpired(listener);

    const expired = client.upload('/v1/excel-files', formWithFile());
    lastRequest().respond(401, problem(401, 'no_session'));
    await expect(expired).rejects.toMatchObject({ code: 'no_session' });
    expect(listener).toHaveBeenCalledTimes(1);

    const other = client.upload('/v1/excel-files', formWithFile());
    lastRequest().respond(403, problem(403, 'no_permission'));
    await expect(other).rejects.toMatchObject({ code: 'no_permission' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
