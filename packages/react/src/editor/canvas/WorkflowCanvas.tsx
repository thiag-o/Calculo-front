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
import { Button, EmptyState } from '../../design-system';
import { WORKFLOW_ITEM, sameItem, useDraftEditor, type EditorItem } from '../draft';
import { usePanelWidths } from '../layout';
import { useProblemCounts } from '../problems';
import { addBlock, freePosition, moveBlocks, newBlock, type Position } from './blocks';
import { useBlockRemoval } from './BlockRemoval';
import { useAnnouncement } from './announcement';
import { keep, useStableList, type KeptObjects } from './keptObjects';
import { INPUTS_ID, OUTPUT_ID, canvasGraph, type Block, type BlockKind, type CanvasGraph } from './graph';
import { BlocksIcon, FitIcon, ZoomInIcon, ZoomOutIcon } from './icons';
import { BLOCK_KEYS_HELP, BLOCK_KEYS_HELP_READ_ONLY, blockAddedText, blockLabel, linkLabel, movedText } from './messages';
import { NODE_TYPES, type CanvasNode } from './nodes';
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

interface Size {
  width: number;
  height: number;
}

export interface WorkflowCanvasProps {
  /**
   * Enter on a block (or on a bar): its properties should take the focus. Called after the item is selected. Without it,
   * the focus goes to the first field of the editor's Propriedades panel, when there is one.
   */
  onOpenProperties?: (item: EditorItem) => void;
}

