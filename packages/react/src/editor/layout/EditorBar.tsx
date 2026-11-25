import { useState } from 'react';
import { Badge, Button } from '../../design-system';
import { TriggerExecution } from '../../executions';
import { useSession } from '../../session';
import { EXECUTIONS_VIEW_PERMISSION } from '../../workflows';
import { READ_ONLY_REASON, SaveIndicator } from '../draft';
import { ProblemCounter } from '../problems';
import { ArrowLeftIcon } from './icons';

export interface EditorBarProps {
  /** The workflow whose draft is open: "Executar lote" runs it. */
  workflowId: string;
  /** The workflow name, in the path. Without it (still loading), "Workflow". */
  workflowName?: string;
  /** ← : back to the workflow Overview. */
  onBack: () => void;
  /** Opens the workflow list (the "Workflows" of the path). Without it, the path shows the word only. */
  onOpenWorkflows?: () => void;
  readOnly: boolean;
  /** "● N problemas": opens the Problems tab. */
  onOpenProblems: () => void;
  /**
   * Opens the panel of an execution (`/executions/:id`). With it, the bar has "Executar lote" (with `executions.trigger`),
   * which opens the panel of the new execution (without `executions.view` the bar stays and tells the batch was created).
   * Without it, no button.
   */
  onOpenExecution?: (id: string) => void;
}

/**
 * The editor bar (E4-20; estilos.md §9 and §16): ←, the path (Workflows / name), the "Rascunho" badge, "Só leitura"
 * without `workflows.edit`, the clickable "● N problemas", "Salvo há…" and, on the right, "Executar lote" (E6-19). Testes,
 * Simular and Enviar para revisão come with their epics.
 */
export function EditorBar({ workflowId, workflowName, onBack, onOpenWorkflows, readOnly, onOpenProblems, onOpenExecution }: EditorBarProps) {
  const canViewExecutions = useSession().hasPermission(EXECUTIONS_VIEW_PERMISSION);
  const [created, setCreated] = useState(false);
  return (
    <>
      <Button
        className="fc-editor-back"
        variant="ghost"
        size="small"
        iconOnly
        icon={<ArrowLeftIcon size={14} />}
        label="Voltar para a visão geral"
        onClick={onBack}
      />
      <nav aria-label="Você está em">
        <ol className="fc-editor-crumb">
          <li>
            {onOpenWorkflows ? (
              <button type="button" className="fc-editor-crumb-link" onClick={onOpenWorkflows}>
                Workflows
              </button>
            ) : (
              <span className="fc-editor-crumb-text">Workflows</span>
            )}
          </li>
          <li>
            <span className="fc-editor-crumb-separator" aria-hidden="true">
              /
            </span>
            <span className="fc-editor-crumb-current" aria-current="page">
              {workflowName ?? 'Workflow'}
            </span>
          </li>
        </ol>
      </nav>
      <Badge>Rascunho</Badge>
      {readOnly ? (
        <>
          <Badge>Só leitura</Badge>
          <span className="fc-visually-hidden">{READ_ONLY_REASON}</span>
        </>
      ) : null}
      <ProblemCounter onOpen={onOpenProblems} />
      <SaveIndicator />
      {created ? (
        <span role="status" className="fc-editor-triggered">
          Lote criado. Você não tem permissão para acompanhar as execuções.
        </span>
      ) : null}
      {onOpenExecution ? (
        <TriggerExecution
          workflowId={workflowId}
          onOpenProblems={onOpenProblems}
          // The executions of the overlap note open their panel, which takes `executions.view`.
          onOpenExecution={canViewExecutions ? onOpenExecution : undefined}
          onTriggered={(execution) => (canViewExecutions ? onOpenExecution(execution.id) : setCreated(true))}
        />
      ) : null}
    </>
  );
}
