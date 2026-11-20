import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData } from '../../session';
import { useRememberedValues } from './memory';
import { API, WORKFLOW_ID, session, simulateApi, testQueryClient } from './unit-run.test-support';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The module's QueryClient with a session, and the "Calcular" tab of a workflow opened (or opened again) on it. */
function moduleWithSession() {
  simulateApi();
  const queryClient = testQueryClient();
  queryClient.setQueryData(['session'], session());
  const wrapper = ({ children }: { children: ReactNode }) =>
    h(ApiProvider, { apiUrl: API, children: h(QueryClientProvider, { client: queryClient }, children) });
  const openTab = () => renderHook(() => useRememberedValues(WORKFLOW_ID), { wrapper });
  return { queryClient, openTab };
}

describe('valores lembrados do Calcular', () => {
  it('ficam ao fechar e abrir a aba de novo, na mesma sessão', () => {
    const { openTab } = moduleWithSession();
    const first = openTab();
    act(() => first.result.current[1]((current) => ({ ...current, valor_item: '10,5' })));
    first.unmount();

    expect(openTab().result.current[0]).toEqual({ valor_item: '10,5' });
  });

  it('são esquecidos quando os dados da sessão saem do módulo (logout, 401, troca de tenant, outra pessoa)', () => {
    const { queryClient, openTab } = moduleWithSession();
    const first = openTab();
    act(() => first.result.current[1]((current) => ({ ...current, valor_item: '10,5' })));
    first.unmount();

    act(() => clearSessionData(queryClient));
    // The same person signs in again in the same module: nothing typed before stays.
    queryClient.setQueryData(['session'], session());

    expect(openTab().result.current[0]).toEqual({});
  });
});
