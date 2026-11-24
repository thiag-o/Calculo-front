import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../session';
import { WorkflowCanvas } from './canvas';
import { DecisionTableGrid, DecisionTableProperties, isGridPath } from './decision-table';
import { useDraftEditor, type EditorItem, type WorkflowProblem } from './draft';
import { GroupProperties } from './groups';
import { Layers } from './layers';
import { EditorScreen, type BottomTab } from './layout';
import { PREVIEW_LABEL, PREVIEW_TAB, PreviewPanel, canRunPreview } from './preview';
import { PropertiesPanel } from './properties';
import { FilterList, SourceBlockProperties, type FilterEntry, type FilterVariable } from './sources';
import { BatchSourceProperties, type BatchSourceFilter, type BatchSourceFiltersProps } from './sources/batch-source';
import { UNIT_RUN_LABEL, UNIT_RUN_TAB, UnitRunPanel, canRunUnit } from './unit-run';
import './editor.css';

export interface EditorProps {
  /** The workflow whose draft is edited (`/workflows/:id/editor` in the module). Another id opens another editor. */
  workflowId: string;
  /** ← : back to the workflow Overview. */
  onBack: () => void;
  /** The "Workflows" of the path in the bar: back to the list. */
  onOpenWorkflows?: () => void;
  /** Opens the panel of an execution (`/executions/:id`). With it, the bar has "Executar lote" (E6-19). */
  onOpenExecution?: (id: string) => void;
}

/**
 * The workflow editor (E4-20): the full-screen layout with Camadas, the canvas, Propriedades and the bottom panel, where
 * Problemas is always there, and Prévia (E5-20) and Calcular come with `workflows.edit` or `simulations.run` (the Auditor
 * sees neither). Propriedades shows the form of what is selected: the batch source (the Fonte do lote bar), a Fonte block,
 * a group, a Calculation or a Decision Table, at any depth of the groups. With a batch source, Calcular asks for a record
 * of it instead of the values, and the values of the last run show on the canvas. "Abrir tabela" (in the
 * properties of a Decision Table) and a problem inside a table cell open the grid in place of the canvas (E4-22); "Voltar ao
 * canvas" and Esc close it. Without `workflows.edit` the draft opens read only. Needs the module root, the API and the
 * cache (`<FluxoCalculo>` and the standalone screens mount them).
 */
export function Editor({ workflowId, onBack, onOpenWorkflows, onOpenExecution }: EditorProps) {
  const session = useSession();
  const canRun = canRunUnit(session.hasPermission);
  const canPreview = canRunPreview(session.hasPermission);
  // The id of the Decision Table whose grid is open in place of the canvas. Another workflow starts with the canvas.
  const [open, setOpen] = useState<{ workflowId: string; nodeId: string } | null>(null);
  const openTable = open !== null && open.workflowId === workflowId ? open.nodeId : null;
  const openGrid = useCallback((nodeId: string) => setOpen({ workflowId, nodeId }), [workflowId]);
  const closeGrid = useCallback(() => setOpen(null), []);

  // After Problemas: Prévia, then Calcular (E5-20).
  const bottomTabs = useMemo<readonly BottomTab[]>(
    () => [
      ...(canPreview ? [{ value: PREVIEW_TAB, label: PREVIEW_LABEL, content: <PreviewPanel /> }] : []),
      ...(canRun ? [{ value: UNIT_RUN_TAB, label: UNIT_RUN_LABEL, content: <UnitRunPanel /> }] : []),
    ],
    [canPreview, canRun],
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
      onOpenExecution={onOpenExecution}
      layers={<Layers />}
      canvas={<CanvasArea openTable={openTable} onCloseTable={closeGrid} />}
      properties={
        <PropertiesPanel
          decisionTable={(node) => <DecisionTableProperties nodeId={node.id} onOpenTable={() => openGrid(node.id)} />}
          sourceBlock={(node) => <SourceBlockProperties key={node.id} node={node} />}
          group={(node) => <GroupProperties key={node.id} node={node} />}
          batchSource={() => <BatchSourceProperties renderFilters={renderBatchSourceFilters} />}
          renderFilters={renderBatchSourceFilters}
        />
      }
      bottomTabs={bottomTabs}
      onSelectProblem={onSelectProblem}
    />
  );
}

/** The filters of the batch source, drawn by the filters component of the Source block (F64): the same rows and rules. */
function renderBatchSourceFilters(props: BatchSourceFiltersProps) {
  return <BatchSourceFilterList {...props} />;
}

/** A stable key per filter while it is edited (ADR 0044): the key follows the filter object that replaced it. */
function useFilterKeys() {
  const state = useRef({ keys: new WeakMap<object, number>(), next: 0 });
  return {
    keyOf(filter: object): number {
      const { keys } = state.current;
      let key = keys.get(filter);
      if (key === undefined) {
        key = state.current.next++;
        keys.set(filter, key);
      }
      return key;
    },
    follow(from: object, to: object) {
      state.current.keys.set(to, state.current.keys.get(from) ?? state.current.next++);
    },
  };
}

function BatchSourceFilterList({ filters, variables, path, problems, onChange }: BatchSourceFiltersProps) {
  const { keyOf, follow } = useFilterKeys();
  const entryVariables: FilterVariable[] = variables.map((variable) => ({ ...variable, key: variable.name }));
  const entries: FilterEntry[] = filters.map((filter) => ({ variable: filter.variable, operator: filter.operator, values: filter.values }));
  const filter = (entry: FilterEntry): BatchSourceFilter => ({ variable: entry.variable, operator: entry.operator, values: [...entry.values] });
  return (
    <FilterList
      filters={entries}
      keys={filters.map((item) => keyOf(item))}
      paths={filters.map((_, index) => `${path}[${index}]`)}
      variableField="variable"
      variables={entryVariables}
      problems={problems}
      mergeKeyPrefix="batch-source"
      onAdd={(entry) => onChange([...filters, filter(entry)])}
      onChange={(index, entry) => {
        const before = filters[index];
        if (!before) return;
        const after = filter(entry);
        follow(before, after);
        onChange(filters.map((item, position) => (position === index ? after : item)));
      }}
      onRemove={(index) => onChange(filters.filter((_, position) => position !== index))}
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
