import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData, replaceSessionInCache, type Session } from '../../session';
import {
  CONNECTION_LIST_KEY,
  CONNECTIONS_KEY,
  connectionKey,
  useCreateConnection,
  useDeleteConnection,
  useRenameConnection,
  useTestConnection,
  useUpdateCredential,
  type Connection,
  type ConnectionTestResult,
  type Credential,
  type NewConnection,
} from './queries';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ID = '40000000-0000-0000-0000-000000000001';
const CREDENTIAL: Credential = { host: '127.0.0.1', port: 5432, database: 'vendas', username: 'leitura', password: 'segredo-de-teste' };
const NEW_CONNECTION: NewConnection = { name: 'Vendas', type: 'postgres', credential: CREDENTIAL };
const CONNECTION: Connection = {
  id: ID,
  name: 'Vendas',
  type: 'postgres',
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
  last_test: null,
  target: null,
};
const TEST_RESULT: ConnectionTestResult = {
  ok: true,
  tested_at: '2026-11-20T10:05:00Z',
  duration_ms: 12,
  server_version: '16.1',
  tls: true,
  read_only: true,
  error: null,
};
const NOT_FOUND = { code: 'not_found', title: 'Não encontrada', status: 404 };
const NAME_TAKEN = { code: 'connection_already_exists', title: 'Já existe', status: 409 };

interface Reply {
  status: number;
  body?: unknown;
}
const OK = (body: unknown): Reply => ({ status: 200, body });
const NO_CONTENT: Reply = { status: 204 };
const FAILURE = (status: number, body: unknown): Reply => ({ status, body });

