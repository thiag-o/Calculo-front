import { useRef, useState } from 'react';
import { useDatasetList } from '../../catalog';
import { Button, Dialog, DialogClose, FieldMessage, Text } from '../../design-system';
import type { WorkflowProblem } from '../draft';
import { SegmentedControl } from '../properties';
import { AllowedValuesQueryFields, UNKNOWN_DATASET } from './AllowedValuesQueryFields';
import { LiteralList } from './LiteralList';
import type { ParameterProblems } from './parameterProblems';
import {
  ALLOWED_VALUES_KIND_LABELS,
  allowedList,
  allowedQuery,
  allowedValuesKind,
  type AllowedValuesKind,
  type AllowedValuesQuery,
  type ValueType,
  type WorkflowParameter,
} from './parameterRules';

export interface AllowedValuesFieldProps {
  parameter: WorkflowParameter;
  /** The parameter as it was analysed: a problem shows only while what it points to is still there (ADR 0044). */
  analyzed: WorkflowParameter | null;
  /** Where the parameter was in the analysed definition (`parameters[1]`), or `null`. */
  at: string | null;
  type: ValueType;
  problems: ParameterProblems;
  /** Changes the parameter in the definition; `field` makes the merge key of a value being typed. */
  update: (apply: (current: WorkflowParameter) => WorkflowParameter, field?: string) => void;
}

const KIND_OPTIONS = (['none', 'list', 'query'] as const).map((value) => ({ value, label: ALLOWED_VALUES_KIND_LABELS[value] }));

function problemList(problems: readonly WorkflowProblem[]) {
  if (problems.length === 0) return null;
  return (
    <ul className="fc-properties-problems" aria-label="Problemas">
      {problems.map((problem, index) => (
        <li key={`${problem.code}-${problem.path ?? ''}-${index}`}>
          <FieldMessage type="error">{problem.message}</FieldMessage>
        </li>
      ))}
    </ul>
  );
}

function valuesCount(count: number): string {
  return count === 1 ? 'O valor da lista sai' : `Os ${count.toLocaleString('pt-BR')} valores da lista saem`;
}

function filtersCount(count: number): string {
  if (count === 0) return 'sem filtros';
  return count === 1 ? 'o filtro' : `os ${count.toLocaleString('pt-BR')} filtros`;
}

/**
 * The Valores permitidos of a parameter of text, integer or date (E7-23): Nenhum | Lista | Consulta. With none, any value of
 * the type is accepted, and "Incluir valor permitido" starts a list; a list takes 1 to 100 literals; a query reads them from
 * a catalog dataset (`AllowedValuesQueryFields`). Switching between Lista and Consulta asks for a confirmation that says what
 * is lost; to the query, the list only leaves when the variable is chosen (one change, one undo step).
 */
