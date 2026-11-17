import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataOrError, ApiError } from './apiError';
import { ApiProvider, useApiClient } from './ApiProvider';

const API = 'https://api.teste';

let simulatedFetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;

beforeEach(() => {
  simulatedFetch = vi.fn<(request: Request) => Promise<Response>>();
  vi.stubGlobal('fetch', simulatedFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Sample component: asks for the session and shows the name or the error code. */
function SessionName() {
  const client = useApiClient();
  const [text, setText] = useState('carregando');
  useEffect(() => {
    dataOrError(client.GET('/v1/sessao')).then(
      (session) => setText(session.usuario.nome),
      (error: unknown) => setText(error instanceof ApiError ? error.code : 'erro'),
    );
  }, [client]);
  return <p>{text}</p>;
}

const session = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana', email: 'ana@exemplo.com' },
  tenants: [],
  tenant_atual: { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' },
  permissoes: [],
};

describe('ApiProvider', () => {
  it('entrega aos filhos o cliente apontado para o apiUrl', async () => {
    simulatedFetch.mockResolvedValue(new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    render(
      <ApiProvider apiUrl={API}>
        <SessionName />
      </ApiProvider>,
    );

    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(simulatedFetch.mock.calls[0]?.[0].url).toBe(`${API}/v1/sessao`);
  });

  it('chama onSessionExpired quando a API responde 401 sem_sessao', async () => {
    simulatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ title: 'Sem sessão', status: 401, detail: 'Entre de novo.', codigo: 'sem_sessao' }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );
    const onSessionExpired = vi.fn();

    render(
      <ApiProvider apiUrl={API} token="tok-vencido" onSessionExpired={onSessionExpired}>
        <SessionName />
      </ApiProvider>,
    );

    expect(await screen.findByText('sem_sessao')).toBeTruthy();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('usa o token mais recente quando o hospedeiro renova o token', async () => {
    simulatedFetch.mockImplementation(async () => new Response(null, { status: 204 }));
    let currentToken = 'tok-1';
    const { result, rerender } = renderHook(() => useApiClient(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiProvider apiUrl={API} token={currentToken}>
          {children}
        </ApiProvider>
      ),
    });
    await result.current.DELETE('/v1/sessao');

    currentToken = 'tok-2';
    rerender();
    await result.current.DELETE('/v1/sessao');

    await waitFor(() => expect(simulatedFetch).toHaveBeenCalledTimes(2));
    expect(simulatedFetch.mock.calls[0]?.[0].headers.get('Authorization')).toBe('Bearer tok-1');
    expect(simulatedFetch.mock.calls[1]?.[0].headers.get('Authorization')).toBe('Bearer tok-2');
  });

  it('useApiClient fora do provedor explica o erro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useApiClient())).toThrow('useApiClient precisa estar dentro de <ApiProvider>.');
    vi.mocked(console.error).mockRestore();
  });
});
