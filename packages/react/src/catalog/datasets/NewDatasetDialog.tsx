import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../api';
import { Notice, Button, TextField, Loading, Dialog, DialogClose, Select, Text, type DialogProps } from '../../design-system';
import { ColumnsTable } from '../columns';
import { useCreateDataset, useDatasetConnections, useObjectColumns, type Dataset, type NewDataset } from './queries';
import { ObjectPicker, type ChosenObject } from './ObjectPicker';
import { SqlField } from './SqlField';
import {
  NO_CONNECTIONS_PERMISSION_MESSAGE,
  UNKNOWN_CONNECTION_MESSAGE,
  UNKNOWN_OBJECT_MESSAGE,
  createError,
  queryErrorMessage,
} from './messages';
import { isCredentialUnreadable } from '../errors';
import { UnreadableCredentialNotice } from './UnreadableCredentialNotice';

export const CONNECTIONS_LOADING_REASON = 'Aguarde a lista de conexões';
export const CONNECTIONS_ERROR_REASON = 'Carregue a lista de conexões para salvar';
export const NO_CONNECTIONS_PERMISSION_REASON = 'Peça a permissão de ver conexões para criar um dataset';
export const NO_CONNECTIONS_REASON = 'Cadastre uma conexão na aba Conexões para criar um dataset';
/** Discreet note below the picker when fetching the connections again failed: the list already loaded still holds. */
export const CONNECTIONS_STALE_NOTE = 'Não foi possível atualizar a lista de conexões; ela mostra a última carregada.';

/** The maximum SQL length the API accepts. */
const SQL_MAX_LENGTH = 100_000;

const schema = z
  .object({
    kind: z.enum(['table', 'sql']),
    connectionId: z.string(),
    object: z.object({ schema_name: z.string(), name: z.string() }).nullable(),
    sql: z.string(),
    name: z.string(),
  })
  // One refinement for everything, so every field error shows at once.
  .superRefine((data, context) => {
    if (data.connectionId === '') context.addIssue({ code: 'custom', path: ['connectionId'], message: 'Escolha a conexão' });
    if (data.kind === 'table' && data.connectionId !== '' && data.object === null) {
      context.addIssue({ code: 'custom', path: ['object'], message: 'Escolha uma tabela ou view' });
    }
    if (data.kind === 'sql' && data.sql.trim() === '') context.addIssue({ code: 'custom', path: ['sql'], message: 'Escreva o SQL' });
    if (data.name.trim() === '') context.addIssue({ code: 'custom', path: ['name'], message: 'Informe o nome do dataset' });
  });

type FormFields = z.infer<typeof schema>;

const KIND_OPTIONS = [
  { value: 'table', label: 'Tabela ou view' },
  { value: 'sql', label: 'SQL livre' },
] as const;

export interface NewDatasetDialogProps {
  /** Who gets focus on close (the button that opened the dialog). */
  focusOnClose?: DialogProps['focusOnClose'];
  /** Whether the person may create a free SQL dataset (`free_sql.use`). Without it, only tables and views. */
  allowSql: boolean;
  /** Called on close without saving (Cancelar, Esc or "Fechar"). */
  onClose: () => void;
  /** Called after saving, with the created dataset. */
  onCreated: (dataset: Dataset) => void;
  /** Opens a connection, from the unreadable credential notice. */
  onOpenConnection?: (id: string) => void;
}

/**
 * "Novo dataset": pick the connection; then browse the tables and views (filter and "Carregar mais"), see the columns
 * of the chosen one and give the name. With `free_sql.use`, the origin can be free SQL, in a monospaced area; a refused
 * SQL shows the reason in the field. Mount it only while open: each opening starts from scratch.
 */
