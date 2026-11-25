import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api';
import { Button, Dialog, DialogClose, Notice, type DialogProps } from '../../design-system';
import { isSameSessionData } from '../../session';
import { changeErrorMessage } from './messages';
import { useDeleteSchedule, type Schedule } from './queries';

export interface DeleteScheduleDialogProps {
  schedule: Schedule;
  /** Called on close without removing (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after removing (or when it was already removed by someone else); the lists are fetched again. */
  onDeleted: () => void;
  /** Who gets focus on close (the "…" button that opened the menu). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * Confirmation to remove a schedule (`DELETE /v1/schedules/{id}`), with its name. The executions it already triggered stay.
 * The dangerous action is red (estilos.md §7.7).
 */
export function DeleteScheduleDialog({ schedule, onClose, onDeleted, focusOnClose }: DeleteScheduleDialogProps) {
  const queryClient = useQueryClient();
  const remove = useDeleteSchedule();

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose();
      }}
      title="Remover agendamento"
      description={`O agendamento ${schedule.name} deixa de disparar. As execuções que ele já disparou continuam na lista. Não dá para desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button disabledReason={remove.isPending ? 'Aguarde a remoção do agendamento' : undefined}>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(schedule.id, {
                onSuccess: (_data, _id, mark) => {
                  if (isSameSessionData(queryClient, mark)) onDeleted();
                },
                onError: (error, _id, mark) => {
                  // Already removed by someone else: what was asked is done.
                  if (isSameSessionData(queryClient, mark) && error instanceof ApiError && error.code === 'not_found') onDeleted();
                },
              })
            }
          >
            Remover agendamento
          </Button>
        </>
      }
    >
      {remove.error && !(remove.error instanceof ApiError && remove.error.code === 'not_found') ? (
        <Notice type="error">{changeErrorMessage(remove.error)}</Notice>
      ) : null}
    </Dialog>
  );
}
