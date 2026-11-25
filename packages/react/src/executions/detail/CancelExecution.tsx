import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Button, Dialog, DialogClose, Notice } from '../../design-system';
import { isSameSessionData } from '../../session';
import { isRunning, useCancelExecution, type Execution } from '../api';
import { CANCELLING_REASON, cancelDescription, cancelErrorMessage } from './messages';

/** The reason beside the disabled button once the cancel was asked. */
export const CANCEL_REQUESTED_REASON = 'O cancelamento já foi pedido';

export interface CancelExecutionProps {
  execution: Execution;
  /** The button label: "Cancelar execução" in the header, "Cancelar" in the pre-validation alert (E7-21). */
  label?: string;
  /** Another reason to keep the button disabled (e.g. while "Prosseguir" is in flight). */
  disabledReason?: string;
  /** The button was pressed: the panel opens its dialog, which the button does not own (see `CancelDialog`). */
  onRequest: (button: HTMLButtonElement | null) => void;
}

/**
 * The "Cancelar execução" button, shown only while the execution has not finished; render it only with the permission of
 * the mode (`executions.trigger` in the batch, `simulations.run` in the simulation). It owns nothing but the button: the
 * header and the pre-validation alert each have one, and both open the same `CancelDialog`, so a change of the execution
 * that moves the button from one place to the other does not take the dialog down with it.
 */
export function CancelExecution({ execution, label = 'Cancelar execução', disabledReason, onRequest }: CancelExecutionProps) {
  const button = useRef<HTMLButtonElement>(null);
  if (!isRunning(execution.status)) return null;
  return (
    <Button
      ref={button}
      disabledReason={execution.cancel_requested_at !== null ? CANCEL_REQUESTED_REASON : disabledReason}
      onClick={() => onRequest(button.current)}
    >
      {label}
    </Button>
  );
}

export interface CancelDialogProps {
  execution: Execution;
  open: boolean;
  onClose: () => void;
  /** The button that opened the dialog; when it is gone by the time the dialog closes, the focus goes to `fallbackFocus`. */
  origin: HTMLElement | null;
  fallbackFocus: () => HTMLElement | null;
}

/**
 * The confirmation of "Cancelar execução" (E6-21), locked while the request is in flight (ADR 0064). It lives in the panel,
 * not in a button: `409 execution_finished` stays in the dialog, explained, while the panel shows how the execution ended,
 * even though the button that opened it (the alert's) is no longer on screen. In the pre-validation, nothing was calculated
 * yet, and the text says so.
 */
export function CancelDialog({ execution, open, onClose, origin, fallbackFocus }: CancelDialogProps) {
  const cancel = useCancelExecution(execution.id);
  const queryClient = useQueryClient();
  const sending = cancel.isPending;

  function close() {
    if (sending) return;
    onClose();
    cancel.reset();
  }

  function confirm() {
    if (sending) return;
    cancel.mutate(undefined, {
      onSuccess: (_execution, _variables, mark) => {
        if (isSameSessionData(queryClient, mark)) onClose();
      },
    });
  }

  if (!open) return null;
  return (
    <Dialog
      open
      focusOnClose={() => (origin?.isConnected ? origin : fallbackFocus())}
      onOpenChange={(next) => (next ? undefined : close())}
      title="Cancelar execução"
      description={cancelDescription(execution.status)}
      actions={
        <>
          <DialogClose>
            <Button disabledReason={sending ? CANCELLING_REASON : undefined}>Voltar</Button>
          </DialogClose>
          <Button variant="danger" loading={sending} onClick={confirm}>
            Cancelar execução
          </Button>
        </>
      }
    >
      {cancel.isError ? (
        <Notice type="error" title="Não foi possível cancelar">
          {cancelErrorMessage(cancel.error)}
        </Notice>
      ) : null}
    </Dialog>
  );
}
