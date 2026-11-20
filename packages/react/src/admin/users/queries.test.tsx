import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider, type Schemas } from '../../api';
import { clearSessionData, replaceSessionInCache, type Session } from '../../session';
import { AVAILABLE_ROLES_KEY, USER_LIST_KEY, useCreateUser, useGenerateResetLink, useUpdateUser, type NewUser, type UserUpdate } from './queries';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

const ID = '40000000-0000-0000-0000-000000000001';
const NEW_USER: NewUser = { email: 'bia@exemplo.com', name: 'Bia', roles: [ID] };
const USER_UPDATE: UserUpdate = { name: 'Ana', roles: [ID], active: true };
const USER: Schemas['User'] = { id: ID, email: 'bia@exemplo.com', name: 'Bia', roles: [], active: true, external: false };

/** The session after a tenant switch: the same person, in another tenant. */
const OTHER_TENANT_SESSION: Session = {
  user: { id: '00000000-0000-0000-0000-000000000001', name: 'Ana Beatriz', email: 'ana@exemplo.com' },
  tenants: [{ id: '00000000-0000-0000-0000-00000000000b', name: 'Filial' }],
  current_tenant: { id: '00000000-0000-0000-0000-00000000000b', name: 'Filial' },
  permissions: [],
};

interface Reply {
  status: number;
  body?: unknown;
}
const OK = (body?: unknown): Reply => ({ status: body === undefined ? 204 : 200, body });
const FAILURE = (status: number, code: string): Reply => {
  const body: Schemas['Problem'] = { type: 'about:blank', title: 'Erro', status, detail: 'Texto do servidor.', code };
  return { status, body };
};

/** The API answers only when the test calls `release`: the request is "in flight" meanwhile. */
function lateApi(reply: Reply) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const simulatedFetch = vi.fn(async () => {
    await gate;
    if (reply.body === undefined) return new Response(null, { status: reply.status });
    const type = reply.status >= 400 ? 'application/problem+json' : 'application/json';
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': type } });
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return { release, requests: () => simulatedFetch.mock.calls.length };
}

type Moment = 'sem limpeza' | 'depois do logout' | 'depois da troca de tenant';

/** Runs a mutation whose answer arrives late; returns the keys the mutation invalidated. */
async function runLate<V>(useHook: () => { mutateAsync: (variables: V) => Promise<unknown> }, variables: V, reply: Reply, moment: Moment) {
  document.cookie = 'fc_csrf=csrf-123; path=/';
  const queryClient = new QueryClient();
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
  const api = lateApi(reply);
  const wrapper = ({ children }: { children: ReactNode }) =>
    h(ApiProvider, { apiUrl: 'http://127.0.0.1:8000', children: h(QueryClientProvider, { client: queryClient }, children) });
  const { result } = renderHook(useHook, { wrapper });
  let done: Promise<unknown> = Promise.resolve();
  act(() => {
    done = result.current.mutateAsync(variables).catch(() => undefined);
  });
  await vi.waitFor(() => expect(api.requests()).toBe(1));
  if (moment === 'depois da troca de tenant') await act(() => replaceSessionInCache(queryClient, OTHER_TENANT_SESSION));
  else if (moment === 'depois do logout') act(() => clearSessionData(queryClient));
  api.release();
  await act(async () => {
    await done;
  });
  return invalidated.mock.calls.map(([filters]) => filters?.queryKey);
}

interface Case {
  name: string;
  run: (moment: Moment) => Promise<unknown[]>;
  /** The key the mutation invalidates when nothing was cleared. */
  key: readonly unknown[];
}
const LATE_MOMENTS: Moment[] = ['depois do logout', 'depois da troca de tenant'];

describe('Usuários: resposta que chega depois de a sessão sair do módulo', () => {
  const CASES: Case[] = [
    { name: 'criar usuário (sucesso)', key: USER_LIST_KEY, run: (moment) => runLate(() => useCreateUser(), NEW_USER, OK(USER), moment) },
    { name: 'criar usuário (unknown_role)', key: AVAILABLE_ROLES_KEY, run: (moment) => runLate(() => useCreateUser(), NEW_USER, FAILURE(422, 'unknown_role'), moment) },
    { name: 'editar usuário (sucesso)', key: USER_LIST_KEY, run: (moment) => runLate(() => useUpdateUser(), { id: ID, body: USER_UPDATE }, OK(USER), moment) },
    { name: 'editar usuário (unknown_role)', key: AVAILABLE_ROLES_KEY, run: (moment) => runLate(() => useUpdateUser(), { id: ID, body: USER_UPDATE }, FAILURE(422, 'unknown_role'), moment) },
    { name: 'editar usuário (not_found)', key: USER_LIST_KEY, run: (moment) => runLate(() => useUpdateUser(), { id: ID, body: USER_UPDATE }, FAILURE(404, 'not_found'), moment) },
    { name: 'gerar link (not_found)', key: USER_LIST_KEY, run: (moment) => runLate(() => useGenerateResetLink(), ID, FAILURE(404, 'not_found'), moment) },
    { name: 'gerar link (inactive_user)', key: USER_LIST_KEY, run: (moment) => runLate(() => useGenerateResetLink(), ID, FAILURE(409, 'inactive_user'), moment) },
    { name: 'gerar link (external_user)', key: USER_LIST_KEY, run: (moment) => runLate(() => useGenerateResetLink(), ID, FAILURE(409, 'external_user'), moment) },
  ];

  it.each(CASES)('$name: sem limpeza, a resposta manda buscar de novo', async ({ run, key }) => {
    expect(await run('sem limpeza')).toContainEqual(key);
  });

  it.each(CASES.flatMap((item) => LATE_MOMENTS.map((moment) => ({ ...item, moment }))))(
    '$name: a resposta $moment não invalida nada',
    async ({ run, moment }) => {
      expect(await run(moment)).toEqual([]);
    },
  );
});
