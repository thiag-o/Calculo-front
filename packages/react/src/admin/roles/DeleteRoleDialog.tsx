import { Notice, Button, Dialog, DialogClose } from '../../design-system';
import { errorWithCode, useDeleteRole, type Role } from './queries';
import { deleteErrorMessage } from './messages';

export const DELETE_IN_USE_REASON = 'Tire o papel dos usuários antes de remover';
export const DELETE_NOT_FOUND_REASON = 'O papel não existe mais';
export const DELETE_FIXED_REASON = 'O Admin não pode ser removido';

export interface DeleteRoleDialogProps {
  /** The role to delete. Never the Admin (`fixed`), which cannot be deleted. */
  role: Role;
  /** Called on close (Cancelar, Esc, "Fechar" or after deleting). */
  onClose: () => void;
}

/** Confirmation to delete a role. The dangerous action is red (estilos.md §7.7). */
export function DeleteRoleDialog({ role, onClose }: DeleteRoleDialogProps) {
  const deleteMutation = useDeleteRole();
  const error = deleteMutation.error;
  // After these errors, trying again changes nothing: the button stays disabled, with the reason.
  const disabledReason = errorWithCode(error, ['role_in_use'])
    ? DELETE_IN_USE_REASON
    : errorWithCode(error, ['not_found'])
      ? DELETE_NOT_FOUND_REASON
      : errorWithCode(error, ['fixed_role'])
        ? DELETE_FIXED_REASON
        : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover papel"
      description={`O papel ${role.name} deixa de existir neste tenant. Não dá para desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            disabledReason={disabledReason}
            onClick={() => deleteMutation.mutate(role.id, { onSuccess: onClose })}
          >
            Remover papel
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
