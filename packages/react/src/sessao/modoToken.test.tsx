import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarQueryClient, ErroApi, ProvedorApi, useClienteApi } from '../api';
import { API, json, problema, requisicao, rotasChamadas, sessaoMatriz, simularFetch, type FetchSimulado } from './api.test.apoio';
import type { Sessao } from './useSessao';
import { useSessao } from '.';

let fetchSimulado: FetchSimulado;

beforeEach(() => {
  fetchSimulado = simularFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Outra pessoa, com token do mesmo hospedeiro. */
const sessaoBruno: Sessao = {
  ...sessaoMatriz,
  usuario: { id: '00000000-0000-0000-0000-000000000002', nome: 'Bruno Carvalho', email: 'bruno@exemplo.com' },
  permissoes: ['auditoria.ver'],
};

/** O token de cada sessão, como o back do hospedeiro emitiria. */
const SESSAO_DO_TOKEN: Record<string, Sessao> = {
  'token-ana-1': sessaoMatriz,
  'token-ana-2': { ...sessaoMatriz, permissoes: [...sessaoMatriz.permissoes, 'auditoria.ver'] },
  'token-bruno': sessaoBruno,
};

/** Uma API que responde pelo token do `Authorization`; token desconhecido é token vencido. */
function apiPorToken() {
  fetchSimulado.mockImplementation(async (req) => {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const sessao = SESSAO_DO_TOKEN[token];
    if (!sessao) return problema(401, 'sem_sessao');
    if (new URL(req.url).pathname === '/v1/sessao') return json(sessao);
    return json(`workflows de ${sessao.usuario.nome}`);
  });
}

/** Provedores no modo incorporado: o token vem do hospedeiro e pode ser trocado com `rerender`. */
function renderizarIncorporado<R>(usar: () => R, tokenInicial: string, queryClient: QueryClient = criarQueryClient()) {
  const onSessaoExpirada = vi.fn();
  let tokenAtual = tokenInicial;
  const resultado = renderHook(usar, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ProvedorApi apiUrl={API} token={tokenAtual} onSessaoExpirada={onSessaoExpirada}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ProvedorApi>
    ),
  });
  const trocarToken = (token: string) => {
    tokenAtual = token;
    resultado.rerender();
  };
  return { ...resultado, onSessaoExpirada, queryClient, trocarToken };
}

/** Dado de outra tela, que depende de quem é a pessoa do token (pelo cliente da API, com o token atual). */
function useDadosDaPessoa() {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async ({ signal }) => (await cliente.GET('/v1/usuarios', { signal })).data as unknown as string,
  });
}

