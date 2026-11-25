import { Button, Tabs, Text } from '../../design-system';
import { ExecutionList, ScheduleList } from '../../executions';
import { BackIcon } from './icons';

/** The two tabs of the workflow executions screen (E7-24): the batches and the schedules. */
export type WorkflowExecutionsTab = 'executions' | 'schedules';

const TABS = [
  { value: 'executions', label: 'Execuções' },
  { value: 'schedules', label: 'Agendamentos' },
] as const satisfies readonly { value: WorkflowExecutionsTab; label: string }[];

export interface WorkflowExecutionsProps {
  /** The workflow whose executions are listed (`/workflows/:id/executions` in the module). */
  workflowId: string;
  /** Opens the panel of an execution (`/executions/:id`), also right after "Executar lote". */
  onOpenExecution: (id: string) => void;
  /** Goes back to the workflow Overview ("Voltar para a visão geral"). */
  onBack: () => void;
  /** Opens the editor, from the "Ver problemas" of the "Executar lote" dialog. */
  onOpenProblems: () => void;
  /** The open tab (`/workflows/:id/executions` or `/workflows/:id/executions/schedules` in the module). Default: `executions`. */
  tab?: WorkflowExecutionsTab;
  /** Called when the person picks the other tab. Without it the screen has no tabs: only the list of executions. */
  onTabChange?: (tab: WorkflowExecutionsTab) => void;
}

/**
 * The executions of one workflow (E6-20, E7-24): under "Voltar para a visão geral", the tabs Execuções | Agendamentos (when
 * `onTabChange` comes). The first is the same list as the tenant one, with the workflow filter fixed and "Executar lote" (with
 * `executions.trigger`); the second, the schedules of the workflow, with "Novo agendamento" (with `executions.schedule`). Needs
 * `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function WorkflowExecutions({ workflowId, onOpenExecution, onBack, onOpenProblems, tab = 'executions', onTabChange }: WorkflowExecutionsProps) {
  const list = <ExecutionList workflowId={workflowId} onOpenExecution={onOpenExecution} onOpenProblems={onOpenProblems} />;
  return (
    <div className="fc-workflow-executions">
      <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack} className="fc-workflow-executions-back">
        Voltar para a visão geral
      </Button>
      {onTabChange ? (
        <Tabs<WorkflowExecutionsTab>
          label="Abas de Execuções do workflow"
          size="small"
          className="fc-workflow-executions-tabs"
          items={TABS}
          value={tab}
          onValueChange={onTabChange}
        >
          {(open) =>
            open === 'schedules' ? (
              <>
                {/* The screen keeps one h1; the open tab's own title is the h2 of the list (ADR 0027). */}
                <Text as="h1" variant="heading-24" className="fc-workflow-executions-title">
                  Execuções
                </Text>
                <ScheduleList workflowId={workflowId} onOpenExecution={onOpenExecution} />
              </>
            ) : (
              list
            )
          }
        </Tabs>
      ) : (
        list
      )}
    </div>
  );
}
