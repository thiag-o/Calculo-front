import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData } from '../../session';
import { connectionKey, useCreateConnection, useRenameConnection, useTestConnection, useUpdateCredential } from './queries';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The API answers only when the test calls `release`: the request is "in flight" meanwhile. */
function lateApi(body: unknown) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const simulatedFetch = vi.fn(async () => {
    await gate;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return { release, requests: () => simulatedFetch.mock.calls.length };
}

/**
 * Runs a mutation whose answer arrives late. With `clearBefore`, the session data is cleared (sign-out, 401, tenant
 * switch) while the request is in flight. Returns the cache and the spies of what the mutation wrote or invalidated.
 */
async function runLate<V>(
  useHook: () => { mutateAsync: (variables: V) => Promise<unknown> },
  variables: V,
  answer: unknown,
  clearBefore: boolean,
) {
  const queryClient = new QueryClient();
  const written = vi.spyOn(queryClient, 'setQueryData');
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
  const api = lateApi(answer);
  const wrapper = ({ children }: { children: ReactNode }) =>
    h(ApiProvider, { apiUrl: 'http://127.0.0.1:8000', children: h(QueryClientProvider, { client: queryClient }, children) });
  const { result } = renderHook(useHook, { wrapper });
  let done: Promise<unknown> = Promise.resolve();
  act(() => {
    done = result.current.mutateAsync(variables);
  });
  await vi.waitFor(() => expect(api.requests()).toBe(1));
  if (clearBefore) act(() => clearSessionData(queryClient));
  api.release();
  await act(async () => {
    await done;
  });
  return { queryClient, written, invalidated };
}


const ID = '40000000-0000-0000-0000-000000000001';

describe('resposta que chega depois de a sessão sair do módulo (conexões)', () => {
  it('sem limpeza, a conexão criada vai para o cache', async () => {
    const { queryClient } = await runLate(() => useCreateConnection(() => ({}) as never), undefined, { id: ID }, false);
    expect(queryClient.getQueryData(connectionKey(ID))).toEqual({ id: ID });
  });

  it('criar conexão: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useCreateConnection(() => ({}) as never), undefined, { id: ID }, true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('trocar a credencial: a resposta depois da limpeza não grava nada', async () => {
    const { queryClient, written } = await runLate(() => useUpdateCredential(ID, () => ({}) as never), undefined, { id: ID }, true);
    expect(written).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('renomear: a resposta depois da limpeza não grava nada', async () => {
    const { queryClient, written } = await runLate(() => useRenameConnection(ID), 'Novo nome', { id: ID }, true);
    expect(written).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('testar: o resultado depois da limpeza não grava nada', async () => {
    const { queryClient, written } = await runLate(() => useTestConnection(ID), undefined, { ok: true }, true);
    expect(written).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
