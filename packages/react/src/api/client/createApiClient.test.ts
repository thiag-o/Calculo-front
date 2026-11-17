import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from './createApiClient';
import { UNEXPECTED_RESPONSE_CODE, NO_CONNECTION_CODE, ApiError, dataOrError } from './apiError';

const API = 'https://api.teste';

const session = {
  user: { id: '00000000-0000-0000-0000-000000000001', name: 'Ana', email: 'ana@exemplo.com' },
  tenants: [{ id: '00000000-0000-0000-0000-00000000000a', name: 'Matriz' }],
  current_tenant: { id: '00000000-0000-0000-0000-00000000000a', name: 'Matriz' },
  permissions: ['workflows.view'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Mensagem de ${code}.`, code: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

let simulatedFetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;

/** The request the client handed to fetch on call `index`. */
function request(index = 0): Request {
  const call = simulatedFetch.mock.calls[index];
  if (!call) throw new Error(`o fetch não foi chamado ${index + 1} vez(es)`);
  return call[0];
}

function setCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}

function deleteCookie() {
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

beforeEach(() => {
  simulatedFetch = vi.fn<(request: Request) => Promise<Response>>();
  vi.stubGlobal('fetch', simulatedFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  deleteCookie();
});

describe('modo cookie (app casca)', () => {
  it('envia o cookie de sessão e não manda Authorization', async () => {
    simulatedFetch.mockResolvedValue(json(session));
    const client = createApiClient({ apiUrl: API });

    const data = await dataOrError(client.GET('/v1/session'));

    expect(client.mode).toBe('cookie');
    expect(data).toEqual(session);
    expect(request().url).toBe(`${API}/v1/session`);
    expect(request().credentials).toBe('include');
    expect(request().headers.get('Authorization')).toBeNull();
  });

  it('não manda X-CSRF-Token em GET, mesmo com o cookie fc_csrf', async () => {
    setCookie('csrf-123');
    simulatedFetch.mockResolvedValue(json(session));
    const client = createApiClient({ apiUrl: API });

    await client.GET('/v1/session');

    expect(request().headers.get('X-CSRF-Token')).toBeNull();
  });

  it('manda X-CSRF-Token com o valor do cookie fc_csrf em POST, PUT e DELETE', async () => {
    setCookie('csrf-123');
    simulatedFetch.mockImplementation(async (req) => (req.method === 'DELETE' ? new Response(null, { status: 204 }) : json(session)));
    const client = createApiClient({ apiUrl: API });

    await client.POST('/v1/session', { body: { email: 'ana@exemplo.com', password: 'senha-segura-123' } });
    await client.PUT('/v1/session/tenant', { body: { tenant_id: '00000000-0000-0000-0000-00000000000a' } });
    await client.DELETE('/v1/session');

    expect(simulatedFetch).toHaveBeenCalledTimes(3);
    for (const index of [0, 1, 2]) {
      expect(request(index).headers.get('X-CSRF-Token')).toBe('csrf-123');
      expect(request(index).credentials).toBe('include');
    }
    expect(request(0).method).toBe('POST');
    expect(request(1).method).toBe('PUT');
    expect(request(2).method).toBe('DELETE');
  });

  it('lê o cookie a cada mutação (o fc_csrf muda a cada login)', async () => {
    simulatedFetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const client = createApiClient({ apiUrl: API });

    setCookie('primeiro');
    await client.DELETE('/v1/session');
    setCookie('segundo');
    await client.DELETE('/v1/session');

    expect(request(0).headers.get('X-CSRF-Token')).toBe('primeiro');
    expect(request(1).headers.get('X-CSRF-Token')).toBe('segundo');
  });

  it('sem o cookie fc_csrf (antes do login), não inventa o cabeçalho', async () => {
    simulatedFetch.mockResolvedValue(json(session));
    const client = createApiClient({ apiUrl: API });

    await client.POST('/v1/session', { body: { email: 'ana@exemplo.com', password: 'senha-segura-123' } });

    expect(request().headers.has('X-CSRF-Token')).toBe(false);
    expect(request().headers.get('Content-Type')).toBe('application/json');
  });

  it('acha o fc_csrf entre outros cookies', async () => {
    document.cookie = 'outro=x; path=/';
    setCookie('csrf-abc');
    simulatedFetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const client = createApiClient({ apiUrl: API });

    await client.DELETE('/v1/session');

    expect(request().headers.get('X-CSRF-Token')).toBe('csrf-abc');
    document.cookie = 'outro=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });
});

describe('modo token (incorporado)', () => {
  it('manda Authorization: Bearer e não envia cookies', async () => {
    simulatedFetch.mockResolvedValue(json(session));
    const client = createApiClient({ apiUrl: API, token: 'tok-xyz' });

    await dataOrError(client.GET('/v1/session'));

    expect(client.mode).toBe('token');
    expect(request().headers.get('Authorization')).toBe('Bearer tok-xyz');
    expect(request().credentials).toBe('omit');
  });

  it('não manda X-CSRF-Token nas mutações, mesmo com o cookie fc_csrf presente', async () => {
    setCookie('csrf-123');
    simulatedFetch.mockImplementation(async (req) => (req.method === 'DELETE' ? new Response(null, { status: 204 }) : json(session)));
    const client = createApiClient({ apiUrl: API, token: 'tok-xyz' });

    await client.PUT('/v1/session/tenant', { body: { tenant_id: '00000000-0000-0000-0000-00000000000a' } });
    await client.DELETE('/v1/session');

    for (const index of [0, 1]) {
      expect(request(index).headers.has('X-CSRF-Token')).toBe(false);
      expect(request(index).headers.get('Authorization')).toBe('Bearer tok-xyz');
    }
  });
});

describe('conversão de problem+json em ApiError', () => {
  async function errorOf(response: Response, token?: string): Promise<ApiError> {
    simulatedFetch.mockResolvedValue(response);
    const client = createApiClient({ apiUrl: API, token });
    const error = await dataOrError(client.GET('/v1/session')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }

  it('traz status, code e mensagem (detail) do problem+json', async () => {
    const error = await errorOf(problem(403, 'invalid_csrf'));

    expect(error.status).toBe(403);
    expect(error.code).toBe('invalid_csrf');
    expect(error.message).toBe('Mensagem de invalid_csrf.');
    expect(error.message).toBe('Mensagem de invalid_csrf.');
    expect(error.fields).toEqual({});
  });

  it('traz o erro de cada campo no 422 invalid_data', async () => {
    const error = await errorOf(problem(422, 'invalid_data', { fields: { email: 'Campo obrigatório.', 'tenant.id': 'UUID inválido.' } }));

    expect(error.status).toBe(422);
    expect(error.code).toBe('invalid_data');
    expect(error.fields).toEqual({ email: 'Campo obrigatório.', 'tenant.id': 'UUID inválido.' });
  });

  it('mantém os membros de extensão no corpo (ex.: unlocks_at do 423)', async () => {
    const error = await errorOf(problem(423, 'login_locked', { unlocks_at: '2026-11-15T15:30:00Z' }));

    expect(error.code).toBe('login_locked');
    expect(error.body?.unlocks_at).toBe('2026-11-15T15:30:00Z');
  });

  it('converte também no modo token', async () => {
    const error = await errorOf(problem(429, 'too_many_attempts'), 'tok-xyz');

    expect(error.status).toBe(429);
    expect(error.code).toBe('too_many_attempts');
  });

  it('usa o title quando não há detail', async () => {
    const error = await errorOf(
      new Response(JSON.stringify({ title: 'Sem permissão', status: 403, code: 'no_permission' }), {
        status: 403,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );

    expect(error.message).toBe('Sem permissão');
  });

  it('resposta de erro que não é problem+json vira unexpected_response, com o status real', async () => {
    const error = await errorOf(new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));

    expect(error.status).toBe(502);
    expect(error.code).toBe(UNEXPECTED_RESPONSE_CODE);
    expect(error.message).not.toBe('');
    expect(error.body).toBeUndefined();
  });

  it('resposta de erro sem corpo também vira unexpected_response', async () => {
    const error = await errorOf(new Response(null, { status: 500 }));

    expect(error.status).toBe(500);
    expect(error.code).toBe(UNEXPECTED_RESPONSE_CODE);
  });

  it('falha de rede vira no_connection, com status 0', async () => {
    simulatedFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient({ apiUrl: API });

    const error = await dataOrError(client.GET('/v1/session')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe(NO_CONNECTION_CODE);
  });

  it('cancelamento passa adiante sem virar ApiError', async () => {
    const cancellation = new DOMException('cancelada', 'AbortError');
    simulatedFetch.mockRejectedValue(cancellation);
    const client = createApiClient({ apiUrl: API });

    await expect(dataOrError(client.GET('/v1/session'))).rejects.toBe(cancellation);
  });

  it('sucesso sem corpo (204) devolve undefined', async () => {
    simulatedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ apiUrl: API });

    await expect(dataOrError(client.DELETE('/v1/session'))).resolves.toBeUndefined();
  });
});

describe('evento de sessão expirada', () => {
  it.each([
    ['cookie', undefined],
    ['token', 'tok-vencido'],
  ])('avisa no 401 no_session (modo %s)', async (_mode, token) => {
    simulatedFetch.mockResolvedValue(problem(401, 'no_session'));
    const client = createApiClient({ apiUrl: API, token });
    const listener = vi.fn();
    client.onSessionExpired(listener);

    const error = await dataOrError(client.GET('/v1/session')).catch((e: unknown) => e);

    expect(listener).toHaveBeenCalledTimes(1);
    // The response is still readable: the error conversion works after the notice.
    expect((error as ApiError).code).toBe('no_session');
  });

  it('não avisa em outro 401 (invalid_credentials no login)', async () => {
    simulatedFetch.mockResolvedValue(problem(401, 'invalid_credentials'));
    const client = createApiClient({ apiUrl: API });
    const listener = vi.fn();
    client.onSessionExpired(listener);

    await client.POST('/v1/session', { body: { email: 'ana@exemplo.com', password: 'errada-errada' } });

    expect(listener).not.toHaveBeenCalled();
  });

  it('não avisa em 403 nem em 401 sem problem+json', async () => {
    simulatedFetch.mockResolvedValueOnce(problem(403, 'no_permission'));
    simulatedFetch.mockResolvedValueOnce(new Response('não autorizado', { status: 401 }));
    const client = createApiClient({ apiUrl: API });
    const listener = vi.fn();
    client.onSessionExpired(listener);

    await client.GET('/v1/session');
    await client.GET('/v1/session');

    expect(listener).not.toHaveBeenCalled();
  });

  it('para de avisar depois de cancelado', async () => {
    simulatedFetch.mockImplementation(async () => problem(401, 'no_session'));
    const client = createApiClient({ apiUrl: API });
    const listener = vi.fn();
    const cancel = client.onSessionExpired(listener);

    await client.GET('/v1/session');
    cancel();
    await client.GET('/v1/session');

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
