import { ApiError } from '../../api';
import { Button, Dialog, DialogClose, Notice, type DialogProps } from '../../design-system';
import { useDeleteWorkflow, type Workflow } from '../queries';
import { GONE_REASON, deleteErrorMessage } from './messages';

export interface DeleteWorkflowDialogProps {
  workflow: Workflow;
  /** Called on close without removing (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after removing; the workflow and its draft have already left the cache. */
  onDeleted: () => void;
  /** Who gets focus on close (the "…" button that opened the menu). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * Confirmation to remove a workflow, with its name (`DELETE /v1/workflows/{id}`). The draft goes along. The dangerous
 * action is red (estilos.md §7.7).
 */
export function DeleteWorkflowDialog({ workflow, onClose, onDeleted, focusOnClose }: DeleteWorkflowDialogProps) {
  const remove = useDeleteWorkflow();
  const error = remove.error;
  // After this error, trying again changes nothing: the button stays disabled, with the reason.
  const gone = error instanceof ApiError && error.code === 'not_found';

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover workflow"
      description={`O workflow ${workflow.name} e o rascunho dele deixam de existir neste tenant. Não dá para desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={remove.isPending}
            disabledReason={gone ? GONE_REASON : undefined}
            onClick={() => remove.mutate(workflow.id, { onSuccess: onDeleted })}
          >
            Remover workflow
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
