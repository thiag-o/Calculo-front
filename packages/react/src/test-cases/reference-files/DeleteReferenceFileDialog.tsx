import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api';
import { Button, Dialog, DialogClose, Notice, type DialogProps } from '../../design-system';
import { isSameSessionData } from '../../session';
import { deleteErrorMessage } from './messages';
import { useDeleteReferenceFile, type ReferenceFile } from './queries';

export const NOT_FOUND_REASON = 'O arquivo já foi removido';

/** The reason beside the disabled "Cancelar" while the removal is on its way (ADR 0064). */
export const REMOVING_REASON = 'Aguarde a remoção do arquivo';

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
 * simulations made with the file stay, with its name. Locked while the request is in flight (ADR 0064): Esc, "Fechar" and
 * "Cancelar" wait for the answer.
 */
export function DeleteReferenceFileDialog({ workflowId, file, focusOnClose, onClose, onDeleted }: DeleteReferenceFileDialogProps) {
  const deletion = useDeleteReferenceFile(workflowId);
  const queryClient = useQueryClient();
  const error = deletion.error;
  const gone = error instanceof ApiError && error.code === 'not_found';

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        // Locked while the removal is on its way: closing now would hide its answer.
        if (!open && !deletion.isPending) onClose();
      }}
      title="Remover arquivo"
      description={`${file.name} sai dos testes deste workflow e a cópia guardada é apagada. As simulações feitas com ele continuam. Não é possível desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button disabledReason={deletion.isPending ? REMOVING_REASON : undefined}>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deletion.isPending}
            disabledReason={gone ? NOT_FOUND_REASON : undefined}
            onClick={() =>
              deletion.mutate(file.id, {
                // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) changes nothing (ADR 0015).
                onSuccess: (_data, _fileId, mark) => {
                  if (isSameSessionData(queryClient, mark)) onDeleted();
                },
              })
            }
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
