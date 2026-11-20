// The canvas nodes (estilos.md §8): the Calculation and Decision Table blocks, and the Entradas and Saída bars.
import { Handle, Position as Side, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { textClasses } from '../../design-system';
import type { BlockView, InputRow, OutputRow, Port } from './graph';
import { AlertIcon } from './icons';
import { BLOCK_KIND_LABELS, problemsText } from './messages';

export interface BlockData extends Record<string, unknown> {
  view: BlockView;
  problems: number;
}

export interface InputsBarData extends Record<string, unknown> {
  rows: InputRow[];
  problems: number;
}

export interface OutputBarData extends Record<string, unknown> {
  rows: OutputRow[];
  problems: number;
}

export type BlockNodeType = Node<BlockData, 'block'>;
export type InputsBarNodeType = Node<InputsBarData, 'inputs'>;
export type OutputBarNodeType = Node<OutputBarData, 'output'>;
export type CanvasNode = BlockNodeType | InputsBarNodeType | OutputBarNodeType;

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

/** A Calculation or a Decision Table: category square, name, type, problems, and the ports it reads and produces. */
export const BlockNode = memo(function BlockNode({ data, selected }: NodeProps<BlockNodeType>) {
  const { block, reads, outputs } = data.view;
  return (
    <div className="fc-canvas-block" data-kind={block.type} data-selected={selected ? 'true' : undefined}>
      <div className="fc-canvas-block-head">
        <span className="fc-canvas-category" data-kind={block.type} aria-hidden="true" />
        <span className={`fc-canvas-block-name ${textClasses({ variant: 'mono-13', medium: true })}`}>{block.name}</span>
        <span className="fc-canvas-block-kind">{BLOCK_KIND_LABELS[block.type]}</span>
        <ProblemMark count={data.problems} />
      </div>
      {reads.length > 0 ? (
        <ul className="fc-canvas-ports" aria-label="Lê">
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
    </div>
  );
});

/** The Entradas bar, left of the blocks: the declared inputs, a multiple one with its fields. */
export const InputsBarNode = memo(function InputsBarNode({ data, selected }: NodeProps<InputsBarNodeType>) {
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

export const NODE_TYPES = { block: BlockNode, inputs: InputsBarNode, output: OutputBarNode };
