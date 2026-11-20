import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData, replaceSessionInCache, type Session } from '../../session';
import { EXCEL_FILE, SHEET_DATASET, fileOf, simulateUploads } from './files.test-support';
import { FILES_KEY, fileKey, useCreateSheetDataset, useDeleteExcelFile, useUploadExcelFile } from './queries';

const FILE_ID = EXCEL_FILE.id;
const SHEET_REQUEST = { fileId: FILE_ID, sheet: 'Vendas', name: 'Vendas' };
const NOT_FOUND = { code: 'not_found', title: 'Não encontrado', status: 404 };
const UNEXPECTED = { code: 'unexpected', title: 'Erro', status: 500 };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** An upload in flight (XMLHttpRequest simulated); the test decides when and how the API answers. */
async function startUpload(unmountAfterStart: boolean) {
  const uploads = simulateUploads();
  const queryClient = new QueryClient();
  const written = vi.spyOn(queryClient, 'setQueryData');
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    h(ApiProvider, { apiUrl: 'http://127.0.0.1:8000', children: h(QueryClientProvider, { client: queryClient }, children) });
  const { result, unmount } = renderHook(() => useUploadExcelFile(), { wrapper });
  let done: Promise<unknown> = Promise.resolve();
  act(() => {
    done = result.current.mutateAsync(fileOf('clientes.xlsx')).catch(() => undefined);
  });
  const upload = await uploads.nth(1);
  // The screen that started the upload left: the mutation's own callbacks still run (they write the outcome).
  if (unmountAfterStart) unmount();
  return { queryClient, written, invalidated, upload, finish: () => act(async () => void (await done)) };
}

interface Reply {
  status: number;
  body?: unknown;
}

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
 * switch) while the request is in flight. `seed` fills the cache before the request.
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
  return { queryClient, invalidated, removed };
}

const catalogInvalidated = expect.objectContaining({ queryKey: ['catalog'] });

describe('resposta que chega depois de a sessão sair do módulo (arquivos)', () => {
  it('sem limpeza, o arquivo enviado vai para o cache e o catálogo é buscado de novo', async () => {
    const { queryClient, invalidated, upload, finish } = await startUpload(false);
    upload.respond(201, EXCEL_FILE);
    await finish();
    expect(queryClient.getQueryData(fileKey(FILE_ID))).toEqual(EXCEL_FILE);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('envio que termina bem depois da limpeza: não grava o arquivo, o resultado nem invalida o catálogo', async () => {
    const { queryClient, written, invalidated, upload, finish } = await startUpload(true);
    act(() => clearSessionData(queryClient));
    upload.respond(201, EXCEL_FILE);
    await finish();
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(fileKey(FILE_ID))).toBeUndefined();
  });

  it('sem limpeza, o envio que falha com a tela fechada guarda o resultado de erro', async () => {
    const { written, upload, finish } = await startUpload(true);
    upload.respond(500, UNEXPECTED);
    await finish();
    expect(written).toHaveBeenCalledTimes(1);
    expect(written.mock.calls[0]?.[1]).toMatchObject({ status: 'error', fileName: 'clientes.xlsx' });
  });

  it('envio que falha depois da limpeza: não grava o resultado de erro', async () => {
    const { queryClient, written, invalidated, upload, finish } = await startUpload(true);
    act(() => clearSessionData(queryClient));
    upload.respond(500, UNEXPECTED);
    await finish();
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().find({ queryKey: FILES_KEY })).toBeUndefined();
  });

  it('sem limpeza, o dataset criado da planilha busca o catálogo de novo, sem o que não mudou', async () => {
    const { invalidated } = await runLate(useCreateSheetDataset, SHEET_REQUEST, { status: 200, body: SHEET_DATASET }, false);
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('criar dataset da planilha: a resposta depois da limpeza não invalida nada', async () => {
    const { invalidated } = await runLate(useCreateSheetDataset, SHEET_REQUEST, { status: 200, body: SHEET_DATASET }, true);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('sem limpeza, apagar o arquivo tira o detalhe do cache e busca o catálogo de novo', async () => {
    const { invalidated, removed } = await runLate(useDeleteExcelFile, FILE_ID, { status: 204 }, false);
    expect(removed).toHaveBeenCalledWith({ queryKey: fileKey(FILE_ID) });
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('apagar arquivo: a resposta depois da limpeza não remove nem invalida nada', async () => {
    const { invalidated, removed } = await runLate(useDeleteExcelFile, FILE_ID, { status: 204 }, true);
    expect(removed).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('apagar arquivo que já sumiu: não remove nem invalida (sem limpeza)', async () => {
    const { invalidated, removed } = await runLate(useDeleteExcelFile, FILE_ID, { status: 404, body: NOT_FOUND }, false);
    expect(removed).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('resposta que chega depois da troca de tenant (arquivos)', () => {
  it('criar dataset da planilha: a resposta depois da troca não invalida nada', async () => {
    const { invalidated } = await runLate(useCreateSheetDataset, SHEET_REQUEST, { status: 200, body: SHEET_DATASET }, 'switch');
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('envio que termina bem depois da troca: não grava o arquivo nem invalida o catálogo', async () => {
    const { queryClient, written, invalidated, upload, finish } = await startUpload(true);
    await act(() => replaceSessionInCache(queryClient, OTHER_TENANT_SESSION));
    upload.respond(201, EXCEL_FILE);
    await finish();
    // The switch itself writes the new session; nothing else may be written.
    expect(written.mock.calls.filter(([key]) => key[0] !== 'session')).toEqual([]);
    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('envio cancelado (arquivos)', () => {
  it('sem limpeza, o cancelamento busca o catálogo de novo (o arquivo pode ter chegado ao servidor)', async () => {
    const { invalidated, upload, finish } = await startUpload(false);
    act(() => upload.abort());
    await finish();
    expect(invalidated).toHaveBeenCalledWith(catalogInvalidated);
  });

  it('cancelamento depois da limpeza: não invalida o catálogo', async () => {
    const { queryClient, invalidated, upload, finish } = await startUpload(false);
    act(() => clearSessionData(queryClient));
    act(() => upload.abort());
    await finish();
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('cancelamento depois da troca de tenant: não invalida o catálogo', async () => {
    const { queryClient, invalidated, upload, finish } = await startUpload(false);
    await act(() => replaceSessionInCache(queryClient, OTHER_TENANT_SESSION));
    act(() => upload.abort());
    await finish();
    expect(invalidated).not.toHaveBeenCalled();
  });
});
