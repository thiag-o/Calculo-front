import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import { dadosOuErro, useClienteApi, type Esquemas } from '../api';

/** A sessão do usuário logado, no tenant atual (gerada do contrato, `GET /v1/sessao`). */
export type Sessao = Esquemas['Sessao'];

/** Chave da sessão no cache do TanStack Query. As mutações da vertical gravam a sessão nova aqui. */
export const CHAVE_SESSAO = ['sessao'] as const;

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

/**
 * A sessão atual (`GET /v1/sessao`): usuário, tenants, tenant atual e permissões.
 * Sem sessão válida, a consulta falha com `ErroApi` `sem_sessao` (sem repetir, por ser 4xx) e o cliente
 * avisa o `onSessaoExpirada` do provedor.
 */
export function useSessao(): ResultadoSessao {
  const cliente = useClienteApi();
  const consulta = useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/sessao', { signal })),
  });
  const permissoes = consulta.data;
  const verificar = useCallback((codigo: string) => temPermissao(permissoes, codigo), [permissoes]);
  return { ...consulta, temPermissao: verificar };
}
