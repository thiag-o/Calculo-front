import { Notice, Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { errorWithCode, useRevokeApiKey, type ApiKey } from './queries';
import { revokeErrorMessage } from './messages';

export const REVOKE_NOT_FOUND_REASON = 'A chave não existe mais';

export interface RevokeApiKeyDialogProps {
  /** A chave a revogar (ainda ativa). */
  apiKey: ApiKey;
  /** Called on close (Cancelar, Esc, "Fechar" or after revoking). */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/** Confirmation to revoke an API key. The dangerous action is red (estilos.md §7.7). */
export function RevokeApiKeyDialog({ apiKey, onClose, focusOnClose }: RevokeApiKeyDialogProps) {
  const revoke = useRevokeApiKey();
  const error = revoke.error;
  // After this error, trying again changes nothing: the button stays disabled, with the reason.
  const disabledReason = errorWithCode(error, ['not_found']) ? REVOKE_NOT_FOUND_REASON : undefined;

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Revogar chave"
      description={`A chave ${apiKey.name} (${apiKey.prefix}…) para de funcionar: o sistema que a usa não consegue mais pedir tokens de incorporação. Não dá para desfazer.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={revoke.isPending}
            disabledReason={disabledReason}
            onClick={() => revoke.mutate(apiKey.id, { onSuccess: onClose })}
          >
            Revogar chave
          </Button>
        </>
      }
    >
      {error ? <Notice type="error">{revokeErrorMessage(error)}</Notice> : null}
    </Dialog>
  );
}