export function AllowedValuesField({ parameter, analyzed, at, type, problems, update }: AllowedValuesFieldProps) {
  const scope = parameter.name;
  const kind = allowedValuesKind(parameter);
  /** Consulta chosen, its dataset and variable not yet: the fields show, and the draft is still as it was. */
  const [choosing, setChoosing] = useState(false);
  const [confirming, setConfirming] = useState<'list' | 'query' | null>(null);
  const box = useRef<HTMLFieldSetElement>(null);
  const pending = choosing && kind !== 'query';
  const shown: AllowedValuesKind = pending ? 'query' : kind;
  const query = allowedQuery(parameter);
  const literals = allowedList(parameter);

  const path = (field: string) => (at === null ? null : `${at}.${field}`);
  const listWhole = problems.allowed.filter(({ spot }) => spot === null).map(({ problem }) => problem);
  const analyzedList = Array.isArray(analyzed?.allowed_values) ? analyzed.allowed_values : null;

  /** The first value of a list just started: the next thing to type. */
  function focusFirstValue() {
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('.fc-parameters-values input, .fc-parameters-values button')?.focus());
  }

  function startList() {
    update((current) => ({ ...current, allowed_values: [''] }));
    focusFirstValue();
  }

  function choose(next: AllowedValuesKind) {
    if (next === shown) return;
    if (next === 'none') {
      setChoosing(false);
      if (kind !== 'none') update((current) => ({ ...current, allowed_values: null }));
      return;
    }
    if (next === 'list') {
      if (pending) {
        // Nothing was written while choosing: back to the list there was, or to a new one.
        setChoosing(false);
        if (kind === 'none') startList();
        return;
      }
      if (kind === 'query') setConfirming('list');
      else startList();
      return;
    }
    if (kind === 'list') setConfirming('query');
    else setChoosing(true);
  }

  function confirm() {
    const next = confirming;
    setConfirming(null);
    if (next === 'query') setChoosing(true);
    else if (next === 'list') startList();
  }

  function writeQuery(written: AllowedValuesQuery) {
    setChoosing(false);
    update((current) => ({ ...current, allowed_values: written }));
  }

  function changeQuery(apply: (current: AllowedValuesQuery) => AllowedValuesQuery, field?: string) {
    update((current) => {
      const currentQuery = allowedQuery(current);
      return currentQuery ? { ...current, allowed_values: apply(currentQuery) } : current;
    }, field);
  }

  return (
    <fieldset ref={box} className="fc-properties-group fc-parameters-allowed">
      <legend className="fc-properties-group-title">Valores permitidos</legend>
      <SegmentedControl
        label="Valores permitidos"
        scope={scope}
        className="fc-parameters-allowed-kind"
        options={KIND_OPTIONS}
        value={shown}
        onChange={choose}
      />
      {shown === 'query' ? (
        <AllowedValuesQueryFields
          query={query}
          analyzed={allowedQuery(analyzed)}
          at={at}
          scope={scope}
          type={type}
          problems={problems.query}
          onWrite={writeQuery}
          onChange={changeQuery}
        />
      ) : (
        <LiteralList
          itemLabel="Valor permitido"
          addLabel="Incluir valor permitido"
          scope={scope}
          type={type}
          scale={parameter.scale}
          literals={literals}
          minimum={0}
          problems={problemList(listWhole)}
          emptyNote={
            <Text as="p" variant="label-12" emphasis="secondary" className="fc-parameters-note">
              Sem restrição: aceita qualquer valor do tipo.
            </Text>
          }
          problemsAt={(index) =>
            problems.allowed
              .filter(({ spot }) => spot === index)
              .filter(() => analyzedList?.[index] === literals[index])
              .map(({ problem }) => problem)
          }
          pathAt={(index) => problems.allowed.find(({ spot }) => spot === index)?.problem.path ?? path(`allowed_values[${index}]`)}
          onChange={(apply, item) =>
            update(
              (current) => {
                const next = apply(allowedList(current));
                return { ...current, allowed_values: next.length > 0 ? next : null };
              },
              item === undefined ? undefined : `allowed[${item}]`,
            )
          }
        />
      )}
      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        // Confirmed to the query, the focus goes to the dataset search; otherwise, to the chosen option of the control.
        focusOnClose={() =>
          box.current?.querySelector<HTMLElement>('input[type="search"]') ??
          box.current?.querySelector<HTMLElement>('.fc-parameters-values input, .fc-parameters-values button') ??
          box.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
        }
        title={confirming === 'query' ? 'Usar consulta' : 'Usar lista'}
        description={
          confirming === 'query' ? (
            <>
              {valuesCount(literals.length)} do parâmetro {scope} quando você escolher a variável da consulta: os valores permitidos
              passam a vir de um dataset do catálogo. Você pode desfazer com Ctrl Z.
            </>
          ) : confirming === 'list' && query ? (
            <>
              A consulta ao dataset <DatasetName id={query.dataset_id} /> sai do parâmetro {scope}, com a variável e {filtersCount(query.filters.length)}. Os
              valores permitidos passam a ser digitados na lista. Você pode desfazer com Ctrl Z.
            </>
          ) : null
        }
        actions={
          <>
            <DialogClose>
              <Button>Cancelar</Button>
            </DialogClose>
            <Button variant="danger" onClick={confirm}>
              {confirming === 'query' ? 'Usar consulta' : 'Usar lista'}
            </Button>
          </>
        }
      />
    </fieldset>
  );
}

/** The name of a catalog dataset, read only when it shows (the catalog is not read for a parameter without a query). */
function DatasetName({ id }: { id: string }) {
  const datasets = useDatasetList();
  return <>{datasets.data?.find((item) => item.id === id)?.name ?? UNKNOWN_DATASET}</>;
}
