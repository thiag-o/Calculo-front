import { useId, useRef, useState } from 'react';
import { DATA_TYPE_LABELS, DATASET_TYPE_LABELS, useDatasetList, useDatasetVariables, type Dataset } from '../../catalog';
import { Badge, Button, FieldMessage, Loading, Notice, Text, textClasses, type SelectOption } from '../../design-system';
import { READ_ONLY_REASON, type WorkflowProblem } from '../draft';
import { PathSelect, problemText, useFieldsState, useFocusOnSelection } from '../properties';
import { FilterList, type FilterEntry, type FilterVariable } from '../sources';
import { DatasetSearch } from '../sources/batch-source';
import { filterKey, indexOfFilter, removeFilter, replaceFilter, type QueryFilter } from './filterIdentity';
import type { QueryProblems } from './parameterProblems';
import { QUERY_PARAMETER_REFUSAL, type AllowedValuesQuery, type ValueType } from './parameterRules';

export interface AllowedValuesQueryFieldsProps {
  /** The query in the definition, or `null` while the first dataset and variable are being chosen (nothing written yet). */
  query: AllowedValuesQuery | null;
  /** The query as it was analysed: the filters' problems are found by it (ADR 0044). */
  analyzed: AllowedValuesQuery | null;
  /** Where the parameter was in the analysed definition (`parameters[1]`), or `null`. */
  at: string | null;
  /** The parameter the fields belong to (part of the accessible names). */
  scope: string;
  /** The parameter's type: only the variables of this type are offered. */
  type: ValueType;
  problems: QueryProblems;
  /** Writes the whole query (the first one, or a new dataset with its variable): one change, one undo step. */
  onWrite: (query: AllowedValuesQuery) => void;
  /** Changes the query in the definition; `field` makes the merge key of a value being typed. */
  onChange: (apply: (query: AllowedValuesQuery) => AllowedValuesQuery, field?: string) => void;
}

export const UNKNOWN_DATASET = 'Dataset fora do catálogo';
const OUT_OF_TYPE = 'Variável de outro tipo';
const OUT_OF_DATASET = 'Variável fora do dataset';

/**
 * The query of the allowed values (E7-23; Contratos, `AllowedValuesQuery`): the dataset, chosen in the catalog search of the
 * batch source; the variable whose distinct values are allowed, only among the ones of the parameter's type; and the
 * filters of a Source, without `@` (the values are read before any run). A new dataset only goes to the draft with its
 * variable, so the query is never written half done (ADR 0046); its filters, of the dataset left behind, go then.
 */
