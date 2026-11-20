import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../session';
import { WorkflowCanvas } from './canvas';
import { DecisionTableGrid, DecisionTableProperties, isGridPath } from './decision-table';
import { useDraftEditor, type EditorItem, type WorkflowProblem } from './draft';
import { Layers } from './layers';
import { EditorScreen, type BottomTab } from './layout';
import { PropertiesPanel } from './properties';
import { UNIT_RUN_LABEL, UNIT_RUN_TAB, UnitRunPanel, canRunUnit } from './unit-run';
import './editor.css';

export interface EditorProps {
  /** The workflow whose draft is edited (`/workflows/:id/editor` in the module). Another id opens another editor. */
  workflowId: string;
  /** ← : back to the workflow Overview. */
  onBack: () => void;
  /** The "Workflows" of the path in the bar: back to the list. */
  onOpenWorkflows?: () => void;
}

/**
 * The workflow editor (E4-20): the full-screen layout with Camadas, the canvas, Propriedades and the bottom panel, where
 * Problemas is always there and Calcular comes with `workflows.edit` or `simulations.run`. "Abrir tabela" (in the
 * properties of a Decision Table) and a problem inside a table cell open the grid in place of the canvas (E4-22); "Voltar ao
 * canvas" and Esc close it. Without `workflows.edit` the draft opens read only. Needs the module root, the API and the
 * cache (`<FluxoCalculo>` and the standalone screens mount them).
 */
export function Editor({ workflowId, onBack, onOpenWorkflows }: EditorProps) {
  const session = useSession();
  const canRun = canRunUnit(session.hasPermission);
  // The id of the Decision Table whose grid is open in place of the canvas. Another workflow starts with the canvas.
  const [open, setOpen] = useState<{ workflowId: string; nodeId: string } | null>(null);
  const openTable = open !== null && open.workflowId === workflowId ? open.nodeId : null;
  const openGrid = useCallback((nodeId: string) => setOpen({ workflowId, nodeId }), [workflowId]);
  const closeGrid = useCallback(() => setOpen(null), []);

  const bottomTabs = useMemo<readonly BottomTab[]>(
    () => (canRun ? [{ value: UNIT_RUN_TAB, label: UNIT_RUN_LABEL, content: <UnitRunPanel /> }] : []),
    [canRun],
  );

  // A problem inside a cell or a rule of a table: the grid opens on it (the block is already selected, with the field).
  function onSelectProblem(item: EditorItem, problem: WorkflowProblem) {
    if (item.type === 'node' && isGridPath(problem.path)) openGrid(item.id);
  }

  return (
    <EditorScreen
      workflowId={workflowId}
      onBack={onBack}
      onOpenWorkflows={onOpenWorkflows}
      layers={<Layers />}
      canvas={<CanvasArea openTable={openTable} onCloseTable={closeGrid} />}
      properties={
        <PropertiesPanel
          decisionTable={(node) => <DecisionTableProperties nodeId={node.id} onOpenTable={() => openGrid(node.id)} />}
        />
      }
      bottomTabs={bottomTabs}
      onSelectProblem={onSelectProblem}
    />
  );
}

interface CanvasAreaProps {
  openTable: string | null;
  onCloseTable: () => void;
}

/**
 * The canvas, or the grid of the open Decision Table in its place. It sits inside the draft context, so it can see the
 * selection: choosing another item (in the layers, say) closes the grid, which belongs to one table.
 */
function CanvasArea({ openTable, onCloseTable }: CanvasAreaProps) {
  const { selection } = useDraftEditor();
  const host = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const { item } = selection;
  const selectedId = item.type === 'node' ? item.id : null;

  useEffect(() => {
    if (openTable !== null && selectedId !== openTable) onCloseTable();
  }, [openTable, selectedId, onCloseTable]);

  // The grid took the focus with it when it closed: the canvas area gets it back, so the keyboard stays in the editor.
  useEffect(() => {
    if (wasOpen.current && openTable === null) host.current?.focus();
    wasOpen.current = openTable !== null;
  }, [openTable]);

  return (
    <div ref={host} className="fc-editor-canvas-host" tabIndex={-1}>
      {openTable !== null ? <DecisionTableGrid nodeId={openTable} onClose={onCloseTable} /> : <WorkflowCanvas />}
    </div>
  );
}
