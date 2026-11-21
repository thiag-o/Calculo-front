// The group on the canvas (estilos.md §8, E5-19): a container with the header (category square, name, how many blocks,
// recolher e expandir and the menu) and two bars, the Input (derived by the analysis) on the left and the Output on the
// right. Every link that enters or leaves the group goes through the bars: each name has a port outside the group and
// one inside it. The nodes inside are React Flow children of this node; a collapsed group shows only the bars.
import { Handle, Position as Side, type Node, type NodeProps } from '@xyflow/react';
import { memo, type ComponentType } from 'react';
import { Button, Tooltip, textClasses } from '../../design-system';
import { AlertIcon, ChevronDownIcon, ChevronRightIcon, DerivedIcon } from './icons';
import { COLLAPSE_ACTION, DERIVED_INPUT_TEXT, EXPAND_ACTION, blockCountText, groupProblemsText } from './messages';
import type { GroupNode } from './tree';
import './groups.css';

/** A port of a group bar: the handle outside the group and the one inside it, for the same name. */
export interface GroupBoxPort {
  handle: string;
  inner: string;
  label: string;
  type: string | null;
}

export interface GroupBoxView {
  group: GroupNode;
  inputs: GroupBoxPort[];
  outputs: GroupBoxPort[];
  blockCount: number;
}

export interface GroupBoxData extends Record<string, unknown> {
  view: GroupBoxView;
  problems: number;
  /** Recolher e expandir (saved in the draft). Without it (read-only), the button says why it cannot. */
  onToggle: ((id: string, collapsed: boolean) => void) | null;
  /** Why the group cannot be collapsed or expanded (read-only). */
  toggleReason?: string;
  /** The menu of the node ("Mais ações"), drawn by the canvas. */
  menu?: ComponentType<{ id: string; name: string }>;
}

export type GroupBoxNodeType = Node<GroupBoxData, 'groupBox'>;

function BarRow({ port, side }: { port: GroupBoxPort; side: 'input' | 'output' }) {
  // The Input takes each name from outside (left) and hands it on inside (right); the Output takes it inside (left) and
  // hands it on outside (right). Links are derived from the analysis, never drawn by hand: the handles only anchor them.
  const left = side === 'input' ? port.handle : port.inner;
  const right = side === 'input' ? port.inner : port.handle;
  return (
    <li className="fc-group-port">
      <Handle type="target" position={Side.Left} id={left} isConnectable={false} className="fc-group-port-dot" aria-hidden="true" />
      <span className={`fc-group-port-name ${textClasses({ variant: 'mono-12' })}`}>{port.label}</span>
      {port.type ? <span className={`fc-group-port-type ${textClasses({ variant: 'mono-12', emphasis: 'tertiary' })}`}>{port.type}</span> : null}
      <Handle type="source" position={Side.Right} id={right} isConnectable={false} className="fc-group-port-dot" aria-hidden="true" />
    </li>
  );
}

function Bar({ side, ports }: { side: 'input' | 'output'; ports: GroupBoxPort[] }) {
  const title = side === 'input' ? 'Input' : 'Output';
  return (
    <div className="fc-group-bar" data-bar={side}>
      <div className={`fc-group-bar-title ${textClasses({ variant: 'label-12', medium: true })}`}>
        <span>{title}</span>
        {side === 'input' ? (
          <Tooltip content={DERIVED_INPUT_TEXT}>
            <span className="fc-group-derived" role="img" aria-label={DERIVED_INPUT_TEXT}>
              <DerivedIcon size={12} />
            </span>
          </Tooltip>
        ) : null}
      </div>
      {ports.length > 0 ? (
        <ul className="fc-group-ports" aria-label={title}>
          {ports.map((port) => (
            <BarRow key={port.handle} port={port} side={side} />
          ))}
        </ul>
      ) : (
        <p className={`fc-group-bar-empty ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>
          {side === 'input' ? 'Nada de fora' : 'Nenhuma variável'}
        </p>
      )}
    </div>
  );
}

/** The group container: header, Input bar and Output bar; the nodes inside it are drawn by React Flow over it. */
export const GroupBoxNode = memo(function GroupBoxNode({ id, data, selected }: NodeProps<GroupBoxNodeType>) {
  const { group, inputs, outputs, blockCount } = data.view;
  const { collapsed } = group;
  const Menu = data.menu;
  const toggleLabel = collapsed ? EXPAND_ACTION : COLLAPSE_ACTION;
  return (
    <div className="fc-group" data-collapsed={collapsed ? 'true' : undefined} data-selected={selected ? 'true' : undefined}>
      <div className="fc-group-head">
        <span className="fc-group-category" aria-hidden="true" />
        <span className={`fc-group-name ${textClasses({ variant: 'mono-13', medium: true })}`}>{group.name || group.id}</span>
        <span className={`fc-group-count ${textClasses({ variant: 'label-12', emphasis: 'secondary' })}`}>{blockCountText(blockCount)}</span>
        {data.problems > 0 ? (
          <span className="fc-group-problems" role="img" aria-label={groupProblemsText(data.problems)}>
            <AlertIcon size={14} />
            <span aria-hidden="true">{data.problems.toLocaleString('pt-BR')}</span>
          </span>
        ) : null}
        <span className="fc-group-actions nodrag">
          <Button
            variant="ghost"
            size="small"
            iconOnly
            label={toggleLabel}
            icon={collapsed ? <ChevronRightIcon size={14} /> : <ChevronDownIcon size={14} />}
            aria-expanded={!collapsed}
            // The keyboard reaches the group itself (Tab passes through the nodes) and collapses it by its menu.
            tabIndex={-1}
            disabledReason={data.onToggle ? undefined : data.toggleReason}
            onClick={(event) => {
              event.stopPropagation();
              data.onToggle?.(id, !collapsed);
            }}
          />
          {Menu ? <Menu id={id} name={group.name || group.id} /> : null}
        </span>
      </div>
      <Bar side="input" ports={inputs} />
      <Bar side="output" ports={outputs} />
    </div>
  );
});
