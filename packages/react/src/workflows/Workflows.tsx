import type { ReactNode } from 'react';
import { WorkflowList } from './list';
import { WorkflowOverview } from './overview';

/** Where the Workflows screen is: the list, a workflow Overview or its editor. */
export type WorkflowsLocation = { view: 'list' } | { view: 'overview'; id: string } | { view: 'editor'; id: string };

/** What `renderEditor` receives: the workflow to edit and the two ways out of the editor. */
export interface WorkflowsEditorProps {
  workflowId: string;
  /** ← : back to the workflow Overview. */
  onBack: () => void;
  /** The "Workflows" of the editor path: back to the list. */
  onOpenWorkflows: () => void;
}

/** What `renderUnsavedNotice` receives: where "Voltar ao editor" goes, and the workflow it is about (every one on the list). */
export interface WorkflowsUnsavedNoticeProps {
  onReturn: (workflowId: string) => void;
  workflowId?: string;
}

export interface WorkflowsProps {
  /** The open view: the module keeps it in the route (`/workflows`, `/workflows/:id` and `/workflows/:id/editor`). */
  location: WorkflowsLocation;
  onLocationChange: (location: WorkflowsLocation) => void;
  /**
   * The editor of a workflow. The editor vertical depends on this one (it reads the workflow), so the module, which knows
   * both, hands it over here instead of this screen importing it.
   */
  renderEditor: (props: WorkflowsEditorProps) => ReactNode;
  /** The note of a change the editor could not save on close (F74), shown on the screens that follow the editor. */
  renderUnsavedNotice?: (props: WorkflowsUnsavedNoticeProps) => ReactNode;
}

/**
 * The Workflows screen (E4-19): the list (`/workflows`), the Overview (`/workflows/:id`) and the editor
 * (`/workflows/:id/editor`), switched by the `location` the module keeps in the route. After the editor, the list and the
 * Overview tell about a change that could not be saved. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function Workflows({ location, onLocationChange, renderEditor, renderUnsavedNotice }: WorkflowsProps) {
  const openEditor = (id: string) => onLocationChange({ view: 'editor', id });
  const openList = () => onLocationChange({ view: 'list' });

  if (location.view === 'editor') {
    return renderEditor({
      workflowId: location.id,
      onBack: () => onLocationChange({ view: 'overview', id: location.id }),
      onOpenWorkflows: openList,
    });
  }

  if (location.view === 'overview') {
    return (
      <>
        {renderUnsavedNotice?.({ onReturn: openEditor, workflowId: location.id })}
        <WorkflowOverview workflowId={location.id} onOpenEditor={openEditor} onBack={openList} onDeleted={openList} />
      </>
    );
  }

  return (
    <>
      {renderUnsavedNotice?.({ onReturn: openEditor })}
      <WorkflowList onOpenWorkflow={(id) => onLocationChange({ view: 'overview', id })} />
    </>
  );
}
