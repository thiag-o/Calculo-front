import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Notice, Button, TextField, Dialog, DialogClose, Select, Text, type DialogProps } from '../../design-system';
import { DATA_TYPE_LABELS, columnTypeLabel, type Column, type DataType } from '../columns';
import { useCreateVariable, useUpdateVariable, type Dataset, type Variable } from './queries';
import { SCALE_MAX, VARIABLE_NAME_PATTERN, acceptedTypes, canBecomeVariable, minimumScale } from './variableRules';
import { INVALID_VARIABLE_NAME_MESSAGE, variableError } from './messages';

/** Why "Salvar" is disabled when the column of the variable left the dataset or lost its supported type. */
export function columnGoneReason(column: string): string {
  return `A coluna ${column} não está mais no dataset com um tipo suportado`;
}

export const NAME_TOOLTIP = 'Letras minúsculas sem acento, números e _, começando por uma letra. Ex.: valor_item';
export const TYPE_TOOLTIP = 'Só aparecem os tipos aceitos para o tipo da coluna.';

function scaleTooltip(minimum: number): string {
  return minimum > 0
    ? `De ${minimum} a ${SCALE_MAX}: menos casas que as ${minimum} da coluna arredondariam os valores.`
    : `De 0 a ${SCALE_MAX}.`;
}

interface FormFields {
  column: string;
  name: string;
  /** A `DataType`, or `''` while no column is chosen. */
  type: string;
  scale: string;
}

function isDataType(value: string): value is DataType {
  return Object.prototype.hasOwnProperty.call(DATA_TYPE_LABELS, value);
}

/** The form rules, mirroring the API (E3-10 and D36), against the current dataset columns. */
function createSchema(columns: readonly Column[]) {
  return z
    .object({ column: z.string(), name: z.string(), type: z.string(), scale: z.string() })
    .superRefine((data, context) => {
      const column = columns.find((item) => item.name === data.column);
      if (data.column === '') context.addIssue({ code: 'custom', path: ['column'], message: 'Escolha a coluna' });
      // As typed, without trimming: the API checks the name as it came.
      if (data.name === '') context.addIssue({ code: 'custom', path: ['name'], message: 'Informe o nome da variável' });
      else if (!VARIABLE_NAME_PATTERN.test(data.name)) {
        context.addIssue({ code: 'custom', path: ['name'], message: INVALID_VARIABLE_NAME_MESSAGE });
      }
      if (data.column !== '' && data.type === '') context.addIssue({ code: 'custom', path: ['type'], message: 'Escolha o tipo' });
      if (data.type === 'decimal') {
        const minimum = minimumScale(column);
        const scale = data.scale.trim();
        if (scale === '') context.addIssue({ code: 'custom', path: ['scale'], message: 'Informe as casas decimais' });
        else if (!/^\d+$/.test(scale) || Number(scale) > SCALE_MAX) {
          context.addIssue({ code: 'custom', path: ['scale'], message: `As casas decimais vão de 0 a ${SCALE_MAX}.` });
        } else if (Number(scale) < minimum) {
          context.addIssue({
            code: 'custom',
            path: ['scale'],
            message: `Use ao menos ${minimum} casas decimais, as da coluna, para não arredondar.`,
          });
        }
      }
    });
}

/** The starting scale for a `decimal` variable over `column`: the column's own places, when it has them. */
function startingScale(column: Column | undefined): string {
  return column?.type === 'decimal' && column.scale !== null ? String(column.scale) : '';
}

export interface VariableDialogProps {
  /** The dataset, with the current columns. */
  dataset: Dataset;
  /** The variable to edit. Without it, the dialog creates a new one. */
  variable?: Variable;
  /** Called on close (Cancelar, Esc, "Fechar" or after saving). */
  onClose: () => void;
  /** Element that gets focus on close (see `Dialog`). */
  focusOnClose?: DialogProps['focusOnClose'];
}

/**
 * "Nova variável" and "Editar variável": a business name and a type for a column of the dataset. Only columns with a
 * supported type can be chosen, and the type picker offers only the conversions the column accepts (E3-10); `decimal`
 * asks for the decimal places. When editing, the column stays. Mount it only while open: each opening starts from scratch.
 */
