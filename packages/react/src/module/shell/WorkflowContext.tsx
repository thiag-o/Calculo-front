import { useNavigate } from 'react-router';
import { Menu, type MenuItem } from '../../design-system';
import { useWorkflow, useWorkflowList } from '../../workflows';
import { WorkflowsIcon } from '../icons';

/** How many other workflows the context menu lists; the rest is one "Todos os workflows" away. */
const OTHER_WORKFLOWS = 8;

/**
 * The second line of the context selector (E4-25, estilos.md §9): "tenant › workflow", shown while a workflow is open. The
 * button opens the other workflows and "Todos os workflows". It sits right below the tenant line and looks like it.
 */
export function WorkflowContext({ workflowId }: { workflowId: string }) {
  const navigate = useNavigate();
  const workflow = useWorkflow(workflowId);
  const list = useWorkflowList({ limit: OTHER_WORKFLOWS + 1 });
  const name = workflow.data?.name ?? 'Workflow';

  const others = (list.data ?? []).filter((item) => item.id !== workflowId).slice(0, OTHER_WORKFLOWS);
  const items: MenuItem[] = [
    ...others.map((item) => ({
      label: item.name,
      onSelect: () => void navigate(`/workflows/${encodeURIComponent(item.id)}`),
    })),
    ...(others.length > 0 ? [{ type: 'separator' } as const] : []),
    { label: 'Todos os workflows', onSelect: () => void navigate('/workflows') },
  ];

  return (
    <Menu
      align="start"
      items={items}
      trigger={
        <button
          type="button"
          className="fc-tenant-selector fc-tenant-selector-button fc-workflow-context"
          aria-label={`Trocar workflow. Atual: ${name}`}
        >
          <span className="fc-workflow-context-separator" aria-hidden="true">
            ›
          </span>
          <WorkflowsIcon />
          <span className="fc-tenant-selector-name">{name}</span>
        </button>
      }
    />
  );
}
