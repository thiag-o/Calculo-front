// Sub-vertical "overview" of the "workflows" vertical (ADR 0003): the workflow Overview (`/workflows/:id`), with
// "Renomear", "Remover workflow" and "Executar lote", and the executions of the workflow (`/workflows/:id/executions`).
// This folder's interface; other verticals reach it only through workflows/index.ts.
export { WorkflowOverview, EXECUTIONS_VIEW_PERMISSION } from './WorkflowOverview';
export type { WorkflowOverviewProps } from './WorkflowOverview';
export { WorkflowExecutions } from './WorkflowExecutions';
export type { WorkflowExecutionsProps } from './WorkflowExecutions';
