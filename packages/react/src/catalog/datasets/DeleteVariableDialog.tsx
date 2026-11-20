import { Notice, Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { ReloadNotice } from '../errors';
import { errorWithCode, useDeleteVariable, useReloadDataset, type Variable } from './queries';
import { deleteVariableErrorMessage } from './messages';

export const DELETE_VARIABLE_NOT_FOUND_REASON = 'A variável não existe mais';

export interface DeleteVariableDialogProps {
  /** Who gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
  variable: Variable;
  /** Called on close (Cancelar, Esc, "Fechar" or after deleting). */
  onClose: () => void;
}

/** Confirmation to delete a variable; the column stays in the dataset. The dangerous action is red (estilos.md §7.7). */
export function DeleteVariableDialog({ variable, onClose, focusOnClose }: DeleteVariableDialogProps) {
  const deleteMutation = useDeleteVariable(variable.dataset_id);
  const reloadDataset = useReloadDataset(variable.dataset_id);
  const error = deleteMutation.error;
  // After this error, trying again changes nothing: the button stays disabled, with the reason.
  const disabledReason = errorWithCode(error, ['not_found']) ? DELETE_VARIABLE_NOT_FOUND_REASON : undefined;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover variável"
      description={`A variável ${variable.name} deixa de existir neste dataset; a coluna ${variable.column} continua. Não dá para desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            disabledReason={disabledReason}
            onClick={() => deleteMutation.mutate(variable.id, { onSuccess: onClose })}
          >
            Remover variável
          </Button>
        </>
      }
    >
      {error && errorWithCode(error, ['variable_changed']) ? (
        <ReloadNotice
          message={deleteVariableErrorMessage(error)}
          onReload={async () => {
            await reloadDataset();
            onClose();
          }}
        />
      ) : error ? (
        <Notice type="error">{deleteVariableErrorMessage(error)}</Notice>
      ) : null}
    </Dialog>
  );
}
