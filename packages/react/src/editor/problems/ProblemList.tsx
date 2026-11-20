import { useMemo } from 'react';
import { Badge, EmptyState, Text } from '../../design-system';
import { useDraftEditor, type EditorItem, type WorkflowProblem } from '../draft';
import { CheckIcon } from './icons';
import { groupProblems, problemCountText, type ProblemOwnerKind } from './problemGroups';
import './problems.css';

/** The block type beside its name; the inputs, the output and the workflow are named by the title itself. */
const kindLabel: Record<ProblemOwnerKind, string | null> = {
  calculation: 'Cálculo',
  decision_table: 'Tabela de Decisão',
  inputs: null,
  output: null,
  workflow: null,
};

export interface ProblemListProps {
  /**
   * Called after a problem selects its item and field (e.g. to open the Decision Table grid when the problem is in a
   * cell). Optional.
   */
  onSelectProblem?: (item: EditorItem, problem: WorkflowProblem) => void;
}

/**
 * The Problems tab (E4-20; estilos.md §14): the problems of the draft grouped by block (and the inputs, the output and the
 * workflow settings), each with its code and message. A click selects the block and the field of the problem (`path`),
 * for the canvas, the layers and the properties. Without problems, the empty state.
 */
export function ProblemList({ onSelectProblem }: ProblemListProps = {}) {
  const { problems, definition, analyzedDefinition, analysisFailed, select } = useDraftEditor();
  const groups = useMemo(() => groupProblems(problems, analyzedDefinition, definition), [problems, analyzedDefinition, definition]);

  // A discreet line, not an alert: the problems shown are from before the latest change, and the next one tries again.
  const failed = (
    <p className="fc-problems-outdated" role="status">
      {analysisFailed ? (
        <Text as="span" variant="label-13" emphasis="tertiary">
          Não foi possível conferir a última mudança. A lista pode estar desatualizada.
        </Text>
      ) : null}
    </p>
  );

  if (groups.length === 0) {
    return (
      <>
        {failed}
        <EmptyState
          className="fc-problems-empty"
          icon={<CheckIcon />}
          title="Nenhum problema"
          description="Os problemas do rascunho aparecem aqui enquanto você edita."
        />
      </>
    );
  }

  return (
    <>
      {/* The section title, for the block titles (h3) to come after an h2 (the tab already shows the word). */}
      <h2 className="fc-visually-hidden">Problemas</h2>
      {failed}
      <ul className="fc-problems" aria-label="Problemas por bloco">
        {groups.map((group) => (
          <li key={group.key} className="fc-problems-group">
            <h3 className="fc-problems-group-head">
              <span className={`fc-problems-square fc-problems-square-${group.kind}`} aria-hidden="true" />
              <span className={group.item.type === 'node' ? 'fc-problems-group-name fc-problems-group-block' : 'fc-problems-group-name'}>
                {group.title}
              </span>
              {kindLabel[group.kind] ? <span className="fc-problems-group-kind">{kindLabel[group.kind]}</span> : null}
              <Badge tone="red" className="fc-problems-group-count">
                {problemCountText(group.problems.length)}
              </Badge>
            </h3>
            <ul className="fc-problems-items">
              {group.problems.map((problem, index) => (
                <li key={`${problem.path ?? ''}:${problem.start ?? ''}:${index}`}>
                  <button
                    type="button"
                    className="fc-problems-item"
                    onClick={() => {
                      select(group.item, problem.path);
                      onSelectProblem?.(group.item, problem);
                    }}
                  >
                    <span className="fc-problems-code">{problem.code}</span>
                    <span className="fc-problems-message">{problem.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
