import { ApiError, type Schemas } from '../../api';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

export function problemCount(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** The reason beside the disabled "Executar lote" while the saved draft has problems (estilos.md §14). */
export function problemsReason(count: number): string {
  return `Resolva ${problemCount(count)} do rascunho para executar`;
}

/** The note on what runs (E6-19). */
export function revisionNote(revision: number): string {
  return `Executa o rascunho salvo (revisão ${revision.toLocaleString('pt-BR')}). Mudanças feitas depois não entram nesta execução.`;
}

/** Why the saved draft could not be read, by `code` (ADR 0008). */
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

export interface TriggerErrorMessage {
  title: string;
  message: string;
  /** The problems are in the editor: the note offers "Ver problemas". */
  showProblems?: boolean;
}

function sentProblems(error: ApiError): number {
  const problems = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.problems;
  return Array.isArray(problems) ? problems.length : 0;
}

function currentRevision(error: ApiError): number | null {
  const revision = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.current_revision;
  return typeof revision === 'number' ? revision : null;
}

/**
 * What went wrong with the trigger, by `code` (ADR 0008). `missing_parameter` and `invalid_parameter` go to the
 * parameter field, not here.
 */
export function triggerErrorMessage(error: unknown): TriggerErrorMessage {
  const title = 'Não foi possível executar o lote';
  if (!(error instanceof ApiError)) return { title, message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'draft_conflict': {
      const revision = currentRevision(error);
      return {
        title: 'O rascunho foi salvo de novo',
        message:
          revision === null
            ? 'Alguém salvou o rascunho depois que esta janela abriu. Confira os parâmetros e execute de novo para rodar a revisão atual.'
            : `Alguém salvou o rascunho depois que esta janela abriu, e ele está agora na revisão ${revision.toLocaleString('pt-BR')}. Confira os parâmetros e execute de novo para rodar a revisão atual.`,
      };
    }
    case 'draft_has_problems': {
      const count = sentProblems(error);
      return {
        title: 'O rascunho salvo tem problemas',
        message: `${count > 0 ? `O rascunho salvo tem ${problemCount(count)}.` : 'O rascunho salvo tem problemas.'} Corrija-os no editor e salve antes de executar o lote.`,
        showProblems: true,
      };
    }
    case 'no_batch_source':
      return {
        title: 'Este workflow não tem fonte do lote',
        message: 'A execução em lote lê os registros da fonte do lote. Escolha a fonte do lote no painel do workflow, salve e execute de novo.',
      };
    case 'no_permission':
      return { title, message: 'Você não tem permissão para executar este workflow. Peça acesso a um Admin.' };
    case 'not_found':
      return { title, message: 'Este workflow não existe mais. Ele pode ter sido removido por outra pessoa.' };
    default:
      return { title, message: error.message };
  }
}
