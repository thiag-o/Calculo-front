import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData, replaceSessionInCache, type Session } from '../../session';
import {
  DATASET_CONNECTIONS_KEY,
  DATASETS_KEY,
  datasetKey,
  useCreateDataset,
  useCreateVariable,
  useDeleteDataset,
  useDeleteVariable,
  useRefreshDatasetColumns,
  useRenameDataset,
  useUpdateVariable,
  variablesKey,
  type Dataset,
  type NewDataset,
  type NewVariable,
  type Variable,
  type VariableUpdate,
} from './queries';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ID = '50000000-0000-0000-0000-000000000001';
const VARIABLE_ID = '50000000-0000-0000-0000-0000000000a1';
const NEW_DATASET: NewDataset = {
  type: 'table',
  name: 'Vendas',
  connection_id: '40000000-0000-0000-0000-000000000001',
  schema_name: 'public',
  object_name: 'vendas',
};
const DATASET: Dataset = {
  id: ID,
  name: 'Vendas',
  type: 'table',
  connection_id: NEW_DATASET.connection_id,
  schema_name: 'public',
  object_name: 'vendas',
  sql: null,
  excel_file_id: null,
  sheet: null,
  columns: [{ name: 'valor', source_type: 'numeric', type: 'decimal', scale: 2, nullable: false }],
  columns_refreshed_at: '2026-11-20T10:00:00Z',
};
const VARIABLE: Variable = { id: VARIABLE_ID, dataset_id: ID, column: 'valor', name: 'Valor', type: 'decimal', scale: 2 };
const NEW_VARIABLE: NewVariable = { column: 'valor', name: 'Valor', type: 'decimal', scale: 2 };
const VARIABLE_UPDATE: VariableUpdate = { name: 'Valor bruto', type: 'decimal', scale: 2 };
const NOT_FOUND = { code: 'not_found', title: 'Não encontrado', status: 404 };
const CONNECTION_GONE = { code: 'invalid_data', title: 'Dados inválidos', status: 422, fields: { connection_id: 'A conexão não existe.' } };
const UNKNOWN_COLUMN = { code: 'unknown_column', title: 'Coluna desconhecida', status: 422 };

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
 * switch) while the request is in flight. `seed` fills the cache before the request. Returns the cache and the spies of
 * what the mutation wrote or invalidated.
 */
