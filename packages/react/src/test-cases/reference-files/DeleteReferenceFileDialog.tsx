import { ApiError } from '../../api';
import { Button, Dialog, DialogClose, Notice, type DialogProps } from '../../design-system';
import { deleteErrorMessage } from './messages';
import { useDeleteReferenceFile, type ReferenceFile } from './queries';

export const NOT_FOUND_REASON = 'O arquivo já foi removido';

export interface DeleteReferenceFileDialogProps {
  workflowId: string;
  file: ReferenceFile;
  /** Who gets focus on close. */
  focusOnClose?: DialogProps['focusOnClose'];
  /** Called on close without removing (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after removing. */
  onDeleted: () => void;
}

/**
 * Confirmation to remove a reference file and the stored copy (E7-25). The dangerous action is red (estilos.md §7.7). The
 * simulations made with the file stay, with its name.
 */
export function DeleteReferenceFileDialog({ workflowId, file, focusOnClose, onClose, onDeleted }: DeleteReferenceFileDialogProps) {
  const deletion = useDeleteReferenceFile(workflowId);
  const error = deletion.error;
  const gone = error instanceof ApiError && error.code === 'not_found';

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover arquivo"
      description={`${file.name} sai dos testes deste workflow e a cópia guardada é apagada. As simulações feitas com ele continuam. Não é possível desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deletion.isPending}
            disabledReason={gone ? NOT_FOUND_REASON : undefined}
            onClick={() => deletion.mutate(file.id, { onSuccess: onDeleted })}
          >
            Remover arquivo
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
