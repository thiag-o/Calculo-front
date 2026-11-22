import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Button, Dialog, DialogClose, Notice } from '../../design-system';
import { isSameSessionData } from '../../session';
import { isRunning, useCancelExecution, type Execution } from '../api';
import { CANCELLING_REASON, cancelErrorMessage } from './messages';

/** The reason beside the disabled button once the cancel was asked. */
export const CANCEL_REQUESTED_REASON = 'O cancelamento já foi pedido';

/**
 * "Cancelar execução" (E6-21), with confirmation, while the execution has not finished. The dialog is locked while the
 * request is in flight (ADR 0064). `409 execution_finished` stays in the dialog, explained, while the panel shows how it
 * ended. The button shows only while the execution runs; render it only with `executions.trigger`.
 */
export function CancelExecution({ execution }: { execution: Execution }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const cancel = useCancelExecution(execution.id);
  const queryClient = useQueryClient();
  const sending = cancel.isPending;
  const requested = execution.cancel_requested_at !== null;
  const running = isRunning(execution.status);

  function close() {
    if (sending) return;
    setOpen(false);
    cancel.reset();
  }

  function confirm() {
    if (sending) return;
    cancel.mutate(undefined, {
      onSuccess: (_execution, _variables, mark) => {
        if (isSameSessionData(queryClient, mark)) setOpen(false);
      },
    });
  }

  return (
    <>
      {running ? (
        <Button
          ref={button}
          disabledReason={requested ? CANCEL_REQUESTED_REASON : undefined}
          onClick={() => {
            cancel.reset();
            setOpen(true);
          }}
        >
          Cancelar execução
        </Button>
      ) : null}
      {open ? (
        <Dialog
          open
          focusOnClose={button}
          onOpenChange={(next) => (next ? undefined : close())}
          title="Cancelar execução"
          description="Os registros já calculados não são entregues e a execução não gera CSV. Não é possível desfazer."
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
      ) : null}
    </>
  );
}
