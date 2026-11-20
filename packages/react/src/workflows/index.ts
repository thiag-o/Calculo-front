// Vertical "workflows" (ADR 0003).
// Workflow list, Overview, versions, review and approval, generated description (the whole screen is <Workflows>).
// This file is the vertical's public interface; the rest of the folder is private.

// Queries and mutations of the workflows, with the cache keys of the contract (used by the editor and the Home screen).
export {
  WORKFLOWS_KEY,
  WORKFLOW_LISTS_KEY,
  workflowListKey,
  workflowKey,
  workflowDraftKey,
  useWorkflowList,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
} from './queries';
export type { WorkflowSummary, Workflow, NewWorkflow, WorkflowUpdate, WorkflowListFilter } from './queries';

// The list (`/workflows`) and the "Novo workflow" dialog (also opened from the Home screen).
export { WorkflowList, NewWorkflowDialog, EDIT_PERMISSION as WORKFLOWS_EDIT_PERMISSION } from './list';
export type { WorkflowListProps, NewWorkflowDialogProps } from './list';

// The Overview (`/workflows/:id`), with "Renomear" and "Remover workflow".
export { WorkflowOverview } from './overview';
export type { WorkflowOverviewProps } from './overview';

// The whole screen: list, Overview and editor, bound to the module routes. The module hands the editor in (see Workflows.tsx).
export { Workflows } from './Workflows';
export type { WorkflowsProps, WorkflowsLocation, WorkflowsEditorProps, WorkflowsUnsavedNoticeProps } from './Workflows';

// "Há 2 h", "ontem 03:00" (estilos.md §10), for the Home recent workflows.
export { relativeTime } from './list';
