import { useId, useRef, useState, type ReactNode } from 'react';
import { DATASET_TYPE_LABELS, dataTypeLabel, useDatasetList, useDatasetVariables, type Dataset, type Variable } from '../../../catalog';
import { Badge, Button, Checkbox, Dialog, DialogClose, FieldMessage, Loading, Notice, Text, textClasses } from '../../../design-system';
import { READ_ONLY_REASON, useDraftEditor, type WorkflowProblem } from '../../draft';
import {
  CommitTextField,
  NAME_PATTERN,
  NAME_RULE_MESSAGE,
  NAME_TOOLTIP,
  PathSelect,
  problemText,
  useFieldsState,
  useFocusOnSelection,
} from '../../properties';
import {
  BATCH_SOURCE_PATH,
  DATASET_PATH,
  FILTERS_PATH,
  KEY_PATH,
  ORDER_PATH,
  analyzedOrderPath,
  analyzedOutputPath,
  hasSetup,
  isBatchSourceCode,
  isUnder,
  keyProblems as keyProblemsOf,
  orderProblems as orderProblemsOf,
  problemsUnder,
  updateBatchSource,
  withDataset,
  withFilters,
  withKey,
  withNewOrder,
  withOrderChanged,
  withOrderMoved,
  withOutput,
  withOutputName,
  withoutOrder,
  withoutOutput,
  type BatchSource,
  type BatchSourceFilter,
  type BatchSourceOrder,
  type DataType,
  type SortDirection,
  type SourceOutput,
} from './batchSource';
import { DatasetSearch } from './DatasetSearch';
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, PlusIcon, TrashIcon } from './icons';
import {
  NO_FILTERS,
  NO_ORDER,
  NO_OUTPUTS_FOR_KEY,
  NO_OUTPUTS_FOR_ORDER,
  NO_VARIABLES,
  ORDER_KEY_NOTE,
  OUT_OF_CATALOG,
  SORT_DIRECTION_LABELS,
  UNKNOWN_DATASET,
  VARIABLES_ERROR_TITLE,
  datasetsErrorMessage,
  variablesCount,
} from './messages';
import './batch-source.css';

/** A variable the filters of the batch source can use: a variable brought, by its name in the workflow, with its type. */
export interface FilterVariable {
  name: string;
  type: DataType;
  scale: number | null;
}

/**
 * What the filters component (F64) gets to edit the filters of the batch source. The filters point to the variables
 * brought by their name in the workflow (`BatchSourceFilter.variable`).
 */
export interface BatchSourceFiltersProps {
  filters: readonly BatchSourceFilter[];
  /** The variables brought whose type the catalog gives, in the order of the outputs. */
  variables: readonly FilterVariable[];
  /** Replaces the filters (one undo step). */
  onChange: (filters: readonly BatchSourceFilter[]) => void;
  /** Where the filters are in the analysed definition (`root.batch_source.filters`): their problems start with it. */
  path: string;
  /** The problems at `path` or inside it. */
  problems: readonly WorkflowProblem[];
}

export interface BatchSourceFieldsProps {
  source: BatchSource;
  /**
   * The filters editor (the filters component of the source block, F64). Without it, the filters show as text, read only.
   */
  renderFilters?: (props: BatchSourceFiltersProps) => ReactNode;
}

const validateName = (text: string) => (NAME_PATTERN.test(text) ? null : NAME_RULE_MESSAGE);

const DIRECTION_OPTIONS = (['asc', 'desc'] as const).map((value) => ({ value, label: SORT_DIRECTION_LABELS[value] }));

const OPERATOR_TEXT: Readonly<Record<BatchSourceFilter['operator'], string>> = {
  '=': '=',
  '<>': '≠',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  between: 'entre',
  in: 'em',
  is_null: 'é nulo',
  is_not_null: 'não é nulo',
};

