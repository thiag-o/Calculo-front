import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dadosOuErro, ErroApi, useClienteApi, type Esquemas } from '../../api';

/** Uma chave de API do tenant, sem a chave inteira (gerado do contrato). */
export type ChaveApi = Esquemas['ChaveApi'];
/** A chave recém-criada, com a `chave` inteira, mostrada uma vez só (gerado do contrato). */
export type ChaveApiCriada = Esquemas['ChaveApiCriada'];
/** Corpo da criação de chave de API (gerado do contrato). */
export type NovaChaveApi = Esquemas['NovaChaveApi'];
/** Um domínio autorizado do tenant, com a origem normalizada (gerado do contrato). */
export type DominioAutorizado = Esquemas['DominioAutorizado'];
/** Corpo do cadastro de domínio autorizado (gerado do contrato). */
export type NovoDominioAutorizado = Esquemas['NovoDominioAutorizado'];

/**
 * Chaves no cache, sob `['administracao', …]` (ADR 0020). Não levam o tenant: a troca de tenant reinicia o cache
 * (ADR 0015). A chave inteira nunca entra numa chave nem no dado de uma consulta (ADR 0021).
 */
export const CHAVE_INTEGRACAO = ['administracao', 'integracao'] as const;
export const CHAVE_LISTA_CHAVES = [...CHAVE_INTEGRACAO, 'chaves'] as const;
export const CHAVE_LISTA_DOMINIOS = [...CHAVE_INTEGRACAO, 'dominios'] as const;

export function erroComCodigo(erro: unknown, codigos: readonly string[]): boolean {
  return erro instanceof ErroApi && codigos.includes(erro.codigo);
}

/** As chaves de API do tenant (`GET /v1/chaves-api`), inclusive as revogadas, paginadas por cursor. */
export function useListaChaves() {
  const cliente = useClienteApi();
  return useInfiniteQuery({
    queryKey: CHAVE_LISTA_CHAVES,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dadosOuErro(cliente.GET('/v1/chaves-api', { params: { query: pageParam ? { cursor: pageParam } : {} }, signal })),
    getNextPageParam: (ultima) => ultima.proximo_cursor ?? undefined,
    select: (dados) => dados.pages.flatMap((pagina) => pagina.itens),
  });
}

/**
 * Cria uma chave de API (`POST /v1/chaves-api`). A resposta traz a chave inteira, que só existe no resultado desta
 * mutação (ADR 0021): `gcTime: 0` tira a mutação do cache assim que o diálogo que a usa desmonta. No sucesso, a lista
 * é buscada de novo (ela só tem o prefixo).
 */
export function useCriarChave() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (corpo: NovaChaveApi) => dadosOuErro(cliente.POST('/v1/chaves-api', { body: corpo })),
    gcTime: 0,
    // Sem esperar a lista: a chave aparece assim que a API responde.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_CHAVES });
    },
  });
}

/** Revoga uma chave (`DELETE /v1/chaves-api/{id}`). Ela continua na lista, com `revogada_em`. */
export function useRevogarChave() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dadosOuErro(cliente.DELETE('/v1/chaves-api/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_CHAVES }),
    onError: (erro) => {
      // A lista estava desatualizada (a chave não existe mais): busca de novo.
      if (erroComCodigo(erro, ['nao_encontrado'])) void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_CHAVES });
    },
  });
}

/** Os domínios autorizados do tenant (`GET /v1/dominios-autorizados`). A lista vem inteira, sem paginação. */
export function useListaDominios() {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_LISTA_DOMINIOS,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/dominios-autorizados', { signal })),
    select: (dados) => dados.itens,
  });
}

/** Cadastra um domínio autorizado (`POST /v1/dominios-autorizados`); a API devolve a origem normalizada. */
export function useCriarDominio() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (corpo: NovoDominioAutorizado) => dadosOuErro(cliente.POST('/v1/dominios-autorizados', { body: corpo })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_DOMINIOS }),
    onError: (erro) => {
      // A origem já estava cadastrada (talvez por outra pessoa): a lista é buscada de novo para mostrá-la.
      if (erroComCodigo(erro, ['dominio_existente'])) void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_DOMINIOS });
    },
  });
}

/** Remove um domínio autorizado de vez (`DELETE /v1/dominios-autorizados/{id}`). */
export function useRemoverDominio() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dadosOuErro(cliente.DELETE('/v1/dominios-autorizados/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_DOMINIOS }),
    onError: (erro) => {
      if (erroComCodigo(erro, ['nao_encontrado'])) void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_DOMINIOS });
    },
  });
}
