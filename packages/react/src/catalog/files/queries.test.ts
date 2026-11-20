import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement as h, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../../api';
import { clearSessionData } from '../../session';
import { fileOf, simulateUploads } from './files.test-support';
import { fileKey, useUploadExcelFile } from './queries';

const FILE_ID = '60000000-0000-0000-0000-000000000001';

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

describe('resposta que chega depois de a sessão sair do módulo (arquivos)', () => {
  it('sem limpeza, o arquivo enviado vai para o cache', async () => {
    const { queryClient, upload, finish } = await startUpload(false);
    upload.respond(201, { id: FILE_ID });
    await finish();
    expect(queryClient.getQueryData(fileKey(FILE_ID))).toEqual({ id: FILE_ID });
  });

  it('envio que termina bem depois da limpeza: não grava o arquivo, o resultado nem invalida o catálogo', async () => {
    const { queryClient, written, invalidated, upload, finish } = await startUpload(true);
    act(() => clearSessionData(queryClient));
    upload.respond(201, { id: FILE_ID });
    await finish();
    expect(written).not.toHaveBeenCalled();
    expect(invalidated).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('envio que falha depois da limpeza: não grava o resultado de erro', async () => {
    const { queryClient, written, upload, finish } = await startUpload(true);
    act(() => clearSessionData(queryClient));
    upload.respond(500, { code: 'unexpected', title: 'Erro', status: 500 });
    await finish();
    expect(written).not.toHaveBeenCalled();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