export function AllowedValuesQueryFields({ query, analyzed, at, scope, type, problems, onWrite, onChange }: AllowedValuesQueryFieldsProps) {
  const { readOnly } = useFieldsState();
  const datasets = useDatasetList();
  /** "Trocar dataset" pressed: the search shows. */
  const [searching, setSearching] = useState(false);
  /** A dataset chosen whose variable is not chosen yet: it goes to the draft with the variable. */
  const [chosen, setChosen] = useState<Dataset | null>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const errorId = useId();

  const pending = chosen !== null && chosen.id !== query?.dataset_id ? chosen : null;
  const datasetId = pending?.id ?? query?.dataset_id ?? null;
  const search = datasetId === null || searching;
  const path = (field: string) => (at === null ? null : `${at}.allowed_values.${field}`);
  const datasetPath = problems.dataset[0]?.path ?? path('dataset_id');
  const datasetError = problemText(problems.dataset);
  useFocusOnSelection(search ? null : datasetPath, () => toggle.current);

  const dataset = datasets.data?.find((item) => item.id === datasetId);
  const datasetName = dataset
    ? dataset.name
    : datasets.isPending
      ? 'Carregando dataset'
      : datasets.isError
        ? 'Não foi possível carregar o dataset'
        : UNKNOWN_DATASET;

  function keepDataset() {
    setSearching(false);
    requestAnimationFrame(() => toggle.current?.focus());
  }

  function chooseVariable(variableId: string) {
    if (pending !== null || query === null) {
      onWrite({ dataset_id: datasetId!, variable_id: variableId, filters: [] });
      setChosen(null);
      return;
    }
    onChange((current) => ({ ...current, variable_id: variableId }));
  }

  return (
    <div className="fc-parameters-query">
      {search ? (
        <>
          <DatasetSearch
            value={datasetId}
            path={datasetPath}
            error={datasetError}
            autoFocus
            onChoose={(next) => {
              setSearching(false);
              setChosen(next);
              requestAnimationFrame(() => toggle.current?.focus());
            }}
          />
          {datasetId !== null ? (
            <div>
              <Button size="small" variant="ghost" onClick={keepDataset}>
                Manter dataset
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="fc-parameters-query-dataset">
          <Text as="span" variant="label-13" emphasis="secondary">
            Dataset
          </Text>
          <div className="fc-parameters-query-dataset-line">
            <span className={textClasses({ variant: 'label-14', medium: true })}>{datasetName}</span>
            {dataset ? (
              <>
                {' '}
                <Badge>{DATASET_TYPE_LABELS[dataset.type]}</Badge>
              </>
            ) : null}
          </div>
          {datasetError && pending === null ? (
            <FieldMessage id={errorId} type="error">
              {datasetError}
            </FieldMessage>
          ) : null}
          <div className="fc-parameters-query-actions">
            <Button
              ref={toggle}
              size="small"
              aria-label={`Trocar dataset (${scope})`}
              aria-describedby={datasetError && pending === null ? errorId : undefined}
              disabledReason={readOnly ? READ_ONLY_REASON : undefined}
              onClick={() => setSearching(true)}
            >
              Trocar dataset
            </Button>
            {pending !== null && query !== null ? (
              <Button
                size="small"
                variant="ghost"
                disabledReason={readOnly ? READ_ONLY_REASON : undefined}
                onClick={() => {
                  setChosen(null);
                  requestAnimationFrame(() => toggle.current?.focus());
                }}
              >
                Manter dataset
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {datasetId !== null && !search ? (
        <DatasetVariables
          datasetId={datasetId}
          query={pending === null ? query : null}
          analyzed={analyzed}
          at={at}
          scope={scope}
          type={type}
          problems={problems}
          leaving={pending !== null && query !== null ? query.filters.length : 0}
          onChooseVariable={chooseVariable}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}

interface DatasetVariablesProps {
  datasetId: string;
  /** The query written, of this dataset; `null` while its variable is being chosen. */
  query: AllowedValuesQuery | null;
  analyzed: AllowedValuesQuery | null;
  at: string | null;
  scope: string;
  type: ValueType;
  problems: QueryProblems;
  /** How many filters of the dataset left behind go when the variable is chosen. */
  leaving: number;
  onChooseVariable: (variableId: string) => void;
  onChange: AllowedValuesQueryFieldsProps['onChange'];
}

/** The parts that need the dataset's variables: the variable of the values and the filters. */
function DatasetVariables({ datasetId, query, analyzed, at, scope, type, problems, leaving, onChooseVariable, onChange }: DatasetVariablesProps) {
  const variables = useDatasetVariables(datasetId);
  if (variables.isPending) return <Loading label="Carregando as variáveis do dataset" rows={2} />;
  if (variables.isError) {
    return (
      <Notice type="error" actions={<Button size="small" onClick={() => void variables.refetch()}>Tentar de novo</Button>}>
        Não foi possível carregar as variáveis do dataset. A variável e os filtros aparecem quando elas carregarem.
      </Notice>
    );
  }
  const all = variables.data;
  const typeLabel = DATA_TYPE_LABELS[type];
  const options: SelectOption[] = all.filter((variable) => variable.type === type).map((variable) => ({ value: variable.id, label: variable.name }));
  const current = query?.variable_id ?? '';
  if (current !== '' && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: all.some((variable) => variable.id === current) ? OUT_OF_TYPE : OUT_OF_DATASET });
  }
  const variablePath = problems.variable[0]?.path ?? (at === null ? null : `${at}.allowed_values.variable_id`);
  const filterVariables: FilterVariable[] = all.map((variable) => ({ key: variable.id, name: variable.name, type: variable.type, scale: variable.scale }));

  return (
    <>
      {options.length > 0 ? (
        <PathSelect
          label="Variável"
          scope={scope}
          value={current}
          options={options}
          placeholder="Escolha a variável"
          tooltip={`Os valores distintos desta variável são os permitidos. Só aparecem as do tipo ${typeLabel}.`}
          className="fc-properties-mono"
          path={query === null ? null : variablePath}
          problems={query === null ? [] : problems.variable}
          onChange={onChooseVariable}
        />
      ) : (
        <Text as="p" variant="label-12" emphasis="secondary" className="fc-parameters-note">
          O dataset não tem variáveis do tipo {typeLabel}. Escolha outro dataset ou crie a variável em Catálogo › Datasets.
        </Text>
      )}
      {query === null ? (
        <Text as="p" variant="label-12" emphasis="secondary" className="fc-parameters-note">
          {leaving > 0
            ? `A consulta muda quando você escolher a variável. ${leaving === 1 ? 'O filtro do dataset atual sai' : `Os ${leaving} filtros do dataset atual saem`}.`
            : 'A consulta vai para o rascunho quando você escolher a variável.'}
        </Text>
      ) : (
        <QueryFilters query={query} analyzed={analyzed} at={at} variables={filterVariables} problems={problems} onChange={onChange} />
      )}
    </>
  );
}

interface QueryFiltersProps {
  query: AllowedValuesQuery;
  analyzed: AllowedValuesQuery | null;
  at: string | null;
  variables: readonly FilterVariable[];
  problems: QueryProblems;
  onChange: AllowedValuesQueryFieldsProps['onChange'];
}

/** The filters of the query: the Source's (F64), with literals only. */
function QueryFilters({ query, analyzed, at, variables, problems, onChange }: QueryFiltersProps) {
  const filters = query.filters;
  const entries: FilterEntry[] = filters.map((filter) => ({ variable: filter.variable_id, operator: filter.operator, values: filter.values }));
  const paths = filters.map((filter) => {
    const index = indexOfFilter(analyzed?.filters, filter);
    return at === null || index < 0 ? null : `${at}.allowed_values.filters[${index}]`;
  });
  const toFilter = (entry: FilterEntry): QueryFilter => ({ variable_id: entry.variable, operator: entry.operator, values: [...entry.values] });

  return (
    <div className="fc-parameters-query-filters">
      {problems.filterList.length > 0 ? <ProblemList problems={problems.filterList} /> : null}
      <FilterList
        filters={entries}
        keys={filters.map((filter) => filterKey(filter))}
        paths={paths}
        variableField="variable_id"
        variables={variables}
        problems={problems.filters}
        mergeKeyPrefix="allowed"
        refuseParameters={QUERY_PARAMETER_REFUSAL}
        onAdd={(entry) => onChange((current) => ({ ...current, filters: [...current.filters, toFilter(entry)] }))}
        onChange={(index, entry, mergeKey) => {
          const filter = filters[index];
          if (filter) onChange((current) => ({ ...current, filters: replaceFilter(current.filters, filter, toFilter(entry)) }), mergeKey);
        }}
        onRemove={(index) => {
          const filter = filters[index];
          if (filter) onChange((current) => ({ ...current, filters: removeFilter(current.filters, filter) }));
        }}
      />
    </div>
  );
}

function ProblemList({ problems }: { problems: readonly WorkflowProblem[] }) {
  return (
    <ul className="fc-properties-problems" aria-label="Problemas dos filtros">
      {problems.map((problem, index) => (
        <li key={`${problem.code}-${problem.path ?? ''}-${index}`}>
          <FieldMessage type="error">{problem.message}</FieldMessage>
        </li>
      ))}
    </ul>
  );
}
