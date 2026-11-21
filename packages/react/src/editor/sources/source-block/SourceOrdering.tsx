import { Button, FieldMessage, type SelectOption } from '../../../design-system';
import { READ_ONLY_REASON, useDraftEditor } from '../../draft';
import { PathSelect, problemsAt, useFieldsState } from '../../properties';
import { variableOptionLabel } from '../filters/FilterList';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '../filters/icons';
import { fieldPath, rowProblems, scopedName } from '../filters/paths';
import { indexOfItem, itemKey, moveItem, removeItem, replaceItem } from './identity';
import { DIRECTION_OPTIONS, ONE_ORDER, OUTSIDE_DATASET } from './labels';
import { ORDER_MAX, type CatalogVariable, type SortDirection, type LinearSourceNode, type SourceNode, type SourceOrder } from './sourceNode';

export interface SourceOrderingProps {
  node: LinearSourceNode;
  analyzedNode: SourceNode | null;
  at: string | null;
  variables: readonly CatalogVariable[];
  update: (apply: (node: SourceNode) => SourceNode) => void;
}

/**
 * The ordering of a Linear (E5-18; required): variable and direction per item, moved up and down. It decides which row is
 * worth with "Aceitar a primeira linha".
 */
export function SourceOrdering({ node, analyzedNode, at, variables, update }: SourceOrderingProps) {
  const { problems } = useDraftEditor();
  const { readOnly } = useFieldsState();
  const order = node.order_by;
  const listPath = fieldPath(at, 'order_by');
  const used = new Set(order.map((item) => item.variable_id));
  const next = variables.find((variable) => !used.has(variable.id)) ?? variables[0];
  const addReason = readOnly
    ? READ_ONLY_REASON
    : order.length >= ORDER_MAX
      ? `A ordenação aceita até ${ORDER_MAX} critérios.`
      : next === undefined
        ? 'O dataset não tem variáveis para ordenar.'
        : undefined;

  function setOrder(apply: (order: readonly SourceOrder[]) => SourceOrder[]) {
    update((current) => (current.mode === 'linear' ? { ...current, order_by: apply(current.order_by) } : current));
  }

  return (
    <fieldset className="fc-properties-group fc-source-section">
      <legend className="fc-properties-group-title">Ordenação</legend>
      {problemsAt(problems, listPath).map((problem, index) => (
        <FieldMessage key={`${problem.code}-${index}`} type="error">
          {problem.message}
        </FieldMessage>
      ))}
      <ol className="fc-source-list" aria-label="Ordenação">
        {order.map((item, index) => {
          const analyzedIndex = indexOfItem(analyzedNode?.mode === 'linear' ? analyzedNode.order_by : undefined, item);
          const itemAt = at === null || analyzedIndex < 0 ? null : `${at}.order_by[${analyzedIndex}]`;
          const scope = `critério ${index + 1}`;
          const variablePath = fieldPath(itemAt, 'variable_id');
          const directionPath = fieldPath(itemAt, 'direction');
          const options: SelectOption[] = variables.map((variable) => ({ value: variable.id, label: variableOptionLabel(variable) }));
          if (!variables.some((variable) => variable.id === item.variable_id)) options.push({ value: item.variable_id, label: OUTSIDE_DATASET });
          const reason = (fallback: string | undefined) => (readOnly ? READ_ONLY_REASON : fallback);
          return (
            <li key={itemKey(item)} className="fc-source-item">
              <div role="group" aria-label={`Critério ${index + 1}`} className="fc-properties-item-group">
                <div className="fc-source-order-row">
                  <PathSelect
                    label="Variável"
                    scope={scope}
                    value={item.variable_id}
                    options={options}
                    className="fc-properties-mono"
                    path={variablePath}
                    problems={problemsAt(problems, variablePath)}
                    onChange={(id) => setOrder((all) => replaceItem(all, item, (current) => ({ ...current, variable_id: id })))}
                  />
                  <PathSelect
                    label="Direção"
                    scope={scope}
                    value={item.direction}
                    options={DIRECTION_OPTIONS}
                    path={directionPath}
                    problems={problemsAt(problems, directionPath)}
                    onChange={(chosen) => {
                      const direction: SortDirection = chosen === 'desc' ? 'desc' : 'asc';
                      setOrder((all) => replaceItem(all, item, (current) => ({ ...current, direction })));
                    }}
                  />
                </div>
                {rowProblems(problems, itemAt, [variablePath, directionPath]).map((problem, problemIndex) => (
                  <FieldMessage key={`${problem.code}-${problemIndex}`} type="error">
                    {problem.message}
                  </FieldMessage>
                ))}
                <div className="fc-properties-item-actions">
                  <Button
                    iconOnly
                    variant="ghost"
                    size="small"
                    label={scopedName('Mover para cima', scope)}
                    icon={<ArrowUpIcon size={14} />}
                    disabledReason={reason(index === 0 ? 'Já é o primeiro critério' : undefined)}
                    onClick={() => setOrder((all) => moveItem(all, item, -1))}
                  />
                  <Button
                    iconOnly
                    variant="ghost"
                    size="small"
                    label={scopedName('Mover para baixo', scope)}
                    icon={<ArrowDownIcon size={14} />}
                    disabledReason={reason(index === order.length - 1 ? 'Já é o último critério' : undefined)}
                    onClick={() => setOrder((all) => moveItem(all, item, 1))}
                  />
                  <Button
                    iconOnly
                    variant="ghost"
                    size="small"
                    label={scopedName('Remover critério', scope)}
                    icon={<TrashIcon size={14} />}
                    disabledReason={reason(order.length <= 1 ? ONE_ORDER : undefined)}
                    onClick={() => setOrder((all) => removeItem(all, item))}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button
        size="small"
        icon={<PlusIcon size={14} />}
        className="fc-properties-add"
        disabledReason={addReason}
        onClick={() => {
          if (next) setOrder((all) => [...all, { variable_id: next.id, direction: 'asc' }]);
        }}
      >
        Incluir critério
      </Button>
    </fieldset>
  );
}
