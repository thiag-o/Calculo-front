import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type OnNodesChange,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Button, EmptyState, type MenuItem } from '../../design-system';
import { READ_ONLY_REASON, WORKFLOW_ITEM, sameItem, useDraftEditor, type EditorItem } from '../draft';
import {
  COLLAPSE_ACTION,
  EXPAND_ACTION,
  GROUP_ACTION,
  GROUP_CONTENT,
  MOVE_TO_GROUP_ACTION,
  MoveToGroupDialog,
  NOT_IN_GROUP_REASON,
  NO_TARGET_GROUP_REASON,
  TAKE_OUT_OF_GROUP_ACTION,
  UNGROUP_ACTION,
  collapsedText,
  findEntry,
  findGroup,
  findNode,
  groupLabel,
  groupNodes,
  groupReason,
  groupSizes,
  groupedText,
  isGroup,
  moveTargets,
  moveToGroup,
  movedToGroupText,
  pickedText,
  setCollapsed,
  takeOutOfGroup,
  takenOutText,
  ungroup,
  ungroupedText,
  type GroupNode,
  type Size,
} from '../groups';
import { usePanelWidths } from '../layout';
import { useProblemCounts } from '../problems';
import { addBlock, freePosition, moveBlocks, newBlock, type Position } from './blocks';
import { useBlockRemoval } from './BlockRemoval';
import { useAnnouncement } from './announcement';
import { keep, useStableList, type KeptObjects } from './keptObjects';
import { INPUTS_ID, OUTPUT_ID, canvasGraph, type Block, type CanvasGraph, type NewBlockKind } from './graph';
import { BlocksIcon, FitIcon, ZoomInIcon, ZoomOutIcon } from './icons';
import { BLOCK_KEYS_HELP, BLOCK_KEYS_HELP_READ_ONLY, blockAddedText, blockLabel, linkLabel, movedText } from './messages';
import { NODE_TYPES, type CanvasNode } from './nodes';
import { NodeMenu, NodeMenuContext, type NodeMenuState } from './NodeMenu';
import { CanvasToolbar } from './CanvasToolbar';
import './canvas.css';

/** One arrow press moves the block this far; with Shift, four times as far. */
export const ARROW_STEP = 8;

const ARROWS: Readonly<Record<string, Position>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** How "Ajustar à tela" (and the first view) fits the blocks. */
const FIT_VIEW = { padding: 0.2, maxZoom: 1 };

/** A node inside a group stays in the group's content area while it is dragged. */
const INSIDE_GROUP: [[number, number], [number, number]] = [
  [GROUP_CONTENT.x, GROUP_CONTENT.y],
  [Infinity, Infinity],
];

const NO_PICK: ReadonlySet<string> = new Set();

export interface WorkflowCanvasProps {
  /**
   * Enter on a block (or on a bar): its properties should take the focus. Called after the item is selected. Without it,
   * the focus goes to the first field of the editor's Propriedades panel, when there is one.
   */
  onOpenProperties?: (item: EditorItem) => void;
}

/**
 * The workflow canvas (React Flow; estilos.md §8, §11 and §15): the Calculation, Decision Table and Fonte blocks and the
 * groups (E5-19), with groups inside groups, the Entradas and Saída bars and the links derived from the analysis
 * (`symbols`, `dependencies` and the `groups` of the analysis, never drawn by hand); the floating toolbar that includes
 * blocks and groups them; the zoom and, from 1281px of module width up, the minimap.
 * Moving a node saves its `position`; Delete removes it after the confirmation that says how many blocks use its output.
 * Shift + clique, Shift + Espaço and the lasso (Shift + arrastar no fundo) pick the blocks to group; the menu of each
 * node ("Mais ações", the right click or Shift + F10) groups, ungroups and moves a block into or out of a group (never by
 * dragging, E5-19). Keyboard: Tab goes through the nodes, the arrows move, Enter opens the properties and Esc clears the
 * selection. Read-only: no toolbar, no menu, no moving and no removing. The selection is the editor's
 * (`useDraftEditor`), shared with the layers and the properties. Needs the `DraftEditorProvider` and `FluxoRoot`.
 */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function flowId(item: EditorItem): string | null {
  if (item.type === 'node') return item.id;
  if (item.type === 'inputs') return INPUTS_ID;
  if (item.type === 'output') return OUTPUT_ID;
  return null;
}

