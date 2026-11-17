import { useQuery } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import {
  deleteCsrfCookie,
  createProviders,
  setCsrfCookie,
  json,
  problem,
  request,
  calledRoutes,
  branchSession,
  headquartersSession,
  simulateFetch,
  BRANCH_TENANT,
  type SimulatedFetch,
} from './api.test-support';
import { hasPermission, useSignIn, useSignOut, useSession, useSwitchTenant } from '.';

let simulatedFetch: SimulatedFetch;

beforeEach(() => {
  simulatedFetch = simulateFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  deleteCsrfCookie();
});

/** Query of another screen, to check what happens to the previous tenant's data. */
function useTenantData() {
  return useQuery({ queryKey: ['workflows'], queryFn: ({ signal }) => fetch(new Request('https://api.teste/v1/workflows', { signal })).then((r) => r.json() as Promise<string>) });
}

describe('hasPermission', () => {
  it('confere o código na lista de permissões do tenant atual', () => {
    expect(hasPermission(headquartersSession, 'workflows.view')).toBe(true);
    expect(hasPermission(headquartersSession, 'credentials.manage')).toBe(false);
  });

  it('sem sessão, nunca tem permissão', () => {
    expect(hasPermission(undefined, 'workflows.view')).toBe(false);
  });
});

describe('useSession', () => {
  it('busca GET /v1/session e responde hasPermission pelo tenant atual', async () => {
    simulatedFetch.mockResolvedValue(json(headquartersSession));
    const { Providers } = createProviders();

    const { result } = renderHook(() => useSession(), { wrapper: Providers });

    expect(result.current.isPending).toBe(true);
    expect(result.current.hasPermission('workflows.view')).toBe(false);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(headquartersSession);
    expect(result.current.hasPermission('workflows.view')).toBe(true);
    expect(result.current.hasPermission('versions.approve')).toBe(false);
    expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session']);
    expect(request(simulatedFetch).credentials).toBe('include');
  });

  it('sem sessão, falha com no_session sem repetir a consulta e sem permissões', async () => {
    simulatedFetch.mockImplementation(async () => problem(401, 'no_session'));
    const { Providers } = createProviders();

    const { result } = renderHook(() => useSession(), { wrapper: Providers });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).code).toBe('no_session');
    expect(result.current.hasPermission('workflows.view')).toBe(false);
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });
});

describe('useSignIn', () => {
  it('faz POST /v1/session com e-mail e senha e grava a sessão devolvida, sem buscá-la de novo', async () => {
    simulatedFetch.mockImplementation(async (req) => (req.method === 'POST' ? json(headquartersSession) : problem(401, 'no_session')));
    const { Providers, queryClient } = createProviders();
    const { result } = renderHook(() => useSignIn(), { wrapper: Providers });

    await act(() => result.current.mutateAsync({ email: 'ana@exemplo.com', password: 'senha-segura-123' }));

    const req = request(simulatedFetch);
    expect(`${req.method} ${new URL(req.url).pathname}`).toBe('POST /v1/session');
    expect(req.headers.get('Content-Type')).toBe('application/json');
    expect(await req.json()).toEqual({ email: 'ana@exemplo.com', password: 'senha-segura-123' });
    expect(queryClient.getQueryData(['session'])).toEqual(headquartersSession);

    // Whoever reads the session after sign-in gets the cached one, without a new request.
    const session = renderHook(() => useSession(), { wrapper: Providers });
    expect(session.result.current.data).toEqual(headquartersSession);
    expect(session.result.current.hasPermission('executions.view')).toBe(true);
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });

  it('descarta os dados de uma identidade anterior', async () => {
    simulatedFetch.mockImplementation(async (req) => (req.method === 'POST' ? json(headquartersSession) : json('dados novos')));
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['workflows'], 'dados de outra pessoa');
    const { result } = renderHook(() => useSignIn(), { wrapper: Providers });

    await act(() => result.current.mutateAsync({ email: 'ana@exemplo.com', password: 'senha-segura-123' }));

    expect(queryClient.getQueryData(['workflows'])).toBeUndefined();
  });

  it.each([
    [401, 'invalid_credentials', {}],
    [423, 'login_locked', { unlocks_at: '2026-11-15T14:30:00Z' }],
    [429, 'too_many_attempts', {}],
  ])('erro %i vira ApiError com o código %s, sem gravar sessão', async (status, code, extra) => {
    simulatedFetch.mockResolvedValue(problem(status, code, extra));
    const { Providers, queryClient } = createProviders();
    const { result } = renderHook(() => useSignIn(), { wrapper: Providers });

    act(() => result.current.mutate({ email: 'ana@exemplo.com', password: 'errada-errada' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).code).toBe(code);
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });
});

describe('useSignOut', () => {
  it('faz DELETE /v1/session com o X-CSRF-Token e apaga o cache do usuário', async () => {
    setCsrfCookie('csrf-123');
    simulatedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    queryClient.setQueryData(['workflows'], 'dados da Ana');
    const { result } = renderHook(() => useSignOut(), { wrapper: Providers });

    await act(() => result.current.mutateAsync());

    expect(calledRoutes(simulatedFetch)).toEqual(['DELETE /v1/session']);
    expect(request(simulatedFetch).headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
    expect(queryClient.getQueryData(['workflows'])).toBeUndefined();
  });

  it('em erro (invalid_csrf), mantém a sessão no cache', async () => {
    simulatedFetch.mockResolvedValue(problem(403, 'invalid_csrf'));
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    const { result } = renderHook(() => useSignOut(), { wrapper: Providers });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).code).toBe('invalid_csrf');
    expect(queryClient.getQueryData(['session'])).toEqual(headquartersSession);
  });
});

