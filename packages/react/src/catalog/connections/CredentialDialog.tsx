import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { Notice, Button, Dialog, DialogClose, type DialogProps } from '../../design-system';
import { CredentialFields, FormErrorNotice, credentialSchema, toCredential, useResetOnChange, type CredentialValues } from './CredentialFields';
import { DEFAULT_PORTS } from './format';
import { ReloadNotice, conflictMessage } from '../errors';
import { formError, isConnectionChanged, isTooManyTests } from './messages';
import { useTestCredential, useUpdateCredential, type Connection } from './queries';
import { TestResult } from './TestStatus';
import { useTestCooldown } from './useTestCooldown';

export interface CredentialDialogProps {
  connection: Connection;
  /** Shows "Testar" (test without saving), which also needs `connections.manage`. */
  canTest: boolean;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). The form state goes away with the dialog. */
  onClose: () => void;
  /** Fetches the connection again after a `409 connection_changed` ("Recarregar"). */
  onReload: () => Promise<unknown>;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Trocar credencial" (only with `credentials.manage`): the target (host, port, database and user) comes filled in and the
 * password empty, because the stored one never comes back; saving needs the five fields, and the API tests them before
 * saving. Mount it only while open: closing unmounts the form and discards what was typed (design.md §4).
 */
export function CredentialDialog({ connection, canTest, onClose, onReload, focusOnClose }: CredentialDialogProps) {
  const formId = useId();
  const target = connection.target;
  const {
    register,
    handleSubmit,
    getValues,
    watch,
    reset,
    formState: { errors },
  } = useForm<CredentialValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      host: target?.host ?? '',
      port: String(target?.port ?? DEFAULT_PORTS[connection.type]),
      database: target?.database ?? '',
      username: target?.username ?? '',
      password: '',
    },
  });

  const test = useTestCredential(() => ({ type: connection.type, credential: toCredential(getValues()) }));
  const update = useUpdateCredential(connection.id, () => toCredential(getValues()));
  useResetOnChange(watch, test.reset);

  const apiError = update.error ? formError(update.error) : undefined;
  const testError = test.error ? formError(test.error) : undefined;
  // The limit is shared by the test and the save: a `429` from either one holds "Testar" until the wait ends.
  const cooldown = useTestCooldown([test.error, update.error].find(isTooManyTests));

  const runTest = handleSubmit(() => {
    if (!test.isPending) test.mutate();
  });
  const save = handleSubmit(() => {
    if (update.isPending) return;
    update.mutate(undefined, {
      onSuccess: () => {
        // The typed credential leaves the form before the dialog closes.
        reset();
        onClose();
      },
    });
  });

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Trocar credencial"
      description={`Informe os cinco campos de ${connection.name}. A senha guardada nunca volta para a tela: digite-a de novo.`}
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          {canTest ? (
            <Button loading={test.isPending} disabledReason={cooldown.reason} showReason="beside" onClick={() => void runTest()}>
              Testar
            </Button>
          ) : null}
          <Button type="submit" form={formId} variant="primary" loading={update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-connections-form" onSubmit={save} noValidate>
        <CredentialFields register={register} errors={errors} apiError={apiError} />
        {apiError?.message && isConnectionChanged(update.error) ? (
          <ReloadNotice message={conflictMessage(update.error)} onReload={onReload} />
        ) : (
          <FormErrorNotice error={apiError} />
        )}
        <div aria-live="polite">{test.data ? <TestResult result={test.data} /> : null}</div>
        {testError?.message && !isTooManyTests(test.error) ? <Notice type="error">{testError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
