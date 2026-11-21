import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData, replaceSessionInCache } from '../../session';
import { useLastUnitRun } from './lastRun';
import { API, RUN_ERROR, RUN_OK, RUN_ROUTE, WORKFLOW_ID, json, renderTab, session, simulateApi, type SimulatedApi } from './unit-run.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** What the canvas reads: the last run of the workflow, on the module's QueryClient. */
function readLastRun(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider apiUrl={API}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiProvider>
  );
  return renderHook(() => useLastUnitRun(WORKFLOW_ID), { wrapper });
}

async function calculate(user: ReturnType<typeof renderTab>['user']) {
  await user.click(screen.getByRole('button', { name: 'Calcular' }));
  await screen.findByRole('heading', { name: 'Resultado' });
}

describe('último cálculo em memória', () => {
  it('guarda o trace, a revisão e a definição que rodou, e fica depois de fechar a aba', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user, queryClient, unmount } = renderTab();
    await calculate(user);
    unmount();

    const { result } = readLastRun(queryClient);
    expect(result.current.lastRun?.trace).toEqual(RUN_OK);
    expect(result.current.lastRun?.revision).toBe(3);
    expect(result.current.lastRun?.definition.root.nodes.map((node) => node.id)).toContain('calc_pontos');
  });

  it('o cálculo seguinte toma o lugar do anterior', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK), json(RUN_ERROR));
    const { user, queryClient } = renderTab();
    const { result } = readLastRun(queryClient);
    await calculate(user);
    expect(result.current.lastRun?.trace.status).toBe('ok');

    await user.click(screen.getByRole('button', { name: 'Calcular' }));
    await waitFor(() => expect(result.current.lastRun?.trace.status).toBe('error'));
  });

  it('Limpar esquece o cálculo, mas não um mais novo que tomou o lugar dele', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK), json(RUN_ERROR));
    const { user, queryClient } = renderTab();
    const { result } = readLastRun(queryClient);
    await calculate(user);
    const first = result.current.lastRun!;

    await user.click(screen.getByRole('button', { name: 'Calcular' }));
    await waitFor(() => expect(result.current.lastRun).not.toBe(first));
    act(() => result.current.clear(first));
    expect(result.current.lastRun?.trace.status).toBe('error');

    act(() => result.current.clear(result.current.lastRun!));
    expect(result.current.lastRun).toBeNull();
  });

  it('é esquecido quando os dados da sessão saem do módulo (logout, 401, troca de tenant, outra pessoa)', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user, queryClient } = renderTab();
    const { result } = readLastRun(queryClient);
    await calculate(user);
    expect(result.current.lastRun).not.toBeNull();

    act(() => clearSessionData(queryClient));
    queryClient.setQueryData(['session'], session());
    expect(result.current.lastRun).toBeNull();
  });

  it('uma resposta que chega depois que os dados da sessão saíram não é guardada', async () => {
    let answer: (response: Response) => void = () => {};
    api.respond(RUN_ROUTE, () => new Promise<Response>((resolve) => (answer = resolve)));
    const { user, queryClient } = renderTab();
    await user.click(screen.getByRole('button', { name: 'Calcular' }));
    await waitFor(() => expect(api.bodiesTo(RUN_ROUTE)).toHaveLength(1));

    act(() => clearSessionData(queryClient));
    queryClient.setQueryData(['session'], session());
    await act(async () => answer(json(RUN_OK)));

    expect(readLastRun(queryClient).result.current.lastRun).toBeNull();
  });

  it('na troca de tenant, o cálculo do tenant anterior não aparece', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user, queryClient, unmount } = renderTab();
    const { result } = readLastRun(queryClient);
    await calculate(user);
    expect(result.current.lastRun).not.toBeNull();
    // The editor starts over in the new tenant (useSessionGeneration); the tab of the previous one is gone.
    unmount();

    const other = { id: '20000000-0000-0000-0000-000000000002', name: 'Outra Distribuidora' };
    await act(() => replaceSessionInCache(queryClient, { ...session(), tenants: [...session().tenants, other], current_tenant: other }));
    expect(result.current.lastRun).toBeNull();
  });

});
