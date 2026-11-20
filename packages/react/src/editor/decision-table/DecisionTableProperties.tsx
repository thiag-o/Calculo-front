import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Schemas } from '../../api';
import { Button, Select, Text, TextField, type SelectOption } from '../../design-system';
import { READ_ONLY_REASON, useDraftEditor, type WorkflowProblem } from '../draft';
import { PlusIcon, TableIcon, TrashIcon } from './icons';
import {
  DATA_TYPE_LABELS,
  ERROR_POLICY_LABELS,
  HIT_POLICY_LABELS,
  INHERIT_LABEL,
  INHERIT_VALUE,
  MAX_CONDITIONS_REASON,
  MAX_RESULTS_REASON,
  NAME_REQUIRED,
  ROUNDING_MODE_LABELS,
  VARIABLE_NAME_RULE,
  gridProblemsText,
  rulesText,
} from './labels';
import {
  MAX_CONDITIONS,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_RESULTS,
  MAX_SCALE,
  VARIABLE_NAME,
  addCondition,
  addResult,
  findTable,
  freeResultName,
  removeColumn,
  setCondition,
  setResult,
  updateTable,
  withType,
  type DataType,
  type DecisionTableNode,
} from './tableModel';
import { fieldKey, placeOfPath, tableProblems, type TableProblems } from './tableProblems';
import './decision-table.css';

type HitPolicy = Schemas['HitPolicy'];
type RoundingMode = Schemas['RoundingMode'];
type ErrorPolicy = Schemas['ErrorPolicy'];

export interface DecisionTablePropertiesProps {
  /** The id of the Decision Table block in `root.nodes`. */
  nodeId: string;
  /** "Abrir tabela": the screen shows the grid in place of the canvas (E4-22). */
  onOpenTable: () => void;
}

const hitPolicyOptions: SelectOption[] = (Object.keys(HIT_POLICY_LABELS) as HitPolicy[]).map((value) => ({ value, label: HIT_POLICY_LABELS[value] }));
const roundingOptions: SelectOption[] = [
  { value: INHERIT_VALUE, label: INHERIT_LABEL },
  ...(Object.keys(ROUNDING_MODE_LABELS) as RoundingMode[]).map((value) => ({ value, label: ROUNDING_MODE_LABELS[value] })),
];
const errorPolicyOptions: SelectOption[] = [
  { value: INHERIT_VALUE, label: INHERIT_LABEL },
  ...(Object.keys(ERROR_POLICY_LABELS) as ErrorPolicy[]).map((value) => ({ value, label: ERROR_POLICY_LABELS[value] })),
];
const typeOptions: SelectOption[] = (Object.keys(DATA_TYPE_LABELS) as DataType[]).map((value) => ({ value, label: DATA_TYPE_LABELS[value] }));
const scaleOptions: SelectOption[] = Array.from({ length: MAX_SCALE + 1 }, (_, scale) => ({ value: String(scale), label: String(scale) }));

function messages(problems: readonly WorkflowProblem[] | undefined): ReactNode {
  if (!problems || problems.length === 0) return undefined;
  return problems.map((problem) => problem.message).join(' ');
}

/**
 * The properties of a Decision Table (E4-22): name, description, hit policy ("Primeira" or "Única"), rounding mode and
 * error policy (with "Herdar do workflow"), the condition columns (the formula of the header) and the result columns
 * (name, type, decimal places and default value, this one only when the policy is "Usar valor padrão"), and **Abrir
 * tabela**. Each problem shows beside its field, by the `path`. Read-only: everything disabled, with the reason.
 */
export function DecisionTableProperties({ nodeId, onOpenTable }: DecisionTablePropertiesProps) {
  const { definition } = useDraftEditor();
  const found = findTable(definition, nodeId);
  if (!found) return null;
  return <TableProperties node={found.node} onOpenTable={onOpenTable} />;
}

