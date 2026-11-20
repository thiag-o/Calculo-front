import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, Dialog, DialogClose, TextField, type DialogProps } from '../../design-system';
import { fieldError } from './CredentialFields';
import { ReloadNotice, conflictMessage, isChangedConflict } from '../errors';
import { formError } from './messages';
import { useRenameConnection, type Connection } from './queries';

const schema = z.object({ name: z.string().trim().min(1, 'Informe o nome da conexão') });

type RenameValues = z.infer<typeof schema>;

export interface RenameConnectionDialogProps {
  connection: Connection;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
  /** Fetches the connection again after a `409 connection_changed` ("Recarregar"). */
  onReload: () => Promise<unknown>;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/** "Renomear conexão": changes only the name; the credential changes through "Trocar credencial". */
export function RenameConnectionDialog({ connection, onClose, onReload, focusOnClose }: RenameConnectionDialogProps) {
  const formId = useId();
  const rename = useRenameConnection(connection.id);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RenameValues>({ resolver: zodResolver(schema), defaultValues: { name: connection.name } });

  const apiError = rename.error ? formError(rename.error) : undefined;

  const save = handleSubmit((values) => {
    if (rename.isPending) return;
    rename.mutate(values.name, { onSuccess: onClose });
  });

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Renomear conexão"
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={rename.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-connections-form" onSubmit={save} noValidate>
        <TextField label="Nome" autoComplete="off" error={fieldError(errors, apiError, 'name')} {...register('name')} />
        {apiError?.message ? (
          isChangedConflict(rename.error) ? (
            <ReloadNotice message={conflictMessage(rename.error)} onReload={onReload} />
          ) : (
            <Notice type="error">{apiError.message}</Notice>
          )
        ) : null}
      </form>
    </Dialog>
  );
}
