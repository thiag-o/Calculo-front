import { DATA_TYPE_LABELS } from '../../../catalog';
import { Button, FieldMessage, Notice, type SelectOption } from '../../../design-system';
import { READ_ONLY_REASON, useDraftEditor, type DraftSymbol } from '../../draft';
import { PathSelect, problemsAt, useFieldsState } from '../../properties';
import { fieldPath, rowProblems, scopedName } from '../filters/paths';
import { PlusIcon, TrashIcon } from '../filters/icons';
import { indexOfItem, itemKey, removeItem, replaceItem } from './identity';
import { ONE_LINK_IN_FILTER, OUTSIDE_DATASET, PARAMETER_TABLE_NOTE, PARAMETER_TABLE_TITLE } from './labels';
import { LINKS_MAX, linkableTypes, type CatalogVariable, type SourceLink, type SourceNode } from './sourceNode';

export interface SourceLinksProps {
  node: SourceNode;
  /** The block as it was analysed (its links give the `path` of the problems), or `null`. */
  analyzedNode: SourceNode | null;
  /** The block's `path` in the analysed definition, or `null`. */
  at: string | null;
  /** The variables of the block's dataset. */
  variables: readonly CatalogVariable[];
  /** The workflow variables a link can use here (read, linear and visible). */
  candidates: readonly DraftSymbol[];
  update: (apply: (node: SourceNode) => SourceNode) => void;
}

function optionLabel(name: string, type: DraftSymbol['type']): string {
  return type === null ? name : `${name} · ${DATA_TYPE_LABELS[type]}`;
}

/**
 * The new link: the first variable that is not linked yet, to the dataset variable of the same name (or, failing that, of
 * a type it links to, or the first one).
 */
function newLink(node: SourceNode, candidates: readonly DraftSymbol[], variables: readonly CatalogVariable[]): SourceLink | null {
  const linked = new Set(node.links.map((link) => link.variable));
  const symbol = candidates.find((candidate) => !linked.has(candidate.name)) ?? candidates[0];
  if (!symbol || variables.length === 0) return null;
  const column =
    variables.find((variable) => variable.name === symbol.name) ??
    variables.find((variable) => symbol.type !== null && linkableTypes(symbol.type, variable.type)) ??
    variables[0]!;
  return { variable: symbol.name, column_variable_id: column.id };
}

/**
 * The links of the block (E5-18): "variável visível → variável do dataset", with the type of both and a warning while
 * the types do not link. Without links, a Linear is a parameter table; the Filtro needs at least one.
 */
export function SourceLinks({ node, analyzedNode, at, variables, candidates, update }: SourceLinksProps) {
  const { problems } = useDraftEditor();
  const { readOnly } = useFieldsState();
  const listPath = fieldPath(at, 'links');
  const created = newLink(node, candidates, variables);
  const addReason = readOnly
    ? READ_ONLY_REASON
    : node.links.length >= LINKS_MAX
      ? `O bloco aceita até ${LINKS_MAX} ligações.`
      : variables.length === 0
        ? 'O dataset não tem variáveis para ligar.'
        : created === null
          ? 'Nenhuma variável lida está visível aqui. A ligação usa variáveis da fonte do lote ou de outro bloco Fonte.'
          : undefined;
  const only = node.mode === 'filter' && node.links.length <= 1;

  return (
    <fieldset className="fc-properties-group fc-source-section">
      <legend className="fc-properties-group-title">Ligações</legend>
      {problemsAt(problems, listPath).map((problem, index) => (
        <FieldMessage key={`${problem.code}-${index}`} type="error">
          {problem.message}
        </FieldMessage>
      ))}
      {node.links.length === 0 ? (
        node.mode === 'linear' ? (
          <div className="fc-source-note" role="note" aria-label={PARAMETER_TABLE_TITLE}>
            <p className="fc-source-note-title">{PARAMETER_TABLE_TITLE}</p>
            <p className="fc-source-note-text">{PARAMETER_TABLE_NOTE}</p>
          </div>
        ) : null
      ) : (
        <ol className="fc-source-list" aria-label="Ligações">
          {node.links.map((link, index) => {
            const analyzedIndex = indexOfItem(analyzedNode?.links, link);
            return (
              <LinkRow
                key={itemKey(link)}
                link={link}
                number={index + 1}
                at={at === null || analyzedIndex < 0 ? null : `${at}.links[${analyzedIndex}]`}
                variables={variables}
                candidates={candidates}
                removeReason={readOnly ? READ_ONLY_REASON : only ? ONE_LINK_IN_FILTER : undefined}
                onChange={(apply) => update((current) => ({ ...current, links: replaceItem(current.links, link, apply) }))}
                onRemove={() => update((current) => ({ ...current, links: removeItem(current.links, link) }))}
              />
            );
          })}
        </ol>
      )}
      <Button
        size="small"
        icon={<PlusIcon size={14} />}
        className="fc-properties-add"
        disabledReason={addReason}
        onClick={() => {
          if (created) update((current) => ({ ...current, links: [...current.links, created] }));
        }}
      >
        Incluir ligação
      </Button>
    </fieldset>
  );
}