function TableProperties({ node, onOpenTable }: { node: DecisionTableNode; onOpenTable: () => void }) {
  const editor = useDraftEditor();
  const { change, readOnly, definition, analyzedDefinition, selection } = editor;
  const nodeId = node.id;
  const base = `fc-dt-properties-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const problems: TableProblems = useMemo(
    () => tableProblems(editor.problems, analyzedDefinition, node),
    [editor.problems, analyzedDefinition, node],
  );
  const fieldProblems = (key: string) => messages(problems.fields.get(key));

  const editTable = useCallback(
    (update: (table: DecisionTableNode) => DecisionTableNode, mergeKey?: string) =>
      change((current) => updateTable(current, nodeId, update), mergeKey ? { mergeKey } : undefined),
    [change, nodeId],
  );
  const mergeKey = (field: string) => `decision-table:${nodeId}:${field}`;

  // A problem chosen in the Problems tab focuses its field here (a cell or a rule is for the grid).
  const latest = useRef({ node, analyzedDefinition });
  latest.current = { node, analyzedDefinition };
  useEffect(() => {
    if (selection.item.type !== 'node' || selection.item.id !== nodeId || !selection.field) return;
    const place = placeOfPath(selection.field, nodeId, latest.current.analyzedDefinition, latest.current.node, nodeId);
    if (!place || place.kind === 'cell' || place.kind === 'rule' || place.kind === 'table') return;
    rootRef.current?.querySelector<HTMLElement>(`[data-field="${fieldKey(place)}"] input, [data-field="${fieldKey(place)}"] button`)?.focus();
  }, [selection, nodeId]);

  // The field of a column just included takes the focus.
  useEffect(() => {
    if (!lastAdded) return;
    rootRef.current?.querySelector<HTMLElement>(`[data-field="${lastAdded}"] input`)?.focus();
    setLastAdded(null);
  }, [lastAdded]);

  const effectivePolicy = node.error_policy ?? definition.settings.error_policy;
  const showDefault = effectivePolicy === 'default_value';
  const disabled = readOnly;

  return (
    <div ref={rootRef} className="fc-dt-properties" aria-label={`Propriedades de ${node.name}`} role="group">
      <div className="fc-dt-properties-head">
        <span className="fc-dt-title">
          <span className="fc-dt-category" aria-hidden="true" />
          <span className="fc-dt-kind">Tabela de Decisão</span>
        </span>
        <Button variant="primary" icon={<TableIcon />} onClick={onOpenTable}>
          Abrir tabela
        </Button>
        <Text as="p" variant="label-13" emphasis="secondary">
          {rulesText(node.rules.length)}
          {problems.inGrid > 0 ? ` · ${gridProblemsText(problems.inGrid)}` : ''}
        </Text>
        {readOnly ? (
          <Text as="p" variant="label-12" emphasis="tertiary">
            {READ_ONLY_REASON}
          </Text>
        ) : null}
        {problems.table.length > 0 ? (
          <ul className="fc-dt-problems" aria-label="Problemas da tabela">
            {problems.table.map((problem, index) => (
              <li key={index} className="fc-dt-message-line">
                {problem.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div data-field="name">
        <ValidatedField
          id={`${base}-name`}
          label="Nome"
          value={node.name}
          maxLength={MAX_NAME_LENGTH}
          disabled={disabled}
          problem={fieldProblems('name')}
          validate={(text) => (text.trim() ? null : NAME_REQUIRED)}
          onCommit={(text) => editTable((table) => (table.name === text ? table : { ...table, name: text }), mergeKey('name'))}
        />
      </div>
      <div data-field="description">
        <TextField
          id={`${base}-description`}
          label="Descrição curta"
          value={node.description ?? ''}
          maxLength={MAX_DESCRIPTION_LENGTH}
          disabled={disabled}
          error={fieldProblems('description')}
          onChange={(event) => {
            const description = event.target.value === '' ? null : event.target.value;
            editTable((table) => (table.description === description ? table : { ...table, description }), mergeKey('description'));
          }}
        />
      </div>
      <div data-field="hit_policy">
        <Select
          id={`${base}-hit-policy`}
          label="Política de acerto"
          options={hitPolicyOptions}
          value={node.hit_policy}
          disabled={disabled}
          error={fieldProblems('hit_policy')}
          tooltip={node.hit_policy === 'first' ? 'Vale a primeira regra que casa, de cima para baixo.' : 'Mais de uma regra casando é erro do registro.'}
          onValueChange={(value) => editTable((table) => (table.hit_policy === value ? table : { ...table, hit_policy: value as HitPolicy }))}
        />
      </div>
      <div data-field="rounding_mode">
        <Select
          id={`${base}-rounding`}
          label="Modo de arredondamento"
          options={roundingOptions}
          value={node.rounding_mode ?? INHERIT_VALUE}
          disabled={disabled}
          error={fieldProblems('rounding_mode')}
          onValueChange={(value) => {
            const mode = value === INHERIT_VALUE ? null : (value as RoundingMode);
            editTable((table) => (table.rounding_mode === mode ? table : { ...table, rounding_mode: mode }));
          }}
        />
      </div>
      <div data-field="error_policy">
        <Select
          id={`${base}-error-policy`}
          label="Política de erro"
          options={errorPolicyOptions}
          value={node.error_policy ?? INHERIT_VALUE}
          disabled={disabled}
          error={fieldProblems('error_policy')}
          onValueChange={(value) => {
            const policy = value === INHERIT_VALUE ? null : (value as ErrorPolicy);
            editTable((table) => (table.error_policy === policy ? table : { ...table, error_policy: policy }));
          }}
        />
      </div>

      <section className="fc-dt-section" aria-labelledby={`${base}-conditions`}>
        <h3 id={`${base}-conditions`} className="fc-dt-section-title">
          Condições
        </h3>
        {node.conditions.length === 0 ? (
          <Text as="p" variant="label-13" emphasis="secondary">
            Nenhuma condição. Sem condição, toda regra casa.
          </Text>
        ) : null}
        {node.conditions.map((condition, index) => (
          <div key={index} className="fc-dt-condition" data-field={`condition:${index}`}>
            <TextField
              id={`${base}-condition-${index}`}
              className="fc-dt-mono fc-dt-grow"
              label={`Condição ${index + 1}`}
              value={condition.expression}
              placeholder="categoria"
              spellCheck={false}
              autoComplete="off"
              disabled={disabled}
              error={fieldProblems(`condition:${index}`)}
              onChange={(event) => {
                const expression = event.target.value;
                editTable((table) => setCondition(table, index, expression), mergeKey(`condition:${index}`));
              }}
            />
            {readOnly ? null : (
              <Button
                size="small"
                variant="ghost"
                iconOnly
                icon={<TrashIcon size={14} />}
                label={`Remover condição ${index + 1}`}
                onClick={() => editTable((table) => removeColumn(table, index))}
              />
            )}
          </div>
        ))}
        {readOnly ? null : (
          <span>
            <Button
              size="small"
              icon={<PlusIcon size={14} />}
              disabledReason={node.conditions.length >= MAX_CONDITIONS ? MAX_CONDITIONS_REASON : undefined}
              onClick={() => {
                editTable((table) => addCondition(table));
                setLastAdded(`condition:${node.conditions.length}`);
              }}
            >
              Incluir condição
            </Button>
          </span>
        )}
      </section>

      <section className="fc-dt-section" aria-labelledby={`${base}-results`}>
        <h3 id={`${base}-results`} className="fc-dt-section-title">
          Resultados
        </h3>
        {node.results.length === 0 ? (
          <Text as="p" variant="label-13" emphasis="secondary">
            Nenhum resultado. A tabela precisa de pelo menos um.
          </Text>
        ) : null}
        {node.results.map((result, index) => {
          const column = node.conditions.length + index;
          return (
            <fieldset key={index} className="fc-dt-column">
              <legend className="fc-dt-section-title fc-dt-legend">{`Resultado ${index + 1}`}</legend>
              {readOnly ? null : (
                <Button
                  size="small"
                  variant="ghost"
                  iconOnly
                  className="fc-dt-column-remove"
                  icon={<TrashIcon size={14} />}
                  label={`Remover resultado ${index + 1}`}
                  onClick={() => editTable((table) => removeColumn(table, column))}
                />
              )}
              <div data-field={`result:${index}:name`}>
                <ValidatedField
                  id={`${base}-result-${index}-name`}
                  className="fc-dt-mono"
                  label="Nome da variável"
                  value={result.name}
                  maxLength={63}
                  disabled={disabled}
                  problem={fieldProblems(`result:${index}:name`)}
                  validate={(text) => (VARIABLE_NAME.test(text) ? null : VARIABLE_NAME_RULE)}
                  onCommit={(text) => editTable((table) => setResult(table, index, (current) => (current.name === text ? current : { ...current, name: text })), mergeKey(`result:${index}:name`))}
                />
              </div>
              <div data-field={`result:${index}:type`}>
                <Select
                  id={`${base}-result-${index}-type`}
                  label="Tipo"
                  options={typeOptions}
                  value={result.type}
                  disabled={disabled}
                  error={fieldProblems(`result:${index}:type`)}
                  onValueChange={(value) =>
                    editTable((table) => setResult(table, index, (current) => withType(current, value as DataType, definition.settings.rounding.scale)))
                  }
                />
              </div>
              {result.type === 'decimal' ? (
                <div data-field={`result:${index}:scale`}>
                  <Select
                    id={`${base}-result-${index}-scale`}
                    label="Casas"
                    options={scaleOptions}
                    value={String(result.scale ?? definition.settings.rounding.scale)}
                    disabled={disabled}
                    error={fieldProblems(`result:${index}:scale`)}
                    onValueChange={(value) =>
                      editTable((table) => setResult(table, index, (current) => (current.scale === Number(value) ? current : { ...current, scale: Number(value) })))
                    }
                  />
                </div>
              ) : null}
              {showDefault ? (
                <div data-field={`result:${index}:default_value`}>
                  <TextField
                    id={`${base}-result-${index}-default`}
                    className="fc-dt-mono"
                    label="Valor padrão"
                    tooltip="Usado quando nenhuma regra casa."
                    value={result.default_value ?? ''}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={disabled}
                    error={fieldProblems(`result:${index}:default_value`)}
                    onChange={(event) => {
                      const value = event.target.value === '' ? null : event.target.value;
                      editTable(
                        (table) => setResult(table, index, (current) => (current.default_value === value ? current : { ...current, default_value: value })),
                        mergeKey(`result:${index}:default_value`),
                      );
                    }}
                  />
                </div>
              ) : null}
            </fieldset>
          );
        })}
        {readOnly ? null : (
          <span>
            <Button
              size="small"
              icon={<PlusIcon size={14} />}
              disabledReason={node.results.length >= MAX_RESULTS ? MAX_RESULTS_REASON : undefined}
              onClick={() => {
                const name = freeResultName(definition);
                const scale = definition.settings.rounding.scale;
                editTable((table) => addResult(table, { name, type: 'decimal', scale, default_value: null }));
                setLastAdded(`result:${node.results.length}:name`);
              }}
            >
              Incluir resultado
            </Button>
          </span>
        )}
      </section>
    </div>
  );
}

interface ValidatedFieldProps {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  disabled: boolean;
  className?: string;
  /** The problems of the analysis for this field. */
  problem: ReactNode;
  /** The error of a text that cannot go into the draft (it would be refused as a shape error), or `null`. */
  validate: (text: string) => string | null;
  onCommit: (text: string) => void;
}

/**
 * A text field whose value goes to the draft only when valid: an invalid text (an empty name, a variable name out of the
 * rule) stays on the field with the error and is not saved, so the draft never gets a shape error (`422 invalid_data`).
 * The draft keeps the last valid value until the text is fixed.
 */
function ValidatedField({ id, label, value, maxLength, disabled, className, problem, validate, onCommit }: ValidatedFieldProps) {
  const [pending, setPending] = useState<string | null>(null);
  const text = pending ?? value;
  const localError = pending === null ? null : validate(pending);
  return (
    <TextField
      id={id}
      className={className}
      label={label}
      value={text}
      maxLength={maxLength}
      spellCheck={false}
      autoComplete="off"
      disabled={disabled}
      error={localError ?? problem}
      onChange={(event) => {
        const next = event.target.value;
        if (validate(next) === null) {
          setPending(null);
          onCommit(next);
        } else {
          setPending(next);
        }
      }}
    />
  );
}
