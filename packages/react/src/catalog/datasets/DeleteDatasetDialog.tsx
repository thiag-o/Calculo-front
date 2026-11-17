import { Notice, Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { errorWithCode, useDeleteDataset, type Dataset } from './queries';
import { deleteErrorMessage } from './messages';

export const DELETE_NOT_FOUND_REASON = 'O dataset não existe mais';

export interface DeleteDatasetDialogProps {
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
  dataset: Dataset;
  /** Called on close without deleting (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after deleting. */
  onDeleted: () => void;
}

/** Confirmation to delete a dataset, which takes its variables along. The dangerous action is red (estilos.md §7.7). */
export function DeleteDatasetDialog({ dataset, onClose, onDeleted, focusOnClose }: DeleteDatasetDialogProps) {
  const deleteMutation = useDeleteDataset();
  const error = deleteMutation.error;
  // After this error, trying again changes nothing: the button stays disabled, with the reason.
  const disabledReason = errorWithCode(error, ['not_found']) ? DELETE_NOT_FOUND_REASON : undefined;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover dataset"
      description={`O dataset ${dataset.name} deixa de existir neste tenant, e as variáveis dele também são removidas. Não dá para desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            disabledReason={disabledReason}
            onClick={() => deleteMutation.mutate(dataset.id, { onSuccess: onDeleted })}
          >
            Remover dataset
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
