import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, Dialog, DialogClose, Select, TextField, type DialogProps } from '../../design-system';
import { CredentialFields, FormErrorNotice, credentialSchema, fieldError, toCredential, useResetOnChange } from './CredentialFields';
import { CooldownAnnouncer, CooldownNotice } from './CooldownNotice';
import { DEFAULT_PORTS, TYPE_LABELS } from './format';
import { formError, isTooManyTests } from './messages';
import { useCreateConnection, useTestCredential, type Connection, type ConnectionType } from './queries';
import { TestResult } from './TestStatus';
import { useTestCooldown } from './useTestCooldown';

const TYPES = ['postgres', 'sqlserver'] as const satisfies readonly ConnectionType[];

const schema = credentialSchema.extend({
  name: z.string().trim().min(1, 'Informe o nome da conexão'),
  type: z.enum(TYPES),
});

type NewConnectionValues = z.infer<typeof schema>;

export interface NewConnectionDialogProps {
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). The form state goes away with the dialog. */
  onClose: () => void;
  /** Called after saving, with the new connection (without the credential). */
  onCreated?: (connection: Connection) => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Nova conexão": type, name and the credential (host, port, database, user and password). "Testar" checks the credential
 * without saving and shows version, TLS, read-only and time; "Salvar" creates the connection, which the API tests again
 * and saves only if it passes. Mount it only while open: closing (Cancelar, Esc, "Fechar" or after saving) unmounts the
 * form and discards what was typed; the credential never goes into the query cache (design.md §4).
 */
export function NewConnectionDialog({ onClose, onCreated, focusOnClose }: NewConnectionDialogProps) {
  const formId = useId();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<NewConnectionValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: 'postgres', host: '', port: String(DEFAULT_PORTS.postgres), database: '', username: '', password: '' },
  });

  const test = useTestCredential(() => ({ type: getValues('type'), credential: toCredential(getValues()) }));
  const create = useCreateConnection(() => ({
    name: getValues('name').trim(),
    type: getValues('type'),
    credential: toCredential(getValues()),
  }));
  useResetOnChange(watch, test.reset);

  const apiError = create.error ? formError(create.error) : undefined;
  const testError = test.error ? formError(test.error) : undefined;
  // The limit is shared by the test and the save: a `429` from either one holds "Testar" until the wait ends.
  const cooldown = useTestCooldown([test.error, create.error].find(isTooManyTests));

  const runTest = handleSubmit(() => {
    if (!test.isPending) test.mutate();
  });
  const save = handleSubmit(() => {
    if (create.isPending) return;
    create.mutate(undefined, {
      onSuccess: (connection) => {
        // The typed credential leaves the form before the dialog closes.
        reset();
        onCreated?.(connection);
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
      title="Nova conexão"
      description="A credencial vai direto para a API, fica guardada cifrada e nunca volta para a tela. Use um usuário do banco só de leitura."
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button loading={test.isPending} disabledReason={cooldown.reason} showReason="beside" onClick={() => void runTest()}>
            Testar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-connections-form" onSubmit={save} noValidate>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <Select
              ref={field.ref}
              label="Tipo"
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              error={fieldError(errors, apiError, 'type')}
              options={TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
              onValueChange={(value) => {
                const type = TYPES.find((item) => item === value);
                if (!type) return;
                // The port follows the type while it is the previous type's default (or empty).
                const port = getValues('port').trim();
                if (port === '' || port === String(DEFAULT_PORTS[field.value])) {
                  setValue('port', String(DEFAULT_PORTS[type]), { shouldValidate: Boolean(errors.port) });
                }
                field.onChange(type);
              }}
            />
          )}
        />
        <TextField
          label="Nome"
          autoComplete="off"
          placeholder="ERP de faturamento"
          error={fieldError(errors, apiError, 'name')}
          {...register('name')}
        />
        <CredentialFields register={register} errors={errors} apiError={apiError} />
        {isTooManyTests(create.error) ? <CooldownNotice reason={cooldown.reason} /> : <FormErrorNotice error={apiError} />}
        <CooldownAnnouncer announcement={cooldown.announcement} />
        <div aria-live="polite">{test.data ? <TestResult result={test.data} /> : null}</div>
        {testError?.message && !isTooManyTests(test.error) ? <Notice type="error">{testError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
