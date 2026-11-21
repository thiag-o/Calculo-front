import { useId, useRef, useState } from 'react';
import { ApiError } from '../../../api';
import { DATASET_TYPE_LABELS, useDatasetList, type Dataset } from '../../../catalog';
import { Badge, Button, FieldMessage, Loading, Notice, Text, TextField, textClasses } from '../../../design-system';
import { useFieldsState, useFocusOnSelection } from '../../properties';
import { DatabaseIcon } from './icons';
import { DATASETS_ERROR_TITLE, NO_DATASETS, NO_DATASET_WITH, datasetsErrorMessage } from './messages';

export interface DatasetSearchProps {
  /** The dataset of the batch source, if there is one (marked in the list). */
  value: string | null;
  onChoose: (dataset: Dataset) => void;
  /** The field's `path` in the analysed definition: the focus from the Problems tab. */
  path: string | null;
  /** The problems of the dataset (`unknown_dataset`), as text. */
  error?: string;
  /** Focus the search when it shows (it was opened by "Trocar dataset" or by choosing "Fonte do lote"). */
  autoFocus?: boolean;
}

/** The text compared by the search: no case and no accents ("Preço" is found by "preco"). */
function comparable(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

/**
 * The search in the tenant's catalog datasets (`GET /v1/datasets`, whole): "Buscar dataset" filters by name as it is
 * typed, and each dataset shows its type (Tabela ou view, SQL livre, Excel). A button per dataset: Tab moves, Enter
 * chooses (arrows never choose by accident, since a choice changes the draft).
 */
export function DatasetSearch({ value, onChoose, path, error, autoFocus = false }: DatasetSearchProps) {
  const { readOnly, reasonId } = useFieldsState();
  const datasets = useDatasetList();
  const [typed, setTyped] = useState('');
  const legendId = useId();
  const errorId = useId();
  const search = useRef<HTMLInputElement>(null);
  useFocusOnSelection(path, () => search.current);

  const term = comparable(typed.trim());
  const items = datasets.data?.filter((dataset) => comparable(dataset.name).includes(term));

  let content;
  if (datasets.isPending) {
    content = <Loading label="Carregando datasets" rows={3} />;
  } else if (datasets.isError) {
    const noPermission = datasets.error instanceof ApiError && datasets.error.code === 'no_permission';
    content = (
      <Notice
        type="error"
        title={DATASETS_ERROR_TITLE}
        actions={
          noPermission ? undefined : (
            <Button size="small" loading={datasets.isFetching} onClick={() => void datasets.refetch()}>
              Tentar de novo
            </Button>
          )
        }
      >
        {datasetsErrorMessage(datasets.error)}
      </Notice>
    );
  } else if (datasets.data.length === 0) {
    content = (
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-batch-source-empty">
        {NO_DATASETS}
      </Text>
    );
  } else if (!items || items.length === 0) {
    content = (
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-batch-source-empty">
        {NO_DATASET_WITH(typed.trim())}
      </Text>
    );
  } else {
    content = (
      <ul className="fc-batch-source-datasets" aria-label="Datasets do catálogo">
        {items.map((dataset) => {
          const chosen = dataset.id === value;
          return (
            <li key={dataset.id}>
              <button
                type="button"
                className="fc-batch-source-dataset"
                aria-pressed={chosen}
                disabled={readOnly}
                aria-describedby={reasonId}
                onClick={() => {
                  if (!chosen) onChoose(dataset);
                }}
              >
                <DatabaseIcon size={14} />
                <span className={`fc-batch-source-dataset-name ${textClasses({ variant: 'label-14' })}`}>{dataset.name}</span>
                {/* The space separates the words in the accessible name ("Itens de nota fiscal Tabela ou view"). */}{' '}
                <Badge>{DATASET_TYPE_LABELS[dataset.type]}</Badge>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <fieldset
      className="fc-batch-source-search"
      aria-labelledby={legendId}
      aria-describedby={error ? errorId : undefined}
      aria-busy={datasets.isFetching || undefined}
    >
      <legend id={legendId} className={`fc-batch-source-legend ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>
        Dataset
      </legend>
      <TextField
        ref={search}
        type="search"
        label="Buscar dataset"
        autoComplete="off"
        autoFocus={autoFocus}
        value={typed}
        disabled={readOnly}
        aria-describedby={reasonId}
        onChange={(event) => setTyped(event.target.value)}
      />
      {content}
      {error ? (
        <FieldMessage id={errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
    </fieldset>
  );
}
