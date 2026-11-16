import { useInfiniteQuery } from '@tanstack/react-query';
import { dadosOuErro, useClienteApi, type Esquemas, type operations } from '../../api';
import { ateDe, desdeDe } from './periodo';

/** Um evento da auditoria de acessos (gerado do contrato). */
export type EventoAcesso = Esquemas['EventoAcesso'];

type ConsultaAcessos = NonNullable<operations['listar_acessos']['parameters']['query']>;

/** Os filtros aplicados à lista. `de` e `ate` são dias (`aaaa-mm-dd`) ou vazios; `tipo` nulo é "todos os tipos". */
export interface FiltrosAcessos {
  tipo: string | null;
  de: string;
  ate: string;
}

export const SEM_FILTROS: FiltrosAcessos = { tipo: null, de: '', ate: '' };

/**
 * Chaves no cache, sob `['auditoria', …]`. Não levam o tenant: a troca de tenant reinicia o cache (ADR 0015). Cada
 * combinação de filtros é uma lista própria, que começa da primeira página.
 */
export const CHAVE_ACESSOS = ['auditoria', 'acessos'] as const;

export function chaveListaAcessos(filtros: FiltrosAcessos) {
  return [...CHAVE_ACESSOS, filtros] as const;
}

/** Os parâmetros de `GET /v1/auditoria/acessos` para os filtros e o cursor da página. */
export function consultaDe(filtros: FiltrosAcessos, cursor: string | null): ConsultaAcessos {
  const consulta: ConsultaAcessos = {};
  if (filtros.tipo) consulta.tipo = [filtros.tipo];
  const desde = desdeDe(filtros.de);
  if (desde) consulta.desde = desde;
  const ate = ateDe(filtros.ate);
  if (ate) consulta.ate = ate;
  if (cursor) consulta.cursor = cursor;
  return consulta;
}

/** Os eventos de acesso do tenant (`GET /v1/auditoria/acessos`), do mais recente ao mais antigo, paginados por cursor. */
export function useListaAcessos(filtros: FiltrosAcessos) {
  const cliente = useClienteApi();
  return useInfiniteQuery({
    queryKey: chaveListaAcessos(filtros),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dadosOuErro(cliente.GET('/v1/auditoria/acessos', { params: { query: consultaDe(filtros, pageParam) }, signal })),
    getNextPageParam: (ultima) => ultima.proximo_cursor ?? undefined,
    select: (dados) => dados.pages.flatMap((pagina) => pagina.itens),
  });
}
