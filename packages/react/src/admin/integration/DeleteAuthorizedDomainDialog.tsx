import { Notice, Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { errorWithCode, useDeleteAuthorizedDomain, type AuthorizedDomain } from './queries';
import { deleteErrorMessage } from './messages';

export const DELETE_NOT_FOUND_REASON = 'O domínio já foi removido';

export interface DeleteAuthorizedDomainDialogProps {
  authorizedDomain: AuthorizedDomain;
  /** Called on close (Cancelar, Esc, "Fechar" or after deleting). */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/** Confirmation to delete an authorized domain. The dangerous action is red (estilos.md §7.7). */
export function DeleteAuthorizedDomainDialog({ authorizedDomain, onClose, focusOnClose }: DeleteAuthorizedDomainDialogProps) {
  const deleteMutation = useDeleteAuthorizedDomain();
  const error = deleteMutation.error;
  const disabledReason = errorWithCode(error, ['nao_encontrado']) ? DELETE_NOT_FOUND_REASON : undefined;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Remover domínio"
      description={`${authorizedDomain.origem} deixa de poder chamar a API com o token deste tenant: o módulo incorporado nessa origem para de funcionar.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            disabledReason={disabledReason}
            onClick={() => deleteMutation.mutate(authorizedDomain.id, { onSuccess: onClose })}
          >
            Remover domínio
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{deleteErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
