import { useQuery } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '../api';
import {
  apagarCookieCsrf,
  criarProvedores,
  definirCookieCsrf,
  json,
  problema,
  requisicao,
  rotasChamadas,
  sessaoFilial,
  sessaoMatriz,
  simularFetch,
  TENANT_FILIAL,
  type FetchSimulado,
} from './api.test.apoio';
import { temPermissao, useEntrar, useSair, useSessao, useTrocarTenant } from '.';

let fetchSimulado: FetchSimulado;

beforeEach(() => {
  fetchSimulado = simularFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  apagarCookieCsrf();
});

/** Consulta de outra tela, para conferir o que acontece com os dados do tenant anterior. */
function useDadosDoTenant() {
  return useQuery({ queryKey: ['workflows'], queryFn: ({ signal }) => fetch(new Request('https://api.teste/v1/workflows', { signal })).then((r) => r.json() as Promise<string>) });
}

describe('temPermissao', () => {
  it('confere o código na lista de permissões do tenant atual', () => {
    expect(temPermissao(sessaoMatriz, 'workflows.ver')).toBe(true);
    expect(temPermissao(sessaoMatriz, 'credenciais.gerenciar')).toBe(false);
  });

  it('sem sessão, nunca tem permissão', () => {
    expect(temPermissao(undefined, 'workflows.ver')).toBe(false);
  });
});

describe('useSessao', () => {
  it('busca GET /v1/sessao e responde temPermissao pelo tenant atual', async () => {
    fetchSimulado.mockResolvedValue(json(sessaoMatriz));
    const { Provedores } = criarProvedores();

    const { result } = renderHook(() => useSessao(), { wrapper: Provedores });

    expect(result.current.isPending).toBe(true);
    expect(result.current.temPermissao('workflows.ver')).toBe(false);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sessaoMatriz);
    expect(result.current.temPermissao('workflows.ver')).toBe(true);
    expect(result.current.temPermissao('versao.aprovar')).toBe(false);
    expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao']);
    expect(requisicao(fetchSimulado).credentials).toBe('include');
  });

  it('sem sessão, falha com sem_sessao sem repetir a consulta e sem permissões', async () => {
    fetchSimulado.mockImplementation(async () => problema(401, 'sem_sessao'));
    const { Provedores } = criarProvedores();

    const { result } = renderHook(() => useSessao(), { wrapper: Provedores });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ErroApi);
    expect((result.current.error as ErroApi).codigo).toBe('sem_sessao');
    expect(result.current.temPermissao('workflows.ver')).toBe(false);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});

