import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, TextField, Dialog, DialogClose, type DialogProps, Text } from '../../design-system';
import { useCreateApiKey } from './queries';
import { CopyIcon } from './icons';
import { newApiKeyError } from './messages';

export const COPY_FAILED_MESSAGE = 'Não foi possível copiar. Selecione a chave e copie com Ctrl C.';
export const KEY_SHOWN_ONCE_NOTICE = 'Copie a chave agora: ela não será mostrada de novo.';

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome'),
});

type NewApiKeyData = z.infer<typeof schema>;

export interface NewApiKeyDialogProps {
  /** Called on close. The key goes away with the dialog: mount it only while open. */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Nova chave de API": asks for the name, creates the key and shows it a single time, with "Copiar" and the notice that it will not
 * be shown again. The key lives only in this dialog's mutation result (`gcTime: 0`, ADR 0021): closing unmounts
 * the dialog and discards it; it never goes to the query cache, to outside state or to storage.
 */
export function NewApiKeyDialog({ onClose, focusOnClose }: NewApiKeyDialogProps) {
  const formId = useId();
  const create = useCreateApiKey();
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | undefined>(undefined);
  const created = create.data;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewApiKeyData>({ resolver: zodResolver(schema), defaultValues: { name: '' } });

  const apiError = create.error ? newApiKeyError(create.error) : undefined;

  const submit = handleSubmit((data) => {
    if (create.isPending || created) return;
    create.mutate({ name: data.name });
  });

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
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
      title="Nova chave de API"
      description={
        created
          ? `Configure a chave ${created.name} no backend do sistema hospedeiro, no cabeçalho Authorization: ApiKey <chave>.`
          : 'O backend do sistema hospedeiro usa a chave para pedir tokens de incorporação deste tenant.'
      }
      actions={
        created ? (
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
            <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
              Salvar
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="fc-integration-secret">
          <Notice type="warning">{KEY_SHOWN_ONCE_NOTICE}</Notice>
          <TextField
            label="Chave"
            value={created.key}
            readOnly
            autoFocus
            autoComplete="off"
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            tooltip={`Na lista, ela aparece só pelo começo: ${created.prefix}…`}
          />
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-integration-copy" role="status">
            {copyStatus === 'copied' ? 'Chave copiada' : ''}
          </Text>
          {copyStatus === 'failed' ? <Notice type="error">{COPY_FAILED_MESSAGE}</Notice> : null}
        </div>
      ) : (
        <form id={formId} className="fc-integration-form" onSubmit={submit} noValidate>
          <TextField
            label="Nome"
            autoComplete="off"
            tooltip="Para reconhecer onde a chave é usada, como Portal do cliente. Pode repetir."
            error={errors.name?.message ?? apiError?.field}
            {...register('name')}
          />
          {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
        </form>
      )}
    </Dialog>
  );
}