export function NewDatasetDialog({ allowSql, onClose, onCreated, onOpenConnection, focusOnClose }: NewDatasetDialogProps) {
  const formId = useId();
  const connections = useDatasetConnections();
  const create = useCreateDataset();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    clearErrors,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'table', connectionId: '', object: null, sql: '', name: '' },
  });
  const kind = useWatch({ control, name: 'kind' });
  const connectionId = useWatch({ control, name: 'connectionId' });
  const object = useWatch({ control, name: 'object' });
  const typedName = useWatch({ control, name: 'name' });
  const typedSql = useWatch({ control, name: 'sql' });

  const apiError = create.error ? createError(create.error) : undefined;

  // "Abrir conexão" leaves the dialog (and the tab), discarding the form: with an object chosen, a name or an SQL typed,
  // it asks first. Only the connection chosen is not worth asking about.
  const [pendingConnection, setPendingConnection] = useState<string | null>(null);
  const hasWork = object !== null || typedName.trim() !== '' || typedSql.trim() !== '';
  const openConnection = onOpenConnection
    ? (id: string) => (hasWork ? setPendingConnection(id) : onOpenConnection(id))
    : undefined;
  // A failed refetch in the background keeps the list already loaded: it still holds, with a discreet warning. Only a
  // list that never arrived blocks the picker and "Salvar".
  const connectionList = connections.data;
  const connectionsFailed = connections.isError && connectionList === undefined;
  const connectionsForbidden =
    connectionsFailed && connections.error instanceof ApiError && connections.error.code === 'no_permission';
  const disabledReason = connections.isPending
    ? CONNECTIONS_LOADING_REASON
    : connectionsForbidden
      ? NO_CONNECTIONS_PERMISSION_REASON
      : connectionsFailed
        ? CONNECTIONS_ERROR_REASON
        : connectionList?.length === 0
          ? NO_CONNECTIONS_REASON
          : undefined;

  const submit = handleSubmit((data) => {
    if (disabledReason) return;
    const name = data.name.trim();
    const body: NewDataset =
      data.kind === 'sql'
        ? { type: 'sql', name, connection_id: data.connectionId, sql: data.sql }
        : { type: 'table', name, connection_id: data.connectionId, schema_name: data.object?.schema_name ?? '', object_name: data.object?.name ?? '' };
    create.mutate(body, { onSuccess: onCreated });
  });

  function chooseObject(chosen: ChosenObject) {
    setValue('object', chosen);
    clearErrors('object');
    create.reset();
    // The object name is a good starting name, while the person has not typed one.
    if (!getFieldState('name').isDirty) setValue('name', chosen.name);
  }

  let connectionField;
  if (connectionList === undefined && !connectionsFailed) {
    connectionField = <Loading label="Carregando conexões" rows={1} />;
  } else if (connectionList === undefined) {
    connectionField = (
      <Notice
        type="error"
        title="Não foi possível carregar as conexões"
        actions={
          connectionsForbidden ? undefined : (
            <Button size="small" loading={connections.isFetching} onClick={() => void connections.refetch()}>
              Tentar de novo
            </Button>
          )
        }
      >
        {connectionsForbidden ? NO_CONNECTIONS_PERMISSION_MESSAGE : queryErrorMessage(connections.error, UNKNOWN_CONNECTION_MESSAGE)}
      </Notice>
    );
  } else if (connectionList.length === 0) {
    connectionField = (
      <Notice type="warning" title="Nenhuma conexão ainda">
        Cadastre uma conexão com o banco do cliente na aba Conexões e volte para criar o dataset.
      </Notice>
    );
  } else {
    connectionField = (
      <Controller
        control={control}
        name="connectionId"
        render={({ field }) => (
          <Select
            ref={field.ref}
            label="Conexão"
            options={connectionList.map((connection) => ({ value: connection.id, label: connection.name }))}
            tooltip={connections.isError ? CONNECTIONS_STALE_NOTE : undefined}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              // Another connection: the chosen object belonged to the previous one.
              setValue('object', null);
              create.reset();
            }}
            onBlur={field.onBlur}
            error={errors.connectionId?.message ?? apiError?.fields.connection}
          />
        )}
      />
    );
  }

  return (
    <>
      <Dialog
        open
        focusOnClose={focusOnClose}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        className="fc-datasets-dialog"
        title="Novo dataset"
        description={
          allowSql
            ? 'Um dataset lê uma tabela, uma view ou um SQL de uma conexão. As colunas são lidas ao salvar.'
            : 'Um dataset lê uma tabela ou uma view de uma conexão. As colunas são lidas ao salvar.'
        }
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button type="submit" form={formId} variant="primary" loading={create.isPending} disabledReason={disabledReason}>
              Salvar
            </Button>
          </>
        }
      >
        <form id={formId} className="fc-datasets-form" onSubmit={submit} noValidate>
          {allowSql ? (
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <Select
                  ref={field.ref}
                  label="Origem"
                  options={KIND_OPTIONS}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    create.reset();
                  }}
                  onBlur={field.onBlur}
                />
              )}
            />
          ) : null}

          {connectionField}

          {kind === 'table' && connectionId !== '' ? (
            <>
              <ObjectPicker
                key={connectionId}
                connectionId={connectionId}
                value={object}
                onChange={chooseObject}
                onOpenConnection={openConnection}
                error={errors.object?.message ?? apiError?.fields.object}
              />
              {object ? <ObjectColumns connectionId={connectionId} object={object} onOpenConnection={openConnection} /> : null}
            </>
          ) : null}

          {kind === 'sql' && connectionId !== '' ? (
            <SqlField
              label="SQL"
              rows={8}
              maxLength={SQL_MAX_LENGTH}
              tooltip="Um comando só, que precisa ser SELECT. As colunas são lidas ao salvar."
              error={errors.sql?.message ?? apiError?.fields.sql}
              {...register('sql', { onChange: () => create.reset() })}
            />
          ) : null}

          <TextField label="Nome" autoComplete="off" error={errors.name?.message ?? apiError?.fields.name} {...register('name')} />

          {apiError?.message && isCredentialUnreadable(create.error) ? (
            <UnreadableCredentialNotice message={apiError.message} connectionId={connectionId} onOpenConnection={openConnection} />
          ) : apiError?.message ? (
            <Notice type="error">{apiError.message}</Notice>
          ) : null}
        </form>
      </Dialog>
      {pendingConnection !== null && onOpenConnection ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingConnection(null);
          }}
          title="Descartar o novo dataset?"
          description="Abrir a conexão fecha este formulário, e o que você preencheu se perde."
          actions={
            <>
              <DialogClose>
                <Button>Continuar editando</Button>
              </DialogClose>
              <Button variant="danger" onClick={() => onOpenConnection(pendingConnection)}>
                Descartar e abrir conexão
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}

