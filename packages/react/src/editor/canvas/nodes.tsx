// The canvas nodes (estilos.md §8): the Calculation, Decision Table and Fonte blocks, the groups (editor/groups), and the
// Entradas and Saída bars.
import { Handle, Position as Side, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { textClasses } from '../../design-system';
import type { DraftSymbol } from '../draft';
import { GroupBoxNode, type GroupBoxNodeType } from '../groups';
import { BatchSourceBar, type BatchSource } from '../sources/batch-source';
import type { BlockView, InputRow, OutputRow, Port } from './graph';
import { AlertIcon } from './icons';
import { blockKindLabel, problemsText } from './messages';
import { NodeMenu } from './NodeMenu';
import { BlockRunValues } from './run-values/RunValues';
import type { NodeRunView } from './run-values/views';

export interface BlockData extends Record<string, unknown> {
  view: BlockView;
  problems: number;
  /** What the block gave in the last "Calcular", while the canvas shows it (E5-21). */
  run?: NodeRunView | null;
}

export interface InputsBarData extends Record<string, unknown> {
  rows: InputRow[];
  problems: number;
  /** The batch source of the workflow: its bar takes the place of the Entradas one (E5-17). */
  batchSource?: BatchSource | null;
  /** The symbols of the analysis, for the type of each variable the batch source brings. */
  symbols?: readonly DraftSymbol[];
}

export interface OutputBarData extends Record<string, unknown> {
  rows: OutputRow[];
  problems: number;
}

export type BlockNodeType = Node<BlockData, 'block'>;
export type InputsBarNodeType = Node<InputsBarData, 'inputs'>;
export type OutputBarNodeType = Node<OutputBarData, 'output'>;
export type CanvasNode = BlockNodeType | GroupBoxNodeType | InputsBarNodeType | OutputBarNodeType;

/** The red icon and the number of problems (estilos §8, "Erro de validação"). */
function ProblemMark({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="fc-canvas-problems" role="img" aria-label={problemsText(count)}>
      <AlertIcon size={14} />
      <span aria-hidden="true">{count.toLocaleString('pt-BR')}</span>
    </span>
  );
}

function PortRow({ port, side }: { port: Port; side: 'in' | 'out' }) {
  return (
    <li className="fc-canvas-port" data-side={side}>
      {/* Links are derived from the analysis, never drawn by hand: the handles only anchor them. */}
      <Handle
        type={side === 'in' ? 'target' : 'source'}
        position={side === 'in' ? Side.Left : Side.Right}
        id={port.handle}
        isConnectable={false}
        className="fc-canvas-port-dot"
        aria-hidden="true"
      />
      <span className={`fc-canvas-port-name ${textClasses({ variant: 'mono-12' })}`}>{port.label}</span>
      {port.type ? <span className={`fc-canvas-port-type ${textClasses({ variant: 'mono-12', emphasis: 'tertiary' })}`}>{port.type}</span> : null}
    </li>
  );
}

/**
 * A Calculation, a Decision Table or a Fonte: category square, name, type, problems, the menu, and the ports it reads and
 * produces. A Fonte's left ports are its links (the variables it looks the dataset up by) and its right ports, its outputs.
 * After a "Calcular", the status and the values of the last run come under the name (E5-21).
 */
export const BlockNode = memo(function BlockNode({ id, data, selected }: NodeProps<BlockNodeType>) {
  const { block, reads, outputs } = data.view;
  const isSource = block.type === 'source';
  return (
    <div
      className="fc-canvas-block"
      data-kind={block.type}
      data-selected={selected ? 'true' : undefined}
      data-run-status={data.run ? data.run.status : undefined}
    >
      <div className="fc-canvas-block-head">
        <span className="fc-canvas-category" data-kind={block.type} aria-hidden="true" />
        <span className={`fc-canvas-block-name ${textClasses({ variant: 'mono-13', medium: true })}`}>{block.name}</span>
        <span className="fc-canvas-block-kind">{blockKindLabel(block)}</span>
        <ProblemMark count={data.problems} />
        <NodeMenu id={id} name={block.name || block.id} />
      </div>
      {data.run ? <BlockRunValues name={block.name || block.id} run={data.run} /> : null}
      {reads.length > 0 ? (
        <ul className="fc-canvas-ports" aria-label={isSource ? 'Liga por' : 'Lê'}>
          {reads.map((port) => (
            <PortRow key={port.handle} port={port} side="in" />
          ))}
        </ul>
      ) : null}
      {outputs.length > 0 ? (
        <ul className="fc-canvas-ports" aria-label="Produz">
          {outputs.map((port) => (
            <PortRow key={port.handle} port={port} side="out" />
          ))}
        </ul>
      ) : null}
      {block.type === 'source' && block.mode === 'filter' ? (
        // A Fonte Filtro brings no variable: it only decides whether the record goes on.
        <p className={`fc-canvas-bar-empty ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
          {block.exists === false ? 'Só registros sem linha (NÃO EXISTE)' : 'Só registros com linha (EXISTE)'}
        </p>
      ) : null}
    </div>
  );
});

/**
 * The Entradas bar, left of the blocks: the declared inputs, a multiple one with its fields. With a batch source it is the
 * Fonte do lote bar instead: the dataset and the variables it brings, the key ones with the key icon.
 */
export const InputsBarNode = memo(function InputsBarNode({ data, selected }: NodeProps<InputsBarNodeType>) {
  if (data.batchSource) {
    return (
      <BatchSourceBar
        source={data.batchSource}
        symbols={data.symbols ?? []}
        selected={selected}
        problems={<ProblemMark count={data.problems} />}
        renderHandle={(row) => (
          // The variable leaves through the same `var:<name>` handle a declared input has, so the links keep their ids.
          <Handle type="source" position={Side.Right} id={`var:${row.name}`} isConnectable={false} className="fc-canvas-port-dot" aria-hidden="true" />
        )}
      />
    );
  }
  return (
    <div className="fc-canvas-bar" data-bar="inputs" data-selected={selected ? 'true' : undefined}>
      <div className="fc-canvas-bar-head">
        <span className="fc-canvas-category" data-kind="inputs" aria-hidden="true" />
        <span className="fc-canvas-bar-title">Entradas</span>
        <ProblemMark count={data.problems} />
      </div>
      {data.rows.length > 0 ? (
        <ul className="fc-canvas-ports" aria-label="Entradas declaradas">
          {data.rows.map((row) => (
            <li key={row.handle} className="fc-canvas-port" data-side="out" data-row={row.kind}>
              <Handle type="source" position={Side.Right} id={row.handle} isConnectable={false} className="fc-canvas-port-dot" aria-hidden="true" />
              <span className={`fc-canvas-port-name ${textClasses({ variant: 'mono-12' })}`}>{row.label}</span>
              {row.type ? <span className={`fc-canvas-port-type ${textClasses({ variant: 'mono-12', emphasis: 'tertiary' })}`}>{row.type}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`fc-canvas-bar-empty ${textClasses({ variant: 'label-12', emphasis: 'tertiary' })}`}>Nenhuma entrada</p>
      )}
    </div>
  );
});

/** The Saída bar, right of the blocks: the output fields. */
export const OutputBarNode = memo(function OutputBarNode({ data, selected }: NodeProps<OutputBarNodeType>) {
  return (
    <div className="fc-canvas-bar" data-bar="output" data-selected={selected ? 'true' : undefined}>
      <div className="fc-canvas-bar-head">
        <span className="fc-canvas-category" data-kind="output" aria-hidden="true" />
        <span className="fc-canvas-bar-title">Saída</span>
        <ProblemMark count={data.problems} />
      </div>
      {data.rows.length > 0 ? (
        <ul className="fc-canvas-ports" aria-label="Campos de saída">
          {data.rows.map((row) => (
            <PortRow key={row.handle} port={row} side="in" />
          ))}
        </ul>
      ) : (
        <p className={`fc-canvas-bar-empty ${textClasses({ variant: 'label-12', emphasis: 'tertiary' })}`}>Nenhum campo</p>
      )}
    </div>
  );
});

export const NODE_TYPES = { block: BlockNode, groupBox: GroupBoxNode, inputs: InputsBarNode, output: OutputBarNode };
