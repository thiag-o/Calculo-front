import { notifyManager, type QueryClient } from '@tanstack/react-query';
import type { Esquemas } from '../api';

/** A sessão do usuário logado, no tenant atual (gerada do contrato, `GET /v1/sessao`). */
export type Sessao = Esquemas['Sessao'];

/** Chave da sessão no cache do TanStack Query. As mutações da vertical gravam a sessão nova aqui. */
export const CHAVE_SESSAO = ['sessao'] as const;

/** As duas sessões são da mesma pessoa no mesmo tenant? Então os dados do cache continuam valendo. */
export function mesmaIdentidade(a: Sessao, b: Sessao): boolean {
  return a.usuario.id === b.usuario.id && a.tenant_atual.id === b.tenant_atual.id;
}

/**
 * A sessão passou a ser de outra identidade (login, token de outra pessoa) ou de outro tenant (troca). Nada do
 * cache anterior pode aparecer na tela nem voltar de uma requisição atrasada (ADR 0015):
 * - cancela as consultas em andamento (a resposta delas seria da identidade ou do tenant anterior);
 * - grava a sessão nova, que a API já devolveu;
 * - reinicia as demais consultas: os dados somem e as consultas montadas buscam de novo, já no tenant novo.
 */
export async function trocarSessaoNoCache(queryClient: QueryClient, sessao: Sessao): Promise<void> {
  await queryClient.cancelQueries();
  // Num lote só: a tela nunca renderiza a sessão nova ao lado dos dados antigos.
  notifyManager.batch(() => {
    queryClient.setQueryData(CHAVE_SESSAO, sessao);
    // Sem await: a mutação termina já com a sessão nova; as consultas reiniciadas buscam em paralelo.
    void queryClient.resetQueries({ predicate: (consulta) => consulta.queryKey[0] !== CHAVE_SESSAO[0] });
  });
}