/** The columns of the chosen table or view, to check before creating the dataset. */
function ObjectColumns({
  connectionId,
  object,
  onOpenConnection,
}: {
  connectionId: string;
  object: ChosenObject;
  onOpenConnection?: (id: string) => void;
}) {
  const columns = useObjectColumns(connectionId, object);
  const qualified = `${object.schema_name}.${object.name}`;
  return (
    <div className="fc-datasets-preview">
      <Text as="p" variant="label-13" emphasis="secondary">
        Colunas de <span className="fc-datasets-code">{qualified}</span>
      </Text>
      <ColumnsTable
        caption={`Colunas de ${qualified}`}
        columns={columns.data}
        loading={columns.isPending}
        error={
          columns.isError && isCredentialUnreadable(columns.error) ? (
            <UnreadableCredentialNotice
              message={queryErrorMessage(columns.error, UNKNOWN_OBJECT_MESSAGE)}
              connectionId={connectionId}
              onOpenConnection={onOpenConnection}
            />
          ) : columns.isError ? (
            <Notice
              type="error"
              title="Não foi possível ler as colunas"
              actions={
                <Button size="small" loading={columns.isFetching} onClick={() => void columns.refetch()}>
                  Tentar de novo
                </Button>
              }
            >
              {queryErrorMessage(columns.error, UNKNOWN_OBJECT_MESSAGE)}
            </Notice>
          ) : undefined
        }
      />
    </div>
  );
}