/**
 * The properties of the batch source (E5-17): the dataset (a search in the catalog), the variables it brings (with the
 * name in the workflow), the record key, the filters and the order. Each change goes to the draft through `change`
 * (ADR 0042), and each problem shows beside the field of its `path`; the others of the batch source show on top.
 */
export function BatchSourceFields({ source, renderFilters }: BatchSourceFieldsProps) {
  const { problems, analyzedDefinition } = useDraftEditor();
  const datasets = useDatasetList();
  const variables = useDatasetVariables(source.dataset_id);
  const catalog = variables.data;

  const outputPaths = source.outputs.map((output) => analyzedOutputPath(analyzedDefinition, output));
  const handled = [DATASET_PATH, KEY_PATH, ORDER_PATH, FILTERS_PATH, ...outputPaths.filter((path): path is string => path !== null)];
  const loose = problemsUnder(problems, BATCH_SOURCE_PATH).filter(
    (problem) => !isBatchSourceCode(problem) && !handled.some((prefix) => isUnder(problem.path!, prefix)),
  );

  return (
    <div className="fc-batch-source">
      {loose.length > 0 ? (
        <ul className="fc-batch-source-problems" aria-label="Problemas da fonte do lote">
          {loose.map((problem, index) => (
            <li key={`${problem.code}-${problem.path ?? ''}-${index}`}>
              <FieldMessage type="error">{problem.message}</FieldMessage>
            </li>
          ))}
        </ul>
      ) : null}
      <DatasetPart source={source} dataset={datasets.data?.find((dataset) => dataset.id === source.dataset_id)} known={datasets.isSuccess} />
      <VariablesPart source={source} catalog={catalog} state={variables} outputPaths={outputPaths} />
      <KeyPart source={source} />
      <FiltersPart source={source} catalog={catalog} renderFilters={renderFilters} />
      <OrderPart source={source} />
    </div>
  );
}

function change(editor: ReturnType<typeof useDraftEditor>, update: (source: BatchSource) => BatchSource, mergeKey?: string) {
  editor.change((current) => updateBatchSource(current, update), mergeKey ? { mergeKey } : undefined);
}

interface DatasetPartProps {
  source: BatchSource;
  /** The dataset of the batch source in the catalog; `undefined` while loading or when it is not there. */
  dataset: Dataset | undefined;
  /** The catalog list came: a dataset missing from it is out of the catalog. */
  known: boolean;
}

/** The dataset chosen, with its type, and "Trocar dataset" (with the confirmation when something would be lost). */
function DatasetPart({ source, dataset, known }: DatasetPartProps) {
  const editor = useDraftEditor();
  const { readOnly } = useFieldsState();
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState<Dataset | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const datasetProblems = problemsUnder(editor.problems, DATASET_PATH).filter((problem) => !isBatchSourceCode(problem));
  const error = problemText(datasetProblems);
  const errorId = useId();
  useFocusOnSelection(searching ? null : DATASET_PATH, () => toggle.current);

  function choose(next: Dataset) {
    if (hasSetup(source)) {
      setReplacing(next);
      return;
    }
    apply(next);
  }

  function apply(next: Dataset) {
    setSearching(false);
    change(editor, (current) => withDataset(current, next.id));
    requestAnimationFrame(() => toggle.current?.focus());
  }

  return (
    <div className="fc-batch-source-part">
      {searching ? (
        <>
          <DatasetSearch value={source.dataset_id} onChoose={choose} path={DATASET_PATH} error={error} autoFocus />
          <div>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                setSearching(false);
                requestAnimationFrame(() => toggle.current?.focus());
              }}
            >
              Manter dataset
            </Button>
          </div>
        </>
      ) : (
        <div className="fc-batch-source-dataset-chosen">
          <Text as="span" variant="label-13" emphasis="secondary">
            Dataset
          </Text>
          <div className="fc-batch-source-dataset-line">
            <span className={textClasses({ variant: 'label-14', medium: true })}>
              {dataset ? dataset.name : known ? UNKNOWN_DATASET : 'Carregando dataset'}
            </span>
            {dataset ? (
              <>
                {' '}
                <Badge>{DATASET_TYPE_LABELS[dataset.type]}</Badge>
              </>
            ) : null}
          </div>
          {error ? (
            <FieldMessage id={errorId} type="error">
              {error}
            </FieldMessage>
          ) : null}
          <div>
            <Button
              ref={toggle}
              size="small"
              aria-describedby={error ? errorId : undefined}
              disabledReason={readOnly ? READ_ONLY_REASON : undefined}
              onClick={() => setSearching(true)}
            >
              Trocar dataset
            </Button>
          </div>
        </div>
      )}
      <Dialog
        open={replacing !== null}
        onOpenChange={(open) => {
          if (!open) setReplacing(null);
        }}
        title="Trocar dataset"
        description={
          replacing ? (
            <>
              {variablesCount(source.outputs.length)} trazidas, a chave, os filtros e a ordenação saem da fonte do lote, porque são do
              dataset atual. Os blocos que usam essas variáveis passam a mostrar um problema. Você pode desfazer com Ctrl Z.
            </>
          ) : null
        }
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                const next = replacing;
                setReplacing(null);
                if (next) apply(next);
              }}
            >
              Trocar dataset
            </Button>
          </>
        }
      />
    </div>
  );
}

