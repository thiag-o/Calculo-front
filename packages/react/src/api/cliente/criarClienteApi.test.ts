import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarClienteApi } from './criarClienteApi';
import { CODIGO_RESPOSTA_INESPERADA, CODIGO_SEM_CONEXAO, ErroApi, dadosOuErro } from './erroApi';

const API = 'https://api.teste';

const sessao = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana', email: 'ana@exemplo.com' },
  tenants: [{ id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' }],
  tenant_atual: { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' },
  permissoes: ['workflows.ver'],
};

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function problema(status: number, codigo: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Mensagem de ${codigo}.`, codigo, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

let fetchSimulado: ReturnType<typeof vi.fn<(requisicao: Request) => Promise<Response>>>;

/** A requisição que o cliente entregou ao fetch na chamada `indice`. */
function requisicao(indice = 0): Request {
  const chamada = fetchSimulado.mock.calls[indice];
  if (!chamada) throw new Error(`o fetch não foi chamado ${indice + 1} vez(es)`);
  return chamada[0];
}

function definirCookie(valor: string) {
  document.cookie = `fc_csrf=${valor}; path=/`;
}

function apagarCookie() {
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

beforeEach(() => {
  fetchSimulado = vi.fn<(requisicao: Request) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
  apagarCookie();
});

describe('modo cookie (app casca)', () => {
  it('envia o cookie de sessão e não manda Authorization', async () => {
    fetchSimulado.mockResolvedValue(json(sessao));
    const cliente = criarClienteApi({ apiUrl: API });

    const dados = await dadosOuErro(cliente.GET('/v1/sessao'));

    expect(cliente.modo).toBe('cookie');
    expect(dados).toEqual(sessao);
    expect(requisicao().url).toBe(`${API}/v1/sessao`);
    expect(requisicao().credentials).toBe('include');
    expect(requisicao().headers.get('Authorization')).toBeNull();
  });

  it('não manda X-CSRF-Token em GET, mesmo com o cookie fc_csrf', async () => {
    definirCookie('csrf-123');
    fetchSimulado.mockResolvedValue(json(sessao));
    const cliente = criarClienteApi({ apiUrl: API });

    await cliente.GET('/v1/sessao');

    expect(requisicao().headers.get('X-CSRF-Token')).toBeNull();
  });

  it('manda X-CSRF-Token com o valor do cookie fc_csrf em POST, PUT e DELETE', async () => {
    definirCookie('csrf-123');
    fetchSimulado.mockImplementation(async (req) => (req.method === 'DELETE' ? new Response(null, { status: 204 }) : json(sessao)));
    const cliente = criarClienteApi({ apiUrl: API });

    await cliente.POST('/v1/sessao', { body: { email: 'ana@exemplo.com', senha: 'senha-segura-123' } });
    await cliente.PUT('/v1/sessao/tenant', { body: { tenant_id: '00000000-0000-0000-0000-00000000000a' } });
    await cliente.DELETE('/v1/sessao');

    expect(fetchSimulado).toHaveBeenCalledTimes(3);
    for (const indice of [0, 1, 2]) {
      expect(requisicao(indice).headers.get('X-CSRF-Token')).toBe('csrf-123');
      expect(requisicao(indice).credentials).toBe('include');
    }
    expect(requisicao(0).method).toBe('POST');
    expect(requisicao(1).method).toBe('PUT');
    expect(requisicao(2).method).toBe('DELETE');
  });

  it('lê o cookie a cada mutação (o fc_csrf muda a cada login)', async () => {
    fetchSimulado.mockImplementation(async () => new Response(null, { status: 204 }));
    const cliente = criarClienteApi({ apiUrl: API });

    definirCookie('primeiro');
    await cliente.DELETE('/v1/sessao');
    definirCookie('segundo');
    await cliente.DELETE('/v1/sessao');

    expect(requisicao(0).headers.get('X-CSRF-Token')).toBe('primeiro');
    expect(requisicao(1).headers.get('X-CSRF-Token')).toBe('segundo');
  });

  it('sem o cookie fc_csrf (antes do login), não inventa o cabeçalho', async () => {
    fetchSimulado.mockResolvedValue(json(sessao));
    const cliente = criarClienteApi({ apiUrl: API });

    await cliente.POST('/v1/sessao', { body: { email: 'ana@exemplo.com', senha: 'senha-segura-123' } });

    expect(requisicao().headers.has('X-CSRF-Token')).toBe(false);
    expect(requisicao().headers.get('Content-Type')).toBe('application/json');
  });

  it('acha o fc_csrf entre outros cookies', async () => {
    document.cookie = 'outro=x; path=/';
    definirCookie('csrf-abc');
    fetchSimulado.mockImplementation(async () => new Response(null, { status: 204 }));
    const cliente = criarClienteApi({ apiUrl: API });

    await cliente.DELETE('/v1/sessao');

    expect(requisicao().headers.get('X-CSRF-Token')).toBe('csrf-abc');
    document.cookie = 'outro=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });
});

describe('modo token (incorporado)', () => {
  it('manda Authorization: Bearer e não envia cookies', async () => {
    fetchSimulado.mockResolvedValue(json(sessao));
    const cliente = criarClienteApi({ apiUrl: API, token: 'tok-xyz' });

    await dadosOuErro(cliente.GET('/v1/sessao'));

    expect(cliente.modo).toBe('token');
    expect(requisicao().headers.get('Authorization')).toBe('Bearer tok-xyz');
    expect(requisicao().credentials).toBe('omit');
  });

  it('não manda X-CSRF-Token nas mutações, mesmo com o cookie fc_csrf presente', async () => {
    definirCookie('csrf-123');
    fetchSimulado.mockImplementation(async (req) => (req.method === 'DELETE' ? new Response(null, { status: 204 }) : json(sessao)));
    const cliente = criarClienteApi({ apiUrl: API, token: 'tok-xyz' });

    await cliente.PUT('/v1/sessao/tenant', { body: { tenant_id: '00000000-0000-0000-0000-00000000000a' } });
    await cliente.DELETE('/v1/sessao');

    for (const indice of [0, 1]) {
      expect(requisicao(indice).headers.has('X-CSRF-Token')).toBe(false);
      expect(requisicao(indice).headers.get('Authorization')).toBe('Bearer tok-xyz');
    }
  });
});

describe('conversão de problem+json em ErroApi', () => {
  async function erroDe(resposta: Response, token?: string): Promise<ErroApi> {
    fetchSimulado.mockResolvedValue(resposta);
    const cliente = criarClienteApi({ apiUrl: API, token });
    const erro = await dadosOuErro(cliente.GET('/v1/sessao')).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    return erro as ErroApi;
  }

  it('traz status, codigo e mensagem (detail) do problem+json', async () => {
    const erro = await erroDe(problema(403, 'csrf_invalido'));

    expect(erro.status).toBe(403);
    expect(erro.codigo).toBe('csrf_invalido');
    expect(erro.mensagem).toBe('Mensagem de csrf_invalido.');
    expect(erro.message).toBe('Mensagem de csrf_invalido.');
    expect(erro.campos).toEqual({});
  });

  it('traz o erro de cada campo no 422 dados_invalidos', async () => {
    const erro = await erroDe(problema(422, 'dados_invalidos', { campos: { email: 'Campo obrigatório.', 'tenant.id': 'UUID inválido.' } }));

    expect(erro.status).toBe(422);
    expect(erro.codigo).toBe('dados_invalidos');
    expect(erro.campos).toEqual({ email: 'Campo obrigatório.', 'tenant.id': 'UUID inválido.' });
  });

  it('mantém os membros de extensão no corpo (ex.: desbloqueia_em do 423)', async () => {
    const erro = await erroDe(problema(423, 'login_bloqueado', { desbloqueia_em: '2026-11-15T15:30:00Z' }));

    expect(erro.codigo).toBe('login_bloqueado');
    expect(erro.corpo?.desbloqueia_em).toBe('2026-11-15T15:30:00Z');
  });

  it('converte também no modo token', async () => {
    const erro = await erroDe(problema(429, 'muitas_tentativas'), 'tok-xyz');

    expect(erro.status).toBe(429);
    expect(erro.codigo).toBe('muitas_tentativas');
  });

  it('usa o title quando não há detail', async () => {
    const erro = await erroDe(
      new Response(JSON.stringify({ title: 'Sem permissão', status: 403, codigo: 'sem_permissao' }), {
        status: 403,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );

    expect(erro.mensagem).toBe('Sem permissão');
  });

  it('resposta de erro que não é problem+json vira resposta_inesperada, com o status real', async () => {
    const erro = await erroDe(new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));

    expect(erro.status).toBe(502);
    expect(erro.codigo).toBe(CODIGO_RESPOSTA_INESPERADA);
    expect(erro.mensagem).not.toBe('');
    expect(erro.corpo).toBeUndefined();
  });

  it('resposta de erro sem corpo também vira resposta_inesperada', async () => {
    const erro = await erroDe(new Response(null, { status: 500 }));

    expect(erro.status).toBe(500);
    expect(erro.codigo).toBe(CODIGO_RESPOSTA_INESPERADA);
  });

  it('falha de rede vira sem_conexao, com status 0', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    const cliente = criarClienteApi({ apiUrl: API });

    const erro = await dadosOuErro(cliente.GET('/v1/sessao')).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(0);
    expect((erro as ErroApi).codigo).toBe(CODIGO_SEM_CONEXAO);
  });

  it('cancelamento passa adiante sem virar ErroApi', async () => {
    const cancelamento = new DOMException('cancelada', 'AbortError');
    fetchSimulado.mockRejectedValue(cancelamento);
    const cliente = criarClienteApi({ apiUrl: API });

    await expect(dadosOuErro(cliente.GET('/v1/sessao'))).rejects.toBe(cancelamento);
  });

  it('sucesso sem corpo (204) devolve undefined', async () => {
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    const cliente = criarClienteApi({ apiUrl: API });

    await expect(dadosOuErro(cliente.DELETE('/v1/sessao'))).resolves.toBeUndefined();
  });
});

describe('evento de sessão expirada', () => {
  it.each([
    ['cookie', undefined],
    ['token', 'tok-vencido'],
  ])('avisa no 401 sem_sessao (modo %s)', async (_modo, token) => {
    fetchSimulado.mockResolvedValue(problema(401, 'sem_sessao'));
    const cliente = criarClienteApi({ apiUrl: API, token });
    const ouvinte = vi.fn();
    cliente.aoExpirarSessao(ouvinte);

    const erro = await dadosOuErro(cliente.GET('/v1/sessao')).catch((e: unknown) => e);

    expect(ouvinte).toHaveBeenCalledTimes(1);
    // A resposta continua legível: a conversão de erro funciona depois do aviso.
    expect((erro as ErroApi).codigo).toBe('sem_sessao');
  });

  it('não avisa em outro 401 (credenciais_invalidas no login)', async () => {
    fetchSimulado.mockResolvedValue(problema(401, 'credenciais_invalidas'));
    const cliente = criarClienteApi({ apiUrl: API });
    const ouvinte = vi.fn();
    cliente.aoExpirarSessao(ouvinte);

    await cliente.POST('/v1/sessao', { body: { email: 'ana@exemplo.com', senha: 'errada-errada' } });

    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('não avisa em 403 nem em 401 sem problem+json', async () => {
    fetchSimulado.mockResolvedValueOnce(problema(403, 'sem_permissao'));
    fetchSimulado.mockResolvedValueOnce(new Response('não autorizado', { status: 401 }));
    const cliente = criarClienteApi({ apiUrl: API });
    const ouvinte = vi.fn();
    cliente.aoExpirarSessao(ouvinte);

    await cliente.GET('/v1/sessao');
    await cliente.GET('/v1/sessao');

    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('para de avisar depois de cancelado', async () => {
    fetchSimulado.mockImplementation(async () => problema(401, 'sem_sessao'));
    const cliente = criarClienteApi({ apiUrl: API });
    const ouvinte = vi.fn();
    const cancelar = cliente.aoExpirarSessao(ouvinte);

    await cliente.GET('/v1/sessao');
    cancelar();
    await cliente.GET('/v1/sessao');

    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
