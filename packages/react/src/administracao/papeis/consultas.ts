import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { dadosOuErro, ErroApi, useClienteApi, type Esquemas } from '../../api';

/** Um papel do tenant (gerado do contrato). */
export type Papel = Esquemas['Papel'];
/** Uma permissão do catálogo (gerado do contrato). */
export type Permissao = Esquemas['Permissao'];
/** Código de uma permissão do catálogo (gerado do contrato). */
export type CodigoPermissao = Esquemas['CodigoPermissao'];
/** Corpo da criação e da alteração de papel (gerado do contrato). */
export type DadosPapel = Esquemas['DadosPapel'];

/**
 * Chaves no cache. As chaves não levam o tenant: a troca de tenant reinicia o cache (ADR 0015).
 * Tudo da Administração fica abaixo de `administracao`; esta tela usa só `administracao/papeis`.
 */
const CHAVE_ADMINISTRACAO = ['administracao'] as const;
export const CHAVE_PAPEIS = [...CHAVE_ADMINISTRACAO, 'papeis'] as const;
export const CHAVE_LISTA_PAPEIS = [...CHAVE_PAPEIS, 'lista'] as const;
export const CHAVE_CATALOGO_PERMISSOES = [...CHAVE_PAPEIS, 'permissoes'] as const;

/** Os papéis do tenant (`GET /v1/papeis`), inclusive o Admin (`fixo`). A lista vem inteira, sem paginação. */
export function useListaPapeis() {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_LISTA_PAPEIS,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/papeis', { signal })),
    select: (dados) => dados.itens,
  });
}

/** O catálogo de permissões (`GET /v1/permissoes`), para o formulário de papel. Só busca enquanto `ativo`. */
export function useCatalogoPermissoes(ativo: boolean) {
  const cliente = useClienteApi();
  return useQuery({
    queryKey: CHAVE_CATALOGO_PERMISSOES,
    queryFn: ({ signal }) => dadosOuErro(cliente.GET('/v1/permissoes', { signal })),
    select: (dados) => dados.itens,
    enabled: ativo,
  });
}

/**
 * Depois de mudar um papel, tudo o que a Administração guardou é buscado de novo, menos o catálogo (que não muda):
 * a tela de usuários também mostra os nomes dos papéis e oferece a lista deles.
 */
function atualizarAdministracao(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: CHAVE_ADMINISTRACAO,
    predicate: (consulta) => !mesmaChave(consulta.queryKey, CHAVE_CATALOGO_PERMISSOES),
  });
}

function mesmaChave(chave: readonly unknown[], outra: readonly unknown[]) {
  return chave.length === outra.length && chave.every((parte, indice) => parte === outra[indice]);
}

/** Cria um papel personalizado (`POST /v1/papeis`). */
export function useCriarPapel() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (corpo: DadosPapel) => dadosOuErro(cliente.POST('/v1/papeis', { body: corpo })),
    onSuccess: () => atualizarAdministracao(queryClient),
  });
}

/** Altera o nome e as permissões de um papel (`PUT /v1/papeis/{id}`); o corpo substitui tudo. */
export function useAlterarPapel() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, corpo }: { id: string; corpo: DadosPapel }) =>
      dadosOuErro(cliente.PUT('/v1/papeis/{id}', { params: { path: { id } }, body: corpo })),
    onSuccess: () => atualizarAdministracao(queryClient),
    onError: (erro) => {
      // A lista estava desatualizada (papel removido, ou é o Admin): busca de novo.
      if (erroComCodigo(erro, ['nao_encontrado', 'papel_fixo'])) void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_PAPEIS });
    },
  });
}

/** Remove um papel (`DELETE /v1/papeis/{id}`). */
export function useRemoverPapel() {
  const cliente = useClienteApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dadosOuErro(cliente.DELETE('/v1/papeis/{id}', { params: { path: { id } } })),
    onSuccess: () => atualizarAdministracao(queryClient),
    onError: (erro) => {
      // A lista estava desatualizada (o papel ganhou usuários, já foi removido, ou é o Admin): busca de novo.
      if (erroComCodigo(erro, ['papel_em_uso', 'nao_encontrado', 'papel_fixo'])) {
        void queryClient.invalidateQueries({ queryKey: CHAVE_LISTA_PAPEIS });
      }
    },
  });
}

export function erroComCodigo(erro: unknown, codigos: readonly string[]): boolean {
  return erro instanceof ErroApi && codigos.includes(erro.codigo);
}

/** Um grupo do catálogo, com as permissões na ordem em que a API as devolve. */
export interface GrupoPermissoes {
  grupo: string;
  permissoes: Permissao[];
}

/** Agrupa o catálogo por `grupo`, na ordem em que cada grupo aparece pela primeira vez. */
export function agruparPermissoes(catalogo: readonly Permissao[]): GrupoPermissoes[] {
  const grupos = new Map<string, Permissao[]>();
  for (const permissao of catalogo) {
    const itens = grupos.get(permissao.grupo);
    if (itens) itens.push(permissao);
    else grupos.set(permissao.grupo, [permissao]);
  }
  return Array.from(grupos, ([grupo, permissoes]) => ({ grupo, permissoes }));
}
