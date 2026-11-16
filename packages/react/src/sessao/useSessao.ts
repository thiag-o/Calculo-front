import { useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { dadosOuErro, useClienteApi, type ClienteApi } from '../api';
import { CHAVE_SESSAO, mesmaIdentidade, trocarSessaoNoCache, type Sessao } from './cacheSessao';

export { CHAVE_SESSAO } from './cacheSessao';
export type { Sessao } from './cacheSessao';

/**
 * O usuário tem a permissão `codigo` (ex.: `workflows.ver`) no tenant atual?
 * Sem sessão (carregando, erro ou deslogado), a resposta é sempre `false`.
 */
export function temPermissao(sessao: Sessao | undefined, codigo: string): boolean {
  return sessao?.permissoes.includes(codigo) ?? false;
}

export type ResultadoSessao = UseQueryResult<Sessao> & {
  /** O usuário tem a permissão `codigo` no tenant atual? `false` enquanto não há sessão. */
  temPermissao: (codigo: string) => boolean;
};

/** O cliente mais recente de cada QueryClient: uma conferência de um token já trocado de novo é descartada. */
const clienteAtual = new WeakMap<QueryClient, ClienteApi>();
/** A conferência de cada cliente, feita uma vez só, por mais que haja `useSessao` montados. */
const conferencias = new WeakMap<ClienteApi, Promise<void>>();

/**
 * O cliente da API mudou (o hospedeiro passou outro token). O token novo pode ser de outra pessoa ou de outro tenant:
 * busca a sessão com ele e, se a identidade mudou, descarta o cache do token anterior como numa troca de tenant
 * (ADR 0015); se é a mesma, só grava a sessão nova (os papéis podem ter mudado) e mantém os dados.
 * Token já vencido: o cliente avisa o `onSessaoExpirada` (401 `sem_sessao`). Outra falha: a sessão fica como está.
 */
function conferirSessaoDoCliente(queryClient: QueryClient, cliente: ClienteApi): Promise<void> {
  const existente = conferencias.get(cliente);
  if (existente) return existente;
  const conferencia = (async () => {
    const anterior = queryClient.getQueryData<Sessao>(CHAVE_SESSAO);
    if (anterior === undefined) {
      // Sem sessão no cache, nada a comparar: a consulta (talvez em andamento com o token anterior) recomeça com o novo.
      await queryClient.invalidateQueries({ queryKey: CHAVE_SESSAO });
      return;
    }
    await queryClient.cancelQueries({ queryKey: CHAVE_SESSAO });
    const nova = await dadosOuErro(cliente.GET('/v1/sessao'));
    if (clienteAtual.get(queryClient) !== cliente) return;
    if (mesmaIdentidade(anterior, nova)) queryClient.setQueryData(CHAVE_SESSAO, nova);
    else await trocarSessaoNoCache(queryClient, nova);
  })().catch(() => undefined);
  conferencias.set(cliente, conferencia);
  return conferencia;
}

/**
 * A sessão atual (`GET /v1/sessao`): usuário, tenants, tenant atual e permissões.
 * - **Modo cookie** (casca): a sessão do cookie.
 * - **Modo token** (incorporado): a sessão do token, com `Authorization: Bearer`. Quando o hospedeiro passa outro
 *   token, a sessão é conferida de novo; se o token novo é de outra pessoa ou de outro tenant, o cache do anterior
 *   é descartado.
 *
 * Sem sessão válida (sessão expirada, token vencido), a consulta falha com `ErroApi` `sem_sessao` (sem repetir, por
 * ser 4xx) e o cliente avisa o `onSessaoExpirada` do provedor.
 */
export function useSessao(): ResultadoSessao {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/sessao', { signal })),
  });

  const clienteDaMontagem = useRef(cliente);
  useEffect(() => {
    if (clienteDaMontagem.current === cliente) return;
    clienteDaMontagem.current = cliente;
    clienteAtual.set(queryClient, cliente);
    void conferirSessaoDoCliente(queryClient, cliente);
  }, [cliente, queryClient]);

  const permissoes = consulta.data;
  const verificar = useCallback((codigo: string) => temPermissao(permissoes, codigo), [permissoes]);
  return { ...consulta, temPermissao: verificar };
}