interface VariablesPartProps {
  source: BatchSource;
  catalog: Variable[] | undefined;
  state: ReturnType<typeof useDatasetVariables>;
  /** The analysed path of each output (`root.batch_source.outputs[k]`), in the order of `source.outputs`. */
  outputPaths: (string | null)[];
}

/**
 * "Variáveis trazidas": a box per variable of the dataset in the catalog. A marked one is brought, with its name in the
 * workflow (by default, the name in the catalog). An output whose variable left the catalog stays listed, so it can be
 * unmarked.
 */
function VariablesPart({ source, catalog, state, outputPaths }: VariablesPartProps) {
  let content: ReactNode;
  if (state.isPending) {
    content = <Loading label="Carregando variáveis do dataset" rows={3} />;
  } else if (state.isError) {
    content = (
      <Notice
        type="error"
        title={VARIABLES_ERROR_TITLE}
        actions={
          <Button size="small" loading={state.isFetching} onClick={() => void state.refetch()}>
            Tentar de novo
          </Button>
        }
      >
        {datasetsErrorMessage(state.error)}
      </Notice>
    );
  } else {
    const known = new Set(catalog!.map((variable) => variable.id));
    const orphans = source.outputs.filter((output) => !known.has(output.variable_id));
    content =
      catalog!.length === 0 && orphans.length === 0 ? (
        <Text as="p" variant="label-13" emphasis="secondary" className="fc-batch-source-empty">
          {NO_VARIABLES}
        </Text>
      ) : (
        <ul className="fc-batch-source-list">
          {catalog!.map((variable) => {
            const index = source.outputs.findIndex((output) => output.variable_id === variable.id);
            return (
              <VariableRow
                key={variable.id}
                variable={variable}
                output={index < 0 ? undefined : source.outputs[index]}
                path={index < 0 ? null : (outputPaths[index] ?? null)}
              />
            );
          })}
          {orphans.map((output) => (
            <VariableRow key={output.variable_id} output={output} path={outputPaths[source.outputs.indexOf(output)] ?? null} />
          ))}
        </ul>
      );
  }
  return (
    <fieldset className="fc-batch-source-part">
      <legend className="fc-batch-source-legend fc-batch-source-title">Variáveis trazidas</legend>
      {content}
    </fieldset>
  );
}

interface VariableRowProps {
  /** The catalog variable; missing when the output's variable left the catalog. */
  variable?: Variable;
  /** The output that brings it, when marked. */
  output?: SourceOutput;
  /** The output's path in the analysed definition, or `null`. */
  path: string | null;
}

