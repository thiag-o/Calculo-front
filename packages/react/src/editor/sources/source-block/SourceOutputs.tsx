import { useId } from 'react';
import { DATA_TYPE_LABELS } from '../../../catalog';
import { Button, Checkbox, FieldMessage, textClasses } from '../../../design-system';
import { READ_ONLY_REASON, useDraftEditor } from '../../draft';
import { CommitTextField, problemsAt, useFieldsState } from '../../properties';
import { InfoIcon, TrashIcon } from '../filters/icons';
import { fieldPath, rowProblems, scopedName } from '../filters/paths';
import { indexOfItem, itemKey, removeItem, replaceItem } from './identity';
import { DUPLICATE_VARIABLE_MESSAGE, NAME_RULE_MESSAGE, NAME_TOOLTIP, ONE_OUTPUT, OUTSIDE_DATASET } from './labels';
import { NAME_PATTERN, OUTPUTS_MAX, variableNameCounts, type CatalogVariable, type SourceNode, type SourceOutput } from './sourceNode';

export interface SourceOutputsProps {
  node: SourceNode;
  analyzedNode: SourceNode | null;
  at: string | null;
  variables: readonly CatalogVariable[];
  update: (apply: (node: SourceNode) => SourceNode, mergeKey?: string) => void;
}

const validateName = (text: string) => (NAME_PATTERN.test(text) ? null : NAME_RULE_MESSAGE);

/**
 * The output of a Linear (E5-18): a box per dataset variable; the checked ones become variables of the workflow from the
 * block on, each with its name in the workflow (by default, the name in the catalog), which can be changed.
 */
export function SourceOutputs({ node, analyzedNode, at, variables, update }: SourceOutputsProps) {
  const { definition, problems } = useDraftEditor();
  const outputs = node.outputs ?? [];
  const listPath = fieldPath(at, 'outputs');
  const names = variableNameCounts(definition);
  const known = new Set(variables.map((variable) => variable.id));
  const outside = outputs.filter((output) => !known.has(output.variable_id));

  function outputAt(output: SourceOutput): string | null {
    const index = indexOfItem(analyzedNode?.outputs, output);
    return at === null || index < 0 ? null : `${at}.outputs[${index}]`;
  }

  function setOutputs(apply: (outputs: readonly SourceOutput[]) => SourceOutput[], mergeKey?: string) {
    update((current) => ({ ...current, outputs: apply(current.outputs ?? []) }), mergeKey);
  }

  return (
    <fieldset className="fc-properties-group fc-source-section">
      <legend className="fc-properties-group-title">Saída</legend>
      {problemsAt(problems, listPath).map((problem, index) => (
        <FieldMessage key={`${problem.code}-${index}`} type="error">
          {problem.message}
        </FieldMessage>
      ))}
      <ol className="fc-source-list" aria-label="Variáveis da saída">
        {variables.map((variable) => {
          const output = outputs.find((candidate) => candidate.variable_id === variable.id);
          return (
            <OutputRow
              key={variable.id}
              variable={variable}
              output={output}
              at={output ? outputAt(output) : null}
              last={output !== undefined && outputs.length <= 1}
              full={output === undefined && outputs.length >= OUTPUTS_MAX}
              names={names}
              onCheck={(checked) =>
                setOutputs((all) =>
                  checked ? [...all, { variable_id: variable.id, name: variable.name }] : all.filter((item) => item.variable_id !== variable.id),
                )
              }
              onRename={(name) => {
                if (output) setOutputs((all) => replaceItem(all, output, (current) => ({ ...current, name })), `source:${node.id}.output:${itemKey(output)}.name`);
              }}
            />
          );
        })}
        {outside.map((output) => (
          <OutsideOutputRow
            key={itemKey(output)}
            output={output}
            at={outputAt(output)}
            last={outputs.length <= 1}
            onRemove={() => setOutputs((all) => removeItem(all, output))}
          />
        ))}
      </ol>
    </fieldset>
  );
}

