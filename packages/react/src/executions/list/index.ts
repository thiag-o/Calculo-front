// Sub-vertical "list" of "executions" (E6-20): the tenant list (`/executions`) and the list of one workflow
// (`/workflows/:id/executions`), the same component. Exported by `executions/index.ts`; the module wires the routes (F104).
export { ExecutionList } from './ExecutionList';
export type { ExecutionListProps } from './ExecutionList';
