import { ApiError } from '../../api';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Error of the diff, by `code` (ADR 0008). */
export function comparisonErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return 'Você não tem permissão para ver a comparação neste tenant. Peça acesso a um Admin.';
    case 'comparison_not_available':
      return 'Esta simulação ainda não tem a comparação com o arquivo. Tente de novo quando ela terminar.';
    case 'not_found':
      return 'Esta execução não existe mais neste tenant.';
    case 'invalid_data':
      return 'A API recusou o filtro escolhido. Volte para as divergências e escolha de novo.';
    case 'invalid_cursor':
      return 'Não foi possível continuar de onde a lista parou. Recarregue a comparação para ver a lista desde o início.';
    default:
      return error.message;
  }
}

/** "50 registros", "Mais de 50 registros", always of the filter chosen. */
export function listedText(total: number, hasMore: boolean): string {
  const howMany = total.toLocaleString('pt-BR');
  if (hasMore) return `Mais de ${howMany} registros`;
  return total === 1 ? '1 registro' : `${howMany} registros`;
}
