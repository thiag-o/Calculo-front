import { useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, TextField, Dialog, DialogClose, Text, type DialogProps } from '../../design-system';
import { useGenerateResetLink, type User } from './queries';
import { CopyIcon } from './icons';
import { linkErrorMessage } from './messages';

/** Errors where generating again does not help: the user changed since the list was loaded. */
const NO_RETRY_CODES = new Set(['inactive_user', 'external_user', 'not_found']);
const NO_RETRY_REASON = 'Feche e confira o usuário na lista atualizada';

export const COPY_FAILED_MESSAGE = 'Não foi possível copiar. Selecione o link e copie com Ctrl C.';

const validityFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Válido até 16/11, 14:30. Funciona uma vez só." in the user's time zone. */
export function validityText(expiresAt: string): string {
  const when = new Date(expiresAt);
  const expiry = Number.isNaN(when.getTime()) ? '' : `Válido até ${validityFormat.format(when)}. `;
  return `${expiry}Funciona uma vez só.`;
}

export interface ResetLinkDialogProps {
  user: User;
  /** Called on close. The link goes away with the dialog: mount it only while open. */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Gerar link de redefinição": confirms, generates and shows the link a single time, with "Copiar".
 * The link lives only in this dialog's state (the mutation leaves the cache on unmount); closing discards it.
 */
export function ResetLinkDialog({ user, onClose, focusOnClose }: ResetLinkDialogProps) {
  const generate = useGenerateResetLink();
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | undefined>(undefined);
  const link = generate.data;

  const noRetry = generate.error instanceof ApiError && NO_RETRY_CODES.has(generate.error.code);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.link);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Link de redefinição"
      description={
        link
          ? `Entregue o link a ${user.name} para definir a senha.`
          : `Gera um link de uso único para ${user.name} definir a senha. Um link novo invalida os anteriores.`
      }
      actions={
        link ? (
          <>
            <DialogClose>
              <Button>Fechar</Button>
            </DialogClose>
            <Button variant="primary" icon={<CopyIcon />} onClick={() => void copy()}>
              Copiar
            </Button>
          </>
        ) : (
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={generate.isPending}
              disabledReason={noRetry ? NO_RETRY_REASON : undefined}
              onClick={() => generate.mutate(user.id)}
            >
              Gerar link de redefinição
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="fc-users-link">
          <Notice type="warning">Copie o link agora: ele não será mostrado de novo.</Notice>
          <TextField
            label="Link"
            value={link.link}
            readOnly
            autoFocus
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            tooltip={validityText(link.expires_at)}
          />
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-users-link-copy" role="status">
            {copyStatus === 'copied' ? 'Link copiado' : ''}
          </Text>
          {copyStatus === 'failed' ? <Notice type="error">{COPY_FAILED_MESSAGE}</Notice> : null}
        </div>
      ) : generate.isError ? (
        <Notice type="error">{linkErrorMessage(generate.error)}</Notice>
      ) : null}
    </Dialog>
  );
}