/** The API answers only when the test calls `release`: the request is "in flight" meanwhile. */
function lateApi(reply: Reply) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const simulatedFetch = vi.fn(async () => {
    await gate;
    if (reply.body === undefined) return new Response(null, { status: reply.status });
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return { release, requests: () => simulatedFetch.mock.calls.length };
}

/** The session after a tenant switch: the same person, in another tenant. */
const OTHER_TENANT_SESSION: Session = {
  user: { id: '00000000-0000-0000-0000-000000000001', name: 'Ana Beatriz', email: 'ana@exemplo.com' },
  tenants: [{ id: '00000000-0000-0000-0000-00000000000b', name: 'Filial' }],
  current_tenant: { id: '00000000-0000-0000-0000-00000000000b', name: 'Filial' },
  permissions: [],
};

/**
 * Runs a mutation whose answer arrives late. With `clearBefore`, the session data is cleared (sign-out, 401, tenant
 * switch) while the request is in flight. Returns the cache and the spies of what the mutation wrote or invalidated.
 */
async function runLate<V>(
  useHook: () => { mutateAsync: (variables: V) => Promise<unknown> },
  variables: V,
  reply: Reply,
  clearBefore: boolean | 'switch',
) {
  const queryClient = new QueryClient();
  const written = vi.spyOn(queryClient, 'setQueryData');
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
  if (clearBefore === 'switch') await act(() => replaceSessionInCache(queryClient, OTHER_TENANT_SESSION));
  else if (clearBefore) act(() => clearSessionData(queryClient));
  api.release();
  await act(async () => {
    await done;
  });
  return { queryClient, written, invalidated };
}

const listInvalidated = { queryKey: CONNECTION_LIST_KEY };
const connectionsInvalidated = { queryKey: CONNECTIONS_KEY };
const catalogInvalidated = expect.objectContaining({ queryKey: ['catalog'] });

describe('resposta que chega depois de a sessão sair do módulo (conexões)', () => {
  it('sem limpeza, a conexão criada vai para o cache e a lista é buscada de novo', async () => {
    const { queryClient, invalidated } = await runLate(() => useCreateConnection(() => NEW_CONNECTION), undefined, OK(CONNECTION), false);
    expect(queryClient.getQueryData(connectionKey(ID))).toEqual(CONNECTION);
    expect(invalidated).toHaveBeenCalledWith(listInvalidated);
  });

  it('criar conexão: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useCreateConnection(() => NEW_CONNECTION), undefined, OK(CONNECTION), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(connectionKey(ID))).toBeUndefined();
  });

  it('sem limpeza, nome repetido busca a lista de novo', async () => {
    const { invalidated } = await runLate(() => useCreateConnection(() => NEW_CONNECTION), undefined, FAILURE(409, NAME_TAKEN), false);
    expect(invalidated).toHaveBeenCalledWith(listInvalidated);
  });

  it('criar conexão: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useCreateConnection(() => NEW_CONNECTION), undefined, FAILURE(409, NAME_TAKEN), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, a credencial trocada atualiza a conexão no cache', async () => {
    const { queryClient, invalidated } = await runLate(() => useUpdateCredential(ID, () => CREDENTIAL), undefined, OK(CONNECTION), false);
    expect(queryClient.getQueryData(connectionKey(ID))).toEqual(CONNECTION);
    expect(invalidated).toHaveBeenCalledWith(listInvalidated);
  });

  it('trocar a credencial: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useUpdateCredential(ID, () => CREDENTIAL), undefined, OK(CONNECTION), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(connectionKey(ID))).toBeUndefined();
  });

  it('sem limpeza, trocar a credencial de uma conexão que sumiu busca as conexões de novo', async () => {
    const { invalidated } = await runLate(() => useUpdateCredential(ID, () => CREDENTIAL), undefined, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith(connectionsInvalidated);
  });

  it('trocar a credencial: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useUpdateCredential(ID, () => CREDENTIAL), undefined, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, a conexão renomeada vai para o cache e o catálogo é buscado de novo', async () => {
    const { queryClient, invalidated } = await runLate(() => useRenameConnection(ID), 'Novo nome', OK(CONNECTION), false);
    expect(queryClient.getQueryData(connectionKey(ID))).toEqual(CONNECTION);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('renomear: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useRenameConnection(ID), 'Novo nome', OK(CONNECTION), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(connectionKey(ID))).toBeUndefined();
  });

  it('sem limpeza, renomear para um nome repetido busca as conexões de novo', async () => {
    const { invalidated } = await runLate(() => useRenameConnection(ID), 'Novo nome', FAILURE(409, NAME_TAKEN), false);
    expect(invalidated).toHaveBeenCalledWith(connectionsInvalidated);
  });

  it('renomear: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useRenameConnection(ID), 'Novo nome', FAILURE(409, NAME_TAKEN), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, o resultado do teste entra na conexão que está no cache', async () => {
    const { queryClient, invalidated } = await runLate(() => useTestConnection(ID), undefined, OK(TEST_RESULT), false);
    // The detail was not in the cache: the update leaves it empty, and the list is fetched again.
    expect(invalidated).toHaveBeenCalledWith(listInvalidated);
    expect(queryClient.getQueryData(connectionKey(ID))).toBeUndefined();
  });

  it('testar: o resultado depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useTestConnection(ID), undefined, OK(TEST_RESULT), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(connectionKey(ID))).toBeUndefined();
  });

  it('sem limpeza, testar uma conexão que sumiu busca as conexões de novo', async () => {
    const { invalidated } = await runLate(() => useTestConnection(ID), undefined, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith(connectionsInvalidated);
  });

  it('testar: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useTestConnection(ID), undefined, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, apagar busca o catálogo de novo', async () => {
    const { invalidated } = await runLate(() => useDeleteConnection(ID), undefined, NO_CONTENT, false);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('apagar conexão: a resposta depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useDeleteConnection(ID), undefined, NO_CONTENT, true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, apagar uma conexão que já sumiu busca a lista de novo', async () => {
    const { invalidated } = await runLate(() => useDeleteConnection(ID), undefined, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith(listInvalidated);
  });

  it('apagar conexão: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useDeleteConnection(ID), undefined, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('resposta que chega depois da troca de tenant (conexões)', () => {
  it('renomear: a resposta depois da troca não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useRenameConnection(ID), 'Novo nome', OK(CONNECTION), 'switch');
    // The switch itself writes the new session; nothing else may be written.
    expect(written.mock.calls.filter(([key]) => key[0] !== 'session')).toEqual([]);
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(connectionKey(ID))).toBeUndefined();
  });

  it('renomear: o erro depois da troca não invalida nada', async () => {
    const { invalidated } = await runLate(() => useRenameConnection(ID), 'Novo nome', FAILURE(409, NAME_TAKEN), 'switch');
    expect(invalidated).not.toHaveBeenCalled();
  });
});
