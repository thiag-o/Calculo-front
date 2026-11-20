import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider, createApiClient, type Schemas } from '../../api';
import { clearSessionData, useSwitchTenant, type Session } from '../../session';
import { workflowDraftKey } from '../../workflows';
import {
  API,
  DRAFT,
  DRAFT_ROUTE,
  EDITOR_PERMISSIONS,
  SAVE_ROUTE,
  draftWith,
  json,
  pendingResponse,
  session,
  setCsrfCookie,
  simulateApi,
  testQueryClient,
} from './editor.test-support';
import { fetchDraftAgain, saveDraft } from './queries';

const BRANCH_TENANT = { id: '20000000-0000-0000-0000-000000000002', name: 'Filial Sul' };
/** Ana in another tenant, after "Trocar de cliente" (the PUT answer). */
const branchSession: Session = {
  ...session(EDITOR_PERMISSIONS),
  tenants: [session(EDITOR_PERMISSIONS).current_tenant, BRANCH_TENANT],
  current_tenant: BRANCH_TENANT,
};

const SAVED: Schemas['Draft'] = draftWith({ revision: 4, expression: 'valor_item * 7' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

/** The module's QueryClient with Ana's session, and "Trocar de cliente" as the shell runs it. */
function moduleWithSession() {
  const queryClient = testQueryClient();
  queryClient.setQueryData(['session'], session(EDITOR_PERMISSIONS));
  const wrapper = ({ children }: { children: ReactNode }) =>
    h(ApiProvider, { apiUrl: API, children: h(QueryClientProvider, { client: queryClient }, children) });
  const switchTenant = renderHook(() => useSwitchTenant(), { wrapper });
  return { queryClient, switchTenant: () => act(() => switchTenant.result.current.mutateAsync(BRANCH_TENANT.id)) };
}

function save(queryClient: QueryClient) {
  return saveDraft(queryClient, createApiClient({ apiUrl: API }), DRAFT.workflow_id, { revision: 3, definition: SAVED.definition });
}

const draftKeyInCache = (queryClient: QueryClient) =>
  queryClient.getQueryCache().find({ queryKey: workflowDraftKey(DRAFT.workflow_id), exact: true }) !== undefined;

describe('resposta que chega depois de a sessão sair do módulo', () => {
  it('um salvamento em voo na troca de tenant responde depois e não grava o rascunho no cache do tenant novo', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi();
    const late = pendingResponse(() => json(SAVED));
    api.respond(SAVE_ROUTE, late.promise);
    api.respond('PUT /v1/session/tenant', json(branchSession));
    const { queryClient, switchTenant } = moduleWithSession();

    const saving = save(queryClient);
    await vi.waitFor(() => expect(api.calledTimes(SAVE_ROUTE)).toBe(1));
    await switchTenant();
    expect(queryClient.getQueryData(['session'])).toEqual(branchSession);

    late.release();
    // The editor that saved still gets the answer (it is gone from the screen); the cache does not.
    expect(await saving).toEqual(SAVED);
    expect(draftKeyInCache(queryClient)).toBe(false);
    expect(queryClient.getQueryCache().getAll().map((query) => query.queryKey)).toEqual([['session']]);
  });

  it('um salvamento em voo no logout ou no 401 responde depois da limpeza e o cache continua vazio', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi();
    const late = pendingResponse(() => json(SAVED));
    api.respond(SAVE_ROUTE, late.promise);
    const { queryClient } = moduleWithSession();

    const saving = save(queryClient);
    await vi.waitFor(() => expect(api.calledTimes(SAVE_ROUTE)).toBe(1));
    act(() => clearSessionData(queryClient));

    late.release();
    await saving;
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('uma leitura do rascunho em voo na limpeza não grava a resposta antiga no cache', async () => {
    const api = simulateApi();
    const late = pendingResponse(() => json(DRAFT));
    api.respond(DRAFT_ROUTE, late.promise, json(SAVED));
    const { queryClient } = moduleWithSession();

    const reading = fetchDraftAgain(queryClient, createApiClient({ apiUrl: API }), DRAFT.workflow_id).catch(() => null);
    await vi.waitFor(() => expect(api.calledTimes(DRAFT_ROUTE)).toBe(1));
    act(() => clearSessionData(queryClient));

    late.release();
    await reading;
    expect(draftKeyInCache(queryClient)).toBe(false);
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('com a mesma sessão, o salvamento grava o rascunho no cache como sempre', async () => {
    setCsrfCookie('csrf-123');
    const api = simulateApi();
    api.respond(SAVE_ROUTE, json(SAVED));
    const { queryClient } = moduleWithSession();

    await save(queryClient);

    expect(queryClient.getQueryData(workflowDraftKey(DRAFT.workflow_id))).toEqual(SAVED);
  });
});