async function runLate<V>(
  useHook: () => { mutateAsync: (variables: V) => Promise<unknown> },
  variables: V,
  reply: Reply,
  clearBefore: boolean | 'switch',
  seed?: (queryClient: QueryClient) => void,
) {
  const queryClient = new QueryClient();
  seed?.(queryClient);
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

const catalogInvalidated = expect.objectContaining({ queryKey: ['catalog'] });
const seedVariables = (queryClient: QueryClient) => queryClient.setQueryData(variablesKey(ID), { items: [] });

describe('resposta que chega depois de a sessão sair do módulo (datasets)', () => {
  it('sem limpeza, o dataset criado vai para o cache e o catálogo é buscado de novo', async () => {
    const { queryClient, invalidated } = await runLate(useCreateDataset, NEW_DATASET, OK(DATASET), false);
    expect(queryClient.getQueryData(datasetKey(ID))).toEqual(DATASET);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('criar dataset: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useCreateDataset, NEW_DATASET, OK(DATASET), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(datasetKey(ID))).toBeUndefined();
  });

  it('sem limpeza, escolher uma conexão que sumiu busca as conexões do seletor de novo', async () => {
    const { invalidated } = await runLate(useCreateDataset, NEW_DATASET, FAILURE(422, CONNECTION_GONE), false);
    expect(invalidated).toHaveBeenCalledWith({ queryKey: DATASET_CONNECTIONS_KEY });
  });

  it('criar dataset: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(useCreateDataset, NEW_DATASET, FAILURE(422, CONNECTION_GONE), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, o dataset renomeado vai para o cache', async () => {
    const { queryClient, invalidated } = await runLate(useRenameDataset, { id: ID, name: 'Novo' }, OK(DATASET), false);
    expect(queryClient.getQueryData(datasetKey(ID))).toEqual(DATASET);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('renomear dataset: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useRenameDataset, { id: ID, name: 'Novo' }, OK(DATASET), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(datasetKey(ID))).toBeUndefined();
  });

  it('sem limpeza, as colunas atualizadas vão para o cache', async () => {
    const { queryClient, invalidated } = await runLate(useRefreshDatasetColumns, ID, OK(DATASET), false);
    expect(queryClient.getQueryData(datasetKey(ID))).toEqual(DATASET);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('atualizar colunas: a resposta depois da limpeza não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useRefreshDatasetColumns, ID, OK(DATASET), true);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(datasetKey(ID))).toBeUndefined();
  });

  it('sem limpeza, apagar o dataset busca o catálogo de novo, sem o detalhe apagado', async () => {
    const { queryClient, invalidated } = await runLate(useDeleteDataset, ID, NO_CONTENT, false);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
    // The predicate keeps the deleted detail out of the refetch.
    const call = invalidated.mock.calls[0]?.[0];
    const queryOf = (queryKey: readonly unknown[]) => queryClient.getQueryCache().build(queryClient, { queryKey });
    expect(call?.predicate?.(queryOf(datasetKey(ID)))).toBe(false);
    expect(call?.predicate?.(queryOf([...DATASETS_KEY, 'list']))).toBe(true);
  });

  it('apagar dataset: a resposta depois da limpeza não invalida nada', async () => {
    const { queryClient, invalidated } = await runLate(useDeleteDataset, ID, NO_CONTENT, true);
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(datasetKey(ID))).toBeUndefined();
  });

  it('sem limpeza, a variável criada entra na lista do cache e o catálogo é buscado de novo', async () => {
    const { queryClient, invalidated } = await runLate(() => useCreateVariable(ID), NEW_VARIABLE, OK(VARIABLE), false, seedVariables);
    expect(queryClient.getQueryData(variablesKey(ID))).toEqual({ items: [VARIABLE] });
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('criar variável: a resposta depois da limpeza não grava a lista nem invalida o catálogo', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useCreateVariable(ID), NEW_VARIABLE, OK(VARIABLE), true, seedVariables);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(variablesKey(ID))).toBeUndefined();
  });

  it('sem limpeza, coluna desconhecida busca o dataset de novo', async () => {
    const { invalidated } = await runLate(() => useCreateVariable(ID), NEW_VARIABLE, FAILURE(422, UNKNOWN_COLUMN), false);
    expect(invalidated).toHaveBeenCalledWith({ queryKey: datasetKey(ID), exact: true });
  });

  it('criar variável: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useCreateVariable(ID), NEW_VARIABLE, FAILURE(422, UNKNOWN_COLUMN), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, a variável editada troca na lista do cache', async () => {
    const edited: Variable = { ...VARIABLE, name: 'Valor bruto' };
    const { queryClient, invalidated } = await runLate(
      () => useUpdateVariable(ID),
      { id: VARIABLE_ID, body: VARIABLE_UPDATE },
      OK(edited),
      false,
      (client) => client.setQueryData(variablesKey(ID), { items: [VARIABLE] }),
    );
    expect(queryClient.getQueryData(variablesKey(ID))).toEqual({ items: [edited] });
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('editar variável: a resposta depois da limpeza não grava a lista nem invalida o catálogo', async () => {
    const { queryClient, written, invalidated } = await runLate(
      () => useUpdateVariable(ID),
      { id: VARIABLE_ID, body: VARIABLE_UPDATE },
      OK(VARIABLE),
      true,
      seedVariables,
    );
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(variablesKey(ID))).toBeUndefined();
  });

  it('sem limpeza, editar uma variável que sumiu busca a lista de novo', async () => {
    const { invalidated } = await runLate(() => useUpdateVariable(ID), { id: VARIABLE_ID, body: VARIABLE_UPDATE }, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith({ queryKey: variablesKey(ID) });
  });

  it('editar variável: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useUpdateVariable(ID), { id: VARIABLE_ID, body: VARIABLE_UPDATE }, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, apagar a variável tira da lista do cache e busca o catálogo de novo', async () => {
    const { queryClient, invalidated } = await runLate(() => useDeleteVariable(ID), VARIABLE_ID, NO_CONTENT, false, (client) =>
      client.setQueryData(variablesKey(ID), { items: [VARIABLE] }),
    );
    expect(queryClient.getQueryData(variablesKey(ID))).toEqual({ items: [] });
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('apagar variável: a resposta depois da limpeza não mexe na lista nem invalida o catálogo', async () => {
    const { queryClient, written, invalidated } = await runLate(() => useDeleteVariable(ID), VARIABLE_ID, NO_CONTENT, true, seedVariables);
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(variablesKey(ID))).toBeUndefined();
  });

  it('sem limpeza, apagar uma variável que já sumiu busca a lista de novo', async () => {
    const { invalidated } = await runLate(() => useDeleteVariable(ID), VARIABLE_ID, FAILURE(404, NOT_FOUND), false);
    expect(invalidated).toHaveBeenCalledWith({ queryKey: variablesKey(ID) });
  });

  it('apagar variável: o erro depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(() => useDeleteVariable(ID), VARIABLE_ID, FAILURE(404, NOT_FOUND), true);
    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('resposta que chega depois da troca de tenant (datasets)', () => {
  it('apagar o dataset: a resposta depois da troca não invalida nada', async () => {
    const { invalidated } = await runLate(useDeleteDataset, ID, NO_CONTENT, 'switch');
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('atualizar colunas: a resposta depois da troca não grava nem invalida nada', async () => {
    const { queryClient, written, invalidated } = await runLate(useRefreshDatasetColumns, ID, OK(DATASET), 'switch');
    // The switch itself writes the new session; nothing else may be written.
    expect(written.mock.calls.filter(([key]) => key[0] !== 'session')).toEqual([]);
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(datasetKey(ID))).toBeUndefined();
  });
});
