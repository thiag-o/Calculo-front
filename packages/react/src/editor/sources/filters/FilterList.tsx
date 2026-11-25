import { DATA_TYPE_LABELS } from '../../../catalog';
import { Button, FieldMessage, type SelectOption } from '../../../design-system';
import type { ParameterReference } from '../../../formula';
import { READ_ONLY_REASON, useDraftEditor, type WorkflowProblem } from '../../draft';
import { PathSelect, problemsAt, useFieldsState } from '../../properties';
import {
  BOOLEAN_LITERALS,
  FILTERS_MAX,
  FILTER_OPERATORS,
  IN_VALUES_MAX,
  OPERATOR_LABELS,
  operatorsFor,
  valuesFor,
  withVariableType,
  type DataType,
  type FilterOperator,
} from './filterRules';
import { PlusIcon, TrashIcon } from './icons';
import { LiteralField } from './LiteralField';
import { ParameterButton } from './ParameterButton';
import { servingReferences } from './parameterHints';
import { fieldPath, rowProblems, scopedName } from './paths';
import './filters.css';

/** A variable a filter can use: `key` is what the filter keeps (the catalog variable id, or the variable name). */
export interface FilterVariable {
  key: string;
  name: string;
  type: DataType;
  scale: number | null;
}

/** A filter, whatever names its variable (`variable_id` in the Source block, `variable` in the batch source). */
export interface FilterEntry {
  /** The `key` of a `FilterVariable`. */
  variable: string;
  operator: FilterOperator;
  values: readonly string[];
}

export interface FilterListProps {
  filters: readonly FilterEntry[];
  /** A stable key per filter (the same while the same filter is edited, ADR 0044), aligned with `filters`. */
  keys: readonly (string | number)[];
  /** The `path` of each filter in the analysed definition (`root.nodes[2].filters[0]`), or `null`; aligned with `filters`. */
  paths: readonly (string | null)[];
  /** The field of the filter that names the variable, in the `path` of its problems: `variable_id` or `variable`. */
  variableField: string;
  /** The variables a filter can use, with the type that decides the operators. */
  variables: readonly FilterVariable[];
  problems: readonly WorkflowProblem[];
  /** Where the merge keys of the typed values start (`source:produto`): one undo step per value being typed. */
  mergeKeyPrefix: string;
  onAdd: (filter: FilterEntry) => void;
  onChange: (index: number, filter: FilterEntry, mergeKey?: string) => void;
  onRemove: (index: number) => void;
  /** The most filters (20 in the contract). */
  max?: number;
  /**
   * Where run parameters cannot be used (the query of the allowed values, E7-23): why. With it, no parameter is offered and
   * a typed `@` stays only in the field, with this message (ADR 0046).
   */
  refuseParameters?: string;
}

/** "categoria · Texto": the variable and its type, in the options. */
export function variableOptionLabel(variable: { name: string; type: DataType }): string {
  return `${variable.name} · ${DATA_TYPE_LABELS[variable.type]}`;
}

/** A new filter: the first variable, `=` and an empty value (the analysis says it is missing until it is typed). */
export function newFilter(variables: readonly FilterVariable[]): FilterEntry | null {
  const first = variables[0];
  return first ? { variable: first.key, operator: '=', values: [''] } : null;
}

/**
 * The filters of a source (E5-18; design §6): one row per filter, with the variable, the operator the variable's type
 * takes (a text only `=`, `≠`, `EM` and the null ones) and the value: none in `É NULO`, two in `ENTRE`, a list in `EM`.
 * A value can be a run parameter of the draft (`@lojas`, `@periodo.inicio`, E6-18). Each problem shows beside its field,
 * by `path`. Used by the Source block and by the batch source (F63).
 */
