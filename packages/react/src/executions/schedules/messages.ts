import { ApiError, type Schemas } from '../../api';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

export const NAME_TAKEN_MESSAGE = 'Já existe um agendamento com esse nome neste workflow. Escolha outro nome.';
export const GONE_MESSAGE = 'Este agendamento não existe mais. Ele pode ter sido removido por outra pessoa.';

export function problemCount(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** The reason beside the disabled "Salvar" while the saved draft to freeze has problems (estilos.md §14). */
export function problemsReason(count: number): string {
  return `Resolva ${problemCount(count)} do rascunho para agendar`;
}

/** Errors of the schedule list, by `code` (ADR 0008). */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return 'Você não tem permissão para ver os agendamentos neste tenant. Peça acesso a um Admin.';
    case 'invalid_cursor':
      return 'Não foi possível continuar de onde a lista parou. Recarregue a lista para ver os agendamentos desde o início.';
    default:
      return error.message;
  }
}

/** "3 agendamentos", "Mais de 50 agendamentos". */
export function listSummary(total: number, hasMore: boolean): string {
  const howMany = total.toLocaleString('pt-BR');
  if (hasMore) return `Mais de ${howMany} agendamentos`;
  return total === 1 ? '1 agendamento' : `${howMany} agendamentos`;
}

/** Why the saved draft could not be read, by `code`. */
export function draftErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return 'Você não tem permissão para ver o rascunho deste workflow. Peça acesso a um Admin.';
    case 'not_found':
      return 'Este workflow não existe mais. Ele pode ter sido removido por outra pessoa.';
    default:
      return error.message;
  }
}

export interface SaveErrorMessage {
  title: string;
  message: string;
}

function currentRevision(error: ApiError): number | null {
  const revision = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.current_revision;
  return typeof revision === 'number' ? revision : null;
}

function sentProblems(error: ApiError): number {
  const problems = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.problems;
  return Array.isArray(problems) ? problems.length : 0;
}

/**
 * What went wrong when saving a schedule, by `code` (ADR 0008), for the note of the dialog. `schedule_name_taken` goes to
 * the name, `missing_parameter` and `invalid_parameter` to the parameter, and `invalid_data` of a known field to that field.
 */
export function saveErrorMessage(error: unknown): SaveErrorMessage {
  const title = 'Não foi possível salvar o agendamento';
  if (!(error instanceof ApiError)) return { title, message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'too_many_schedules':
      return {
        title: 'Este workflow já tem 20 agendamentos',
        message: 'Remova um agendamento que não serve mais para criar outro.',
      };
    case 'draft_conflict': {
      const revision = currentRevision(error);
      return {
        title: 'O rascunho foi salvo de novo',
        message:
          revision === null
            ? 'Alguém salvou o rascunho depois que esta janela abriu. Confira os parâmetros e salve de novo para usar a revisão atual.'
            : `Alguém salvou o rascunho depois que esta janela abriu, e ele está agora na revisão ${revision.toLocaleString('pt-BR')}. Confira os parâmetros e salve de novo para usar a revisão atual.`,
      };
    }
    case 'draft_has_problems': {
      const count = sentProblems(error);
      return {
        title: 'O rascunho salvo tem problemas',
        message: `${count > 0 ? `O rascunho salvo tem ${problemCount(count)}.` : 'O rascunho salvo tem problemas.'} Corrija-os no editor e salve antes de agendar.`,
      };
    }
    case 'no_batch_source':
      return {
        title: 'Este workflow não tem fonte do lote',
        message: 'O agendamento executa o lote, que lê os registros da fonte do lote. Escolha a fonte do lote no painel do workflow, salve e agende de novo.',
      };
    case 'not_found':
      return { title, message: GONE_MESSAGE };
    case 'no_permission':
      return { title, message: 'Você não tem permissão para agendar este workflow. Peça acesso a um Admin.' };
    default:
      return { title, message: error.message };
  }
}

/** Errors when turning a schedule on or off, or when removing it. */
export function changeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
      return GONE_MESSAGE;
    case 'no_permission':
      return 'Você não tem permissão para mudar os agendamentos deste workflow. Peça acesso a um Admin.';
    default:
      return error.message;
  }
}
