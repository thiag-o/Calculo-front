import { Button } from '../../design-system';
import { ExecutionList } from '../../executions';
import { BackIcon } from './icons';

export interface WorkflowExecutionsProps {
  /** The workflow whose executions are listed (`/workflows/:id/executions` in the module). */
  workflowId: string;
  /** Opens the panel of an execution (`/executions/:id`), also right after "Executar lote". */
  onOpenExecution: (id: string) => void;
  /** Goes back to the workflow Overview ("Voltar para a visão geral"). */
  onBack: () => void;
  /** Opens the editor, from the "Ver problemas" of the "Executar lote" dialog. */
  onOpenProblems: () => void;
}

/**
 * The executions of one workflow (E6-20): the same list as the tenant one, with the workflow filter fixed and "Executar lote"
 * (with `executions.trigger`), under "Voltar para a visão geral". Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function WorkflowExecutions({ workflowId, onOpenExecution, onBack, onOpenProblems }: WorkflowExecutionsProps) {
  return (
    <div className="fc-workflow-executions">
      <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack} className="fc-workflow-executions-back">
        Voltar para a visão geral
      </Button>
      <ExecutionList workflowId={workflowId} onOpenExecution={onOpenExecution} onOpenProblems={onOpenProblems} />
    </div>
  );
}