function itemOf(id: string): EditorItem {
  if (id === INPUTS_ID) return { type: 'inputs' };
  if (id === OUTPUT_ID) return { type: 'output' };
  return { type: 'node', id };
}

function isBar(id: string): boolean {
  return id === INPUTS_ID || id === OUTPUT_ID;
}

/** The first element the keyboard reaches inside the editor's Propriedades panel. */
function focusProperties(from: HTMLElement | null) {
  const panel = from?.closest('.fc-editor')?.querySelector<HTMLElement>('.fc-editor-properties');
  const target = panel?.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  target?.focus();
}

type CanvasGraphInput = Parameters<typeof canvasGraph>;

/**
 * The canvas graph, keeping the same objects for what did not change since the previous one (see `canvasGraph`), so
 * the node of an untouched block keeps its identity and `memo` skips drawing it again.
 */
function useStableGraph(
  definition: CanvasGraphInput[0],
  symbols: CanvasGraphInput[1],
  dependencies: CanvasGraphInput[2],
  interfaces: CanvasGraphInput[4],
): CanvasGraph {
  const previous = useRef<CanvasGraph | null>(null);
  const graph = useMemo(
    () => canvasGraph(definition, symbols, dependencies, previous.current, interfaces),
    [definition, symbols, dependencies, interfaces],
  );
  // Remembered after the commit, so building the graph has no side effect.
  useEffect(() => {
    previous.current = graph;
  }, [graph]);
  return graph;
}

/** Where a node is drawn by React Flow: inside a group, from the group's corner (its content area starts further in). */
function flowPosition(position: Position, parent: string | null): Position {
  return parent === null ? position : { x: GROUP_CONTENT.x + position.x, y: GROUP_CONTENT.y + position.y };
}

/** Back from React Flow: the `position` of the definition. */
function definitionPosition(position: Position, parent: string | undefined): Position {
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  return parent ? { x: x - GROUP_CONTENT.x, y: y - GROUP_CONTENT.y } : { x, y };
}

