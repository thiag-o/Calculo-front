import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Menu, Badge, Table, Text, type TableColumn } from '../../design-system';
import { dataTypeLabel } from '../columns';
import { useDatasetVariables, type Dataset, type Variable } from './queries';
import { canBecomeVariable } from './variableRules';
import { VariableDialog } from './VariableDialog';
import { DeleteVariableDialog } from './DeleteVariableDialog';
import { MoreActionsIcon, VariableIcon } from './icons';
import { queryErrorMessage } from './messages';

/** Why "Nova variável" is disabled when no column of the dataset has a supported type. */
export const NO_SUPPORTED_COLUMN_REASON = 'Nenhuma coluna deste dataset tem um tipo suportado';
/** Badge of a variable whose column left the dataset (or lost its supported type) after "Atualizar colunas". */
export const COLUMN_GONE_LABEL = 'Coluna ausente';

type OpenDialog = { type: 'new' } | { type: 'edit'; variable: Variable } | { type: 'delete'; variable: Variable };

function count(total: number): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'variável' : 'variáveis'}`;
}

export interface DatasetVariablesProps {
  dataset: Dataset;
  /** Whether the person manages variables (`variables.manage`). Without it, the variables are read only. */
  canManage: boolean;
}

/**
 * The "Variáveis" section of the dataset detail: business name, column and type of each variable. With
 * `variables.manage`, "Nova variável" gives a name and a type to a column with a supported type, and the "…" of each
 * row edits or deletes the variable.
 */
export function DatasetVariables({ dataset, canManage }: DatasetVariablesProps) {
  const titleId = useId();
  const list = useDatasetVariables(dataset.id);
  const section = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const close = () => setDialog(null);

  // A dialog opened from a row menu gives the focus back to the row's "…"; if the row is gone (or the dialog was the
  // create one), to "Nova variável". Looked up only inside the section (ADR 0026).
  function focusOnClose() {
    const row =
      dialog && dialog.type !== 'new'
        ? section.current?.querySelector<HTMLElement>(`[data-fc-variable-actions="${dialog.variable.id}"]`)
        : null;
    return row ?? newButton.current;
  }

  const variables = list.data;
  const stopRetry = list.error instanceof ApiError && ['no_permission', 'not_found'].includes(list.error.code);
  const supportedColumns = new Set(dataset.columns.filter(canBecomeVariable).map((column) => column.name));
  const newReason = supportedColumns.size === 0 ? NO_SUPPORTED_COLUMN_REASON : undefined;
  const newVariable = (size: 'small' | 'default', variant: 'primary' | 'secondary') =>
    canManage ? (
      <Button
        ref={variant === 'primary' ? newButton : undefined}
        variant={variant}
        size={size}
        disabledReason={newReason}
        onClick={() => setDialog({ type: 'new' })}
      >
        Nova variável
      </Button>
    ) : null;

  const columns: TableColumn<Variable>[] = [
    {
      key: 'name',
      title: 'Nome',
      skeletonWidth: 140,
      cell: (variable) => (
        <Text variant="mono-13" medium className="fc-datasets-variable-name">
          {variable.name}
        </Text>
      ),
    },
    {
      key: 'column',
      title: 'Coluna',
      skeletonWidth: 120,
      cell: (variable) => (
        <span className="fc-datasets-variable-column">
          <Text variant="mono-13" emphasis="secondary" className="fc-datasets-variable-name">
            {variable.column}
          </Text>
          {supportedColumns.has(variable.column) ? null : <Badge tone="amber">{COLUMN_GONE_LABEL}</Badge>}
        </span>
      ),
    },
    {
      key: 'type',
      title: 'Tipo',
      skeletonWidth: 80,
      cell: (variable) => <Text variant="label-14">{dataTypeLabel(variable.type, variable.scale)}</Text>,
    },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      title: 'Ações',
      hiddenTitle: true,
      align: 'end',
      width: '56px',
      skeletonWidth: 20,
      cell: (variable) => (
        <Menu
          trigger={
            <Button
              iconOnly
              variant="ghost"
              size="small"
              label={`Mais ações para ${variable.name}`}
              icon={<MoreActionsIcon />}
              data-fc-variable-actions={variable.id}
            />
          }
          items={[
            { label: 'Editar variável', onSelect: () => setDialog({ type: 'edit', variable }) },
            { type: 'separator' },
            { label: 'Remover variável', danger: true, onSelect: () => setDialog({ type: 'delete', variable }) },
          ]}
        />
      ),
    });
  }

  return (
    <section ref={section} className="fc-datasets-section" aria-labelledby={titleId}>
      <header className="fc-datasets-top">
        <div className="fc-datasets-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Variáveis
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {variables ? count(variables.length) : 'Nomes de negócio das colunas, usados pelos workflows'}
          </Text>
        </div>
        {newVariable('default', 'primary')}
      </header>

      <Table
        caption={`Variáveis do dataset ${dataset.name}`}
        columns={columns}
        rows={variables}
        rowKey={(variable) => variable.id}
        loading={list.isPending}
        error={
          list.isError && variables === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar as variáveis"
              actions={
                stopRetry ? undefined : (
                  <Button size="small" onClick={() => void list.refetch()} loading={list.isFetching}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {queryErrorMessage(list.error)}
            </Notice>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<VariableIcon />}
            title="Nenhuma variável ainda"
            description={
              canManage
                ? 'Dê um nome de negócio e um tipo a uma coluna para os workflows usarem.'
                : 'Quem gerencia variáveis no tenant ainda não criou nenhuma neste dataset.'
            }
            action={newVariable('small', 'secondary')}
          />
        }
      />

      {list.isError && variables !== undefined ? (
        <Notice
          type="error"
          title="Não foi possível atualizar as variáveis"
          actions={
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          {queryErrorMessage(list.error)}
        </Notice>
      ) : null}

      {dialog?.type === 'new' ? <VariableDialog dataset={dataset} onClose={close} focusOnClose={focusOnClose} /> : null}
      {dialog?.type === 'edit' ? (
        <VariableDialog key={dialog.variable.id} dataset={dataset} variable={dialog.variable} onClose={close} focusOnClose={focusOnClose} />
      ) : null}
      {dialog?.type === 'delete' ? (
        <DeleteVariableDialog key={dialog.variable.id} variable={dialog.variable} onClose={close} focusOnClose={focusOnClose} />
      ) : null}
    </section>
  );
}
