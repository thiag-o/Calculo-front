import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient, ApiError, ApiProvider, useApiClient } from '../api';
import { API, json, problem, request, calledRoutes, headquartersSession, simulateFetch, type SimulatedFetch } from './api.test-support';
import type { Session } from './useSession';
import { useSession } from '.';

let simulatedFetch: SimulatedFetch;

beforeEach(() => {
  simulatedFetch = simulateFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Another person, with a token from the same host app. */
const brunoSession: Session = {
  ...headquartersSession,
  user: { id: '00000000-0000-0000-0000-000000000002', name: 'Bruno Carvalho', email: 'bruno@exemplo.com' },
  permissions: ['audit.view'],
};

/** The token of each session, as the host app backend would issue it. */
const TOKEN_SESSION: Record<string, Session> = {
  'token-ana-1': headquartersSession,
  'token-ana-2': { ...headquartersSession, permissions: [...headquartersSession.permissions, 'audit.view'] },
  'token-bruno': brunoSession,
};

/** An API that answers by the `Authorization` token; an unknown token is an expired token. */
function apiByToken() {
  simulatedFetch.mockImplementation(async (req) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const session = TOKEN_SESSION[token];
    if (!session) return problem(401, 'no_session');
    if (new URL(req.url).pathname === '/v1/session') return json(session);
    return json(`workflows de ${session.user.name}`);
  });
}

/** Providers in embedded mode: the token comes from the host app and can be changed with `rerender`. */
function renderEmbedded<R>(hook: () => R, initialToken: string, queryClient: QueryClient = createQueryClient()) {
  const onSessionExpired = vi.fn();
  let currentToken = initialToken;
  const result = renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ApiProvider apiUrl={API} token={currentToken} onSessionExpired={onSessionExpired}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiProvider>
    ),
  });
  const changeToken = (token: string) => {
    currentToken = token;
    result.rerender();
  };
  return { ...result, onSessionExpired, queryClient, changeToken };
}

/** Data of another screen, which depends on who the token's person is (through the API client, with the current token). */
function usePersonData() {
  const client = useApiClient();
  return useQuery({
    queryKey: ['users'],
    queryFn: async ({ signal }) => (await client.GET('/v1/users', { signal })).data as unknown as string,
  });
}

describe('useSession no modo token (incorporado)', () => {
  it('busca a sessão em GET /v1/session com Bearer, sem cookie, e responde as permissões do token', async () => {
    apiByToken();
    const { result } = renderEmbedded(() => useSession(), 'token-ana-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(headquartersSession);
    expect(result.current.hasPermission('workflows.view')).toBe(true);
    expect(result.current.hasPermission('audit.view')).toBe(false);
    expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session']);
    const req = request(simulatedFetch);
    expect(req.headers.get('Authorization')).toBe('Bearer token-ana-1');
    expect(req.credentials).toBe('omit');
    expect(req.headers.get('X-CSRF-Token')).toBeNull();
  });

  it('token vencido: chama o onSessionExpired uma vez, sem repetir a busca e sem permissões', async () => {
    apiByToken();
    const { result, onSessionExpired } = renderEmbedded(() => useSession(), 'token-vencido');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).code).toBe('no_session');
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(result.current.hasPermission('workflows.view')).toBe(false);
    expect(simulatedFetch).toHaveBeenCalledTimes(1);
  });

  it('token que vence com o módulo aberto: a próxima busca recebe no_session e avisa o onSessionExpired', async () => {
    apiByToken();
    const { result, onSessionExpired } = renderEmbedded(() => useSession(), 'token-ana-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSessionExpired).not.toHaveBeenCalled();

    delete TOKEN_SESSION['token-ana-1'];
    try {
      await result.current.refetch();
    } finally {
      TOKEN_SESSION['token-ana-1'] = headquartersSession;
    }

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('token renovado da mesma pessoa: confere a sessão com o token novo, atualiza as permissões e mantém os dados', async () => {
    apiByToken();
    const { result, changeToken, onSessionExpired } = renderEmbedded(
      () => ({ session: useSession(), data: usePersonData() }),
      'token-ana-1',
    );
    await waitFor(() => expect(result.current.data.data).toBe('workflows de Ana Beatriz'));

    changeToken('token-ana-2');

    await waitFor(() => expect(result.current.session.hasPermission('audit.view')).toBe(true));
    const last = request(simulatedFetch, simulatedFetch.mock.calls.length - 1);
    expect(`${last.method} ${new URL(last.url).pathname}`).toBe('GET /v1/session');
    expect(last.headers.get('Authorization')).toBe('Bearer token-ana-2');
    // The same person's data stays: nothing fetched again besides the session.
    expect(result.current.data.data).toBe('workflows de Ana Beatriz');
    expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session', 'GET /v1/users', 'GET /v1/session']);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('token de outra pessoa: os dados da anterior saem da tela e as consultas buscam de novo com o token novo', async () => {
    apiByToken();
    const screens: string[] = [];
    const { result, changeToken } = renderEmbedded(() => {
      const session = useSession();
      const data = usePersonData();
      screens.push(`${session.data?.user.name} | ${data.data ?? 'carregando'}`);
      return { session, data };
    }, 'token-ana-1');
    await waitFor(() => expect(result.current.data.data).toBe('workflows de Ana Beatriz'));

    changeToken('token-bruno');

    await waitFor(() => expect(result.current.data.data).toBe('workflows de Bruno Carvalho'));
    expect(result.current.session.data).toEqual(brunoSession);
    expect(result.current.session.hasPermission('workflows.view')).toBe(false);
    const afterSwitch = screens.slice(screens.findIndex((screen) => screen.startsWith('Bruno')));
    // No render showed the new session next to the previous person's data.
    expect(afterSwitch.some((screen) => screen.includes('Ana'))).toBe(false);
    expect(afterSwitch.at(-1)).toBe('Bruno Carvalho | workflows de Bruno Carvalho');
  });

  it('com várias telas lendo a sessão, a troca de token confere a sessão uma vez só', async () => {
    apiByToken();
    const { result, changeToken } = renderEmbedded(
      () => ({ menu: useSession(), screen: useSession(), other: useSession() }),
      'token-ana-1',
    );
    await waitFor(() => expect(result.current.menu.isSuccess).toBe(true));

    changeToken('token-ana-2');

    await waitFor(() => expect(result.current.screen.hasPermission('audit.view')).toBe(true));
    expect(calledRoutes(simulatedFetch)).toEqual(['GET /v1/session', 'GET /v1/session']);
  });

  it('token novo já vencido: avisa o onSessionExpired', async () => {
    apiByToken();
    const { result, changeToken, onSessionExpired } = renderEmbedded(() => useSession(), 'token-ana-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    changeToken('token-vencido');

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(request(simulatedFetch, 1).headers.get('Authorization')).toBe('Bearer token-vencido');
  });
});
