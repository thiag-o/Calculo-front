import { useId, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, Badge, EmptyState, Loading, Skeleton, Text, type TableColumn } from '../../design-system';
import { useSession } from '../../session';
import { ColumnsTable, type Column } from '../columns';
import {
  useDataset,
  useDatasetConnections,
  useDatasetExcelFiles,
  useDatasetVariables,
  useRefreshDatasetColumns,
  type Dataset,
} from './queries';
import { DatasetVariables } from './DatasetVariables';
import { DATASET_TYPE_LABELS, dateTime, datasetOrigin } from './origin';
import { RenameDatasetDialog } from './RenameDatasetDialog';
import { DeleteDatasetDialog } from './DeleteDatasetDialog';
import { BackIcon, RefreshIcon, TableIcon } from './icons';
import { queryErrorMessage, refreshErrorMessage } from './messages';
import './datasets.css';

export const COLUMNS_REFRESHED_MESSAGE = 'Colunas lidas de novo da origem.';

export interface DatasetDetailProps {
  /** The dataset id (`/catalog/datasets/:id` in the module). */
  datasetId: string;
  /** Goes back to the dataset list. With it, the screen shows "Voltar para datasets". */
  onBack?: () => void;
  /** Called after the dataset is deleted (the module goes back to the list). Without it, the screen says it was deleted. */
  onDeleted?: () => void;
}

type OpenDialog = 'rename' | 'delete' | null;

/**
 * Catalog › dataset detail: name, type, origin and the columns with name, source type, type, nullable and the variables
 * over each one (a column without a supported type shows "Sem suporte"). With `datasets.manage`: "Atualizar colunas",
 * rename and delete (the variables go along). Below, the "Variáveis" section: read only, or with create, edit and delete
 * under `variables.manage`. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals of dialogs).
 */
export function DatasetDetail({ datasetId, onBack, onDeleted }: DatasetDetailProps) {
  const session = useSession();
  const query = useDataset(datasetId);
  const [deleted, setDeleted] = useState(false);
  const back = onBack ? (
    <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack} className="fc-datasets-back">
      Voltar para datasets
    </Button>
  ) : null;

  if (deleted) {
    return (
      <DetailFrame title="Dataset removido" back={back}>
        <Notice type="success">O dataset e as variáveis dele foram removidos.</Notice>
      </DetailFrame>
    );
  }

  const dataset = query.data;
  const notFound = query.error instanceof ApiError && ['not_found', 'invalid_data'].includes(query.error.code);
  if (notFound || (!dataset && query.isError)) {
    return (
      <DetailFrame title="Dataset" back={back}>
        <Notice
          type="error"
          title="Não foi possível abrir o dataset"
          actions={
            notFound || (query.error instanceof ApiError && query.error.code === 'no_permission') ? undefined : (
              <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
                Tentar de novo
              </Button>
            )
          }
        >
          {queryErrorMessage(query.error)}
        </Notice>
      </DetailFrame>
    );
  }

  if (!dataset) {
    return (
      <DetailFrame title="Dataset" back={back}>
        <Loading label="Carregando o dataset" rows={5} />
      </DetailFrame>
    );
  }

  return (
    <LoadedDetail
      dataset={dataset}
      back={back}
      canManage={session.hasPermission('datasets.manage')}
      canManageVariables={session.hasPermission('variables.manage')}
      onDeleted={() => {
        setDeleted(true);
        onDeleted?.();
      }}
    />
  );
}

