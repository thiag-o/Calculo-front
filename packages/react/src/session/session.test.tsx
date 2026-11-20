import { useQuery } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError, ApiProvider } from '../api';
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
import {
  clearSessionData,
  hasPermission,
  isSameSessionData,
  onSessionDataCleared,
  replaceSessionInCache,
  sessionDataMark,
  useSessionGeneration,
  useSignIn,
  useSignOut,
  useSession,
  useSwitchTenant,
} from '.';

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
  it('faz DELETE /v1/session com o X-CSRF-Token e não limpa nada sozinho, com a tela ainda montada', async () => {
    setCsrfCookie('csrf-123');
    simulatedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    queryClient.setQueryData(['workflows'], 'dados da Ana');
    const told = vi.fn();
    onSessionDataCleared(queryClient, told);
    const { result } = renderHook(() => useSignOut(), { wrapper: Providers });

    await act(() => result.current.mutateAsync());

    expect(calledRoutes(simulatedFetch)).toEqual(['DELETE /v1/session']);
    expect(request(simulatedFetch).headers.get('X-CSRF-Token')).toBe('csrf-123');
    // The module clears once, after the screen leaves (ADR 0019): clearing here would make the mounted queries fetch
    // again and get 401.
    expect(told).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['session'])).toEqual(headquartersSession);
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

  it('a troca que responde depois de um logout não grava nada: nem a sessão, nem o cache, nem a memória avisada de novo', async () => {
    let answer: (response: Response) => void = () => {};
    simulatedFetch.mockImplementation((req) => new Promise<Response>((resolver) => (answer = req.method === 'PUT' ? resolver : () => {})));
    const { Providers, queryClient } = createProviders();
    const told = vi.fn();
    onSessionDataCleared(queryClient, told);
    const { result } = renderHook(() => useSwitchTenant(), { wrapper: Providers });

    act(() => result.current.mutate(BRANCH_TENANT.id));
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await waitFor(() => expect(calledRoutes(simulatedFetch)).toEqual(['PUT /v1/session/tenant']));

    // Sign-out while the PUT is on the way: everything of the session leaves.
    await act(() => clearSessionData(queryClient));
    expect(told).toHaveBeenCalledTimes(1);

    await act(async () => answer(json(branchSession)));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(['session'])).toBeUndefined();
    expect(told).toHaveBeenCalledTimes(1);
    expect(calledRoutes(simulatedFetch)).toEqual(['PUT /v1/session/tenant']);
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

  it('403 no_tenant_access que chega depois da limpeza da sessão não busca a sessão de novo', async () => {
    let answer: (response: Response) => void = () => {};
    simulatedFetch.mockImplementation((req) => new Promise<Response>((resolver) => (answer = req.method === 'PUT' ? resolver : () => {})));
    const { Providers, queryClient } = createProviders();
    const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSwitchTenant(), { wrapper: Providers });

    act(() => result.current.mutate(BRANCH_TENANT.id));
    await waitFor(() => expect(calledRoutes(simulatedFetch)).toEqual(['PUT /v1/session/tenant']));
    await act(() => clearSessionData(queryClient));

    await act(async () => answer(problem(403, 'no_tenant_access')));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidated).not.toHaveBeenCalled();
    expect(calledRoutes(simulatedFetch)).toEqual(['PUT /v1/session/tenant']);
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

describe('o que sai com a sessão', () => {
  it('depois da limpeza do logout, nada fica no cache, a memória registrada é avisada e a tela seguinte busca de novo', async () => {
    setCsrfCookie('csrf-123');
    simulatedFetch.mockImplementation(async (req) => (req.method === 'DELETE' ? new Response(null, { status: 204 }) : problem(401, 'no_session')));
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    queryClient.setQueryData(['workflows'], 'dados da Ana');
    const told = vi.fn();
    onSessionDataCleared(queryClient, told);
    const { result } = renderHook(() => useSignOut(), { wrapper: Providers });

    // What the module does after "Sair": ends the session and, once the screen left, clears.
    await act(() => result.current.mutateAsync(undefined, { onSuccess: () => clearSessionData(queryClient) }));

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
    expect(told).toHaveBeenCalledTimes(1);
    expect(told).toHaveBeenCalledWith(undefined);
    // The next screen does not get the session from the cache: it asks the API (which ended it).
    const next = renderHook(() => useSession(), { wrapper: Providers });
    await waitFor(() => expect(next.result.current.isError).toBe(true));
    expect(calledRoutes(simulatedFetch)).toEqual(['DELETE /v1/session', 'GET /v1/session']);
  });

  it('clearSessionData (o que o módulo faz no 401) esvazia o cache e avisa a memória registrada', () => {
    const queryClient = createProviders().queryClient;
    queryClient.setQueryData(['session'], headquartersSession);
    queryClient.setQueryData(['workflows'], 'dados da Ana');
    const told = vi.fn();
    const stop = onSessionDataCleared(queryClient, told);

    clearSessionData(queryClient);

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(told).toHaveBeenCalledTimes(1);
    expect(told).toHaveBeenCalledWith(undefined);
    stop();
    clearSessionData(queryClient);
    expect(told).toHaveBeenCalledTimes(1);
  });

  it('na troca de tenant, as consultas que ninguém mostra e as mutações encerradas saem, e a geração das telas muda', async () => {
    setCsrfCookie('csrf-123');
    simulatedFetch.mockImplementation(async (req) => (req.method === 'PUT' ? json(branchSession) : json(headquartersSession)));
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    queryClient.setQueryData(['workflows', 'list'], 'lista da Matriz, que nenhuma tela mostra');
    const told = vi.fn();
    onSessionDataCleared(queryClient, told);
    const { result } = renderHook(() => ({ generation: useSessionGeneration(), switchTenant: useSwitchTenant() }), { wrapper: Providers });
    expect(result.current.generation).toBe(0);

    await act(() => result.current.switchTenant.mutateAsync(BRANCH_TENANT.id));

    await waitFor(() => expect(result.current.generation).toBe(1));
    expect(told).toHaveBeenCalledWith(branchSession);
    expect(queryClient.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([['session']]);
    expect(queryClient.getQueryData(['session'])).toEqual(branchSession);
    // Only the switch itself, which was still running when the cache was cleared, can be left (it settles afterwards).
    expect(queryClient.getMutationCache().getAll().length).toBeLessThanOrEqual(1);
  });

  it('isSameSessionData confere a marca, recusa a marca que faltou e muda a cada limpeza', async () => {
    const queryClient = createProviders().queryClient;
    const before = sessionDataMark(queryClient);
    expect(isSameSessionData(queryClient, before)).toBe(true);
    expect(isSameSessionData(queryClient, undefined)).toBe(false);

    clearSessionData(queryClient);
    expect(isSameSessionData(queryClient, before)).toBe(false);
    const afterClear = sessionDataMark(queryClient);
    expect(isSameSessionData(queryClient, afterClear)).toBe(true);

    await replaceSessionInCache(queryClient, branchSession);
    expect(isSameSessionData(queryClient, afterClear)).toBe(false);
    expect(isSameSessionData(queryClient, sessionDataMark(queryClient))).toBe(true);
  });

  it('uma troca de tenant que responde depois do logout não devolve a sessão ao cache já limpo', async () => {
    setCsrfCookie('csrf-123');
    let respond: (response: Response) => void = () => {};
    simulatedFetch.mockImplementation((req) =>
      req.method === 'PUT' ? new Promise<Response>((resolver) => (respond = resolver)) : Promise.resolve(problem(401, 'no_session')),
    );
    const { Providers, queryClient } = createProviders();
    queryClient.setQueryData(['session'], headquartersSession);
    const told = vi.fn();
    onSessionDataCleared(queryClient, told);
    const { result } = renderHook(() => useSwitchTenant(), { wrapper: Providers });

    act(() => result.current.mutate(BRANCH_TENANT.id));
    await waitFor(() => expect(calledRoutes(simulatedFetch)).toEqual(['PUT /v1/session/tenant']));
    act(() => clearSessionData(queryClient));
    await act(async () => respond(json(branchSession)));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(told).toHaveBeenCalledTimes(1);
  });
});

describe('useSession: sessão do token novo que responde atrasada', () => {
  const FRESH = { ...headquartersSession, permissions: ['workflows.view', 'audit.view'] };

  /** Token a is loaded; the host passes token b and the check of b is in flight until `release`. */
  async function checkInFlight() {
    const { queryClient } = createProviders();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markResponded: () => void = () => {};
    const responded = new Promise<void>((resolve) => {
      markResponded = resolve;
    });
    simulatedFetch.mockImplementation(async (req) => {
      if (req.headers.get('Authorization') === 'Bearer token-b') {
        await gate;
        markResponded();
        return json(FRESH);
      }
      return json(headquartersSession);
    });
    let token = 'token-a';
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider apiUrl="https://api.teste" token={token}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiProvider>
    );
    const view = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    token = 'token-b';
    view.rerender();
    await vi.waitFor(() => expect(simulatedFetch.mock.calls.some(([req]) => req.headers.get('Authorization') === 'Bearer token-b')).toBe(true));
    return { queryClient, release, responded };
  }

  /** Waits for the request to answer and for the client to have no pending work, with no fixed time. */
  async function settle(queryClient: ReturnType<typeof createProviders>['queryClient'], responded: Promise<void>) {
    await act(async () => {
      await responded;
      // One macrotask drains every pending microtask (the simulated fetch has no real I/O).
      await new Promise<void>((resolve) => setImmediate(resolve));
    });
    await vi.waitFor(() => expect(queryClient.isFetching() + queryClient.isMutating()).toBe(0));
  }

  it('sem limpeza, a sessão do token novo (mesma pessoa e tenant) vai para o cache', async () => {
    const { queryClient, release } = await checkInFlight();
    release();
    await waitFor(() => expect(queryClient.getQueryData(['session'])).toEqual(FRESH));
  });

  it('depois do logout, a resposta atrasada não grava a sessão no cache limpo', async () => {
    const { queryClient, release, responded } = await checkInFlight();
    act(() => clearSessionData(queryClient));
    release();
    await settle(queryClient, responded);
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
  });

  it('um logout durante o cancelQueries da checagem não grava nada e nem busca a sessão do token novo', async () => {
    const { queryClient } = createProviders();
    simulatedFetch.mockImplementation(async () => json(headquartersSession));
    let token = 'token-a';
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApiProvider apiUrl="https://api.teste" token={token}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiProvider>
    );
    const view = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    const callsBefore = simulatedFetch.mock.calls.length;

    let releaseCancel: () => void = () => {};
    const cancelGate = new Promise<void>((resolve) => {
      releaseCancel = resolve;
    });
    let cancelStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      cancelStarted = resolve;
    });
    const realCancel = queryClient.cancelQueries.bind(queryClient);
    vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async (...args) => {
      cancelStarted();
      await cancelGate;
      return realCancel(...args);
    });

    token = 'token-b';
    view.rerender();
    await started;
    vi.mocked(queryClient.cancelQueries).mockImplementation(realCancel);
    act(() => clearSessionData(queryClient));
    releaseCancel();
    await settle(queryClient, Promise.resolve());
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
    expect(simulatedFetch.mock.calls.length).toBe(callsBefore);
  });

  it('depois da troca de tenant, a resposta atrasada não sobrescreve a sessão nova', async () => {
    const { queryClient, release, responded } = await checkInFlight();
    await act(() => replaceSessionInCache(queryClient, branchSession));
    release();
    await settle(queryClient, responded);
    expect(queryClient.getQueryData(['session'])).toEqual(branchSession);
  });
});
