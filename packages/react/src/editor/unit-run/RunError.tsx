import { Button, Notice } from '../../design-system';
import { CONFLICT_MESSAGE, CONFLICT_TITLE, invalidInputs, isConflict, isRecordNotFound, runErrorMessage } from './messages';

export interface RunErrorProps {
  error: unknown;
  /** `invalid_inputs` paths with no field on screen (the inputs changed meanwhile). */
  unmatched?: readonly string[];
  reloading: boolean;
  reloadError: boolean;
  onReload: () => void;
}

/** The refusal of a run, by `code`: the conflict with "Recarregar rascunho", the refused values, the key not found or the API's message. */
export function RunError({ error, unmatched = [], reloading, reloadError, onReload }: RunErrorProps) {
  if (isConflict(error)) {
    return (
      <Notice
        type="warning"
        title={CONFLICT_TITLE}
        actions={
          <Button size="small" loading={reloading} onClick={onReload}>
            Recarregar rascunho
          </Button>
        }
      >
        {reloadError ? 'Não foi possível recarregar o rascunho. Tente de novo em instantes.' : CONFLICT_MESSAGE}
      </Notice>
    );
  }
  if (isRecordNotFound(error)) {
    // The message itself is at the key field; here, what to do.
    return (
      <Notice type="error" title="Registro não encontrado">
        Confira a chave e calcule de novo.
      </Notice>
    );
  }
  const fields = invalidInputs(error);
  if (fields) {
    return (
      <Notice type="error" title="Alguns valores foram recusados">
        Confira os campos marcados e calcule de novo.
        {unmatched.length > 0 ? (
          <ul className="fc-unit-run-unmatched">
            {unmatched.map((path) => (
              <li key={path}>
                <span className="fc-unit-run-code">{path}</span> {fields[path]}
              </li>
            ))}
          </ul>
        ) : null}
      </Notice>
    );
  }
  const { title, message } = runErrorMessage(error);
  return (
    <Notice type="error" title={title}>
      {message}
    </Notice>
  );
}