describe('useSwitchTenant', () => {
  it('faz PUT /v1/session/tenant com o X-CSRF-Token e passa a sessão e as permissões para o tenant novo', async () => {
    setCsrfCookie('csrf-123');
    simulatedFetch.mockImplementation(async (req) => (req.method === 'PUT' ? json(branchSession) : json(headquartersSession)));
    const { Providers } = createProviders();
    const { result } = renderHook(() => ({ session: useSession(), switchTenant: useSwitchTenant() }), { wrapper: Providers });
    await waitFor(() => expect(result.current.session.isSuccess).toBe(true));
    expect(result.current.session.hasPermission('audit.view')).toBe(false);

    await act(() => result.current.switchTenant.mutateAsync(BRANCH_TENANT.id));

    const put = request(simulatedFetch, 1);
    expect(`${put.method} ${new URL(put.url).pathname}`).toBe('PUT /v1/session/tenant');
    expect(put.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await put.json()).toEqual({ tenant_id: BRANCH_TENANT.id });
    await waitFor(() => expect(result.current.session.data?.current_tenant).toEqual(BRANCH_TENANT));
    expect(result.current.session.hasPermission('audit.view')).toBe(true);
    expect(result.current.session.hasPermission('workflows.view')).toBe(false);
    // The new session came in the PUT response: no new GET /v1/session.
    expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session', 'PUT /v1/session/tenant']);
  });

  it('os dados do tenant anterior saem da tela e as consultas montadas buscam de novo', async () => {
    let serverTenant = 'Matriz';
    simulatedFetch.mockImplementation(async (req) => {
      if (req.method === 'PUT') {
        serverTenant = 'Filial';
        return json(branchSession);
      }
      if (new URL(req.url).pathname === '/v1/session') return json(serverTenant === 'Matriz' ? headquartersSession : branchSession);
      return json(`workflows da ${serverTenant}`);
    });
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    // What each render showed: the session tenant and the screen data.
    const screens: string[] = [];
    const { result } = renderHook(
      () => {
        const session = useSession();
        const data = useTenantData();
        screens.push(`${session.data?.current_tenant.name} | ${data.data ?? 'carregando'}`);
        return { data, switchTenant: useSwitchTenant() };
      },
      { wrapper: Providers },
    );
    await waitFor(() => expect(result.current.data.data).toBe('workflows da Matriz'));

    await act(() => result.current.switchTenant.mutateAsync(BRANCH_TENANT.id));

    await waitFor(() => expect(result.current.data.data).toBe('workflows da Filial'));
    const afterSwitch = screens.slice(screens.findIndex((screen) => screen.startsWith(BRANCH_TENANT.name)));
    // No render showed the new tenant next to the previous one's data.
    expect(afterSwitch.some((screen) => screen.includes('Matriz'))).toBe(false);
    expect(afterSwitch.at(-1)).toBe(`${BRANCH_TENANT.name} | workflows da Filial`);
  });

  it('uma resposta atrasada do tenant anterior não volta para o cache', async () => {
    let respondDelayed: (response: Response) => void = () => {};
    let dataCalls = 0;
    simulatedFetch.mockImplementation((req) => {
      if (req.method === 'PUT') return Promise.resolve(json(branchSession));
      dataCalls += 1;
      if (dataCalls === 1) return new Promise<Response>((resolver) => (respondDelayed = resolver));
      return Promise.resolve(json('workflows da Filial'));
    });
    const { Providers, queryClient } = createProviders();
    const { result } = renderHook(() => ({ data: useTenantData(), switchTenant: useSwitchTenant() }), { wrapper: Providers });
    await waitFor(() => expect(dataCalls).toBe(1));

    await act(() => result.current.switchTenant.mutateAsync(BRANCH_TENANT.id));
    await act(async () => respondDelayed(json('workflows da Matriz')));

    await waitFor(() => expect(result.current.data.data).toBe('workflows da Filial'));
    expect(queryClient.getQueryData(['workflows'])).toBe('workflows da Filial');
  });

  it('em 403 no_tenant_access, mantém o tenant e busca a sessão de novo (a lista de tenants mudou)', async () => {
    simulatedFetch.mockImplementation(async (req) => (req.method === 'PUT' ? problem(403, 'no_tenant_access') : json(headquartersSession)));
    const { Providers } = createProviders();
    const { result } = renderHook(() => ({ session: useSession(), switchTenant: useSwitchTenant() }), { wrapper: Providers });
    await waitFor(() => expect(result.current.session.isSuccess).toBe(true));

    act(() => result.current.switchTenant.mutate(BRANCH_TENANT.id));

    await waitFor(() => expect(result.current.switchTenant.isError).toBe(true));
    expect((result.current.switchTenant.error as ApiError).code).toBe('no_tenant_access');
    await waitFor(() => expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session', 'PUT /v1/session/tenant', 'GET /v1/session']));
    expect(result.current.session.data?.current_tenant).toEqual(headquartersSession.current_tenant);
  });

  it('em outro erro (invalid_csrf), não busca a sessão de novo', async () => {
    simulatedFetch.mockImplementation(async (req) => (req.method === 'PUT' ? problem(403, 'invalid_csrf') : json(headquartersSession)));
    const { Providers } = createProviders();
    const { result } = renderHook(() => ({ session: useSession(), switchTenant: useSwitchTenant() }), { wrapper: Providers });
    await waitFor(() => expect(result.current.session.isSuccess).toBe(true));

    act(() => result.current.switchTenant.mutate(BRANCH_TENANT.id));

    await waitFor(() => expect(result.current.switchTenant.isError).toBe(true));
    expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session', 'PUT /v1/session/tenant']);
  });
});