describe('useEntrar', () => {
  it('faz POST /v1/sessao com e-mail e senha e grava a sessão devolvida, sem buscá-la de novo', async () => {
    fetchSimulado.mockImplementation(async (req) => (req.method === 'POST' ? json(sessaoMatriz) : problema(401, 'sem_sessao')));
    const { Provedores, queryClient } = criarProvedores();
    const { result } = renderHook(() => useEntrar(), { wrapper: Provedores });

    await act(() => result.current.mutateAsync({ email: 'ana@exemplo.com', senha: 'senha-segura-123' }));

    const req = requisicao(fetchSimulado);
    expect(`${req.method} ${new URL(req.url).pathname}`).toBe('POST /v1/sessao');
    expect(req.headers.get('Content-Type')).toBe('application/json');
    expect(await req.json()).toEqual({ email: 'ana@exemplo.com', senha: 'senha-segura-123' });
    expect(queryClient.getQueryData(['sessao'])).toEqual(sessaoMatriz);

    // Quem lê a sessão depois do login recebe a do cache, sem nova requisição.
    const sessao = renderHook(() => useSessao(), { wrapper: Provedores });
    expect(sessao.result.current.data).toEqual(sessaoMatriz);
    expect(sessao.result.current.temPermissao('execucoes.ver')).toBe(true);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('descarta os dados de uma identidade anterior', async () => {
    fetchSimulado.mockImplementation(async (req) => (req.method === 'POST' ? json(sessaoMatriz) : json('dados novos')));
    const { Provedores, queryClient } = criarProvedores();
    queryClient.setQueryData(['workflows'], 'dados de outra pessoa');
    const { result } = renderHook(() => useEntrar(), { wrapper: Provedores });

    await act(() => result.current.mutateAsync({ email: 'ana@exemplo.com', senha: 'senha-segura-123' }));

    expect(queryClient.getQueryData(['workflows'])).toBeUndefined();
  });

  it.each([
    [401, 'credenciais_invalidas', {}],
    [423, 'login_bloqueado', { desbloqueia_em: '2026-11-15T14:30:00Z' }],
    [429, 'muitas_tentativas', {}],
  ])('erro %i vira ErroApi com o codigo %s, sem gravar sessão', async (status, codigo, extra) => {
    fetchSimulado.mockResolvedValue(problema(status, codigo, extra));
    const { Provedores, queryClient } = criarProvedores();
    const { result } = renderHook(() => useEntrar(), { wrapper: Provedores });

    act(() => result.current.mutate({ email: 'ana@exemplo.com', senha: 'errada-errada' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ErroApi).codigo).toBe(codigo);
    expect(queryClient.getQueryData(['sessao'])).toBeUndefined();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });
});

describe('useSair', () => {
  it('faz DELETE /v1/sessao com o X-CSRF-Token e apaga o cache do usuário', async () => {
    definirCookieCsrf('csrf-123');
    fetchSimulado.mockResolvedValue(new Response(null, { status: 204 }));
    const { Provedores, queryClient } = criarProvedores();
    queryClient.setQueryData(['sessao'], sessaoMatriz);
    queryClient.setQueryData(['workflows'], 'dados da Ana');
    const { result } = renderHook(() => useSair(), { wrapper: Provedores });

    await act(() => result.current.mutateAsync());

    expect(rotasChamadas(fetchSimulado)).toEqual(['DELETE /v1/sessao']);
    expect(requisicao(fetchSimulado).headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(queryClient.getQueryData(['sessao'])).toBeUndefined();
    expect(queryClient.getQueryData(['workflows'])).toBeUndefined();
  });

  it('em erro (csrf_invalido), mantém a sessão no cache', async () => {
    fetchSimulado.mockResolvedValue(problema(403, 'csrf_invalido'));
    const { Provedores, queryClient } = criarProvedores();
    queryClient.setQueryData(['sessao'], sessaoMatriz);
    const { result } = renderHook(() => useSair(), { wrapper: Provedores });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ErroApi).codigo).toBe('csrf_invalido');
    expect(queryClient.getQueryData(['sessao'])).toEqual(sessaoMatriz);
  });
});

describe('useTrocarTenant', () => {
  it('faz PUT /v1/sessao/tenant com o X-CSRF-Token e passa a sessão e as permissões para o tenant novo', async () => {
    definirCookieCsrf('csrf-123');
    fetchSimulado.mockImplementation(async (req) => (req.method === 'PUT' ? json(sessaoFilial) : json(sessaoMatriz)));
    const { Provedores } = criarProvedores();
    const { result } = renderHook(() => ({ sessao: useSessao(), trocar: useTrocarTenant() }), { wrapper: Provedores });
    await waitFor(() => expect(result.current.sessao.isSuccess).toBe(true));
    expect(result.current.sessao.temPermissao('auditoria.ver')).toBe(false);

    await act(() => result.current.trocar.mutateAsync(TENANT_FILIAL.id));

    const put = requisicao(fetchSimulado, 1);
    expect(`${put.method} ${new URL(put.url).pathname}`).toBe('PUT /v1/sessao/tenant');
    expect(put.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await put.json()).toEqual({ tenant_id: TENANT_FILIAL.id });
    await waitFor(() => expect(result.current.sessao.data?.tenant_atual).toEqual(TENANT_FILIAL));
    expect(result.current.sessao.temPermissao('auditoria.ver')).toBe(true);
    expect(result.current.sessao.temPermissao('workflows.ver')).toBe(false);
    // A sessão nova veio na resposta do PUT: nada de buscar GET /v1/sessao de novo.
    expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao', 'PUT /v1/sessao/tenant']);
  });

  it('os dados do tenant anterior saem da tela e as consultas montadas buscam de novo', async () => {
    let tenantDoServidor = 'Matriz';
    fetchSimulado.mockImplementation(async (req) => {
      if (req.method === 'PUT') {
        tenantDoServidor = 'Filial';
        return json(sessaoFilial);
      }
      if (new URL(req.url).pathname === '/v1/sessao') return json(tenantDoServidor === 'Matriz' ? sessaoMatriz : sessaoFilial);
      return json(`workflows da ${tenantDoServidor}`);
    });
    const { Provedores, queryClient } = criarProvedores();
    queryClient.setQueryData(['sessao'], sessaoMatriz);
    // O que cada renderização mostrou: tenant da sessão e dado da tela.
    const telas: string[] = [];
    const { result } = renderHook(
      () => {
        const sessao = useSessao();
        const dados = useDadosDoTenant();
        telas.push(`${sessao.data?.tenant_atual.nome} | ${dados.data ?? 'carregando'}`);
        return { dados, trocar: useTrocarTenant() };
      },
      { wrapper: Provedores },
    );
    await waitFor(() => expect(result.current.dados.data).toBe('workflows da Matriz'));

    await act(() => result.current.trocar.mutateAsync(TENANT_FILIAL.id));

    await waitFor(() => expect(result.current.dados.data).toBe('workflows da Filial'));
    const depoisDaTroca = telas.slice(telas.findIndex((tela) => tela.startsWith(TENANT_FILIAL.nome)));
    // Nenhuma renderização mostrou o tenant novo ao lado do dado do anterior.
    expect(depoisDaTroca.some((tela) => tela.includes('Matriz'))).toBe(false);
    expect(depoisDaTroca.at(-1)).toBe(`${TENANT_FILIAL.nome} | workflows da Filial`);
  });

  it('uma resposta atrasada do tenant anterior não volta para o cache', async () => {
    let responderAtrasada: (resposta: Response) => void = () => {};
    let chamadasDeDados = 0;
    fetchSimulado.mockImplementation((req) => {
      if (req.method === 'PUT') return Promise.resolve(json(sessaoFilial));
      chamadasDeDados += 1;
      if (chamadasDeDados === 1) return new Promise<Response>((resolver) => (responderAtrasada = resolver));
      return Promise.resolve(json('workflows da Filial'));
    });
    const { Provedores, queryClient } = criarProvedores();
    const { result } = renderHook(() => ({ dados: useDadosDoTenant(), trocar: useTrocarTenant() }), { wrapper: Provedores });
    await waitFor(() => expect(chamadasDeDados).toBe(1));

    await act(() => result.current.trocar.mutateAsync(TENANT_FILIAL.id));
    await act(async () => responderAtrasada(json('workflows da Matriz')));

    await waitFor(() => expect(result.current.dados.data).toBe('workflows da Filial'));
    expect(queryClient.getQueryData(['workflows'])).toBe('workflows da Filial');
  });

  it('em 403 sem_acesso_ao_tenant, mantém o tenant e busca a sessão de novo (a lista de tenants mudou)', async () => {
    fetchSimulado.mockImplementation(async (req) => (req.method === 'PUT' ? problema(403, 'sem_acesso_ao_tenant') : json(sessaoMatriz)));
    const { Provedores } = criarProvedores();
    const { result } = renderHook(() => ({ sessao: useSessao(), trocar: useTrocarTenant() }), { wrapper: Provedores });
    await waitFor(() => expect(result.current.sessao.isSuccess).toBe(true));

    act(() => result.current.trocar.mutate(TENANT_FILIAL.id));

    await waitFor(() => expect(result.current.trocar.isError).toBe(true));
    expect((result.current.trocar.error as ErroApi).codigo).toBe('sem_acesso_ao_tenant');
    await waitFor(() => expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao', 'PUT /v1/sessao/tenant', 'GET /v1/sessao']));
    expect(result.current.sessao.data?.tenant_atual).toEqual(sessaoMatriz.tenant_atual);
  });

  it('em outro erro (csrf_invalido), não busca a sessão de novo', async () => {
    fetchSimulado.mockImplementation(async (req) => (req.method === 'PUT' ? problema(403, 'csrf_invalido') : json(sessaoMatriz)));
    const { Provedores } = criarProvedores();
    const { result } = renderHook(() => ({ sessao: useSessao(), trocar: useTrocarTenant() }), { wrapper: Provedores });
    await waitFor(() => expect(result.current.sessao.isSuccess).toBe(true));

    act(() => result.current.trocar.mutate(TENANT_FILIAL.id));

    await waitFor(() => expect(result.current.trocar.isError).toBe(true));
    expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao', 'PUT /v1/sessao/tenant']);
  });
});
