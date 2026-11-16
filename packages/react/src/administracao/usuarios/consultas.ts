import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dadosOuErro, ErroApi, useClienteApi, type Esquemas } from '../../api';

/** Um usuário como membro do tenant atual (gerado do contrato). */
export type Usuario = Esquemas['Usuario'];
/** Um papel do tenant (gerado do contrato). */
export type Papel = Esquemas['Papel'];
/** Corpo da criação de usuário (gerado do contrato). */
export type NovoUsuario = Esquemas['NovoUsuario'];
/** Corpo da alteração de usuário (gerado do contrato). */
export type AlteracaoUsuario = Esquemas['AlteracaoUsuario'];
/** O link de redefinição, mostrado uma vez só (gerado do contrato). */
export type LinkRedefinicao = Esquemas['LinkRedefinicao'];

/**
 * Chaves no cache. As chaves não levam o tenant: a troca de tenant reinicia o cache (ADR 0015).
 * Os papéis ficam abaixo de `usuarios` para que invalidar a tela inteira também os atualize; a chave é própria
 * desta tela, para não dividir o cache com a tela de papéis.
 */
export const CHAVE_USUARIOS = ['administracao', 'usuarios'] as const;
export const CHAVE_LISTA_USUARIOS = [...CHAVE_USUARIOS, 'lista'] as const;
export const CHAVE_PAPEIS_DISPONIVEIS = [...CHAVE_USUARIOS, 'papeis'] as const;

/** Os usuários do tenant (`GET /v1/usuarios`), paginados por cursor; `fetchNextPage` traz a próxima página. */
export function useListaUsuarios() {
  const cliente = useClienteApi();
  return useInfiniteQuery({
    queryKey: CHAVE_LISTA_USUARIOS,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dadosOuErro(cliente.GET('/v1/usuarios', { params: { query: pageParam ? { cursor: pageParam } : {} }, signal })),
    getNextPageParam: (ultima) => ultima.proximo_cursor ?? undefined,
    select: (dados) => dados.pages.flatMap((pagina) => pagina.itens),
  });
}

/** Os papéis do tenant (`GET /v1/papeis`), para escolher no formulário. Só busca enquanto `ativo`. */
export function usePapeisDisponiveis(ativo: boolean) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_PAPEIS_DISPONIVEIS,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/papeis', { signal })),
    select: (dados) => dados.itens,
    enabled: ativo,
  });
}

/** Cria um usuário no tenant (`POST /v1/usuarios`). No sucesso, a lista é buscada de novo. */
export function useCriarUsuario() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (corpo: NovoUsuario) => dadosOuErro(cliente.POST('/v1/usuarios', { body: corpo })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_USUARIOS }),
    onError: (erro) => {
      // Algum papel escolhido sumiu: a lista de papéis é buscada de novo.
      if (erroComCodigo(erro, ['papel_inexistente'])) void queryClient.invalidateQueries({ queryKey: CHAVE_PAPEIS_DISPONIVEIS });
    },
  });
}

/** Altera nome, papéis e situação de um usuário (`PUT /v1/usuarios/{id}`). No sucesso, a lista é buscada de novo. */
export function useAlterarUsuario() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, corpo }: { id: string; corpo: AlteracaoUsuario }) =>
      dadosOuErro(cliente.PUT('/v1/usuarios/{id}', { params: { path: { id } }, body: corpo })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_USUARIOS }),
    onError: (erro) => {
      if (erroComCodigo(erro, ['papel_inexistente'])) void queryClient.invalidateQueries({ queryKey: CHAVE_PAPEIS_DISPONIVEIS });
      if (erroComCodigo(erro, ['nao_encontrado'])) void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_USUARIOS });
    },
  });
}

/**
 * Gera o link de redefinição de senha de um usuário (`POST /v1/usuarios/{id}/redefinicao`).
 * O link fica só no resultado da mutação, nunca no cache de consultas: quem usa chama `reset()` ao fechar o diálogo.
 */
export function useGerarLinkRedefinicao() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dadosOuErro(cliente.POST('/v1/usuarios/{id}/redefinicao', { params: { path: { id } } })),
    // Sem observador (depois do `reset()` ou ao desmontar), a mutação sai do cache na hora, levando o link junto.
    gcTime: 0,
    onError: (erro) => {
      // A lista estava desatualizada (usuário desativado, removido ou externo): busca de novo.
      if (erroComCodigo(erro, CODIGOS_LISTA_DESATUALIZADA)) void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_USUARIOS });
    },
  });
}

const CODIGOS_LISTA_DESATUALIZADA = ['usuario_inativo', 'usuario_externo', 'nao_encontrado'];

function erroComCodigo(erro: unknown, codigos: readonly string[]): boolean {
  return erro instanceof ErroApi && codigos.includes(erro.codigo);
}