export function VariableDialog({ dataset, variable, onClose, focusOnClose }: VariableDialogProps) {
  const editing = variable !== undefined;
  const formId = useId();
  const create = useCreateVariable(dataset.id);
  const update = useUpdateVariable(dataset.id);
  const mutation = editing ? update : create;
  const supportedColumns = dataset.columns.filter(canBecomeVariable);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<FormFields>({
    resolver: zodResolver(createSchema(dataset.columns)),
    defaultValues: {
      column: variable?.column ?? '',
      name: variable?.name ?? '',
      type: variable?.type ?? '',
      scale: variable?.scale === null || variable?.scale === undefined ? '' : String(variable.scale),
    },
  });
  const columnName = useWatch({ control, name: 'column' });
  const type = useWatch({ control, name: 'type' });

  const column = supportedColumns.find((item) => item.name === columnName);
  const types = column ? acceptedTypes(column) : [];
  // Editing a variable whose column left the dataset (or lost its type) after "Atualizar colunas": nothing to save.
  const columnGone = editing && column === undefined;
  const disabledReason = columnGone ? columnGoneReason(variable.column) : undefined;
  const apiError = mutation.error ? variableError(mutation.error, editing) : undefined;

  const submit = handleSubmit((data) => {
    if (disabledReason || !isDataType(data.type)) return;
    const scale = data.type === 'decimal' ? Number(data.scale.trim()) : null;
    if (variable) {
      update.mutate({ id: variable.id, body: { name: data.name, type: data.type, scale } }, { onSuccess: onClose });
    } else {
      create.mutate({ column: data.column, name: data.name, type: data.type, scale }, { onSuccess: onClose });
    }
  });

  function chooseColumn(name: string) {
    const chosen = supportedColumns.find((item) => item.name === name);
    setValue('column', name);
    // Another column: the type starts as the column's own, with its decimal places.
    setValue('type', chosen?.type ?? '');
    setValue('scale', startingScale(chosen));
    clearErrors(['column', 'type', 'scale']);
    mutation.reset();
  }

  return (
    <Dialog
      open
      focusOnClose={focusOnClose}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? 'Editar variável' : 'Nova variável'}
      description={
        editing
          ? 'O nome e o tipo mudam; a coluna continua a mesma.'
          : 'Dê um nome de negócio e um tipo a uma coluna do dataset. Os workflows usam a variável, nunca a coluna.'
      }
      actions={
        <>
          <DialogClose>
            <Button>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={mutation.isPending} disabledReason={disabledReason}>
            Salvar
          </Button>
        </>
      }
    >
      <form id={formId} className="fc-datasets-form" onSubmit={submit} noValidate>
        {editing ? (
          <div className="fc-datasets-fact">
            <Text as="p" variant="label-13" emphasis="secondary">
              Coluna
            </Text>
            <Text as="p" variant="mono-13">
              {variable.column}
              {column ? <span className="fc-datasets-fact-detail"> · {columnTypeLabel(column)}</span> : null}
            </Text>
          </div>
        ) : (
          <Controller
            control={control}
            name="column"
            render={({ field }) => (
              <Select
                ref={field.ref}
                label="Coluna"
                options={supportedColumns.map((item) => ({ value: item.name, label: `${item.name} · ${columnTypeLabel(item) ?? ''}` }))}
                value={field.value}
                onValueChange={chooseColumn}
                onBlur={field.onBlur}
                error={errors.column?.message ?? apiError?.fields.column}
              />
            )}
          />
        )}

        {columnGone ? (
          <Notice type="warning" title="A coluna não está mais no dataset">
            {`A coluna ${variable.column} saiu do dataset ou perdeu o tipo suportado quando as colunas foram lidas de novo. Remova a variável ou ajuste a origem e use Atualizar colunas.`}
          </Notice>
        ) : null}

        <TextField
          label="Nome"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={200}
          tooltip={NAME_TOOLTIP}
          error={errors.name?.message ?? apiError?.fields.name}
          {...register('name', { onChange: () => mutation.reset() })}
        />

        {column ? (
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                ref={field.ref}
                label="Tipo"
                options={types.map((value) => ({ value, label: DATA_TYPE_LABELS[value] }))}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value === 'decimal') setValue('scale', startingScale(column));
                  clearErrors('scale');
                  mutation.reset();
                }}
                onBlur={field.onBlur}
                tooltip={TYPE_TOOLTIP}
                error={errors.type?.message ?? apiError?.fields.type}
              />
            )}
          />
        ) : null}

        {column && type === 'decimal' ? (
          <TextField
            label="Casas decimais"
            inputMode="numeric"
            autoComplete="off"
            tooltip={scaleTooltip(minimumScale(column))}
            error={errors.scale?.message ?? apiError?.fields.scale}
            {...register('scale', { onChange: () => mutation.reset() })}
          />
        ) : null}

        {apiError?.message ? <Notice type="error">{apiError.message}</Notice> : null}
      </form>
    </Dialog>
  );
}
