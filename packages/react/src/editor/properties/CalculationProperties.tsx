import { useRef } from 'react';
import { Text } from '../../design-system';
import { FormulaEditor } from '../../formula';
import { useDraftEditor, type WorkflowDefinition } from '../draft';
import {
  NODE_NAME_MAX,
  DESCRIPTION_MAX,
  NAME_PATTERN,
  updateCalculation,
  variableNameCounts,
  withType,
  type CalculationNode,
  type DataType,
} from './definition';
import { CommitTextField, ErrorPolicyField, PathSelect, PropertiesFrame, RoundingModeField, parseScale, useFocusOnSelection } from './fields';
import { DUPLICATE_VARIABLE_MESSAGE, NAME_RULE_MESSAGE, NAME_TOOLTIP, SCALE_RULE_MESSAGE, calculationTypeOptions, duplicateWarning } from './labels';
import { analyzedNodePath, nodePathAt, otherProblems, problemsAt } from './problemPaths';

export interface CalculationPropertiesProps {
  /** The Calculation, as it is in the definition being edited. */
  node: CalculationNode;
}

/**
 * The properties of a Calculation: name, short description, the formula (in the `<FormulaEditor>`), the output (variable,
 * `integer` or `decimal`, places), the rounding mode and the error policy (each with "Herdar do workflow"), and the default
 * value, shown only while the policy in force is "Usar valor padrão".
 */
export function CalculationProperties({ node }: CalculationPropertiesProps) {
  const { definition, analyzedDefinition, problems, symbols, readOnly, change } = useDraftEditor();
  const formula = useRef<HTMLDivElement>(null);

  // The problems point into the analysed definition; the merge keys, into the current one.
  const at = analyzedNodePath(analyzedDefinition, node.id);
  const here = nodePathAt(definition.root.nodes.findIndex((candidate) => candidate.id === node.id));
  const path = (field: string) => (at === null ? null : `${at}.${field}`);
  const fieldProblems = (field: string) => problemsAt(problems, path(field));

  const analyzedNode = analyzedDefinition.root.nodes.find((candidate) => candidate.id === node.id);
  const analyzedExpression = analyzedNode?.type === 'calculation' ? analyzedNode.expression : undefined;

  const { settings } = definition;
  const policy = node.error_policy ?? settings.error_policy;
  const showsDefault = policy === 'default_value';

  const shownFields = ['name', 'description', 'expression', 'output.name', 'output.type', 'error_policy', 'rounding_mode'];
  if (node.output.type === 'decimal') shownFields.push('output.scale');
  if (showsDefault) shownFields.push('default_value');
  const shown = new Set(shownFields.map((field) => `${at}.${field}`));

  function update(field: string, apply: (current: CalculationNode, definition: WorkflowDefinition) => CalculationNode, merge = false) {
    change(
      (current) => updateCalculation(current, node.id, (item) => apply(item, current)),
      merge ? { mergeKey: `${here}.${field}` } : undefined,
    );
  }

  useFocusOnSelection(path('expression'), () => formula.current?.querySelector<HTMLElement>('textarea'));

  return (
    <PropertiesFrame
      title="Cálculo"
      category="calc"
      subtitle={<span className="fc-properties-id">{node.id}</span>}
      problems={otherProblems(problems, at, shown)}
    >
      <CommitTextField
        label="Nome do bloco"
        value={node.name}
        maxLength={NODE_NAME_MAX}
        path={path('name')}
        problems={fieldProblems('name')}
        validate={(text) => (text.trim() === '' ? 'Informe o nome do bloco.' : null)}
        onCommit={(name) => update('name', (current) => ({ ...current, name }), true)}
      />
      <CommitTextField
        label="Descrição curta"
        value={node.description ?? ''}
        maxLength={DESCRIPTION_MAX}
        path={path('description')}
        problems={fieldProblems('description')}
        onCommit={(text) => update('description', (current) => ({ ...current, description: text === '' ? null : text }), true)}
      />
      <div className="fc-field" ref={formula}>
        <Text variant="label-13" emphasis="secondary" aria-hidden="true">
          Fórmula
        </Text>
        <FormulaEditor
          value={node.expression}
          analyzedValue={analyzedExpression}
          problems={fieldProblems('expression')}
          symbols={symbols}
          context="calculation"
          readOnly={readOnly}
          aria-label={`Fórmula de ${node.name}`}
          onChange={(expression) => update('expression', (current) => ({ ...current, expression }), true)}
        />
      </div>

      <fieldset className="fc-properties-group">
        <legend className="fc-properties-group-title">Saída</legend>
        <CommitTextField
          label="Nome da variável"
          value={node.output.name}
          mono
          maxLength={63}
          tooltip={NAME_TOOLTIP}
          path={path('output.name')}
          problems={fieldProblems('output.name')}
          validate={(text) => (NAME_PATTERN.test(text) ? null : NAME_RULE_MESSAGE)}
          warn={duplicateWarning(variableNameCounts(definition), node.output.name, DUPLICATE_VARIABLE_MESSAGE)}
          onCommit={(name) => update('output.name', (current) => ({ ...current, output: { ...current.output, name } }), true)}
        />
        <div className="fc-properties-row">
          <PathSelect
            label="Tipo"
            value={node.output.type}
            options={calculationTypeOptions(node.output.type)}
            path={path('output.type')}
            problems={fieldProblems('output.type')}
            onChange={(type) =>
              update('output.type', (current, latest) => ({
                ...current,
                output: withType(current.output, type as DataType, latest.settings.rounding.scale),
              }))
            }
          />
          {node.output.type === 'decimal' ? (
            <CommitTextField
              label="Casas decimais"
              value={String(node.output.scale ?? '')}
              inputMode="numeric"
              maxLength={2}
              path={path('output.scale')}
              problems={fieldProblems('output.scale')}
              validate={(text) => (parseScale(text) === null ? SCALE_RULE_MESSAGE : null)}
              onCommit={(text) => update('output.scale', (current) => ({ ...current, output: { ...current.output, scale: parseScale(text) } }), true)}
            />
          ) : null}
        </div>
      </fieldset>

      <RoundingModeField
        value={node.rounding_mode}
        inherited={settings.rounding.mode}
        path={path('rounding_mode')}
        problems={fieldProblems('rounding_mode')}
        onChange={(mode) => update('rounding_mode', (current) => ({ ...current, rounding_mode: mode }))}
      />
      <ErrorPolicyField
        value={node.error_policy}
        inherited={settings.error_policy}
        path={path('error_policy')}
        problems={fieldProblems('error_policy')}
        onChange={(errorPolicy) => update('error_policy', (current) => ({ ...current, error_policy: errorPolicy }))}
      />
      {showsDefault ? (
        <CommitTextField
          label="Valor padrão"
          value={node.default_value ?? ''}
          mono
          maxLength={10000}
          tooltip="Fórmula do valor usado quando o bloco falha"
          path={path('default_value')}
          problems={fieldProblems('default_value')}
          onCommit={(text) => update('default_value', (current) => ({ ...current, default_value: text === '' ? null : text }), true)}
        />
      ) : null}
    </PropertiesFrame>
  );
}
