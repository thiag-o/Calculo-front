import { useRef, useState } from 'react';
import { useDatasetList, useDatasetVariables } from '../../../catalog';
import { Button, Dialog, DialogClose, FieldMessage, Loading, Notice, type SelectOption } from '../../../design-system';
import { useDraftEditor, type WorkflowDefinition } from '../../draft';
import { CommitTextField, PathSelect, PropertiesFrame, SegmentedControl, problemsAt, useFieldsState } from '../../properties';
import { FilterList, type FilterEntry, type FilterVariable } from '../filters/FilterList';
import { fieldPath, isUnder } from '../filters/paths';
import { DatasetChangeDialog } from './DatasetChangeDialog';
import { indexOfItem, itemKey, removeItem, replaceItem } from './identity';
import {
  ACCEPT_FIRST_MESSAGE,
  ACCEPT_FIRST_TITLE,
  DATASET_TYPE_LABELS,
  EXISTS_LABELS,
  FILTER_NEEDS_LINK,
  LINEAR_NEEDS_VARIABLES,
  MODE_LABELS,
  MULTIPLE_ROWS_OPTIONS,
  NO_MATCH_OPTIONS,
  NO_MATCH_POLICIES,
  SOURCE_TITLE,
} from './labels';
import { SourceLinks } from './SourceLinks';
import { SourceOrdering } from './SourceOrdering';
import { SourceOutputs } from './SourceOutputs';
import {
  DESCRIPTION_MAX,
  NODE_NAME_MAX,
  findSourceNode,
  linkCandidates,
  locateNode,
  toFilterMode,
  toLinearMode,
  updateSourceNode,
  type CatalogVariable,
  type SourceFilter,
  type SourceMode,
  type SourceNode,
} from './sourceNode';
import './source-block.css';

export interface SourceBlockPropertiesProps {
  /** The Source block, as it is in the definition being edited (also inside a group). */
  node: SourceNode;
}

const MODE_OPTIONS = (['linear', 'filter'] as const).map((value) => ({ value, label: MODE_LABELS[value] }));
const EXISTS_OPTIONS = [
  { value: 'exists', label: EXISTS_LABELS.exists },
  { value: 'missing', label: EXISTS_LABELS.missing },
] as const;

/** The fields of the block whose problems show beside them (the rest shows at the top of the panel). */
const FIELDS = ['name', 'description', 'dataset_id', 'mode', 'exists', 'no_match', 'multiple_rows'] as const;
/** The lists of the block: each row, and the list itself, shows its own problems. */
const LISTS = ['links', 'filters', 'order_by', 'outputs'] as const;

/**
 * The properties of a Source block (E5-18; design §6, "Bloco Fonte"): name, description, the dataset of the catalog, the
 * mode (Linear | Filtro), the links, the filters and, in the Linear, the ordering, "Sem correspondência", "Mais de uma
 * linha" (accepting the first row asks for confirmation) and the output. The Filtro only has the dataset, the links, the
 * filters and EXISTE / NÃO EXISTE. Each problem shows beside its field, by `path`; read-only disables everything.
 */