function VariableRow({ variable, output, path }: VariableRowProps) {
  const editor = useDraftEditor();
  const { readOnly, reasonId } = useFieldsState();
  const box = useRef<HTMLButtonElement>(null);
  const namePath = path === null ? null : `${path}.name`;
  const rowProblems = problemsUnder(editor.problems, path).filter((problem) => problem.path !== namePath && !isBatchSourceCode(problem));
  useFocusOnSelection(rowProblems[0]?.path ?? null, () => box.current);
  const label = variable?.name ?? output!.name;
  const type = variable ? dataTypeLabel(variable.type, variable.scale) : OUT_OF_CATALOG;

  return (
    <li className="fc-batch-source-row">
      <Checkbox
        ref={box}
        label={
          <>
            <span className="fc-batch-source-code">{label}</span>{' '}
            <span className={textClasses({ variant: 'label-12', emphasis: 'secondary' })}>{type}</span>
          </>
        }
        checked={output !== undefined}
        disabled={readOnly}
        aria-describedby={reasonId}
        error={problemText(rowProblems)}
        onCheckedChange={(checked) => {
          if (checked === true && variable) change(editor, (current) => withOutput(current, variable));
          else if (checked !== true && output) {
            change(editor, (current) => {
              const now = current.outputs.find((candidate) => candidate.variable_id === output.variable_id);
              return now ? withoutOutput(current, now) : current;
            });
          }
        }}
      />
      {output ? (
        <CommitTextField
          label="Nome no workflow"
          scope={label}
          value={output.name}
          mono
          maxLength={63}
          tooltip={NAME_TOOLTIP}
          path={namePath}
          problems={problemsUnder(editor.problems, namePath).filter((problem) => problem.path === namePath)}
          validate={validateName}
          className="fc-batch-source-name"
          onCommit={(name) =>
            change(
              editor,
              (current) => {
                const now = current.outputs.find((candidate) => candidate.variable_id === output.variable_id);
                return now ? withOutputName(current, now, name) : current;
              },
              `batch-source:${output.variable_id}.name`,
            )
          }
        />
      ) : null}
    </li>
  );
}

