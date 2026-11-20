import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../api';
import { clearSessionData, replaceSessionInCache, type Session } from '../session';
import {
  WORKFLOW_LISTS_KEY,
  useCreateWorkflow,
  useDeleteWorkflow,
  useUpdateWorkflow,
  workflowKey,
  type NewWorkflow,
  type Workflow,
  type WorkflowUpdate,
} from './queries';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const WORKFLOW_ID = '30000000-0000-0000-0000-000000000001';
const USER = { id: '30000000-0000-0000-0000-0000000000aa', name: 'Ana Beatriz' };
const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  name: 'Campanha de vendas',
  objective: null,
  kind: 'batch',
  created_at: '2026-11-20T10:00:00Z',
  created_by: USER,
  updated_at: '2026-11-20T10:00:00Z',
  updated_by: USER,
  draft: { revision: 1, updated_at: '2026-11-20T10:00:00Z', updated_by: USER, node_count: 0, problem_count: 0 },
};
const NEW_WORKFLOW: NewWorkflow = { name: 'Campanha de vendas' };
const UPDATE: WorkflowUpdate = { name: 'Campanha de vendas 2', objective: null };
const NOT_FOUND = { code: 'not_found', title: 'Não encontrado', status: 404 };

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
 * switch) while the request is in flight. Returns the cache and the spies of what the mutation wrote, invalidated or removed.
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
  const removed = vi.spyOn(queryClient, 'removeQueries');
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
  return { queryClient, written, invalidated, removed };
}

const listsInvalidated = { queryKey: WORKFLOW_LISTS_KEY };

describe('resposta que chega depois de a sessão sair do módulo (workflows)', () => {
  it('sem limpeza, o workflow criado vai para o cache e as listas são buscadas de novo', async () => {
    const { queryClient, invalidated } = await runLate(useCreateWorkflow, NEW_WORKFLOW, OK(WORKFLOW), false);
    expect(queryClient.getQueryData(workflowKey(WORKFLOW_ID))).toEqual(WORKFLOW);
    expect(invalidated).toHaveBeenCalledWith(listsInvalidated);
  });

  it('criar workflow: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useCreateWorkflow, NEW_WORKFLOW, OK(WORKFLOW), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(workflowKey(WORKFLOW_ID))).toBeUndefined();
  });

  it('sem limpeza, o workflow renomeado vai para o cache', async () => {
    const { queryClient, invalidated } = await runLate(useUpdateWorkflow, { id: WORKFLOW_ID, body: UPDATE }, OK(WORKFLOW), false);
    expect(queryClient.getQueryData(workflowKey(WORKFLOW_ID))).toEqual(WORKFLOW);
    expect(invalidated).toHaveBeenCalledWith(listsInvalidated);
  });

  it('renomear workflow: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useUpdateWorkflow, { id: WORKFLOW_ID, body: UPDATE }, OK(WORKFLOW), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(workflowKey(WORKFLOW_ID))).toBeUndefined();
  });

  it('sem limpeza, renomear um workflow que sumiu busca as listas de novo', async () => {
    const { invalidated } = await runLate(useUpdateWorkflow, { id: WORKFLOW_ID, body: UPDATE }, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith(listsInvalidated);
  });

  it('renomear workflow: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(useUpdateWorkflow, { id: WORKFLOW_ID, body: UPDATE }, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, apagar tira o workflow do cache e busca as listas de novo', async () => {
    const { removed, invalidated } = await runLate(useDeleteWorkflow, WORKFLOW_ID, NO_CONTENT, false);
    expect(removed).toHaveBeenCalledWith({ queryKey: workflowKey(WORKFLOW_ID) });
    expect(invalidated).toHaveBeenCalledWith(listsInvalidated);
  });

  it('apagar workflow: a resposta depois da limpeza não remove nem invalida nada', async () => {
    const { removed, invalidated } = await runLate(useDeleteWorkflow, WORKFLOW_ID, NO_CONTENT, true);
    expect(removed).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, apagar um workflow que já sumiu busca as listas de novo', async () => {
    const { invalidated } = await runLate(useDeleteWorkflow, WORKFLOW_ID, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith(listsInvalidated);
  });

  it('apagar workflow: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(useDeleteWorkflow, WORKFLOW_ID, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('resposta que chega depois da troca de tenant (workflows)', () => {
  it('apagar workflow: a resposta depois da troca não remove nem invalida nada', async () => {
    const { removed, invalidated } = await runLate(useDeleteWorkflow, WORKFLOW_ID, NO_CONTENT, 'switch');
    expect(removed).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('apagar workflow: o erro depois da troca não invalida nada', async () => {
    const { invalidated } = await runLate(useDeleteWorkflow, WORKFLOW_ID, FAILURE(404, NOT_FOUND), 'switch');
    expect(invalidated).not.toHaveBeenCalled();
  });
});
