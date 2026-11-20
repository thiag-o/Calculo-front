import { ApiError, type Schemas } from '../../api';

/** The label of the tab and of the button (estilos.md §13; plan, "Rótulos fixos"). */
export const UNIT_RUN_LABEL = 'Calcular';

/** The same note as the draft's `409 draft_conflict` (E4-23), for the conflict found by the run itself. */
export const CONFLICT_TITLE = 'Este rascunho mudou em outra aba ou por outra pessoa';
export const CONFLICT_MESSAGE = 'Recarregue o rascunho para calcular. O que você mudou aqui depois do último salvamento não é mantido.';

const UNKNOWN_MESSAGE = 'Não foi possível calcular agora. Tente de novo em instantes.';

function problemsText(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** Why "Calcular" is disabled while the draft has problems (estilos.md §14). */
export function problemsReason(count: number): string {
  return `Resolva ${problemsText(count)} para calcular`;
}

export const CONFLICT_REASON = 'Recarregue o rascunho para calcular';

/** The problems sent with `422 draft_has_problems`. */
function savedProblems(error: ApiError): number {
  const problems = (error.body as Partial<Schemas['UnitRunRejectedProblem']> | undefined)?.problems;
  return Array.isArray(problems) ? problems.length : 0;
}

/** What went wrong with a run, by `code` (ADR 0008). `draft_conflict` and `invalid_inputs` are shown elsewhere. */
export function runErrorMessage(error: unknown): { title: string; message: string } {
  if (!(error instanceof ApiError)) return { title: 'Não foi possível calcular', message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'draft_has_problems': {
      const count = savedProblems(error);
      return {
        title: 'O rascunho salvo tem problemas',
        message:
          count > 0
            ? `Resolva ${problemsText(count)} na aba Problemas e calcule de novo.`
            : 'Resolva os problemas na aba Problemas e calcule de novo.',
      };
    }
    case 'no_permission':
      return { title: 'Não foi possível calcular', message: 'Você não tem permissão para calcular este workflow. Peça acesso a um Admin.' };
    case 'not_found':
      return { title: 'Não foi possível calcular', message: 'Este workflow não existe mais. Ele pode ter sido removido por outra pessoa.' };
    default:
      return { title: 'Não foi possível calcular', message: error.message || UNKNOWN_MESSAGE };
  }
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'draft_conflict';
}

/** The errors of `422 invalid_inputs`, by input path (`valor_item`, `pontuacoes[1].taxa`). */
export function invalidInputs(error: unknown): Readonly<Record<string, string>> | null {
  return error instanceof ApiError && error.code === 'invalid_inputs' ? error.fields : null;
}