interface OutputRowProps {
  variable: CatalogVariable;
  output: SourceOutput | undefined;
  at: string | null;
  /** The only output: a Linear needs one, so it cannot be unchecked. */
  last: boolean;
  /** Already 100 outputs: no other can be checked. */
  full: boolean;
  names: ReadonlyMap<string, number>;
  onCheck: (checked: boolean) => void;
  onRename: (name: string) => void;
}

function OutputRow({ variable, output, at, last, full, names, onCheck, onRename }: OutputRowProps) {
  const { problems } = useDraftEditor();
  const { readOnly, reasonId } = useFieldsState();
  const ownReasonId = `fc-source-output-reason-${useId()}`;
  const reason = last ? ONE_OUTPUT : full ? `A fonte aceita até ${OUTPUTS_MAX} variáveis de saída` : undefined;
  const namePath = fieldPath(at, 'name');
  const idPath = fieldPath(at, 'variable_id');
  const type = variable.type === 'decimal' && variable.scale !== null ? `${DATA_TYPE_LABELS.decimal} (${variable.scale})` : DATA_TYPE_LABELS[variable.type];

  return (
    <li className="fc-source-item">
      <div role="group" aria-label={`Variável ${variable.name}`} className="fc-properties-item-group">
        <Checkbox
          label={
            <>
              <span className="fc-properties-code">{variable.name}</span>
              <span className={`fc-source-type ${textClasses({ variant: 'label-12', emphasis: 'tertiary' })}`}>{type}</span>
            </>
          }
          checked={output !== undefined}
          disabled={readOnly || reason !== undefined}
          aria-describedby={[readOnly ? reasonId : undefined, !readOnly && reason ? ownReasonId : undefined].filter(Boolean).join(' ') || undefined}
          onCheckedChange={(checked) => onCheck(checked === true)}
        />
        {!readOnly && reason ? (
          <p id={ownReasonId} className={`fc-source-reason ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
            <InfoIcon size={12} />
            <span>{reason}</span>
          </p>
        ) : null}
        {output ? (
          <CommitTextField
            label="Nome no workflow"
            scope={variable.name}
            value={output.name}
            mono
            maxLength={63}
            tooltip={NAME_TOOLTIP}
            path={namePath}
            problems={problemsAt(problems, namePath)}
            validate={validateName}
            warn={(text) => ((names.get(text) ?? 0) > (text === output.name ? 1 : 0) ? DUPLICATE_VARIABLE_MESSAGE : null)}
            onCommit={onRename}
          />
        ) : null}
        {[...problemsAt(problems, idPath), ...rowProblems(problems, at, [namePath, idPath])].map((problem, index) => (
          <FieldMessage key={`${problem.code}-${index}`} type="error">
            {problem.message}
          </FieldMessage>
        ))}
      </div>
    </li>
  );
}

interface OutsideOutputRowProps {
  output: SourceOutput;
  at: string | null;
  last: boolean;
  onRemove: () => void;
}

/** An output whose variable is not in the dataset (removed from the catalog, or of another dataset): it can only leave. */
function OutsideOutputRow({ output, at, last, onRemove }: OutsideOutputRowProps) {
  const { problems } = useDraftEditor();
  const { readOnly } = useFieldsState();
  return (
    <li className="fc-source-item">
      <div role="group" aria-label={`Variável ${output.name}`} className="fc-properties-item-group">
        <p className="fc-source-outside">
          <span className="fc-properties-code">{output.name}</span>
          <span className={textClasses({ variant: 'label-13', emphasis: 'secondary' })}>{OUTSIDE_DATASET}</span>
        </p>
        {rowProblems(problems, at, []).map((problem, index) => (
          <FieldMessage key={`${problem.code}-${index}`} type="error">
            {problem.message}
          </FieldMessage>
        ))}
        <div className="fc-properties-item-actions">
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={scopedName('Remover da saída', output.name)}
            icon={<TrashIcon size={14} />}
            disabledReason={readOnly ? READ_ONLY_REASON : last ? ONE_OUTPUT : undefined}
            onClick={onRemove}
          />
        </div>
      </div>
    </li>
  );
}
