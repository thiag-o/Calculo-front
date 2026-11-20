import { Badge, Card, Text, textClasses } from '../../design-system';
import type { WorkflowSummary } from '../queries';
import { WorkflowIcon } from './icons';
import { relativeTime } from './relativeTime';

function blocks(count: number): string {
  return count === 1 ? '1 bloco' : `${count.toLocaleString('pt-BR')} blocos`;
}

function problems(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

export interface WorkflowCardProps {
  workflow: WorkflowSummary;
  /** Opens the workflow's Overview. Without it, the name is plain text. */
  onOpen?: (id: string) => void;
  /** "Now", for the relative time. */
  now: Date;
}

/**
 * Workflow card (estilos.md §7.6): outline icon, name, "Rascunho · N blocos", who changed it last and when, and the
 * amber badge with the draft problems, when there are any. The whole card opens the Overview (the name is the button).
 */
export function WorkflowCard({ workflow, onOpen, now }: WorkflowCardProps) {
  const { draft } = workflow;
  const nameClasses = textClasses({ variant: 'heading-14' });
  return (
    <Card as="li" className={onOpen ? 'fc-workflows-card fc-workflows-card-clickable' : 'fc-workflows-card'}>
      <div className="fc-workflows-card-head">
        <span className="fc-workflows-card-icon" aria-hidden="true">
          <WorkflowIcon />
        </span>
        <div className="fc-workflows-card-title">
          <h2 className={`fc-workflows-card-name ${nameClasses}`} title={workflow.name}>
            {onOpen ? (
              <button type="button" className={`fc-workflows-card-open ${nameClasses}`} onClick={() => onOpen(workflow.id)}>
                {workflow.name}
              </button>
            ) : (
              workflow.name
            )}
          </h2>
          <Text variant="label-13" emphasis="secondary">
            Rascunho · {blocks(draft.node_count)}
          </Text>
        </div>
      </div>
      <div className="fc-workflows-card-foot">
        <Text variant="label-12" emphasis="tertiary" className="fc-workflows-card-edited">
          editado por {workflow.updated_by.name} {relativeTime(workflow.updated_at, now)}
        </Text>
        {draft.problem_count > 0 ? <Badge tone="amber">{problems(draft.problem_count)}</Badge> : null}
      </div>
    </Card>
  );
}
