import { ApiError, type Schemas } from '../../api';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/**
 * What to do after each abort reason (estilos.md §10: the error says what happened and what to do). What happened is the
 * fixed message of the API (`abort_reason.message`); this is the next step.
 */
export const ABORT_GUIDANCE: Readonly<Record<Schemas['AbortReason'], string>> = {
  error_limit_exceeded: 'Veja os erros agrupados abaixo, corrija a causa no workflow ou nos dados e execute o lote de novo.',
  source_unavailable: 'Confira se a conexão da fonte está no ar e execute o lote de novo.',
  schema_drift: 'Ajuste o dataset e as variáveis no catálogo e execute o lote de novo.',
  source_read_denied: 'Peça a quem administra a origem a permissão de leitura para o usuário da conexão e execute o lote de novo.',
  parameter_table_rows: 'Deixe a tabela de parâmetros com exatamente uma linha e execute o lote de novo.',
  internal_error: 'Execute o lote de novo. Se voltar a acontecer, avise o suporte com o id desta execução.',
};

/** Error of the execution itself, by `code` (ADR 0008). */
export function executionErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
      return 'Esta execução não existe neste tenant. Volte à lista de execuções e escolha outra.';
    case 'no_permission':
      return 'Você não tem permissão para ver as execuções neste tenant. Peça acesso a um Admin.';
    case 'invalid_data':
      return 'O endereço desta execução não é válido. Volte à lista de execuções e escolha outra.';
    default:
      return error.message;
  }
}

/** Whether trying again can help (a missing or forbidden execution stays so). */
export function canRetryExecution(error: unknown): boolean {
  return !(error instanceof ApiError && ['not_found', 'no_permission', 'invalid_data'].includes(error.code));
}

/** Error of the cancel request, by `code`. */
export function cancelErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'execution_finished':
      return 'A execução terminou antes do pedido de cancelamento. O painel mostra como ela ficou.';
    case 'no_permission':
      return 'Você não tem permissão para cancelar execuções neste tenant. Peça acesso a um Admin.';
    case 'not_found':
      return 'Esta execução não existe mais neste tenant.';
    default:
      return error.message;
  }
}

/** Error of the CSV download, by `code`. */
export function downloadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'output_expired':
      return 'O prazo para baixar o CSV acabou e o arquivo foi apagado. Execute o lote de novo para gerar outro arquivo.';
    case 'output_not_available':
      return 'Esta execução não tem arquivo para baixar. Execuções abortadas, canceladas ou ainda em andamento não entregam CSV.';
    case 'no_permission':
      return 'Você não tem permissão para baixar o CSV neste tenant. Peça acesso a um Admin.';
    default:
      return error.message;
  }
}

/** Reason beside the disabled buttons while the cancel request is in flight (ADR 0064). */
export const CANCELLING_REASON = 'Aguarde o pedido de cancelamento';
