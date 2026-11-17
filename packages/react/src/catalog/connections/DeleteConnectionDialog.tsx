import { Notice, Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { deleteErrorMessage } from './messages';
import { errorWithCode, useDeleteConnection, type Connection } from './queries';

export const IN_USE_REASON = 'A conexão é usada por datasets';
export const NOT_FOUND_REASON = 'A conexão já foi removida';

export interface DeleteConnectionDialogProps {
  connection: Connection;
  /** Called on close (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after deleting: the screen leaves the detail. */
  onDeleted: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * Confirmation to delete a connection and its stored credential. The dangerous action is red (estilos.md §7.7). A connection
 * used by a dataset is not deleted (`connection_in_use`): the dialog says what to do and the button stays disabled with the reason.
 */
export function DeleteConnectionDialog({ connection, onClose, onDeleted, focusOnClose }: DeleteConnectionDialogProps) {
  const deletion = useDeleteConnection(connection.id);
  const error = deletion.error;
  const disabledReason = errorWithCode(error, ['connection_in_use'])
    ? IN_USE_REASON
    : errorWithCode(error, ['not_found'])
      ? NOT_FOUND_REASON
      : undefined;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover conexão"
      description={`${connection.name} e a credencial guardada saem do catálogo. Não é possível desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deletion.isPending}
            disabledReason={disabledReason}
            onClick={() => deletion.mutate(undefined, { onSuccess: onDeleted })}
          >
            Remover conexão
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