export function SourceBlockProperties({ node }: SourceBlockPropertiesProps) {
  const { definition, analyzedDefinition, problems, symbols, change } = useDraftEditor();
  const datasets = useDatasetList();
  const variables = useDatasetVariables(node.dataset_id);
  const [pendingDataset, setPendingDataset] = useState<string | null>(null);
  const [confirmingAccept, setConfirmingAccept] = useState(false);
  const [modeRefusal, setModeRefusal] = useState<{ message: string; node: SourceNode } | null>(null);
  const datasetField = useRef<HTMLDivElement>(null);
  const multipleRowsField = useRef<HTMLDivElement>(null);

  const place = locateNode(definition, node.id);
  const at = locateNode(analyzedDefinition, node.id)?.path ?? null;
  const analyzedNode = findSourceNode(analyzedDefinition, node.id);
  const path = (field: string) => fieldPath(at, field);
  const fieldProblems = (field: string) => problemsAt(problems, path(field));

  function update(apply: (current: SourceNode, definition: WorkflowDefinition) => SourceNode, mergeKey?: string) {
    change((current) => updateSourceNode(current, node.id, (item) => apply(item, current)), mergeKey ? { mergeKey } : undefined);
  }

  const catalogVariables = variables.data;
  const filterVariables: FilterVariable[] = (catalogVariables ?? []).map((variable) => ({
    key: variable.id,
    name: variable.name,
    type: variable.type,
    scale: variable.scale,
  }));

  function chooseMode(mode: SourceMode) {
    if (mode === 'filter') {
      if (node.links.length === 0) return setModeRefusal({ message: FILTER_NEEDS_LINK, node });
      setModeRefusal(null);
      return update((current) => toFilterMode(current));
    }
    if (!catalogVariables) return setModeRefusal({ message: 'As variáveis do dataset ainda não foram carregadas.', node });
    const next = toLinearMode(node, catalogVariables);
    if (next === null) return setModeRefusal({ message: LINEAR_NEEDS_VARIABLES, node });
    setModeRefusal(null);
    update((current) => toLinearMode(current, catalogVariables) ?? current);
  }

  const datasetOptions: SelectOption[] = (datasets.data ?? []).map((dataset) => ({
    value: dataset.id,
    label: `${dataset.name} · ${DATASET_TYPE_LABELS[dataset.type]}`,
  }));
  if (datasets.data && !datasets.data.some((dataset) => dataset.id === node.dataset_id)) {
    datasetOptions.push({ value: node.dataset_id, label: 'Dataset fora do catálogo' });
  }
  const pendingName = datasets.data?.find((dataset) => dataset.id === pendingDataset)?.name ?? '';

  // The problems of the block that match no field on screen show at the top of the panel, so none is hidden.
  const shown = (problemPath: string) =>
    at !== null && (FIELDS.some((field) => problemPath === `${at}.${field}`) || LISTS.some((list) => isUnder(problemPath, `${at}.${list}`)));
  const others = problems.filter((problem) =>
    problem.path === null ? problem.node_id === node.id : at !== null && isUnder(problem.path, at) && !shown(problem.path),
  );

  const candidates = linkCandidates(symbols, node.id, place?.groups ?? []);

  return (
    <PropertiesFrame title={SOURCE_TITLE} category="source" subtitle={<span className="fc-properties-id">{node.id}</span>} problems={others}>
      <CommitTextField
        label="Nome do bloco"
        scope={node.name}
        value={node.name}
        maxLength={NODE_NAME_MAX}
        path={path('name')}
        problems={fieldProblems('name')}
        validate={(text) => (text.trim() === '' ? 'Informe o nome do bloco.' : null)}
        onCommit={(name) => update((current) => ({ ...current, name }), `source:${node.id}.name`)}
      />
      <CommitTextField
        label="Descrição curta"
        scope={node.name}
        value={node.description ?? ''}
        maxLength={DESCRIPTION_MAX}
        path={path('description')}
        problems={fieldProblems('description')}
        onCommit={(text) => update((current) => ({ ...current, description: text === '' ? null : text }), `source:${node.id}.description`)}
      />

      <div ref={datasetField} className="fc-source-dataset">
        {datasets.isPending ? (
          <Loading label="Carregando os datasets do catálogo" rows={1} />
        ) : datasets.isError ? (
          <Notice type="error" actions={<Button onClick={() => void datasets.refetch()}>Tentar de novo</Button>}>
            Não foi possível carregar os datasets do catálogo.
          </Notice>
        ) : (
          <PathSelect
            label="Dataset"
            scope={node.name}
            value={node.dataset_id}
            options={datasetOptions}
            path={path('dataset_id')}
            problems={fieldProblems('dataset_id')}
            onChange={setPendingDataset}
          />
        )}
      </div>

      <div className="fc-field">
        <SegmentedControl
          label="Modo"
          scope={node.name}
          options={MODE_OPTIONS}
          value={node.mode}
          path={path('mode')}
          problems={fieldProblems('mode')}
          onChange={chooseMode}
        />
        {modeRefusal && modeRefusal.node === node ? (
          <FieldMessage type="error" role="alert">
            {modeRefusal.message}
          </FieldMessage>
        ) : null}
      </div>

      <DatasetSections
        node={node}
        analyzedNode={analyzedNode}
        at={at}
        variables={variables}
        filterVariables={filterVariables}
        candidates={candidates}
        update={update}
      />

      {node.mode === 'linear' ? (
        <>
          <PathSelect
            label="Sem correspondência"
            scope={node.name}
            value={node.no_match}
            options={NO_MATCH_OPTIONS}
            tooltip="O que fazer quando nenhuma linha do dataset casa com o registro"
            path={path('no_match')}
            problems={fieldProblems('no_match')}
            onChange={(value) => {
              const policy = NO_MATCH_POLICIES.find((candidate) => candidate === value);
              if (policy) update((current) => (current.mode === 'linear' ? { ...current, no_match: policy } : current));
            }}
          />
          <div ref={multipleRowsField}>
            <PathSelect
              label="Mais de uma linha"
              scope={node.name}
              value={node.multiple_rows}
              options={MULTIPLE_ROWS_OPTIONS}
              tooltip="O que fazer quando mais de uma linha do dataset casa com o registro"
              path={path('multiple_rows')}
              problems={fieldProblems('multiple_rows')}
              onChange={(value) => {
                if (value === 'accept_first') setConfirmingAccept(true);
                else update((current) => (current.mode === 'linear' ? { ...current, multiple_rows: 'error' } : current));
              }}
            />
          </div>
        </>
      ) : (
        <SegmentedControl
          label="Condição"
          scope={node.name}
          options={EXISTS_OPTIONS}
          value={node.exists === false ? 'missing' : 'exists'}
          path={path('exists')}
          problems={fieldProblems('exists')}
          onChange={(value) => update((current) => (current.mode === 'filter' ? { ...current, exists: value === 'exists' } : current))}
        />
      )}


      {node.mode === 'linear' && catalogVariables ? (
        <SourceOutputs node={node} analyzedNode={analyzedNode} at={at} variables={catalogVariables} update={update} />
      ) : null}

      {pendingDataset !== null ? (
        <DatasetChangeDialog
          node={node}
          datasetId={pendingDataset}
          datasetName={pendingName}
          before={catalogVariables ?? []}
          focusOnClose={() => datasetField.current?.querySelector<HTMLElement>('[role="combobox"]')}
          onCancel={() => setPendingDataset(null)}
          onConfirm={(next) => {
            setPendingDataset(null);
            update(() => next);
          }}
        />
      ) : null}

      <Dialog
        open={confirmingAccept}
        onOpenChange={(open) => {
          if (!open) setConfirmingAccept(false);
        }}
        focusOnClose={() => multipleRowsField.current?.querySelector<HTMLElement>('[role="combobox"]')}
        title={ACCEPT_FIRST_TITLE}
        description={ACCEPT_FIRST_MESSAGE}
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmingAccept(false);
                update((current) => ({ ...current, multiple_rows: 'accept_first' }));
              }}
            >
              Aceitar a primeira linha
            </Button>
          </>
        }
      />
    </PropertiesFrame>
  );
}

