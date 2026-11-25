import { useRef, useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '../../design-system';
import { useSession } from '../../session';
import type { Execution } from '../api';
import { TriggerExecutionDialog } from './TriggerExecutionDialog';

/** Permission to trigger batch executions. */
export const TRIGGER_PERMISSION = 'executions.trigger';

export interface TriggerExecutionProps {
  workflowId: string;
  /** Called with the new execution, after the dialog closes: the caller opens the execution panel (E6-19). */
  onTriggered: (execution: Execution) => void;
  /** Opens the Problemas tab of the editor (see `TriggerExecutionDialogProps`). */
  onOpenProblems?: () => void;
  /** Opens the panel of an execution of the same scope listed in the note of a scope already delivered (E7-22). */
  onOpenExecution?: (id: string) => void;
  /** Default: `secondary` (the main action of the area is usually another one, like "Abrir editor"). */
  variant?: ButtonVariant;
  /** Default: `default` (32px). */
  size?: ButtonSize;
}

/**
 * The "Executar lote" button and its dialog (E6-19), for the editor header, the workflow Overview and the workflow
 * execution list. Without `executions.trigger`, nothing is shown. Needs `ApiProvider`, `QueryClientProvider` and
 * `FluxoRoot`.
 */
export function TriggerExecution({
  workflowId,
  onTriggered,
  onOpenProblems,
  onOpenExecution,
  variant = 'secondary',
  size = 'default',
}: TriggerExecutionProps) {
  const session = useSession();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  if (!session.hasPermission(TRIGGER_PERMISSION)) return null;

  return (
    <>
      <Button ref={button} variant={variant} size={size} onClick={() => setOpen(true)}>
        Executar lote
      </Button>
      {open ? (
        <TriggerExecutionDialog
          workflowId={workflowId}
          focusOnClose={button}
          onClose={() => setOpen(false)}
          onOpenProblems={onOpenProblems}
          onOpenExecution={onOpenExecution}
          onTriggered={(execution) => {
            setOpen(false);
            onTriggered(execution);
          }}
        />
      ) : null}
    </>
  );
}