describe('useSessao no modo token (incorporado)', () => {
  it('busca a sessão em GET /v1/sessao com Bearer, sem cookie, e responde as permissões do token', async () => {
    apiPorToken();
    const { result } = renderizarIncorporado(() => useSessao(), 'token-ana-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sessaoMatriz);
    expect(result.current.temPermissao('workflows.ver')).toBe(true);
    expect(result.current.temPermissao('auditoria.ver')).toBe(false);
    expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao']);
    const req = requisicao(fetchSimulado);
    expect(req.headers.get('Authorization')).toBe('Bearer token-ana-1');
    expect(req.credentials).toBe('omit');
    expect(req.headers.get('X-CSRF-Token')).toBeNull();
  });

  it('token vencido: chama o onSessaoExpirada uma vez, sem repetir a busca e sem permissões', async () => {
    apiPorToken();
    const { result, onSessaoExpirada } = renderizarIncorporado(() => useSessao(), 'token-vencido');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ErroApi).codigo).toBe('sem_sessao');
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
    expect(result.current.temPermissao('workflows.ver')).toBe(false);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('token que vence com o módulo aberto: a próxima busca recebe sem_sessao e avisa o onSessaoExpirada', async () => {
    apiPorToken();
    const { result, onSessaoExpirada } = renderizarIncorporado(() => useSessao(), 'token-ana-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSessaoExpirada).not.toHaveBeenCalled();

    delete SESSAO_DO_TOKEN['token-ana-1'];
    try {
      await result.current.refetch();
    } finally {
      SESSAO_DO_TOKEN['token-ana-1'] = sessaoMatriz;
    }

    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
  });

  it('token renovado da mesma pessoa: confere a sessão com o token novo, atualiza as permissões e mantém os dados', async () => {
    apiPorToken();
    const { result, trocarToken, onSessaoExpirada } = renderizarIncorporado(
      () => ({ sessao: useSessao(), dados: useDadosDaPessoa() }),
      'token-ana-1',
    );
    await waitFor(() => expect(result.current.dados.data).toBe('workflows de Ana Beatriz'));

    trocarToken('token-ana-2');

    await waitFor(() => expect(result.current.sessao.temPermissao('auditoria.ver')).toBe(true));
    const ultima = requisicao(fetchSimulado, fetchSimulado.mock.calls.length - 1);
    expect(`${ultima.method} ${new URL(ultima.url).pathname}`).toBe('GET /v1/sessao');
    expect(ultima.headers.get('Authorization')).toBe('Bearer token-ana-2');
    // Os dados da mesma pessoa continuam: nada buscado de novo além da sessão.
    expect(result.current.dados.data).toBe('workflows de Ana Beatriz');
    expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao', 'GET /v1/usuarios', 'GET /v1/sessao']);
    expect(onSessaoExpirada).not.toHaveBeenCalled();
  });

  it('token de outra pessoa: os dados da anterior saem da tela e as consultas buscam de novo com o token novo', async () => {
    apiPorToken();
    const telas: string[] = [];
    const { result, trocarToken } = renderizarIncorporado(() => {
      const sessao = useSessao();
      const dados = useDadosDaPessoa();
      telas.push(`${sessao.data?.usuario.nome} | ${dados.data ?? 'carregando'}`);
      return { sessao, dados };
    }, 'token-ana-1');
    await waitFor(() => expect(result.current.dados.data).toBe('workflows de Ana Beatriz'));

    trocarToken('token-bruno');

    await waitFor(() => expect(result.current.dados.data).toBe('workflows de Bruno Carvalho'));
    expect(result.current.sessao.data).toEqual(sessaoBruno);
    expect(result.current.sessao.temPermissao('workflows.ver')).toBe(false);
    const depoisDaTroca = telas.slice(telas.findIndex((tela) => tela.startsWith('Bruno')));
    // Nenhuma renderização mostrou a sessão nova ao lado do dado da pessoa anterior.
    expect(depoisDaTroca.some((tela) => tela.includes('Ana'))).toBe(false);
    expect(depoisDaTroca.at(-1)).toBe('Bruno Carvalho | workflows de Bruno Carvalho');
  });

  it('com várias telas lendo a sessão, a troca de token confere a sessão uma vez só', async () => {
    apiPorToken();
    const { result, trocarToken } = renderizarIncorporado(
      () => ({ menu: useSessao(), tela: useSessao(), outra: useSessao() }),
      'token-ana-1',
    );
    await waitFor(() => expect(result.current.menu.isSuccess).toBe(true));

    trocarToken('token-ana-2');

    await waitFor(() => expect(result.current.tela.temPermissao('auditoria.ver')).toBe(true));
    expect(rotasChamadas(fetchSimulado)).toEqual(['GET /v1/sessao', 'GET /v1/sessao']);
  });

  it('token novo já vencido: avisa o onSessaoExpirada', async () => {
    apiPorToken();
    const { result, trocarToken, onSessaoExpirada } = renderizarIncorporado(() => useSessao(), 'token-ana-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    trocarToken('token-vencido');

    await waitFor(() => expect(onSessaoExpirada).toHaveBeenCalledTimes(1));
    expect(requisicao(fetchSimulado, 1).headers.get('Authorization')).toBe('Bearer token-vencido');
  });
});
