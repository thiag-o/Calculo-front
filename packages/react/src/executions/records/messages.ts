import { ApiError } from '../../api';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Error of the record list, by `code` (ADR 0008). */
export function recordsErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return 'Você não tem permissão para ver os registros e o trace neste tenant. Peça acesso a um Admin.';
    case 'invalid_data':
      return 'A API recusou o filtro escolhido. Mude o filtro ou limpe-o para ver todos os registros.';
    case 'invalid_cursor':
      return 'Não foi possível continuar de onde a lista parou. Recarregue os registros para ver a lista desde o início.';
    default:
      return error.message;
  }
}

/** Error of the trace of one record, by `code`. */
export function traceErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'record_not_found':
      return 'Esta execução não tem mais o trace deste registro. Feche e escolha outro registro da lista.';
    case 'no_permission':
      return 'Você não tem permissão para ver o trace neste tenant. Peça acesso a um Admin.';
    default:
      return error.message;
  }
}

/** "50 registros", "Mais de 50 registros", "… com esse filtro". */
export function recordsSummary(total: number, hasMore: boolean, filtered: boolean): string {
  const howMany = total.toLocaleString('pt-BR');
  const base = hasMore ? `Mais de ${howMany} registros` : total === 1 ? '1 registro' : `${howMany} registros`;
  return filtered ? `${base} com esse filtro` : base;
}