export function FilterList({
  filters,
  keys,
  paths,
  variableField,
  variables,
  problems,
  mergeKeyPrefix,
  onAdd,
  onChange,
  onRemove,
  max = FILTERS_MAX,
  refuseParameters,
}: FilterListProps) {
  const { readOnly } = useFieldsState();
  const created = newFilter(variables);
  const addReason = readOnly
    ? READ_ONLY_REASON
    : created === null
      ? 'O dataset não tem variáveis para filtrar.'
      : filters.length >= max
        ? `A fonte aceita até ${max} filtros.`
        : undefined;

  return (
    <fieldset className="fc-properties-group fc-filters">
      <legend className="fc-properties-group-title">Filtros</legend>
      {filters.length === 0 ? (
        <p className="fc-filters-empty">Nenhum filtro: todas as linhas do dataset entram.</p>
      ) : (
        <ol className="fc-filters-list" aria-label="Filtros">
          {filters.map((filter, index) => (
            <FilterRow
              key={keys[index] ?? index}
              filter={filter}
              number={index + 1}
              at={paths[index] ?? null}
              variableField={variableField}
              variables={variables}
              problems={problems}
              mergeKey={`${mergeKeyPrefix}.filter:${keys[index] ?? index}`}
              refuseParameters={refuseParameters}
              onChange={(next, mergeKey) => onChange(index, next, mergeKey)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ol>
      )}
      <Button
        size="small"
        icon={<PlusIcon size={14} />}
        className="fc-properties-add"
        disabledReason={addReason}
        onClick={() => {
          if (created) onAdd(created);
        }}
      >
        Incluir filtro
      </Button>
    </fieldset>
  );
}

interface FilterRowProps {
  filter: FilterEntry;
  number: number;
  at: string | null;
  variableField: string;
  variables: readonly FilterVariable[];
  problems: readonly WorkflowProblem[];
  mergeKey: string;
  refuseParameters: string | undefined;
  onChange: (filter: FilterEntry, mergeKey?: string) => void;
  onRemove: () => void;
}

function FilterRow({ filter, number, at, variableField, variables, problems, mergeKey, refuseParameters, onChange, onRemove }: FilterRowProps) {
  const { readOnly } = useFieldsState();
  const scope = `filtro ${number}`;
  const variable = variables.find((candidate) => candidate.key === filter.variable);
  const type = variable?.type;

  const variableOptions: SelectOption[] = variables.map((candidate) => ({ value: candidate.key, label: variableOptionLabel(candidate) }));
  if (!variable) variableOptions.push({ value: filter.variable, label: 'Variável fora do dataset' });

  const allowed = type ? operatorsFor(type) : FILTER_OPERATORS;
  const operators = allowed.includes(filter.operator) ? allowed : [...allowed, filter.operator];
  const operatorOptions = operators.map((operator) => ({ value: operator, label: OPERATOR_LABELS[operator] }));

  const variablePath = fieldPath(at, variableField);
  const operatorPath = fieldPath(at, 'operator');
  const valuePath = (index: number) => fieldPath(at, `values[${index}]`);
  const valuePaths = filter.values.map((_, index) => valuePath(index));

  function setValue(index: number, literal: string) {
    const values = [...filter.values];
    values[index] = literal;
    onChange({ ...filter, values }, `${mergeKey}.values[${index}]`);
  }

  /** In `ENTRE`, the start of a period picked in "De" fills "Até" with its end (D35); both stay editable. */
  function pickParameter(index: number, reference: ParameterReference) {
    if (filter.operator === 'between' && index === 0 && reference.part === 'inicio') {
      onChange({ ...filter, values: [reference.text, `@${reference.parameter.name}.fim`] });
      return;
    }
    setValue(index, reference.text);
  }

  function valueField(label: string, index: number) {
    return (
      <ValueInput
        label={label}
        scope={scope}
        type={type ?? 'text'}
        scale={variable?.scale ?? null}
        operator={filter.operator}
        literal={filter.values[index] ?? ''}
        path={valuePath(index)}
        problems={problemsAt(problems, valuePath(index))}
        refuseParameters={refuseParameters}
        onCommit={(literal) => setValue(index, literal)}
        onPickParameter={(reference) => pickParameter(index, reference)}
      />
    );
  }

  let values = null;
  if (filter.operator === 'between') {
    values = (
      <div className="fc-properties-row">
        {valueField('De', 0)}
        {valueField('Até', 1)}
      </div>
    );
  } else if (filter.operator === 'in') {
    const only = filter.values.length <= 1;
    const full = filter.values.length >= IN_VALUES_MAX;
    values = (
      <div className="fc-filters-in">
        <ol className="fc-filters-in-list" aria-label={scopedName('Valores', scope)}>
          {filter.values.map((_, index) => (
            <li key={index} className="fc-filters-in-item">
              {valueField(`Valor ${index + 1}`, index)}
              <Button
                iconOnly
                variant="ghost"
                size="small"
                label={scopedName(`Remover valor ${index + 1}`, scope)}
                icon={<TrashIcon size={14} />}
                className="fc-filters-in-remove"
                disabledReason={readOnly ? READ_ONLY_REASON : only ? 'EM precisa de pelo menos um valor' : undefined}
                onClick={() => onChange({ ...filter, values: filter.values.filter((__, position) => position !== index) })}
              />
            </li>
          ))}
        </ol>
        <Button
          size="small"
          icon={<PlusIcon size={14} />}
          className="fc-properties-add"
          aria-label={scopedName('Incluir valor', scope)}
          disabledReason={readOnly ? READ_ONLY_REASON : full ? `EM aceita até ${IN_VALUES_MAX} valores.` : undefined}
          onClick={() => onChange({ ...filter, values: [...filter.values, ''] })}
        >
          Incluir valor
        </Button>
      </div>
    );
  } else if (filter.values.length > 0) {
    values = valueField('Valor', 0);
  }

  const loose = rowProblems(problems, at, [variablePath, operatorPath, ...valuePaths]);

  return (
    <li className="fc-filters-item">
      <div role="group" aria-label={`Filtro ${number}`} className="fc-properties-item-group">
        <PathSelect
          label="Variável"
          scope={scope}
          value={filter.variable}
          options={variableOptions}
          className="fc-properties-mono"
          path={variablePath}
          problems={problemsAt(problems, variablePath)}
          onChange={(key) => {
            const next = variables.find((candidate) => candidate.key === key);
            if (!next) return;
            onChange({ variable: key, ...withVariableType(filter, type, next.type) });
          }}
        />
        <PathSelect
          label="Operador"
          scope={scope}
          value={filter.operator}
          options={operatorOptions}
          path={operatorPath}
          problems={problemsAt(problems, operatorPath)}
          onChange={(operator) => {
            const chosen = operators.find((candidate) => candidate === operator);
            if (!chosen) return;
            onChange({ ...filter, operator: chosen, values: valuesFor(chosen, filter.values) });
          }}
        />
        {values}
        {loose.map((problem, index) => (
          <FieldMessage key={`${problem.code}-${index}`} type="error">
            {problem.message}
          </FieldMessage>
        ))}
        <div className="fc-properties-item-actions">
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={scopedName('Remover filtro', scope)}
            icon={<TrashIcon size={14} />}
            disabledReason={readOnly ? READ_ONLY_REASON : undefined}
            onClick={onRemove}
          />
        </div>
      </div>
    </li>
  );
}

interface ValueInputProps {
  label: string;
  scope: string;
  type: DataType;
  scale: number | null;
  operator: FilterOperator;
  literal: string;
  path: string | null;
  problems: readonly WorkflowProblem[];
  refuseParameters: string | undefined;
  onCommit: (literal: string) => void;
  onPickParameter: (reference: ParameterReference) => void;
}

const BOOLEAN_OPTIONS: readonly SelectOption[] = [
  { value: BOOLEAN_LITERALS.true, label: 'Verdadeiro' },
  { value: BOOLEAN_LITERALS.false, label: 'Falso' },
];

/**
 * A boolean is chosen (Verdadeiro or Falso), with "Usar parâmetro" beside it; the other types are typed. A boolean holding a
 * parameter is typed too, and emptying it brings the select back.
 */
function ValueInput({ label, scope, type, scale, operator, literal, path, problems, refuseParameters, onCommit, onPickParameter }: ValueInputProps) {
  const { definition } = useDraftEditor();
  const lower = literal.toLowerCase();
  if (type === 'boolean' && (literal === '' || lower === BOOLEAN_LITERALS.true || lower === BOOLEAN_LITERALS.false)) {
    return (
      <div className="fc-filters-value-row">
        <PathSelect
          label={label}
          scope={scope}
          value={lower}
          options={BOOLEAN_OPTIONS}
          path={path}
          problems={problems}
          onChange={onCommit}
        />
        {refuseParameters ? null : (
          <ParameterButton
            fieldLabel={label}
            scope={scope}
            references={servingReferences(definition.parameters, type, operator)}
            hasParameters={definition.parameters.length > 0}
            onPick={onPickParameter}
          />
        )}
      </div>
    );
  }
  return (
    <LiteralField
      label={label}
      scope={scope}
      type={type}
      scale={scale}
      operator={operator}
      literal={literal}
      path={path}
      problems={problems}
      refuseParameters={refuseParameters}
      onCommit={onCommit}
      onPickParameter={onPickParameter}
    />
  );
}
