import { useMemo, useState } from 'react';
import type { Schemas } from '../../api';
import { Button, Status, Text, type StatusTone } from '../../design-system';
import type { DraftSymbol, WorkflowDefinition } from '../draft';
import { CopyIcon } from './icons';
import type { UnitRun } from './queries';
import { keyText } from './recordKey';
import { NO_VALUE } from '../values';
import { allNodes, formatValue, variableTypes } from '../values';
import type { DataType, Value } from './values';

/** The record status (estilos.md §7.5): dot + word. */
export const recordStatus: Record<UnitRun['status'], { tone: StatusTone; word: string }> = {
  ok: { tone: 'green', word: 'ok' },
  ok_with_warnings: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  ignored: { tone: 'gray', word: 'ignorado' },
  filtered: { tone: 'multi', word: 'filtrado' },
};

/** The block status, as the record's; a block that did not run is gray (estilos.md §7.5 and §8, "Debug"). */
const nodeStatus: Record<Schemas['NodeRunStatus'], { tone: StatusTone; word: string }> = {
  ok: { tone: 'green', word: 'ok' },
  warning: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  not_run: { tone: 'gray', word: 'não rodado' },
};

/** Why a record has no output fields, by its status. */
const NO_OUTPUTS: Record<UnitRun['status'], string> = {
  ok: 'O workflow não tem campos de saída.',
  ok_with_warnings: 'O workflow não tem campos de saída.',
  error: 'Sem saídas: o registro deu erro.',
  ignored: 'Sem saídas: o registro foi ignorado.',
  filtered: 'Sem saídas: o registro foi filtrado.',
};

/** The batch source in place of a block name (a message with `node_id` null). */
const BATCH_SOURCE_NAME = 'Fonte do lote';

type TraceNode = UnitRun['nodes'][number];
type TraceInput = Schemas['TraceInput'];
type TraceOrigin = Schemas['TraceOrigin'];
type TraceMessage = Schemas['TraceMessage'];

export interface UnitRunResultProps {
  run: UnitRun;
  /** The definition that ran (to name the blocks and to know each value's type). */
  definition: WorkflowDefinition;
  /** The symbols of the analysis when it ran: the types of the variables read from the catalog. */
  symbols?: readonly DraftSymbol[];
  /** The definition being edited: a block removed since the run can no longer be selected. */
  currentDefinition: WorkflowDefinition;
  /** Selects the block in the canvas. */
  onSelectNode: (nodeId: string) => void;
}

/** A hash shortened on screen (`sha256:77b0db21bf50…`); the whole one is copied. */
export function shortHash(hash: string): string {
  const separator = hash.indexOf(':');
  const algorithm = separator >= 0 ? hash.slice(0, separator + 1) : '';
  const digest = separator >= 0 ? hash.slice(separator + 1) : hash;
  return `${algorithm}${digest.length > 12 ? `${digest.slice(0, 12)}…` : digest}`;
}

/** Where a value came from: `ERP › Itens NF › vl_itm` (no connection in an Excel dataset). */
export function originPath(origin: TraceOrigin): string {
  return [origin.connection, origin.dataset, origin.column].filter((part): part is string => Boolean(part)).join(' › ');
}

type CopyState = { label: string; ok: boolean } | null;
type Copy = (text: string, label: string) => Promise<void>;

/**
 * The trace of "Calcular" (E4-14, E5-12): the record status (and its key, with a batch source), each input with its value
 * and origin, the blocks in the run order (nested by group) with values, "Regra N", rows found, warnings and error, and the
 * output fields with the hashes. Numbers in the Brazilian pattern; inputs and hashes can be copied.
 */
