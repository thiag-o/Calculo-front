import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData } from '../../session';
import { datasetKey, useCreateDataset, useCreateVariable, useDeleteVariable, useRefreshDatasetColumns, useRenameDataset, useUpdateVariable } from './queries';

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

const ID = '50000000-0000-0000-0000-000000000001';

describe('resposta que chega depois de a sessão sair do módulo (datasets)', () => {
  it('sem limpeza, o dataset criado vai para o cache', async () => {
    const { queryClient } = await runLate(useCreateDataset, {} as never, { id: ID }, false);
    expect(queryClient.getQueryData(datasetKey(ID))).toEqual({ id: ID });
  });

  it('criar dataset: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useCreateDataset, {} as never, { id: ID }, true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('renomear dataset: a resposta depois da limpeza não grava nada', async () => {
    const { queryClient, written } = await runLate(useRenameDataset, { id: ID, name: 'Novo' }, { id: ID }, true);
    expect(written).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('atualizar colunas: a resposta depois da limpeza não grava nada', async () => {
    const { queryClient, written } = await runLate(useRefreshDatasetColumns, ID, { id: ID }, true);
    expect(written).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('criar variável: a resposta depois da limpeza não grava a lista nem invalida o catálogo', async () => {
    const { written, invalidated } = await runLate(() => useCreateVariable(ID), {} as never, { id: 'v1' }, true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('editar variável: a resposta depois da limpeza não grava a lista', async () => {
    const { written } = await runLate(() => useUpdateVariable(ID), { id: 'v1', body: {} as never }, { id: 'v1' }, true);
    expect(written).not.toHaveBeenCalled();
  });

  it('apagar variável: a resposta depois da limpeza não mexe na lista', async () => {
    const { written, invalidated } = await runLate(() => useDeleteVariable(ID), 'v1', {}, true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
  });
});
