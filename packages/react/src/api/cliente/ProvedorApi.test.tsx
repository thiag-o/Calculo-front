import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dadosOuErro, ErroApi } from './erroApi';
import { ProvedorApi, useClienteApi } from './ProvedorApi';

const API = 'https://api.teste';

let fetchSimulado: ReturnType<typeof vi.fn<(requisicao: Request) => Promise<Response>>>;

beforeEach(() => {
  fetchSimulado = vi.fn<(requisicao: Request) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Componente de exemplo: pede a sessão e mostra o nome ou o código do erro. */
function NomeDaSessao() {
  const cliente = useClienteApi();
  const [texto, setTexto] = useState('carregando');
  useEffect(() => {
    dadosOuErro(cliente.GET('/v1/sessao')).then(
      (sessao) => setTexto(sessao.usuario.nome),
      (erro: unknown) => setTexto(erro instanceof ErroApi ? erro.codigo : 'erro'),
    );
  }, [cliente]);
  return <p>{texto}</p>;
}

const sessao = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana', email: 'ana@exemplo.com' },
  tenants: [],
  tenant_atual: { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' },
  permissoes: [],
};

describe('ProvedorApi', () => {
  it('entrega aos filhos o cliente apontado para o apiUrl', async () => {
    fetchSimulado.mockResolvedValue(new Response(JSON.stringify(sessao), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    render(
      <ProvedorApi apiUrl={API}>
        <NomeDaSessao />
      </ProvedorApi>,
    );

    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(fetchSimulado.mock.calls[0]?.[0].url).toBe(`${API}/v1/sessao`);
  });

  it('chama onSessaoExpirada quando a API responde 401 sem_sessao', async () => {
    fetchSimulado.mockResolvedValue(
      new Response(JSON.stringify({ title: 'Sem sessão', status: 401, detail: 'Entre de novo.', codigo: 'sem_sessao' }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );
    const onSessaoExpirada = vi.fn();

    render(
      <ProvedorApi apiUrl={API} token="tok-vencido" onSessaoExpirada={onSessaoExpirada}>
        <NomeDaSessao />
      </ProvedorApi>,
    );

    expect(await screen.findByText('sem_sessao')).toBeTruthy();
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
  });

  it('usa o token mais recente quando o hospedeiro renova o token', async () => {
    fetchSimulado.mockImplementation(async () => new Response(null, { status: 204 }));
    let tokenAtual = 'tok-1';
    const { result, rerender } = renderHook(() => useClienteApi(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ProvedorApi apiUrl={API} token={tokenAtual}>
          {children}
        </ProvedorApi>
      ),
    });
    await result.current.DELETE('/v1/sessao');

    tokenAtual = 'tok-2';
    rerender();
    await result.current.DELETE('/v1/sessao');

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(2));
    expect(fetchSimulado.mock.calls[0]?.[0].headers.get('Authorization')).toBe('Bearer tok-1');
    expect(fetchSimulado.mock.calls[1]?.[0].headers.get('Authorization')).toBe('Bearer tok-2');
  });

  it('useClienteApi fora do provedor explica o erro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useClienteApi())).toThrow('useClienteApi precisa estar dentro de <ProvedorApi>.');
    vi.mocked(console.error).mockRestore();
  });
});
