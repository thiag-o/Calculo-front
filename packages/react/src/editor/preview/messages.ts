import { ApiError, type Schemas } from '../../api';
import { formatCount } from './values';

/** The label of the tab (E5-20). */
export const PREVIEW_LABEL = 'Prévia';
/** The label of the button: verb + object (estilos.md §7.1 and §13). */
export const RUN_PREVIEW_LABEL = 'Rodar prévia';

/** The preview counts over the first 500 records of the batch source (E5-11). */
export const COUNT_NOTE = 'Contagens sobre os primeiros 500 registros.';

/** The batch source in place of a block name (a read error with `node_id` null). */
export const BATCH_SOURCE_NAME = 'Fonte do lote';
/** The root group: its Input is the batch source and its Output the output fields. */
export const ROOT_GROUP_NAME = 'Workflow';

export const CONFLICT_TITLE = 'Este rascunho mudou em outra aba ou por outra pessoa';
export const CONFLICT_MESSAGE = 'Recarregue o rascunho para rodar a prévia. O que você mudou aqui depois do último salvamento não é mantido.';
export const CONFLICT_REASON = 'Recarregue o rascunho para rodar a prévia';
export const NO_BATCH_SOURCE_REASON = 'Escolha a fonte do lote para rodar a prévia';

const UNKNOWN_MESSAGE = 'Não foi possível rodar a prévia agora. Tente de novo em instantes.';

function problemsText(count: number): string {
  return count === 1 ? '1 problema' : `${formatCount(count)} problemas`;
}

/** Why "Rodar prévia" is disabled while the draft has problems (estilos.md §14). */
export function problemsReason(count: number): string {
  return `Resolva ${problemsText(count)} para rodar a prévia`;
}

/** A count with its word, singular or plural ("1 encontrado", "480 encontrados"). */
function counted(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export const countText = {
  found: (count: number) => counted(count, 'encontrado', 'encontrados'),
  noMatch: (count: number) => `${formatCount(count)} sem correspondência`,
  multipleRows: (count: number, max: number | null) =>
    `${formatCount(count)} com mais de uma linha${count > 0 && max !== null ? ` (máx. ${formatCount(max)})` : ''}`,
  kept: (count: number) => counted(count, 'passou no filtro', 'passaram no filtro'),
  filtered: (count: number) => counted(count, 'filtrado', 'filtrados'),
};

type ReadErrorCode = Extract<Schemas['FailureCode'], 'schema_drift' | 'source_read_denied' | 'parameter_table_rows'>;

/** The title of a read error of the preview (E5-11); the message is the API's, with the names of the case. */
const READ_ERROR_TITLES: Record<ReadErrorCode, string> = {
  schema_drift: 'O dataset mudou na origem',
  source_read_denied: 'Sem permissão de leitura na origem',
  parameter_table_rows: 'A tabela de parâmetros não tem exatamente uma linha',
};

export function readErrorTitle(code: Schemas['FailureCode']): string {
  return code in READ_ERROR_TITLES ? READ_ERROR_TITLES[code as ReadErrorCode] : 'Não foi possível ler a fonte';
}

/** The problems sent with `409 draft_has_problems`. */
function savedProblems(error: ApiError): number {
  const problems = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.problems;
  return Array.isArray(problems) ? problems.length : 0;
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'draft_conflict';
}

/** What went wrong with the preview route, by `code` (ADR 0008). `draft_conflict` is shown with "Recarregar rascunho". */
export function previewErrorMessage(error: unknown): { title: string; message: string } {
  const title = 'Não foi possível rodar a prévia';
  if (!(error instanceof ApiError)) return { title, message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'draft_has_problems': {
      const count = savedProblems(error);
      return {
        title: 'O rascunho salvo tem problemas',
        message:
          count > 0
            ? `Resolva ${problemsText(count)} na aba Problemas e rode a prévia de novo.`
            : 'Resolva os problemas na aba Problemas e rode a prévia de novo.',
      };
    }
    case 'no_batch_source':
      return { title, message: 'Este workflow não tem fonte do lote. Escolha a fonte do lote no painel do workflow e rode a prévia de novo.' };
    case 'no_permission':
      return { title, message: 'Você não tem permissão para rodar a prévia deste workflow. Peça acesso a um Admin.' };
    case 'not_found':
      return { title, message: 'Este workflow não existe mais. Ele pode ter sido removido por outra pessoa.' };
    default:
      // connection_credential_unreadable, connection_failed, connection_target_not_allowed…: the API's message says
      // what happened and what to do.
      return { title, message: error.message || UNKNOWN_MESSAGE };
  }
}
