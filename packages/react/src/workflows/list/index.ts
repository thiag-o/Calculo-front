// Sub-vertical "list" of the "workflows" vertical (ADR 0003): the workflow list (`/workflows`) and "Novo workflow".
// This folder's interface; other verticals reach it only through workflows/index.ts.
export { WorkflowList, EDIT_PERMISSION } from './WorkflowList';
export type { WorkflowListProps } from './WorkflowList';
export { NewWorkflowDialog } from './NewWorkflowDialog';
export type { NewWorkflowDialogProps } from './NewWorkflowDialog';
export { relativeTime } from './relativeTime';