interface DatasetSectionsProps {
  node: SourceNode;
  analyzedNode: SourceNode | null;
  at: string | null;
  variables: ReturnType<typeof useDatasetVariables>;
  filterVariables: readonly FilterVariable[];
  candidates: ReturnType<typeof linkCandidates>;
  update: (apply: (current: SourceNode) => SourceNode, mergeKey?: string) => void;
}

/** The parts that need the dataset's variables before the policies: links, filters and, in the Linear, the ordering. */
function DatasetSections({ node, analyzedNode, at, variables, filterVariables, candidates, update }: DatasetSectionsProps) {
  const { problems } = useDraftEditor();
  const { readOnly } = useFieldsState();
  if (variables.isPending) return <Loading label="Carregando as variáveis do dataset" rows={4} />;
  if (variables.isError) {
    return (
      <Notice type="error" actions={<Button onClick={() => void variables.refetch()}>Tentar de novo</Button>}>
        Não foi possível carregar as variáveis do dataset. As ligações, os filtros e a saída aparecem quando elas carregarem.
      </Notice>
    );
  }
  const catalogVariables: readonly CatalogVariable[] = variables.data;
  const filters = node.filters;
  const entries: FilterEntry[] = filters.map((filter) => ({ variable: filter.variable_id, operator: filter.operator, values: filter.values }));
  const filterPaths = filters.map((filter) => {
    const index = indexOfItem(analyzedNode?.filters, filter);
    return at === null || index < 0 ? null : `${at}.filters[${index}]`;
  });

  function setFilter(filter: SourceFilter, entry: FilterEntry) {
    return (current: SourceNode): SourceNode => ({
      ...current,
      filters: replaceItem(current.filters, filter, (item) => ({ ...item, variable_id: entry.variable, operator: entry.operator, values: [...entry.values] })),
    });
  }

  return (
    <>
      {catalogVariables.length === 0 && !readOnly ? (
        <Notice type="warning">O dataset não tem variáveis. Crie as variáveis no catálogo para ligar, filtrar e trazer colunas.</Notice>
      ) : null}
      <SourceLinks node={node} analyzedNode={analyzedNode} at={at} variables={catalogVariables} candidates={candidates} update={update} />
      <FilterList
        filters={entries}
        keys={filters.map((filter) => itemKey(filter))}
        paths={filterPaths}
        variableField="variable_id"
        variables={filterVariables}
        problems={problems}
        mergeKeyPrefix={`source:${node.id}`}
        onAdd={(entry) =>
          update((current) => ({ ...current, filters: [...current.filters, { variable_id: entry.variable, operator: entry.operator, values: [...entry.values] }] }))
        }
        onChange={(index, entry, mergeKey) => {
          const filter = filters[index];
          if (filter) update(setFilter(filter, entry), mergeKey);
        }}
        onRemove={(index) => {
          const filter = filters[index];
          if (filter) update((current) => ({ ...current, filters: removeItem(current.filters, filter) }));
        }}
      />
      {node.mode === 'linear' ? (
        <SourceOrdering node={node} analyzedNode={analyzedNode} at={at} variables={catalogVariables} update={update} />
      ) : null}
    </>
  );
}