function LoadedDetail({
  dataset,
  back,
  canManage,
  canManageVariables,
  onDeleted,
}: {
  dataset: Dataset;
  back: ReactNode;
  canManage: boolean;
  canManageVariables: boolean;
  onDeleted: () => void;
}) {
  const columnsTitleId = useId();
  const sqlTitleId = useId();
  const connections = useDatasetConnections(dataset.type !== 'excel');
  const excelFiles = useDatasetExcelFiles(dataset.type === 'excel');
  const refresh = useRefreshDatasetColumns();
  const variables = useDatasetVariables(dataset.id);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);

  const origin = datasetOrigin(dataset, connections.data, excelFiles.data);

  // Another action: the refresh result (success or error) no longer applies.
  function openDialog(next: Exclude<OpenDialog, null>) {
    refresh.reset();
    setDialog(next);
  }
  const columnCount = dataset.columns.length;

  // The variables over each column, next to the column (the "Variáveis" section below has the details and the actions).
  const variableColumn: TableColumn<Column> = {
    key: 'variables',
    title: 'Variáveis',
    skeletonWidth: 100,
    cell: (column) => {
      if (variables.isPending) return <Skeleton width={80} />;
      const names = (variables.data ?? []).filter((variable) => variable.column === column.name).map((variable) => variable.name);
      if (names.length === 0) return null;
      return (
        <span className="fc-datasets-column-variables">
          {names.map((name) => (
            <Text key={name} variant="mono-13" className="fc-datasets-variable-name">
              {name}
            </Text>
          ))}
        </span>
      );
    },
  };

  return (
    <DetailFrame title={dataset.name} back={back}>
      <div className="fc-datasets-summary">
        <div className="fc-datasets-facts">
          <Badge>{DATASET_TYPE_LABELS[dataset.type]}</Badge>
          {origin.source ? <Text variant="label-14">{origin.source}</Text> : null}
          {origin.object ? (
            <Text variant={origin.objectIsCode ? 'mono-13' : 'label-14'} emphasis="secondary" className="fc-datasets-object">
              {origin.object}
            </Text>
          ) : null}
          <Text variant="label-13" emphasis="secondary" className="fc-datasets-number">
            Colunas lidas em {dateTime(dataset.columns_refreshed_at) || '—'}
          </Text>
        </div>
        {canManage ? (
          <div className="fc-datasets-actions">
            <Button
              icon={<RefreshIcon />}
              loading={refresh.isPending}
              onClick={() => refresh.mutate(dataset.id)}
            >
              Atualizar colunas
            </Button>
            <Button ref={renameButton} onClick={() => openDialog('rename')}>
              Renomear dataset
            </Button>
            <Button ref={deleteButton} onClick={() => openDialog('delete')}>
              Remover dataset
            </Button>
          </div>
        ) : null}
      </div>

      {refresh.isError ? (
        <Notice
          type="error"
          title="Não foi possível atualizar as colunas"
          actions={
            <Button size="small" loading={refresh.isPending} onClick={() => refresh.mutate(dataset.id)}>
              Tentar de novo
            </Button>
          }
        >
          {refreshErrorMessage(refresh.error)}
        </Notice>
      ) : null}
      {refresh.isSuccess ? <Notice type="success">{COLUMNS_REFRESHED_MESSAGE}</Notice> : null}

      {dataset.type === 'sql' && dataset.sql ? (
        <section className="fc-datasets-section" aria-labelledby={sqlTitleId}>
          <Text as="h2" variant="heading-16" id={sqlTitleId}>
            SQL
          </Text>
          <pre className="fc-datasets-sql-view">
            <code>{dataset.sql}</code>
          </pre>
        </section>
      ) : null}

      <section className="fc-datasets-section" aria-labelledby={columnsTitleId}>
        <div className="fc-datasets-title">
          <Text as="h2" variant="heading-16" id={columnsTitleId}>
            Colunas
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {`${columnCount.toLocaleString('pt-BR')} ${columnCount === 1 ? 'coluna' : 'colunas'}`}
          </Text>
        </div>
        <ColumnsTable
          caption={`Colunas do dataset ${dataset.name}`}
          columns={dataset.columns}
          extraColumns={[variableColumn]}
          empty={
            <EmptyState
              icon={<TableIcon />}
              title="Nenhuma coluna"
              description={
                canManage
                  ? 'A origem não tem colunas. Ajuste a origem no banco do cliente e use Atualizar colunas.'
                  : 'A origem não tem colunas.'
              }
            />
          }
        />
      </section>

      <DatasetVariables dataset={dataset} canManage={canManageVariables} />

      {dialog === 'rename' ? (
        <RenameDatasetDialog dataset={dataset} focusOnClose={renameButton} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'delete' ? (
        <DeleteDatasetDialog
          dataset={dataset}
          focusOnClose={deleteButton}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            onDeleted();
          }}
        />
      ) : null}
    </DetailFrame>
  );
}

/** The screen title (h1), the same in every state, with "Voltar para datasets" above it. */
function DetailFrame({ title, back, children }: { title: string; back: ReactNode; children: ReactNode }) {
  return (
    <div className="fc-datasets-detail">
      {back}
      <Text as="h1" variant="heading-24" className="fc-datasets-heading">
        {title}
      </Text>
      {children}
    </div>
  );
}
