import { Checkbox, FieldMessage, Text, textClasses } from '../../design-system';
import { useDraftEditor, type WorkflowProblem } from '../draft';
import { CommitTextField, PropertiesFrame, problemsAt, problemText, useFieldsState } from '../properties';
import { outputCandidates, setGroupOutputs } from './actions';
import { DERIVED_INPUT_TEXT } from './messages';
import { DerivedIcon } from './icons';
import { findEntry, updateNode, type GroupNode } from './tree';
import './groups.css';

/** Whether `path` is `prefix` or a part of it (`root.nodes[1].name` is under `root.nodes[1]`). */
function isUnderPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

/** The longest name and description of a node (the same as the other blocks). */
const NAME_MAX = 200;
const DESCRIPTION_MAX = 500;

export interface GroupPropertiesProps {
  /** The group, as it is in the definition being edited. */
  node: GroupNode;
}

/**
 * The properties of a group (E5-19): name, short description, the Input (derived by the analysis, read only) and the
 * Output, chosen among the linear variables produced inside the group. A variable checked that is no longer produced
 * inside stays listed, so it can be unchecked (the analysis says what is wrong with it).
 */
export function GroupProperties({ node }: GroupPropertiesProps) {
  const { analyzedDefinition, problems, symbols, groups, change, definition } = useDraftEditor();
  const at = findEntry(analyzedDefinition, node.id)?.path ?? null;
  const path = (field: string) => (at === null ? null : `${at}.${field}`);
  const fieldProblems = (field: string) => problemsAt(problems, path(field));

  const candidates = outputCandidates(definition, symbols, node.id);
  const names = candidates.map((symbol) => symbol.name);
  for (const name of node.outputs) if (!names.includes(name)) names.push(name);
  const derived = groups.find((entry) => entry.node_id === node.id)?.inputs ?? [];

  // The problems of the group itself: on its fields, on the Output, and the others at the top. Those of the nodes inside
  // it belong to them.
  const shown = new Set<string>([path('name'), path('description'), path('outputs')].filter((value): value is string => value !== null));
  node.outputs.forEach((_, index) => shown.add(`${at}.outputs[${index}]`));
  const own = problems.filter((problem: WorkflowProblem) => {
    if (problem.path === null) return problem.node_id === node.id;
    if (at === null || !isUnderPath(problem.path, at) || isUnderPath(problem.path, `${at}.nodes`)) return false;
    return !shown.has(problem.path);
  });

  function update(field: string, apply: (current: GroupNode) => GroupNode) {
    change(
      (current) => updateNode(current, node.id, (item) => (item.type === 'group' ? apply(item) : item)),
      { mergeKey: `group:${node.id}.${field}` },
    );
  }

  function toggle(name: string, checked: boolean) {
    change((current) => {
      const group = findEntry(current, node.id)?.node;
      if (!group || group.type !== 'group') return current;
      const outputs = checked ? (group.outputs.includes(name) ? group.outputs : [...group.outputs, name]) : group.outputs.filter((item) => item !== name);
      return setGroupOutputs(current, node.id, outputs);
    });
  }

  return (
    <PropertiesFrame title="Grupo" subtitle={<span className="fc-properties-id">{node.id}</span>} problems={own}>
      <CommitTextField
        label="Nome do grupo"
        scope={node.name}
        value={node.name}
        maxLength={NAME_MAX}
        path={path('name')}
        problems={fieldProblems('name')}
        validate={(text) => (text.trim() === '' ? 'Informe o nome do grupo.' : null)}
        onCommit={(name) => update('name', (current) => ({ ...current, name }))}
      />
      <CommitTextField
        label="Descrição curta"
        scope={node.name}
        value={node.description ?? ''}
        maxLength={DESCRIPTION_MAX}
        path={path('description')}
        problems={fieldProblems('description')}
        onCommit={(text) => update('description', (current) => ({ ...current, description: text === '' ? null : text }))}
      />

      <section className="fc-group-properties-part" aria-labelledby={`fc-group-input-${node.id}`}>
        <Text as="h3" variant="label-13" emphasis="secondary" id={`fc-group-input-${node.id}`} className="fc-group-properties-title">
          Input
          <span className="fc-group-derived" aria-hidden="true">
            <DerivedIcon size={12} />
          </span>
        </Text>
        <p className={textClasses({ variant: 'label-12', emphasis: 'secondary' })}>{DERIVED_INPUT_TEXT}.</p>
        {derived.length > 0 ? (
          <ul className="fc-group-properties-names" aria-label="Input do grupo">
            {derived.map((name) => (
              <li key={name} className={textClasses({ variant: 'mono-13' })}>
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className={textClasses({ variant: 'label-12', emphasis: 'secondary' })}>Nenhuma variável de fora.</p>
        )}
      </section>

      <fieldset className="fc-group-properties-part" aria-describedby={`fc-group-output-help-${node.id}`}>
        <legend className={`fc-group-properties-title ${textClasses({ variant: 'label-13', emphasis: 'secondary' })}`}>Output</legend>
        <p id={`fc-group-output-help-${node.id}`} className={textClasses({ variant: 'label-12', emphasis: 'secondary' })}>
          As variáveis lineares produzidas dentro do grupo que os blocos de fora podem ver.
        </p>
        {names.length > 0 ? (
          <OutputChecks names={names} outputs={node.outputs} errorOf={(index) => (at === null ? undefined : problemText(problemsAt(problems, `${at}.outputs[${index}]`)))} onToggle={toggle} />
        ) : (
          <p className={textClasses({ variant: 'label-12', emphasis: 'secondary' })}>Nenhuma variável produzida dentro do grupo ainda.</p>
        )}
        {fieldProblems('outputs').length > 0 ? <FieldMessage type="error">{problemText(fieldProblems('outputs'))}</FieldMessage> : null}
      </fieldset>
    </PropertiesFrame>
  );
}

interface OutputChecksProps {
  names: readonly string[];
  outputs: readonly string[];
  errorOf: (index: number) => string | undefined;
  onToggle: (name: string, checked: boolean) => void;
}

/** One checkbox per variable the Output can give out; in read-only, disabled with the frame's reason. */
function OutputChecks({ names, outputs, errorOf, onToggle }: OutputChecksProps) {
  const { readOnly, reasonId } = useFieldsState();
  return (
    <ul className="fc-group-properties-checks">
      {names.map((name) => {
        const index = outputs.indexOf(name);
        return (
          <li key={name}>
            <Checkbox
              label={<span className={textClasses({ variant: 'mono-13' })}>{name}</span>}
              checked={index >= 0}
              disabled={readOnly}
              aria-describedby={reasonId}
              error={index < 0 ? undefined : errorOf(index)}
              onCheckedChange={(checked) => onToggle(name, checked === true)}
            />
          </li>
        );
      })}
    </ul>
  );
}