/**
 * The workflow canvas (React Flow; estilos.md §8, §11 and §15): the Calculation and Decision Table blocks of
 * `root.nodes`, the Entradas and Saída bars and the links derived from the analysis (`symbols` and `dependencies`, never
 * drawn by hand); the floating toolbar that includes blocks; the zoom and, from 1281px of module width up, the minimap.
 * Moving a block saves its `position`; Delete removes it after the confirmation that says how many blocks use its output.
 * Keyboard: Tab goes through the blocks, the arrows move, Enter opens the properties and Esc clears the selection.
 * Read-only: no toolbar, no moving and no removing. The selection is the editor's (`useDraftEditor`), shared with the
 * layers and the properties. Needs the `DraftEditorProvider` and `FluxoRoot`.
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
function useStableGraph(definition: CanvasGraphInput[0], symbols: CanvasGraphInput[1], dependencies: CanvasGraphInput[2]): CanvasGraph {
  const previous = useRef<CanvasGraph | null>(null);
  const graph = useMemo(() => canvasGraph(definition, symbols, dependencies, previous.current), [definition, symbols, dependencies]);
  // Remembered after the commit, so building the graph has no side effect.
  useEffect(() => {
    previous.current = graph;
  }, [graph]);
  return graph;
}

function Canvas({ onOpenProperties }: WorkflowCanvasProps) {
  const { definition, symbols, dependencies, selection, select, change, readOnly } = useDraftEditor();
  const counts = useProblemCounts();
  const flow = useReactFlow();
  const frame = useRef<HTMLDivElement>(null);
  const compact = usePanelWidths(frame) === 'narrow';
  const [measured, setMeasured] = useState<ReadonlyMap<string, Size>>(() => new Map());
  const [dragged, setDragged] = useState<ReadonlyMap<string, Position>>(() => new Map());
  const [announcement, setAnnouncement] = useAnnouncement();
  const [openProperties, setOpenProperties] = useState(0);
  // The selection came from the canvas itself (no need to bring the block into view).
  const selectedHere = useRef(false);
  const nodeCache = useRef<KeptObjects<CanvasNode>>(new Map());
  const edgeCache = useRef<KeptObjects<Edge>>(new Map());

  const graph = useStableGraph(definition, symbols, dependencies);
  const selectedId = flowId(selection.item);

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
      measured: measured.get(INPUTS_ID),
      draggable: false,
      deletable: false,
      ariaLabel: 'Entradas',
      domAttributes: { 'aria-current': selectedId === INPUTS_ID ? 'true' : undefined },
    }));
    const blocks = graph.blocks.map((view) => {
      const { block } = view;
      const problems = counts.byNode.get(block.id) ?? 0;
      const selected = selectedId === block.id;
      const position = dragged.get(block.id) ?? block.position;
      return cached(block.id, [view, problems, selected, measured.get(block.id), position, draggable], () => ({
        id: block.id,
        type: 'block',
        position,
        data: { view, problems },
        selected,
        measured: measured.get(block.id),
        draggable,
        deletable: false,
        ariaLabel: blockLabel(block.name, block.type, problems),
        domAttributes: { 'aria-current': selected ? 'true' : undefined },
      }));
    });
    const output = cached(OUTPUT_ID, [graph.output, outputProblems, selectedId === OUTPUT_ID, measured.get(OUTPUT_ID), ox, oy], () => ({
      id: OUTPUT_ID,
      type: 'output',
      position: { x: ox, y: oy },
      data: { rows: graph.output, problems: outputProblems },
      selected: selectedId === OUTPUT_ID,
      measured: measured.get(OUTPUT_ID),
      draggable: false,
      deletable: false,
      ariaLabel: 'Saída',
      domAttributes: { 'aria-current': selectedId === OUTPUT_ID ? 'true' : undefined },
    }));
    // The DOM order is the Tab order: Entradas, the blocks in the order of root.nodes, Saída.
    return [inputs, ...blocks, output];
  }, [graph, counts, selectedId, measured, dragged, readOnly]);
  const nodes = useStableList(nodeCache.current, builtNodes);

  const builtEdges = useMemo<Edge[]>(() => {
    const names = new Map<string, string>([
      [INPUTS_ID, 'Entradas'],
      [OUTPUT_ID, 'Saída'],
    ]);
    for (const view of graph.blocks) names.set(view.block.id, view.block.name || view.block.id);
    const cache = edgeCache.current;
    return graph.links.map((link) => {
      const active = selectedId !== null && (link.source === selectedId || link.target === selectedId);
      const source = names.get(link.source) ?? link.source;
      const target = names.get(link.target) ?? link.target;
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
  }, [graph.blocks, graph.links, selectedId]);
  const edges = useStableList(edgeCache.current, builtEdges);

  // The selection read by the handlers, so they keep their identity while it changes (React Flow gets them as props).
  const selected = useRef(selection.item);
  selected.current = selection.item;
  const choose = useCallback(
    (item: EditorItem) => {
      if (sameItem(item, selected.current)) return;
      selectedHere.current = true;
      select(item);
    },
    [select],
  );
  const onNodeClick = useCallback((_: MouseEvent, node: CanvasNode) => choose(itemOf(node.id)), [choose]);
  const onPaneClick = useCallback(() => choose(WORKFLOW_ITEM), [choose]);

  const nodeElement = (id: string) => frame.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`) ?? null;
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
    const left = node.position.x * zoom + x;
    const top = node.position.y * zoom + y;
    const inside = left >= 0 && top >= 0 && left + width * zoom <= box.width && top + height * zoom <= box.height;
    if (!inside) void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom });
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

  const onNodesChange: OnNodesChange<CanvasNode> = useCallback((changes) => {
    const sizes = new Map<string, Size>();
    const moves = new Map<string, Position>();
    for (const item of changes) {
      if (item.type === 'dimensions' && item.dimensions) sizes.set(item.id, item.dimensions);
      else if (item.type === 'position' && item.position && item.dragging) moves.set(item.id, item.position);
    }
    if (sizes.size > 0) {
      setMeasured((current) => {
        let next: Map<string, Size> | null = null;
        for (const [id, size] of sizes) {
          const known = current.get(id);
          if (known && known.width === size.width && known.height === size.height) continue;
          next ??= new Map(current);
          next.set(id, { width: size.width, height: size.height });
        }
        return next ?? current;
      });
    }
    if (moves.size > 0) setDragged((current) => new Map([...current, ...moves]));
  }, []);

  const onNodeDragStart: OnNodeDrag<CanvasNode> = useCallback((_, node) => choose(itemOf(node.id)), [choose]);

  const onNodeDragStop: OnNodeDrag<CanvasNode> = useCallback(
    (_, __, movedNodes) => {
      const positions = new Map<string, Position>();
      for (const node of movedNodes) {
        if (node.type === 'block') positions.set(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) });
      }
      change((current) => moveBlocks(current, positions));
      setDragged(new Map());
    },
    [change],
  );

  const moveByKeyboard = (id: string, direction: Position, factor: number) => {
    const index = definition.root.nodes.findIndex((node) => node.id === id);
    if (index < 0) return;
    let moved: { name: string; position: Position } | null = null;
    // From the latest definition (presses faster than the screen still add up). Presses in a row (less than 1 s apart)
    // become one undo step.
    change(
      (current) => {
        const block = current.root.nodes.find((node) => node.id === id);
        if (!block) return current;
        const position = {
          x: block.position.x + direction.x * ARROW_STEP * factor,
          y: block.position.y + direction.y * ARROW_STEP * factor,
        };
        moved = { name: block.name, position };
        return moveBlocks(current, new Map([[id, position]]));
      },
      { mergeKey: `root.nodes[${index}].position` },
    );
    const done = moved as { name: string; position: Position } | null;
    if (done) setAnnouncement(movedText(done.name, done.position.x, done.position.y));
  };

  // React Flow's own keys on a node (Enter and Space select, the arrows move what it selected, Esc) give way to the
  // editor's: the selection is the editor's and every move is a change of the draft.
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('react-flow__node')) return;
    const id = target.dataset.id;
    if (!id) return;
    const isBlock = id !== INPUTS_ID && id !== OUTPUT_ID;
    const arrow = ARROWS[event.key];
    const handled = (() => {
      if (event.key === 'Enter' || event.key === ' ') {
        choose(itemOf(id));
        if (event.key === 'Enter') setOpenProperties((count) => count + 1);
        return true;
      }
      if (event.key === 'Escape') {
        choose(WORKFLOW_ITEM);
        return true;
      }
      if (arrow) {
        if (isBlock && !readOnly) {
          choose(itemOf(id));
          moveByKeyboard(id, arrow, event.shiftKey ? 4 : 1);
        }
        return true;
      }
      if (event.key === 'Delete' && isBlock && !readOnly) {
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

  const addAtCenter = (kind: BlockKind) => {
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

  return (
    <div ref={frame} className="fc-canvas" tabIndex={-1} onKeyDownCapture={onKeyDownCapture}>
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        nodesFocusable
        edgesFocusable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        selectNodesOnDrag={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
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
        {graph.blocks.length === 0 ? (
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
            <CanvasToolbar onAdd={addAtCenter} compact={compact} />
          </Panel>
        )}
      </ReactFlow>
      <div className="fc-canvas-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
      {removal.dialog}
    </div>
  );
}