interface LinkRowProps {
  link: SourceLink;
  number: number;
  at: string | null;
  variables: readonly CatalogVariable[];
  candidates: readonly DraftSymbol[];
  removeReason: string | undefined;
  onChange: (apply: (link: SourceLink) => SourceLink) => void;
  onRemove: () => void;
}

function LinkRow({ link, number, at, variables, candidates, removeReason, onChange, onRemove }: LinkRowProps) {
  const { problems, symbols } = useDraftEditor();
  const scope = `ligação ${number}`;
  const variablePath = fieldPath(at, 'variable');
  const columnPath = fieldPath(at, 'column_variable_id');

  const symbol = symbols.find((candidate) => candidate.name === link.variable && candidate.cardinality === 'linear');
  const column = variables.find((variable) => variable.id === link.column_variable_id);

  const variableOptions: SelectOption[] = candidates.map((candidate) => ({ value: candidate.name, label: optionLabel(candidate.name, candidate.type) }));
  if (!candidates.some((candidate) => candidate.name === link.variable)) {
    variableOptions.push({ value: link.variable, label: optionLabel(link.variable, symbol?.type ?? null) });
  }
  const columnOptions: SelectOption[] = variables.map((variable) => ({ value: variable.id, label: optionLabel(variable.name, variable.type) }));
  if (!column) columnOptions.push({ value: link.column_variable_id, label: OUTSIDE_DATASET });

  const loose = rowProblems(problems, at, [variablePath, columnPath]);
  const analysed = problemsAt(problems, variablePath).length + problemsAt(problems, columnPath).length + loose.length > 0;
  const mismatch = symbol?.type && column && !linkableTypes(symbol.type, column.type) ? { from: symbol.type, to: column.type } : null;

  return (
    <li className="fc-source-item">
      <div role="group" aria-label={`Ligação ${number}`} className="fc-properties-item-group">
        <PathSelect
          label="Variável do workflow"
          scope={scope}
          value={link.variable}
          options={variableOptions}
          className="fc-properties-mono"
          path={variablePath}
          problems={problemsAt(problems, variablePath)}
          onChange={(variable) => onChange((current) => ({ ...current, variable }))}
        />
        <PathSelect
          label="Variável do dataset"
          scope={scope}
          value={link.column_variable_id}
          options={columnOptions}
          className="fc-properties-mono"
          path={columnPath}
          problems={problemsAt(problems, columnPath)}
          onChange={(id) => onChange((current) => ({ ...current, column_variable_id: id }))}
        />
        {loose.map((problem, index) => (
          <FieldMessage key={`${problem.code}-${index}`} type="error">
            {problem.message}
          </FieldMessage>
        ))}
        {mismatch && !analysed ? (
          <Notice type="warning">
            Os tipos são diferentes: {DATA_TYPE_LABELS[mismatch.from]} e {DATA_TYPE_LABELS[mismatch.to]}. A ligação precisa de tipos
            iguais (inteiro e decimal se ligam pelo valor).
          </Notice>
        ) : null}
        <div className="fc-properties-item-actions">
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={scopedName('Remover ligação', scope)}
            icon={<TrashIcon size={14} />}
            disabledReason={removeReason}
            onClick={onRemove}
          />
        </div>
      </div>
    </li>
  );
}
