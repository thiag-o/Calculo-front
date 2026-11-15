import { notifyManager, useMutation, useQueryClient, type QueryClient, type UseMutationResult } from '@tanstack/react-query';
import { dadosOuErro, ErroApi, useClienteApi, type Esquemas } from '../api';
import { CHAVE_SESSAO, type Sessao } from './useSessao';

/** E-mail e senha do login (gerado do contrato). */
export type Credenciais = Esquemas['Credenciais'];

const SEM_ACESSO_AO_TENANT = 'sem_acesso_ao_tenant';

/**
 * A sessão passou a ser de outra identidade (login) ou de outro tenant (troca). Nada do cache anterior pode
 * aparecer na tela nem voltar de uma requisição atrasada:
 * - cancela as consultas em andamento (a resposta delas seria da identidade ou do tenant anterior);
 * - grava a sessão nova, que a API já devolveu;
 * - reinicia as demais consultas: os dados somem e as consultas montadas buscam de novo, já no tenant novo.
 */
async function trocarSessaoNoCache(queryClient: QueryClient, sessao: Sessao): Promise<void> {
  await queryClient.cancelQueries();
  // Num lote só: a tela nunca renderiza a sessão nova ao lado dos dados antigos.
  notifyManager.batch(() => {
    queryClient.setQueryData(CHAVE_SESSAO, sessao);
    // Sem await: a mutação termina já com a sessão nova; as consultas reiniciadas buscam em paralelo.
    void queryClient.resetQueries({ predicate: (consulta) => consulta.queryKey[0] !== CHAVE_SESSAO[0] });
  });
}

/**
 * Login com e-mail e senha (`POST /v1/sessao`, modo cookie). No sucesso, a sessão devolvida vira a sessão atual
 * e o cache de qualquer identidade anterior é descartado. Os erros chegam como `ErroApi` (decida pelo `codigo`:
 * `credenciais_invalidas`, `login_bloqueado`, `muitas_tentativas`, `dados_invalidos`…).
 */
export function useEntrar(): UseMutationResult<Sessao, Error, Credenciais> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credenciais: Credenciais) => dadosOuErro(cliente.POST('/v1/sessao', { body: credenciais })),
    onSuccess: (sessao) => trocarSessaoNoCache(queryClient, sessao),
  });
}

/**
 * Logout (`DELETE /v1/sessao`). No sucesso, cancela as consultas e apaga todo o cache do usuário.
 * Quem chama decide para onde ir depois (no casca, a tela de login), no `onSuccess` do `mutate`.
 */
export function useSair(): UseMutationResult<void, Error, void> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await dadosOuErro(cliente.DELETE('/v1/sessao'));
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries();
    },
  });
}

/**
 * Troca o tenant atual da sessão (`PUT /v1/sessao/tenant`); a variável é o id do tenant.
 * No sucesso, a sessão devolvida (permissões do tenant novo) vira a sessão atual e os dados do tenant anterior
 * saem do cache. Em `403 sem_acesso_ao_tenant`, a sessão é buscada de novo, porque a lista de tenants mudou.
 */
export function useTrocarTenant(): UseMutationResult<Sessao, Error, string> {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => dadosOuErro(cliente.PUT('/v1/sessao/tenant', { body: { tenant_id: tenantId } })),
    onSuccess: (sessao) => trocarSessaoNoCache(queryClient, sessao),
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.codigo === SEM_ACESSO_AO_TENANT) {
        void queryClient.invalidateQueries({ queryKey: CHAVE_SESSAO });
      }
    },
  });
}
