import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData, replaceSessionInCache, type Session } from '../../session';
import { SECURITY_KEY, useUpdateSecuritySettings, type SecuritySettings, type SecuritySettingsUpdate } from './queries';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const UPDATE: SecuritySettingsUpdate = {
  inactivity_minutes: 480,
  max_duration_days: 7,
  min_password_length: 12,
  link_validity_hours: 24,
  token_validity_minutes: 15,
};
const parameter = (value: number) => ({ value, default: value, min: 1, max: 1000 });
const SETTINGS: SecuritySettings = {
  inactivity_minutes: parameter(480),
  max_duration_days: parameter(7),
  min_password_length: parameter(12),
  link_validity_hours: parameter(24),
  token_validity_minutes: parameter(15),
};
const OUT_OF_RANGE = { code: 'value_out_of_range', title: 'Valor fora do limite', status: 422 };

interface Reply {
  status: number;
  body: unknown;
}

/** The API answers only when the test calls `release`: the request is "in flight" meanwhile. */
function lateApi(reply: Reply) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const simulatedFetch = vi.fn(async () => {
    await gate;
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
 * Runs the save with an answer that arrives late. With `clearBefore`, the session data is cleared (sign-out, 401, tenant
 * switch) while the request is in flight. Returns the cache and the spies of what the mutation wrote or invalidated.
 */
async function runLate(reply: Reply, clearBefore: boolean | 'switch') {
  const queryClient = new QueryClient();
  const written = vi.spyOn(queryClient, 'setQueryData');
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
  const api = lateApi(reply);
  const wrapper = ({ children }: { children: ReactNode }) =>
    h(ApiProvider, { apiUrl: 'http://127.0.0.1:8000', children: h(QueryClientProvider, { client: queryClient }, children) });
  const { result } = renderHook(useUpdateSecuritySettings, { wrapper });
  let done: Promise<unknown> = Promise.resolve();
  act(() => {
    done = result.current.mutateAsync(UPDATE).catch(() => undefined);
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

describe('resposta que chega depois de a sessão sair do módulo (segurança)', () => {
  it('sem limpeza, a resposta do salvamento vai para o cache', async () => {
    const { queryClient } = await runLate({ status: 200, body: SETTINGS }, false);
    expect(queryClient.getQueryData(SECURITY_KEY)).toEqual(SETTINGS);
  });

  it('salvar os parâmetros: a resposta depois da limpeza não grava nada no cache', async () => {
    const { queryClient, written, invalidated } = await runLate({ status: 200, body: SETTINGS }, true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(SECURITY_KEY)).toBeUndefined();
  });

  it('sem limpeza, valor fora do limite busca os parâmetros de novo', async () => {
    const { invalidated } = await runLate({ status: 422, body: OUT_OF_RANGE }, false);
    expect(invalidated).toHaveBeenCalledWith({ queryKey: SECURITY_KEY });
  });

  it('valor fora do limite depois da limpeza: não invalida nada', async () => {
    const { invalidated } = await runLate({ status: 422, body: OUT_OF_RANGE }, true);
    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('resposta que chega depois da troca de tenant (segurança)', () => {
  it('salvar os parâmetros: a resposta depois da troca não grava nada no cache', async () => {
    const { queryClient, written, invalidated } = await runLate({ status: 200, body: SETTINGS }, 'switch');
    // The switch itself writes the new session; nothing else may be written.
    expect(written.mock.calls.filter(([key]) => key[0] !== 'session')).toEqual([]);
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(SECURITY_KEY)).toBeUndefined();
  });

  it('valor fora do limite depois da troca: não invalida nada', async () => {
    const { invalidated } = await runLate({ status: 422, body: OUT_OF_RANGE }, 'switch');
    expect(invalidated).not.toHaveBeenCalled();
  });
});
