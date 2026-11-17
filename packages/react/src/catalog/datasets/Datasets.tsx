import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Badge, Table, Text, textClasses, type TableColumn } from '../../design-system';
import { useSession } from '../../session';
import { useDatasetConnections, useDatasetExcelFiles, useDatasetList, type Dataset } from './queries';
import { DATASET_TYPE_LABELS, dateTime, datasetOrigin } from './origin';
import { NewDatasetDialog } from './NewDatasetDialog';
import { TableIcon } from './icons';
import { queryErrorMessage } from './messages';
import './datasets.css';

export interface DatasetsProps {
  /**
   * Opens the detail of a dataset (`/catalog/datasets/:id` in the module). With it, the names in the list open the detail
   * and a new dataset opens right after it is saved. Without it, the names are plain text.
   */
  onOpenDataset?: (id: string) => void;
}

function count(total: number): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? 'dataset' : 'datasets'}`;
}

/**
 * Catalog › Datasets: the tenant datasets with name, type, origin and when the columns were read. With
 * `datasets.manage`, "Novo dataset" creates one from a table or view, or from free SQL (only with `free_sql.use`).
 * Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals of dialogs and menus).
 */
export function Datasets({ onOpenDataset }: DatasetsProps = {}) {
  const titleId = useId();
  const session = useSession();
  const list = useDatasetList();
  const datasets = list.data;
  const connections = useDatasetConnections((datasets ?? []).some((dataset) => dataset.type !== 'excel'));
  const excelFiles = useDatasetExcelFiles((datasets ?? []).some((dataset) => dataset.type === 'excel'));
  const [creating, setCreating] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);

  const canManage = session.hasPermission('datasets.manage');
  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const newDataset = (size: 'small' | 'default', variant: 'primary' | 'secondary') =>
    canManage ? (
      <Button ref={variant === 'primary' ? newButton : undefined} variant={variant} size={size} onClick={() => setCreating(true)}>
        Novo dataset
      </Button>
    ) : null;

  const columns: readonly TableColumn<Dataset>[] = [
    {
      key: 'name',
      title: 'Nome',
      skeletonWidth: 160,
      cell: (dataset) =>
        onOpenDataset ? (
          <button type="button" className={`fc-datasets-open ${textClasses({ variant: 'label-14', medium: true })}`} onClick={() => onOpenDataset(dataset.id)}>
            {dataset.name}
          </button>
        ) : (
          <Text variant="label-14" medium className="fc-datasets-name">
            {dataset.name}
          </Text>
        ),
    },
    {
      key: 'type',
      title: 'Tipo',
      width: '140px',
      skeletonWidth: 72,
      cell: (dataset) => <Badge>{DATASET_TYPE_LABELS[dataset.type]}</Badge>,
    },
    {
      key: 'origin',
      title: 'Origem',
      skeletonWidth: 180,
      cell: (dataset) => {
        const origin = datasetOrigin(dataset, connections.data, excelFiles.data);
        if (!origin.source && !origin.object) return null;
        return (
          <div className="fc-datasets-origin">
            {origin.source ? <Text variant="label-14">{origin.source}</Text> : null}
            {origin.object ? (
              <Text variant={origin.objectIsCode ? 'mono-12' : 'label-13'} emphasis="secondary" className="fc-datasets-object">
                {origin.object}
              </Text>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'refreshed',
      title: 'Colunas lidas em',
      width: '180px',
      skeletonWidth: 120,
      cell: (dataset) => (
        <Text variant="label-13" emphasis="secondary" className="fc-datasets-number">
          {dateTime(dataset.columns_refreshed_at)}
        </Text>
      ),
    },
  ];

  return (
    <section className="fc-datasets" aria-labelledby={titleId}>
      <header className="fc-datasets-top">
        <div className="fc-datasets-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Datasets
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {datasets ? count(datasets.length) : 'Tabelas, views, SQL e abas de Excel que os workflows leem'}
          </Text>
        </div>
        {newDataset('default', 'primary')}
      </header>

      <Table
        caption="Datasets do tenant"
        columns={columns}
        rows={datasets}
        rowKey={(dataset) => dataset.id}
        loading={list.isPending}
        error={
          list.isError && datasets === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar os datasets"
              actions={
                noPermission ? undefined : (
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
            icon={<TableIcon />}
            title="Nenhum dataset ainda"
            description={
              canManage
                ? 'Crie um dataset a partir de uma tabela, de uma view ou de um SQL de uma conexão.'
                : 'Quem gerencia datasets no tenant ainda não criou nenhum.'
            }
            action={newDataset('small', 'secondary')}
          />
        }
      />

      {list.isError && datasets !== undefined ? (
        <Notice
          type="error"
          title="Não foi possível atualizar a lista"
          actions={
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          {queryErrorMessage(list.error)}
        </Notice>
      ) : null}

      {creating ? (
        <NewDatasetDialog
          allowSql={session.hasPermission('free_sql.use')}
          focusOnClose={newButton}
          onClose={() => setCreating(false)}
          onCreated={(dataset) => {
            setCreating(false);
            onOpenDataset?.(dataset.id);
          }}
        />
      ) : null}
    </section>
  );
}