function Canvas({ onOpenProperties }: WorkflowCanvasProps) {
  const { definition, symbols, dependencies, groups, selection, select, change, readOnly } = useDraftEditor();
  const counts = useProblemCounts();
  const flow = useReactFlow();
  const frame = useRef<HTMLDivElement>(null);
  const compact = usePanelWidths(frame) === 'narrow';
  const [measured, setMeasured] = useState<ReadonlyMap<string, Size>>(() => new Map());
  const [dragged, setDragged] = useState<ReadonlyMap<string, Position>>(() => new Map());
  const [announcement, setAnnouncement] = useAnnouncement();
  const [openProperties, setOpenProperties] = useState(0);
  // The blocks picked to group (Shift + clique, Shift + Espaço, the lasso). Only the canvas has it: the editor's selection
  // stays one item.
  const [pickedIds, setPickedIds] = useState<ReadonlySet<string>>(NO_PICK);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  // The selection came from the canvas itself (no need to bring the block into view).
  const selectedHere = useRef(false);
  const lasso = useRef<Set<string> | null>(null);
  const nodeCache = useRef<KeptObjects<CanvasNode>>(new Map());
  const edgeCache = useRef<KeptObjects<Edge>>(new Map());

  const graph = useStableGraph(definition, symbols, dependencies, groups);
  const selectedId = flowId(selection.item);
  // A picked block removed since (Ctrl Z, Delete) is no longer picked; read-only picks nothing.
  const picked = useMemo(() => {
    if (readOnly || pickedIds.size === 0) return NO_PICK;
    const present = new Set(graph.order);
    const kept = [...pickedIds].filter((id) => present.has(id));
    return kept.length === pickedIds.size ? pickedIds : new Set(kept);
  }, [pickedIds, graph.order, readOnly]);

  // The size of each group: what is inside it, measured (or the size of a block, before the canvas measures it).
  const sizes = useMemo(() => {
    const rows = new Map(graph.groups.map((view) => [view.group.id, { inputs: view.inputs.length, outputs: view.outputs.length }]));
    return groupSizes(definition.root.nodes, (group) => rows.get(group.id) ?? { inputs: 0, outputs: group.outputs.length }, (id) =>
      measured.get(id),
    );
  }, [definition, graph.groups, measured]);

  // The latest state, read by the handlers and the menu, so they keep their identity while it changes.
  const latest = useRef({ definition, dependencies, picked, selection: selection.item });
  latest.current = { definition, dependencies, picked, selection: selection.item };

  const choose = useCallback(
    (item: EditorItem) => {
      if (sameItem(item, latest.current.selection)) return;
      selectedHere.current = true;
      select(item);
    },
    [select],
  );

  const toggleCollapsed = useCallback(
    (id: string, collapsed: boolean) => {
      const group = findGroup(latest.current.definition, id);
      if (!group) return;
      change((current) => setCollapsed(current, id, collapsed));
      setAnnouncement(collapsedText(group.name || group.id, collapsed));
    },
    [change, setAnnouncement],
  );

  const builtNodes = useMemo<CanvasNode[]>(() => {
    const cache = nodeCache.current;
    const cached = (id: string, parts: readonly unknown[], make: () => CanvasNode) => keep(cache, id, parts, make);
    const draggable = !readOnly;
    const inputsProblems = counts.inputs;
    const outputProblems = counts.output;
    const { x: ix, y: iy } = graph.inputsPosition;
    const { x: ox, y: oy } = graph.outputPosition;
    const inputs = cached(INPUTS_ID, [graph.inputs, inputsProblems, selectedId === INPUTS_ID, measured.get(INPUTS_ID), ix, iy], () => ({
      id: INPUTS_ID,
      type: 'inputs',
      position: { x: ix, y: iy },
      data: { rows: graph.inputs, problems: inputsProblems },
      selected: selectedId === INPUTS_ID,
      selectable: false,
      measured: measured.get(INPUTS_ID),
      draggable: false,
      deletable: false,
      ariaLabel: 'Entradas',
      domAttributes: { 'aria-current': selectedId === INPUTS_ID ? 'true' : undefined },
    }));
    const blockViews = new Map(graph.blocks.map((view) => [view.block.id, view]));
    const groupViews = new Map(graph.groups.map((view) => [view.group.id, view]));
    const toggle = readOnly ? null : toggleCollapsed;
    const menu = readOnly ? undefined : NodeMenu;
    // The DOM order is the Tab order: Entradas, the nodes in the order of the tree (a group before what is inside it), Saída.
    const nodes = graph.order.map((id): CanvasNode => {
      const problems = counts.byNode.get(id) ?? 0;
      const selected = selectedId === id || picked.has(id);
      const own = selectedId === id;
      const group = groupViews.get(id);
      if (group) {
        const size = sizes.get(id);
        const position = dragged.get(id) ?? flowPosition(group.group.position, group.parent);
        return cached(id, [group, problems, selected, own, size, position, draggable, toggle, menu], () => ({
          id,
          type: 'groupBox',
          position,
          parentId: group.parent ?? undefined,
          extent: group.parent ? INSIDE_GROUP : undefined,
          hidden: group.hidden,
          width: size?.width,
          height: size?.height,
          data: { view: group, problems, onToggle: toggle, toggleReason: READ_ONLY_REASON, menu },
          selected,
          measured: size,
          draggable,
          deletable: false,
          ariaLabel: groupLabel(group.group.name || id, group.blockCount, group.group.collapsed, problems),
          domAttributes: { 'aria-current': own ? 'true' : undefined },
        }));
      }
      const view = blockViews.get(id)!;
      const position = dragged.get(id) ?? flowPosition(view.block.position, view.parent);
      return cached(id, [view, problems, selected, own, measured.get(id), position, draggable], () => ({
        id,
        type: 'block',
        position,
        parentId: view.parent ?? undefined,
        extent: view.parent ? INSIDE_GROUP : undefined,
        hidden: view.hidden,
        data: { view, problems },
        selected,
        measured: measured.get(id),
        draggable,
        deletable: false,
        ariaLabel: blockLabel(view.block.name, view.block, problems),
        domAttributes: { 'aria-current': own ? 'true' : undefined },
      }));
    });
    const output = cached(OUTPUT_ID, [graph.output, outputProblems, selectedId === OUTPUT_ID, measured.get(OUTPUT_ID), ox, oy], () => ({
      id: OUTPUT_ID,
      type: 'output',
      position: { x: ox, y: oy },
      data: { rows: graph.output, problems: outputProblems },
      selected: selectedId === OUTPUT_ID,
      selectable: false,
      measured: measured.get(OUTPUT_ID),
      draggable: false,
      deletable: false,
      ariaLabel: 'Saída',
      domAttributes: { 'aria-current': selectedId === OUTPUT_ID ? 'true' : undefined },
    }));
    return [inputs, ...nodes, output];
  }, [graph, counts, selectedId, picked, measured, dragged, readOnly, sizes, toggleCollapsed]);
  const nodes = useStableList(nodeCache.current, builtNodes);

  const builtEdges = useMemo<Edge[]>(() => {
    const names = new Map<string, string>([
      [INPUTS_ID, 'Entradas'],
      [OUTPUT_ID, 'Saída'],
    ]);
    for (const view of graph.blocks) names.set(view.block.id, view.block.name || view.block.id);
    for (const view of graph.groups) names.set(view.group.id, view.group.name || view.group.id);
    // The bars of a group, seen from inside it: "Input de Pontuação", "Output de Pontuação".
    const end = (id: string, handle: string) => {
      const name = names.get(id) ?? id;
      if (handle.startsWith('inner-in:')) return `Input de ${name}`;
      if (handle.startsWith('inner-out:')) return `Output de ${name}`;
      return name;
    };
    const cache = edgeCache.current;
    return graph.links.map((link) => {
      const active = selectedId !== null && (link.source === selectedId || link.target === selectedId);
      const source = end(link.source, link.sourceHandle);
      const target = end(link.target, link.targetHandle);
      return keep(cache, link.id, [link, active, source, target], () => ({
        id: link.id,
        source: link.source,
        sourceHandle: link.sourceHandle,
        target: link.target,
        targetHandle: link.targetHandle,
        className: active ? 'fc-canvas-link fc-canvas-link-active' : 'fc-canvas-link',
        selectable: false,
        focusable: false,
        deletable: false,
        interactionWidth: 0,
        zIndex: active ? 1 : 0,
        ariaLabel: linkLabel(link.name, source, target),
      }));
    });
  }, [graph.blocks, graph.groups, graph.links, selectedId]);
  const edges = useStableList(edgeCache.current, builtEdges);

  const nodeElement = (id: string) => frame.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`) ?? null;

  /** Shift + clique or Shift + Espaço: the node joins the blocks picked to group, or leaves them. */
  const togglePick = useCallback(
    (id: string) => {
      const current = latest.current;
      const next = new Set(current.picked);
      // The block selected before the first Shift + clique is picked too: two Shift + cliques are not needed for two.
      if (next.size === 0 && current.selection.type === 'node' && current.selection.id !== id) next.add(current.selection.id);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        choose(itemOf(id));
      }
      setPickedIds(next);
      setAnnouncement(pickedText(next.size));
    },
    [choose, setAnnouncement],
  );

  const onNodeClick = useCallback(
    (event: MouseEvent, node: CanvasNode) => {
      if (event.shiftKey && !readOnly && !isBar(node.id)) {
        togglePick(node.id);
        return;
      }
      if (latest.current.picked.size > 0) setPickedIds(NO_PICK);
      choose(itemOf(node.id));
    },
    [choose, togglePick, readOnly],
  );
  const onPaneClick = useCallback(() => {
    if (latest.current.picked.size > 0) setPickedIds(NO_PICK);
    choose(WORKFLOW_ITEM);
  }, [choose]);

  const removal = useBlockRemoval({
    announce: setAnnouncement,
    focusAfterRemoval: (neighbour) => (neighbour === null ? null : nodeElement(neighbour)) ?? frame.current,
    focusOnCancel: (id) => nodeElement(id) ?? frame.current,
  });
  const keysHelp = readOnly ? BLOCK_KEYS_HELP_READ_ONLY : BLOCK_KEYS_HELP;
  const ariaLabelConfig = useMemo(
    () => ({
      'node.a11yDescription.default': keysHelp,
      'node.a11yDescription.keyboardDisabled': keysHelp,
      'node.a11yDescription.ariaLiveMessage': () => '',
      'edge.a11yDescription.default': 'As ligações vêm da análise do rascunho: mostram o que cada bloco lê.',
      'minimap.ariaLabel': 'Minimapa',
      'handle.ariaLabel': 'Porta',
    }),
    [keysHelp],
  );

  // Selected somewhere else (the layers, the Problems tab): bring the block into view when it is out of it.
  useEffect(() => {
    if (selectedHere.current) {
      selectedHere.current = false;
      return;
    }
    if (selection.item.type !== 'node') return;
    const node = flow.getInternalNode(selection.item.id);
    const box = frame.current?.getBoundingClientRect();
    if (!node || !box || box.width === 0 || box.height === 0) return;
    const { x, y, zoom } = flow.getViewport();
    const width = node.measured.width ?? 0;
    const height = node.measured.height ?? 0;
    const { x: nodeX, y: nodeY } = node.internals.positionAbsolute;
    const left = nodeX * zoom + x;
    const top = nodeY * zoom + y;
    const inside = left >= 0 && top >= 0 && left + width * zoom <= box.width && top + height * zoom <= box.height;
    if (!inside) void flow.setCenter(nodeX + width / 2, nodeY + height / 2, { zoom });
  }, [selection.item, flow]);

  // Enter opened the properties: after the selection reached the panels. Only when Enter asks (the counter changes),
  // never on a selection change alone.
  const openedProperties = useRef(0);
  useEffect(() => {
    if (openProperties === openedProperties.current) return;
    openedProperties.current = openProperties;
    if (onOpenProperties) onOpenProperties(selection.item);
    else focusProperties(frame.current);
  }, [openProperties, onOpenProperties, selection.item]);

  const onNodesChange: OnNodesChange<CanvasNode> = useCallback(
    (changes) => {
      const sizesSeen = new Map<string, Size>();
      const moves = new Map<string, Position>();
      let lassoChanged = false;
      for (const item of changes) {
        if (item.type === 'dimensions' && item.dimensions) sizesSeen.set(item.id, item.dimensions);
        else if (item.type === 'position' && item.position && item.dragging) moves.set(item.id, item.position);
        else if (item.type === 'select' && lasso.current && !isBar(item.id)) {
          // The lasso (Shift + arrastar no fundo) picks what it covers; React Flow's own selection is not the editor's.
          if (item.selected) lasso.current.add(item.id);
          else lasso.current.delete(item.id);
          lassoChanged = true;
        }
      }
      if (sizesSeen.size > 0) {
        setMeasured((current) => {
          let next: Map<string, Size> | null = null;
          for (const [id, size] of sizesSeen) {
            const known = current.get(id);
            if (known && known.width === size.width && known.height === size.height) continue;
            next ??= new Map(current);
            next.set(id, { width: size.width, height: size.height });
          }
          return next ?? current;
        });
      }
      if (moves.size > 0) setDragged((current) => new Map([...current, ...moves]));
      if (lassoChanged && lasso.current && !readOnly) setPickedIds(new Set(lasso.current));
    },
    [readOnly],
  );

  const onSelectionStart = useCallback(() => {
    lasso.current = new Set();
  }, []);
  const onSelectionEnd = useCallback(() => {
    const found = lasso.current;
    lasso.current = null;
    if (!found || readOnly) return;
    setPickedIds(new Set(found));
    setAnnouncement(pickedText(found.size));
  }, [readOnly, setAnnouncement]);

  const onNodeDragStart: OnNodeDrag<CanvasNode> = useCallback(
    (_, node) => {
      // Dragging one of the picked blocks moves them all (React Flow moves the selected ones together).
      if (!latest.current.picked.has(node.id)) choose(itemOf(node.id));
    },
    [choose],
  );

  /** A drag ended: the `position` of each node moved goes to the draft (inside a group, from its content area). */
  const saveDragged = useCallback(
    (movedNodes: readonly CanvasNode[]) => {
      const positions = new Map<string, Position>();
      for (const node of movedNodes) {
        if (node.type === 'block' || node.type === 'groupBox') positions.set(node.id, definitionPosition(node.position, node.parentId));
      }
      change((current) => moveBlocks(current, positions));
      setDragged(new Map());
    },
    [change],
  );
  const onNodeDragStop: OnNodeDrag<CanvasNode> = useCallback((_, __, movedNodes) => saveDragged(movedNodes), [saveDragged]);
  const onSelectionDragStop = useCallback((_: unknown, movedNodes: CanvasNode[]) => saveDragged(movedNodes), [saveDragged]);

  const moveByKeyboard = (id: string, direction: Position, factor: number) => {
    const entry = findEntry(definition, id);
    if (!entry) return;
    let moved: { name: string; position: Position } | null = null;
    // From the latest definition (presses faster than the screen still add up). Presses in a row (less than 1 s apart)
    // become one undo step.
    change(
      (current) => {
        const node = findNode(current, id);
        if (!node) return current;
        const position = {
          x: node.position.x + direction.x * ARROW_STEP * factor,
          y: node.position.y + direction.y * ARROW_STEP * factor,
        };
        const next = moveBlocks(current, new Map([[id, position]]));
        moved = { name: node.name, position: findNode(next, id)?.position ?? position };
        return next;
      },
      { mergeKey: `${entry.path}.position` },
    );
    const done = moved as { name: string; position: Position } | null;
    if (done) setAnnouncement(movedText(done.name, done.position.x, done.position.y));
  };

  // The group actions: one undo step each, announced, and the selection on what was made.
  const groupThese = useCallback(
    (ids: readonly string[]) => {
      let made: GroupNode | null = null;
      change((current) => {
        const grouped = groupNodes(current, ids, latest.current.dependencies);
        if (!grouped) return current;
        made = grouped.group;
        return grouped.definition;
      });
      const group = made as GroupNode | null;
      if (!group) return;
      setPickedIds(NO_PICK);
      choose({ type: 'node', id: group.id });
      setAnnouncement(groupedText(group.name, group.nodes.length));
    },
    [change, choose, setAnnouncement],
  );

  const ungroupThis = useCallback(
    (id: string) => {
      const group = findGroup(latest.current.definition, id);
      if (!group) return;
      change((current) => ungroup(current, id));
      setPickedIds(NO_PICK);
      choose(WORKFLOW_ITEM);
      setAnnouncement(ungroupedText(group.name || id));
    },
    [change, choose, setAnnouncement],
  );

  const takeOut = useCallback(
    (id: string) => {
      const entry = findEntry(latest.current.definition, id);
      const holder = entry?.parent ? findGroup(latest.current.definition, entry.parent) : undefined;
      if (!entry || !holder) return;
      change((current) => takeOutOfGroup(current, id));
      setAnnouncement(takenOutText(entry.node.name || id, holder.name || holder.id));
    },
    [change, setAnnouncement],
  );

  const moveInto = (id: string, groupId: string) => {
    const node = findNode(definition, id);
    const target = findGroup(definition, groupId);
    setMoving(null);
    if (!node || !target) return;
    change((current) => moveToGroup(current, id, groupId));
    setAnnouncement(movedToGroupText(node.name || id, target.name || groupId));
  };

  /** The blocks Agrupar takes: the picked ones, or the selected node. */
  const toGroup = picked.size > 0 ? [...picked] : selection.item.type === 'node' ? [selection.item.id] : [];

  const itemsFor = useCallback(
    (id: string): MenuItem[] => {
      const current = latest.current.definition;
      const entry = findEntry(current, id);
      if (!entry) return [];
      const ids = latest.current.picked.has(id) ? [...latest.current.picked] : [id];
      const items: MenuItem[] = [];
      if (isGroup(entry.node)) {
        const { collapsed } = entry.node;
        items.push({ label: collapsed ? EXPAND_ACTION : COLLAPSE_ACTION, onSelect: () => toggleCollapsed(id, !collapsed) });
      }
      items.push({ label: GROUP_ACTION, onSelect: () => groupThese(ids), disabledReason: groupReason(current, ids) ?? undefined });
      if (isGroup(entry.node)) items.push({ label: UNGROUP_ACTION, onSelect: () => ungroupThis(id) });
      items.push({
        label: MOVE_TO_GROUP_ACTION,
        onSelect: () => setMoving(id),
        disabledReason: moveTargets(current, id).length > 0 ? undefined : NO_TARGET_GROUP_REASON,
      });
      items.push({ label: TAKE_OUT_OF_GROUP_ACTION, onSelect: () => takeOut(id), disabledReason: entry.parent ? undefined : NOT_IN_GROUP_REASON });
      return items;
    },
    [groupThese, ungroupThis, takeOut, toggleCollapsed],
  );
  const menuState = useMemo<NodeMenuState | null>(
    () => (readOnly ? null : { openId: menuFor, setOpenId: setMenuFor, itemsFor }),
    [readOnly, menuFor, itemsFor],
  );

  const onNodeContextMenu = useCallback(
    (event: MouseEvent, node: CanvasNode) => {
      if (readOnly || isBar(node.id)) return;
      event.preventDefault();
      choose(itemOf(node.id));
      setMenuFor(node.id);
    },
    [readOnly, choose],
  );

  // React Flow's own keys on a node (Enter and Space select, the arrows move what it selected, Esc) give way to the
  // editor's: the selection is the editor's and every move is a change of the draft.
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('react-flow__node')) return;
    const id = target.dataset.id;
    if (!id) return;
    const isNode = !isBar(id);
    const arrow = ARROWS[event.key];
    const handled = (() => {
      if (event.key === ' ' && event.shiftKey) {
        if (isNode && !readOnly) togglePick(id);
        return true;
      }
      if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
        if (isNode && !readOnly) {
          choose(itemOf(id));
          setMenuFor(id);
        }
        return true;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        choose(itemOf(id));
        if (event.key === 'Enter') setOpenProperties((count) => count + 1);
        return true;
      }
      if (event.key === 'Escape') {
        if (picked.size > 0) setPickedIds(NO_PICK);
        choose(WORKFLOW_ITEM);
        return true;
      }
      if (arrow) {
        if (isNode && !readOnly) {
          choose(itemOf(id));
          moveByKeyboard(id, arrow, event.shiftKey ? 4 : 1);
        }
        return true;
      }
      if (event.key === 'Delete' && isNode && !readOnly) {
        choose(itemOf(id));
        removal.ask(id);
        return true;
      }
      return false;
    })();
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const addAtCenter = (kind: NewBlockKind) => {
    const box = frame.current?.getBoundingClientRect();
    const center = flow.screenToFlowPosition({ x: (box?.left ?? 0) + (box?.width ?? 0) / 2, y: (box?.top ?? 0) + (box?.height ?? 0) / 2 });
    let added: Block | null = null;
    // The id, the output name and the place come from the latest definition (two includes faster than the screen
    // still get different names and places).
    change((current) => {
      const block = newBlock(current, kind, freePosition(current, center));
      added = block;
      return addBlock(current, block);
    });
    const block = added as Block | null;
    if (!block) return;
    choose({ type: 'node', id: block.id });
    setAnnouncement(blockAddedText(block.name));
  };

  const movingNode = moving === null || readOnly ? undefined : findNode(definition, moving);
  // The node went away (Ctrl Z) or the editor became read-only while the dialog was open: it closes for good.
  if (moving !== null && !movingNode) setMoving(null);
  if (menuFor !== null && (readOnly || !findNode(definition, menuFor))) setMenuFor(null);

  return (
    <NodeMenuContext.Provider value={menuState}>
      <div ref={frame} className="fc-canvas" tabIndex={-1} onKeyDownCapture={onKeyDownCapture}>
        <ReactFlow<CanvasNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onSelectionDragStop={onSelectionDragStop}
          onSelectionStart={onSelectionStart}
          onSelectionEnd={onSelectionEnd}
          onPaneClick={onPaneClick}
          nodesDraggable={!readOnly}
          nodesConnectable={false}
          nodesFocusable
          edgesFocusable={false}
          edgesReconnectable={false}
          // Only for the lasso (Shift + arrastar no fundo): the selection of each node is the canvas's own (`selected`).
          elementsSelectable={!readOnly}
          selectNodesOnDrag={false}
          deleteKeyCode={null}
          selectionKeyCode={readOnly ? null : 'Shift'}
          multiSelectionKeyCode={null}
          zoomActivationKeyCode={null}
          panActivationKeyCode={null}
          zoomOnDoubleClick={false}
          fitView
          fitViewOptions={FIT_VIEW}
          minZoom={0.25}
          maxZoom={2}
          ariaLabelConfig={ariaLabelConfig}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--fc-gray-500)" />
          <Panel position="top-right" className="fc-canvas-view">
            <div className="fc-canvas-zoom" role="group" aria-label="Zoom">
              <Button variant="ghost" size="small" iconOnly label="Diminuir zoom" icon={<ZoomOutIcon size={14} />} onClick={() => void flow.zoomOut()} />
              <Button variant="ghost" size="small" iconOnly label="Aumentar zoom" icon={<ZoomInIcon size={14} />} onClick={() => void flow.zoomIn()} />
              <Button
                variant="ghost"
                size="small"
                iconOnly
                label="Ajustar à tela"
                icon={<FitIcon size={14} />}
                onClick={() => void flow.fitView(FIT_VIEW)}
              />
            </div>
          </Panel>
          {compact ? null : (
            <MiniMap
              position="top-right"
              className="fc-canvas-minimap"
              ariaLabel="Minimapa"
              pannable
              zoomable
              nodeBorderRadius={2}
            />
          )}
          {graph.order.length === 0 ? (
            <Panel position="top-center" className="fc-canvas-empty">
              <EmptyState
                icon={<BlocksIcon />}
                title={readOnly ? 'Nenhum bloco neste rascunho' : 'Nenhum bloco ainda'}
                description={readOnly ? undefined : 'Inclua um Cálculo ou uma Tabela de Decisão pela barra de ferramentas.'}
              />
            </Panel>
          ) : null}
          {readOnly ? null : (
            <Panel position="bottom-center" className="fc-canvas-toolbar-panel">
              <CanvasToolbar
                onAdd={addAtCenter}
                compact={compact}
                onGroup={() => groupThese(toGroup)}
                groupReason={groupReason(definition, toGroup) ?? undefined}
              />
            </Panel>
          )}
        </ReactFlow>
        <div className="fc-canvas-visually-hidden" role="status" aria-live="polite">
          {announcement}
        </div>
        {removal.dialog}
        {movingNode ? (
          <MoveToGroupDialog
            name={movingNode.name || movingNode.id}
            targets={moveTargets(definition, movingNode.id)}
            onMove={(groupId) => moveInto(movingNode.id, groupId)}
            onClose={() => setMoving(null)}
            focusOnClose={() => nodeElement(movingNode.id) ?? frame.current}
          />
        ) : null}
      </div>
    </NodeMenuContext.Provider>
  );
}