export function UnitRunResult({ run, definition, symbols, currentDefinition, onSelectNode }: UnitRunResultProps) {
  const types = useMemo(() => variableTypes(definition, symbols), [definition, symbols]);
  const outputTypes = useMemo(
    () => new Map(definition.root.output.fields.map((field) => [field.name, types.get(field.variable)])),
    [definition, types],
  );
  const names = useMemo(() => new Map(allNodes(definition).map((node) => [node.id, node.name])), [definition]);
  const current = useMemo(() => new Set(allNodes(currentDefinition).map((node) => node.id)), [currentDefinition]);
  const traced = useMemo(() => tracedIds(run.nodes), [run.nodes]);
  const status = recordStatus[run.status];
  const [copied, setCopied] = useState<CopyState>(null);

  const copy: Copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ label, ok: true });
    } catch {
      setCopied({ label, ok: false });
    }
  };

  // The record's error and warnings that no block of the list shows (the batch source, or a block not in the trace).
  const recordError = run.error && (run.error.node_id === null || !traced.has(run.error.node_id)) ? run.error : null;
  const recordWarnings = run.warnings.filter((warning) => warning.node_id === null || !traced.has(warning.node_id));
  const nameOf = (nodeId: string | null) => (nodeId === null ? BATCH_SOURCE_NAME : (names.get(nodeId) ?? nodeId));
  const context: NodeContext = { names, current, types, onSelectNode };

  return (
    <div className="fc-unit-run-result">
      <div className="fc-unit-run-result-head">
        <h3 className="fc-unit-run-title">Resultado</h3>
        <Status tone={status.tone}>{status.word}</Status>
        {run.record_key ? (
          <Text as="span" variant="label-13" emphasis="secondary" className="fc-unit-run-record">
            <span className="fc-visually-hidden">Registro </span>
            <span className="fc-unit-run-name">{keyText(run.record_key)}</span>
          </Text>
        ) : null}
      </div>

      {recordError ? <TraceMessageLine message={recordError} name={nameOf(recordError.node_id)} type="error" /> : null}
      {recordWarnings.length > 0 ? (
        <ul className="fc-unit-run-messages" aria-label="Avisos do registro">
          {recordWarnings.map((warning, index) => (
            <TraceMessageLine key={`${warning.code}:${index}`} as="li" message={warning} name={nameOf(warning.node_id)} type="warning" />
          ))}
        </ul>
      ) : null}

      {run.inputs.length > 0 ? (
        <section className="fc-unit-run-section" aria-label="Entradas">
          <h4 className="fc-unit-run-subtitle">Entradas</h4>
          <ul className="fc-unit-run-trace-inputs">
            {run.inputs.map((input, index) => (
              <InputLine key={`${input.variable}:${index}`} input={input} type={types.get(input.variable)} onCopy={copy} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="fc-unit-run-section" aria-label="Blocos">
        <h4 className="fc-unit-run-subtitle">Blocos</h4>
        {run.nodes.length > 0 ? (
          <NodeList nodes={run.nodes} context={context} />
        ) : (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
            {run.status === 'error' ? 'Nenhum bloco rodou.' : 'O workflow não tem blocos.'}
          </Text>
        )}
      </section>

      <section className="fc-unit-run-section" aria-label="Saídas">
        <h4 className="fc-unit-run-subtitle">Saídas</h4>
        {Object.keys(run.outputs).length > 0 ? (
          <ValueList values={run.outputs} typeOf={(name) => outputTypes.get(name)} />
        ) : (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
            {NO_OUTPUTS[run.status]}
          </Text>
        )}
        <dl className="fc-unit-run-hashes" aria-label="Hashes">
          <HashLine label="Hash das entradas" hash={run.input_hash} onCopy={copy} />
          <HashLine label="Hash da saída" hash={run.output_hash} onCopy={copy} />
        </dl>
      </section>

      {/* Not a `role=status`: the tab already has one, with the result of the run. */}
      <span className="fc-visually-hidden" aria-live="polite" aria-atomic="true">
        {copied ? (copied.ok ? `${copied.label} copiado` : `Não foi possível copiar ${copied.label}. Selecione o texto e copie com Ctrl C.`) : ''}
      </span>
    </div>
  );
}

/** The ids of every node in the trace, the ones inside groups too. */
function tracedIds(nodes: readonly TraceNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (list: readonly TraceNode[]) => {
    for (const node of list) {
      ids.add(node.node_id);
      if (node.type === 'group') visit(node.nodes);
    }
  };
  visit(nodes);
  return ids;
}

/** An input as copied: `valor_item = 1.500,00 · ERP › Itens NF › vl_itm · nf_id 10 · item_seq 1`. */
export function inputCopyText(variable: string, value: string, origin: string, rowKey: string | null): string {
  return `${variable} = ${value} · ${origin}${rowKey ? ` · ${rowKey}` : ''}`;
}

/** The origin of a declared input: the value was typed in "Calcular". */
const TYPED_ORIGIN = 'Digitado';

/** An input of the record: the variable, the value and where it came from, with a button that copies the line. */
function InputLine({ input, type, onCopy }: { input: TraceInput; type: DataType | undefined; onCopy: Copy }) {
  const value = formatValue(input.value, type);
  const origin = input.origin ? originPath(input.origin) : TYPED_ORIGIN;
  const rowKey = input.origin && Object.keys(input.origin.row_key).length > 0 ? keyText(input.origin.row_key) : null;
  return (
    <li className="fc-unit-run-trace-input">
      <div className="fc-unit-run-value">
        <span className="fc-unit-run-name fc-unit-run-trace-input-name">{input.variable}</span>
        <span className="fc-unit-run-trace-input-value">{value}</span>
      </div>
      <Text as="span" variant="label-12" emphasis="secondary" className="fc-unit-run-origin">
        <span className="fc-visually-hidden">Origem: </span>
        {origin}
        {rowKey ? (
          <>
            {' · '}
            <span className="fc-visually-hidden">chave da linha </span>
            <span className="fc-unit-run-name fc-unit-run-row-key">{rowKey}</span>
          </>
        ) : null}
      </Text>
      <Button
        iconOnly
        variant="ghost"
        size="small"
        icon={<CopyIcon size={14} />}
        label={`Copiar ${input.variable}`}
        className="fc-unit-run-copy"
        onClick={() => void onCopy(inputCopyText(input.variable, value, origin, rowKey), input.variable)}
      />
    </li>
  );
}

/** A hash, shortened, with a button that copies the whole of it. Null (no output): "—". */
function HashLine({ label, hash, onCopy }: { label: string; hash: string | null; onCopy: Copy }) {
  const lower = label.toLowerCase();
  return (
    <div className="fc-unit-run-value fc-unit-run-hash">
      <dt>{label}</dt>
      <dd>
        {hash ? (
          <>
            <span title={hash}>{shortHash(hash)}</span>
            <Button
              iconOnly
              variant="ghost"
              size="small"
              icon={<CopyIcon size={14} />}
              label={`Copiar ${lower}`}
              className="fc-unit-run-copy"
              onClick={() => void onCopy(hash, lower)}
            />
          </>
        ) : (
          NO_VALUE
        )}
      </dd>
    </div>
  );
}

interface ValueListProps {
  values: Readonly<Record<string, Value>>;
  typeOf: (name: string) => DataType | undefined;
  className?: string;
  label?: string;
}

function ValueList({ values, typeOf, className, label }: ValueListProps) {
  return (
    <dl className={['fc-unit-run-values', className].filter(Boolean).join(' ')} aria-label={label}>
      {Object.entries(values).map(([name, value]) => (
        <div key={name} className="fc-unit-run-value">
          <dt className="fc-unit-run-name">{name}</dt>
          <dd>{formatValue(value, typeOf(name))}</dd>
        </div>
      ))}
    </dl>
  );
}

interface TraceMessageLineProps {
  message: TraceMessage;
  name: string;
  type: 'error' | 'warning';
  as?: 'p' | 'li';
}

/** A failure or a warning of the record, with the block (or the batch source) it came from. */
function TraceMessageLine({ message, name, type, as: Tag = 'p' }: TraceMessageLineProps) {
  return (
    <Tag className={`fc-unit-run-message fc-unit-run-${type}`}>
      <span className="fc-unit-run-code">{message.code}</span>
      <span>{`${name}: ${message.message}`}</span>
    </Tag>
  );
}

interface NodeContext {
  names: ReadonlyMap<string, string>;
  current: ReadonlySet<string>;
  types: ReadonlyMap<string, DataType>;
  onSelectNode: (nodeId: string) => void;
}

function NodeList({ nodes, context, label }: { nodes: readonly TraceNode[]; context: NodeContext; label?: string }) {
  return (
    <ul className="fc-unit-run-nodes" aria-label={label}>
      {nodes.map((node) => (
        <NodeItem key={node.node_id} node={node} context={context} />
      ))}
    </ul>
  );
}

/** "1 linha encontrada", "3 linhas encontradas", "Nenhuma linha encontrada". */
export function rowsFoundText(count: number): string {
  if (count === 0) return 'Nenhuma linha encontrada';
  return count === 1 ? '1 linha encontrada' : `${count.toLocaleString('pt-BR')} linhas encontradas`;
}

/** A block of the trace: status, name (selects it in the canvas), what it gave and, in a group, the blocks inside. */
function NodeItem({ node, context }: { node: TraceNode; context: NodeContext }) {
  const { names, current, types, onSelectNode } = context;
  const name = names.get(node.node_id) ?? node.node_id;
  const { tone, word } = nodeStatus[node.status];
  const typeOf = (variable: string) => types.get(variable);
  const matchedRule = node.type === 'calculation' || node.type === 'decision_table' ? node.matched_rule : null;
  const warnings = node.type === 'group' ? [] : node.warnings;
  const failure = node.type === 'group' ? null : node.error;
  const classes = ['fc-unit-run-node', node.type === 'group' ? 'fc-unit-run-node-group' : null, node.status === 'not_run' ? 'fc-unit-run-node-not-run' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      <div className="fc-unit-run-node-head">
        <Status tone={tone} className="fc-unit-run-node-status">
          {word}
        </Status>
        {current.has(node.node_id) ? (
          <button type="button" className="fc-unit-run-node-name" aria-label={`${name}: selecionar no canvas`} onClick={() => onSelectNode(node.node_id)}>
            {name}
          </button>
        ) : (
          <span className="fc-unit-run-node-name fc-unit-run-node-gone">{name}</span>
        )}
        {matchedRule !== null ? (
          <Text as="span" variant="label-12" emphasis="secondary">
            {`Regra ${matchedRule.toLocaleString('pt-BR')}`}
          </Text>
        ) : null}
        {node.type === 'source' && node.status !== 'not_run' ? (
          <Text as="span" variant="label-12" emphasis="secondary">
            {rowsFoundText(node.rows_found)}
          </Text>
        ) : null}
      </div>
      {node.type === 'group' ? (
        <>
          {Object.keys(node.inputs).length > 0 ? (
            <div className="fc-unit-run-group-values">
              <span className="fc-unit-run-group-label">Input</span>
              <ValueList values={node.inputs} typeOf={typeOf} className="fc-unit-run-node-values" label={`Input de ${name}`} />
            </div>
          ) : null}
          {Object.keys(node.outputs).length > 0 ? (
            <div className="fc-unit-run-group-values">
              <span className="fc-unit-run-group-label">Output</span>
              <ValueList values={node.outputs} typeOf={typeOf} className="fc-unit-run-node-values" label={`Output de ${name}`} />
            </div>
          ) : null}
          {node.nodes.length > 0 ? <NodeList nodes={node.nodes} context={context} label={`Blocos de ${name}`} /> : null}
        </>
      ) : Object.keys(node.values).length > 0 ? (
        <ValueList values={node.values} typeOf={typeOf} className="fc-unit-run-node-values" />
      ) : null}
      {warnings.length > 0 ? (
        <ul className="fc-unit-run-messages" aria-label={`Avisos de ${name}`}>
          {warnings.map((warning, index) => (
            <li key={`${warning.code}:${index}`} className="fc-unit-run-message fc-unit-run-warning">
              <span className="fc-unit-run-code">{warning.code}</span>
              <span>{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {failure ? (
        <p className="fc-unit-run-message fc-unit-run-error">
          <span className="fc-unit-run-code">{failure.code}</span>
          <span>{failure.message}</span>
        </p>
      ) : null}
    </li>
  );
}
