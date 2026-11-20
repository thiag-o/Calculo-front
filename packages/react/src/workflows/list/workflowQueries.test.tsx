// The workflow queries and mutations (../queries.ts) that the list does not use: they serve the Overview, the editor and
// the Home screen. Tested here because the tests of the vertical live with the list (F48).
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { useDeleteWorkflow, useUpdateWorkflow, useWorkflow, useWorkflowList, workflowDraftKey, workflowKey, workflowListKey } from '..';
import { API, BONUS, CREATED, json, page, problem, simulateApi, testQueryClient, type SimulatedApi } from './workflows.test-support';

let api: SimulatedApi;
let queryClient: QueryClient;

beforeEach(() => {
  api = simulateApi();
  queryClient = testQueryClient();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ApiProvider apiUrl={API}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiProvider>
  );
}

describe('chaves de cache dos workflows', () => {
  it('seguem o contrato: lista com filtro, workflow e rascunho sob o workflow', () => {
    expect(workflowListKey({ name: '  metas ', limit: 6 })).toEqual(['workflows', 'list', { name: 'metas', limit: 6 }]);
    expect(workflowListKey({ name: '   ' })).toEqual(['workflows', 'list', {}]);
    expect(workflowKey('abc')).toEqual(['workflows', 'abc']);
    expect(workflowDraftKey('abc')).toEqual(['workflows', 'abc', 'draft']);
  });
});

describe('consultas dos workflows', () => {
  it('a lista manda o filtro e o limite (o Início pede os 6 mais recentes)', async () => {
    api.respond('GET /v1/workflows', page([BONUS]));
    const { result } = renderHook(() => useWorkflowList({ name: 'bônus', limit: 6 }), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([BONUS]));
    const query = new URL(api.callsTo('GET /v1/workflows')[0]!.url).searchParams;
    expect(query.get('name')).toBe('bônus');
    expect(query.get('limit')).toBe('6');
  });

  it('lê um workflow pelo id', async () => {
    api.respond(`GET /v1/workflows/${CREATED.id}`, json(CREATED));
    const { result } = renderHook(() => useWorkflow(CREATED.id), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(CREATED));
    expect(queryClient.getQueryData(workflowKey(CREATED.id))).toEqual(CREATED);
  });
});

describe('mutações dos workflows', () => {
  it('alterar grava a resposta no cache do workflow e busca as listas de novo', async () => {
    const renamed = { ...CREATED, name: 'Pontuação 2026', objective: 'Pontos por item.' };
    api.respond(`PUT /v1/workflows/${CREATED.id}`, json(renamed));
    api.respond('GET /v1/workflows', page([]));
    queryClient.setQueryData(workflowKey(CREATED.id), CREATED);
    queryClient.setQueryData(workflowListKey(), { pages: [], pageParams: [] });
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper });

    await act(() => result.current.mutateAsync({ id: CREATED.id, body: { name: 'Pontuação 2026', objective: 'Pontos por item.' } }));

    expect(await api.callsTo(`PUT /v1/workflows/${CREATED.id}`)[0]!.json()).toEqual({ name: 'Pontuação 2026', objective: 'Pontos por item.' });
    expect(queryClient.getQueryData(workflowKey(CREATED.id))).toEqual(renamed);
    expect(queryClient.getQueryState(workflowListKey())?.isInvalidated).toBe(true);
  });

  it('alterar com nome repetido devolve workflow_exists sem mexer no cache', async () => {
    api.respond(`PUT /v1/workflows/${CREATED.id}`, problem(409, 'workflow_exists'));
    queryClient.setQueryData(workflowKey(CREATED.id), CREATED);
    const { result } = renderHook(() => useUpdateWorkflow(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ id: CREATED.id, body: { name: 'Bônus de metas', objective: null } })).rejects.toMatchObject({
        code: 'workflow_exists',
      });
    });
    expect(queryClient.getQueryData(workflowKey(CREATED.id))).toEqual(CREATED);
  });

  it('remover tira o workflow e o rascunho do cache e busca as listas de novo', async () => {
    api.respond(`DELETE /v1/workflows/${CREATED.id}`, new Response(null, { status: 204 }));
    queryClient.setQueryData(workflowKey(CREATED.id), CREATED);
    queryClient.setQueryData(workflowDraftKey(CREATED.id), { revision: 1 });
    queryClient.setQueryData(workflowKey(BONUS.id), BONUS);
    queryClient.setQueryData(workflowListKey(), { pages: [], pageParams: [] });
    const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });

    await act(() => result.current.mutateAsync(CREATED.id));

    expect(api.callsTo(`DELETE /v1/workflows/${CREATED.id}`)).toHaveLength(1);
    expect(queryClient.getQueryData(workflowKey(CREATED.id))).toBeUndefined();
    expect(queryClient.getQueryData(workflowDraftKey(CREATED.id))).toBeUndefined();
    expect(queryClient.getQueryData(workflowKey(BONUS.id))).toEqual(BONUS);
    expect(queryClient.getQueryState(workflowListKey())?.isInvalidated).toBe(true);
  });
});