/** "Chave do registro": one or more of the variables brought, by the name in the workflow. */
function KeyPart({ source }: { source: BatchSource }) {
  const editor = useDraftEditor();
  const { readOnly, reasonId } = useFieldsState();
  const first = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const keyProblems = keyProblemsOf(editor.problems);
  const error = problemText(keyProblems);
  // The path, when the problem has one, only says which field the Problems tab brings into view.
  useFocusOnSelection(keyProblems.find((problem) => problem.path !== null)?.path ?? KEY_PATH, () => first.current);
  const names = [...new Set(source.outputs.map((output) => output.name))];
  // A key name that is no longer brought (a stale definition) stays listed, so it can be unmarked.
  for (const name of source.key) if (!names.includes(name)) names.push(name);

  return (
    <fieldset className="fc-batch-source-part" aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="fc-batch-source-legend fc-batch-source-title">Chave do registro</legend>
      {names.length === 0 ? (
        <Text as="p" variant="label-13" emphasis="secondary" className="fc-batch-source-empty">
          {NO_OUTPUTS_FOR_KEY}
        </Text>
      ) : (
        <ul className="fc-batch-source-list fc-batch-source-keys">
          {names.map((name, index) => (
            <li key={name}>
              <Checkbox
                ref={index === 0 ? first : undefined}
                label={
                  <span className="fc-batch-source-key-label">
                    <span className="fc-batch-source-code">{name}</span>
                  </span>
                }
                checked={source.key.includes(name)}
                disabled={readOnly}
                aria-describedby={reasonId}
                onCheckedChange={(checked) => change(editor, (current) => withKey(current, name, checked === true))}
              />
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <FieldMessage id={errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
    </fieldset>
  );
}

interface FiltersPartProps {
  source: BatchSource;
  catalog: Variable[] | undefined;
  renderFilters?: (props: BatchSourceFiltersProps) => ReactNode;
}

/** "Filtros": the filters component (F64) when given; otherwise the filters as text. */
function FiltersPart({ source, catalog, renderFilters }: FiltersPartProps) {
  const editor = useDraftEditor();
  const filterProblems = problemsUnder(editor.problems, FILTERS_PATH);
  const variables: FilterVariable[] = [];
  for (const output of source.outputs) {
    const variable = catalog?.find((candidate) => candidate.id === output.variable_id);
    if (variable) variables.push({ name: output.name, type: variable.type, scale: variable.scale });
  }

  // The filters component brings its own "Filtros" fieldset: wrapping it in another one would nest two with the same name.
  if (renderFilters) {
    return (
      <div className="fc-batch-source-part">
        {renderFilters({
          filters: source.filters,
          variables,
          path: FILTERS_PATH,
          problems: filterProblems,
          onChange: (filters) => change(editor, (current) => withFilters(current, filters)),
        })}
      </div>
    );
  }

  return (
    <fieldset className="fc-batch-source-part">
      <legend className="fc-batch-source-legend fc-batch-source-title">Filtros</legend>
      {source.filters.length === 0 ? (
        <Text as="p" variant="label-13" emphasis="secondary" className="fc-batch-source-empty">
          {NO_FILTERS}
        </Text>
      ) : (
        <ul className="fc-batch-source-list" aria-label="Filtros da fonte do lote">
          {source.filters.map((filter, index) => (
            <li key={index} className="fc-batch-source-code">
              {[filter.variable, OPERATOR_TEXT[filter.operator], ...filter.values].join(' ')}
            </li>
          ))}
        </ul>
      )}
      {filterProblems.map((problem, index) => (
        <FieldMessage key={`${problem.code}-${index}`} type="error">
          {problem.message}
        </FieldMessage>
      ))}
    </fieldset>
  );
}

/**
 * "Ordenação": the criteria (variable and direction), moved with the arrows, and the note that the key comes in as the
 * last criterion (design §6: the order never ties).
 */
function OrderPart({ source }: { source: BatchSource }) {
  const editor = useDraftEditor();
  const { readOnly } = useFieldsState();
  const list = useRef<HTMLOListElement>(null);
  const errorId = useId();
  const noteId = useId();
  const sectionProblems = orderProblemsOf(editor.problems);
  const error = problemText(sectionProblems);
  const add = useRef<HTMLButtonElement>(null);
  useFocusOnSelection(sectionProblems.find((problem) => problem.path !== null)?.path ?? null, () => add.current);
  const addReason = readOnly ? READ_ONLY_REASON : source.outputs.length === 0 ? NO_OUTPUTS_FOR_ORDER : undefined;
  // By variable (and occurrence), not by position: a moved criterion keeps its row, and the focus stays on its arrow.
  const seen = new Map<string, number>();
  const orderKeys = source.order_by.map((order) => {
    const count = (seen.get(order.variable) ?? 0) + 1;
    seen.set(order.variable, count);
    return `${order.variable}#${count}`;
  });

  return (
    <fieldset className="fc-batch-source-part" aria-describedby={[error ? errorId : null, noteId].filter(Boolean).join(' ')}>
      <legend className="fc-batch-source-legend fc-batch-source-title">Ordenação</legend>
      {source.order_by.length === 0 ? (
        <Text as="p" variant="label-13" emphasis="secondary" className="fc-batch-source-empty">
          {NO_ORDER}
        </Text>
      ) : (
        <ol ref={list} className="fc-batch-source-list" aria-label="Critérios de ordenação">
          {source.order_by.map((order, index) => (
            <OrderRow
              key={orderKeys[index]}
              source={source}
              order={order}
              position={index + 1}
              first={index === 0}
              last={index === source.order_by.length - 1}
            />
          ))}
        </ol>
      )}
      <p id={noteId} className={`fc-batch-source-note ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
        <InfoIcon size={12} />
        <span>{ORDER_KEY_NOTE}</span>
      </p>
      {error ? (
        <FieldMessage id={errorId} type="error">
          {error}
        </FieldMessage>
      ) : null}
      <div>
        <Button
          ref={add}
          size="small"
          icon={<PlusIcon size={14} />}
          disabledReason={addReason}
          onClick={() => {
            change(editor, withNewOrder);
            requestAnimationFrame(() => list.current?.querySelector<HTMLButtonElement>(':scope > li:last-child button')?.focus());
          }}
        >
          Incluir critério
        </Button>
      </div>
    </fieldset>
  );
}

interface OrderRowProps {
  source: BatchSource;
  order: BatchSourceOrder;
  /** 1, 2…: names the row's controls ("Variável (critério 1)"). */
  position: number;
  first: boolean;
  last: boolean;
}

function OrderRow({ source, order, position, first, last }: OrderRowProps) {
  const editor = useDraftEditor();
  const { readOnly } = useFieldsState();
  const at = analyzedOrderPath(editor.analyzedDefinition, order);
  const path = (field: string) => (at === null ? null : `${at}.${field}`);
  const scope = `critério ${position}`;
  const names = [...new Set(source.outputs.map((output) => output.name))];
  if (!names.includes(order.variable)) names.push(order.variable);
  const reason = (fallback: string | undefined) => (readOnly ? READ_ONLY_REASON : fallback);
  const rowProblems = problemsUnder(editor.problems, at).filter(
    (problem) => problem.path !== path('variable') && problem.path !== path('direction') && !isBatchSourceCode(problem),
  );

  /** The criterion as it is now in the definition (the same position), so the edits never touch a neighbour. */
  function update(apply: (current: BatchSource, now: BatchSourceOrder) => BatchSource) {
    change(editor, (current) => {
      const now = current.order_by[position - 1];
      return now ? apply(current, now) : current;
    });
  }

  return (
    <li className="fc-batch-source-order">
      <div role="group" aria-label={`Critério ${position}`} className="fc-batch-source-order-group">
        <div className="fc-batch-source-order-fields">
          <PathSelect
            label="Variável"
            scope={scope}
            value={order.variable}
            options={names.map((name) => ({ value: name, label: name }))}
            path={path('variable')}
            problems={editor.problems.filter((problem) => problem.path === path('variable'))}
            className="fc-batch-source-mono"
            onChange={(variable) => update((current, now) => withOrderChanged(current, now, { ...now, variable }))}
          />
          <PathSelect
            label="Direção"
            scope={scope}
            value={order.direction}
            options={DIRECTION_OPTIONS}
            path={path('direction')}
            problems={editor.problems.filter((problem) => problem.path === path('direction'))}
            onChange={(direction) => update((current, now) => withOrderChanged(current, now, { ...now, direction: direction as SortDirection }))}
          />
        </div>
        {rowProblems.map((problem, index) => (
          <FieldMessage key={`${problem.code}-${index}`} type="error">
            {problem.message}
          </FieldMessage>
        ))}
        <div className="fc-batch-source-order-actions">
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={`Mover para cima (${scope})`}
            icon={<ArrowUpIcon size={14} />}
            disabledReason={reason(first ? 'Já é o primeiro critério' : undefined)}
            onClick={() => update((current, now) => withOrderMoved(current, now, -1))}
          />
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={`Mover para baixo (${scope})`}
            icon={<ArrowDownIcon size={14} />}
            disabledReason={reason(last ? 'Já é o último critério' : undefined)}
            onClick={() => update((current, now) => withOrderMoved(current, now, 1))}
          />
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={`Remover critério (${scope})`}
            icon={<TrashIcon size={14} />}
            disabledReason={reason(undefined)}
            onClick={() => update((current, now) => withoutOrder(current, now))}
          />
        </div>
      </div>
    </li>
  );
}
