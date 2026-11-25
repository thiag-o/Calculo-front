import { Notice, Status, formatDateTime } from '../../design-system';
import { STATUS_PRESENTATION } from '../api';
import { OVERLAP_MESSAGE, OVERLAP_TITLE, overlapOrigin, type OverlappingExecution } from './messages';

export interface OverlapNoteProps {
  /** The executions of the same scope, newest first (up to 5). */
  executions: readonly OverlappingExecution[];
  /** Opens the panel of an execution (the dialog closes first). Without it, the rows are only text. */
  onOpenExecution?: (id: string) => void;
}

/**
 * The note of the `409 scope_already_delivered` (E7-22), inside the "Executar lote" dialog: the scope was already delivered
 * (or is running), what running again does, and the executions of that scope, each with state, when, who and a link.
 */
export function OverlapNote({ executions, onOpenExecution }: OverlapNoteProps) {
  return (
    <Notice type="warning" title={OVERLAP_TITLE}>
      <p className="fc-trigger-overlap-text">{OVERLAP_MESSAGE}</p>
      {executions.length > 0 ? (
        <ul className="fc-trigger-overlap-list" aria-label="Execuções do mesmo escopo">
          {executions.map((execution) => {
            const presentation = STATUS_PRESENTATION[execution.status];
            const when = formatDateTime(execution.created_at);
            return (
              <li key={execution.id} className="fc-trigger-overlap-item">
                <Status tone={presentation.tone} pulsing={presentation.pulsing}>
                  {presentation.label}
                </Status>
                <span>{when}</span>
                <span>{overlapOrigin(execution)}</span>
                {onOpenExecution ? (
                  <button
                    type="button"
                    className="fc-trigger-link"
                    aria-label={`Abrir a execução de ${when}`}
                    onClick={() => onOpenExecution(execution.id)}
                  >
                    Abrir execução
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Notice>
  );
}
