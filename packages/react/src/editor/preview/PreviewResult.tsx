import { useMemo, type ReactNode } from 'react';
import type { Schemas } from '../../api';
import { Notice, Status, Text, type StatusTone } from '../../design-system';
import type { DraftSymbol, WorkflowDefinition } from '../draft';
import { BATCH_SOURCE_NAME, COUNT_NOTE, ROOT_GROUP_NAME, countText, readErrorTitle } from './messages';
import type { LastPreview, PreviewGroup, PreviewSource } from './queries';
import { columnsOf, formatValue, nodesById, outputFieldTypes, recordKeyText, variableTypes, type RecordKey, type Value } from './values';

type DataType = Schemas['DataType'];
type Types = ReadonlyMap<string, DataType | null>;

/** The record status (estilos.md §7.5): dot + word. */
const recordStatus: Record<Schemas['UnitRunStatus'], { tone: StatusTone; word: string }> = {
  ok: { tone: 'green', word: 'ok' },
  ok_with_warnings: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  ignored: { tone: 'gray', word: 'ignorado' },
  filtered: { tone: 'multi', word: 'filtrado' },
};

const MODE_LABELS: Record<Schemas['SourceMode'], string> = { linear: 'Linear', filter: 'Filtro' };

/**
 * The dot of a count is the status those records get (estilos.md §7.5), by the policy of the block: no line with
 * "Gerar erro" is an error, with "Manter vazio" a warning, with "Descartar" ignored; more than one line with "Gerar erro"
 * is an error and with "Aceitar a primeira linha" a warning. A zero count is gray.
 */
function noMatchTone(count: number, policy: Schemas['NoMatchPolicy'] | undefined): StatusTone {
  if (count === 0) return 'gray';
  if (policy === 'keep_null') return 'amber';
  if (policy === 'discard') return 'gray';
  return 'red';
}

function multipleRowsTone(count: number, policy: Schemas['MultipleRowsPolicy'] | undefined): StatusTone {
  if (count === 0) return 'gray';
  return policy === 'accept_first' ? 'amber' : 'red';
}

export interface PreviewResultProps {
  last: LastPreview;
  /** The definition being edited: a block removed since the preview can no longer be selected. */
  currentDefinition: WorkflowDefinition;
  /** The symbols of the analysis: the type of each variable, to show its values. */
  symbols: readonly DraftSymbol[];
  /** Selects a block (or group) in the canvas. */
  onSelectNode: (nodeId: string) => void;
  /** Selects the Fonte do lote bar (a read error of the batch source). */
  onSelectBatchSource: () => void;
}

/**
 * The result of "Rodar prévia" (E5-11, design §6): per Fonte block, the counts, the example keys and the sample of the
 * lines brought; per group (the root too), the example records with the Input and the Output side by side. A read error
 * (`schema_drift`, `source_read_denied`, `parameter_table_rows`) takes the place of the lists, with the block name.
 */
export function PreviewResult({ last, currentDefinition, symbols, onSelectNode, onSelectBatchSource }: PreviewResultProps) {
  const { preview, definition } = last;
  const nodes = useMemo(() => nodesById(definition), [definition]);
  const current = useMemo(() => nodesById(currentDefinition), [currentDefinition]);
  const types = useMemo(() => variableTypes(symbols), [symbols]);
  const outputTypes = useMemo(() => outputFieldTypes(definition, types), [definition, types]);

  const blockName = (nodeId: string | null) => {
    if (nodeId === null) return <BlockName name={BATCH_SOURCE_NAME} onSelect={onSelectBatchSource} />;
    const name = nodes.get(nodeId)?.name ?? nodeId;
    return <BlockName name={name} onSelect={current.has(nodeId) ? () => onSelectNode(nodeId) : null} />;
  };

  if (preview.error) {
    return (
      <div className="fc-preview-result">
        <Notice type="error" title={readErrorTitle(preview.error.code)}>
          <span className="fc-preview-error">
            {blockName(preview.error.node_id)}
            <span>{preview.error.message}</span>
          </span>
        </Notice>
      </div>
    );
  }

  return (
    <div className="fc-preview-result">
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-preview-note">
        {COUNT_NOTE}
      </Text>
      {preview.counted_records === 0 ? (
        <Text as="p" variant="label-13" emphasis="secondary" className="fc-preview-none">
          A fonte do lote não trouxe nenhum registro. Confira os filtros da fonte do lote.
        </Text>
      ) : (
        <>
          <section className="fc-preview-section" aria-label="Blocos Fonte">
            <h4 className="fc-preview-subtitle">Blocos Fonte</h4>
            {preview.sources.length > 0 ? (
              <ul className="fc-preview-items">
                {preview.sources.map((source) => {
                  const node = nodes.get(source.node_id);
                  return (
                    <SourceItem
                      key={source.node_id}
                      source={source}
                      name={blockName(source.node_id)}
                      label={node?.name ?? source.node_id}
                      node={node?.type === 'source' ? node : undefined}
                      types={types}
                    />
                  );
                })}
              </ul>
            ) : (
              <Text as="p" variant="label-13" emphasis="secondary" className="fc-preview-none">
                O workflow não tem blocos Fonte.
              </Text>
            )}
          </section>

          <section className="fc-preview-section" aria-label="Grupos">
            <h4 className="fc-preview-subtitle">Grupos</h4>
            <ul className="fc-preview-items">
              {preview.groups.map((group) => {
                const root = group.node_id === null;
                const label = root ? ROOT_GROUP_NAME : (nodes.get(group.node_id!)?.name ?? group.node_id!);
                return (
                  <GroupItem
                    key={group.node_id ?? ''}
                    group={group}
                    name={root ? <span className="fc-preview-name fc-preview-name-static">{ROOT_GROUP_NAME}</span> : blockName(group.node_id)}
                    label={label}
                    inputTypes={types}
                    outputTypes={root ? outputTypes : types}
                  />
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function BlockName({ name, onSelect }: { name: string; onSelect: (() => void) | null }) {
  if (!onSelect) return <span className="fc-preview-name fc-preview-name-static">{name}</span>;
  return (
    <button type="button" className="fc-preview-name" aria-label={`${name}: selecionar no canvas`} onClick={onSelect}>
      {name}
    </button>
  );
}

interface SourceItemProps {
  source: PreviewSource;
  name: ReactNode;
  /** The block name as text (for the table caption and the lists' names). */
  label: string;
  node: Extract<WorkflowDefinition['root']['nodes'][number], { type: 'source' }> | undefined;
  types: Types;
}

function SourceItem({ source, name, label, node, types }: SourceItemProps) {
  return (
    <li className="fc-preview-item">
      <div className="fc-preview-item-head">
        {name}
        <Text as="span" variant="label-12" emphasis="secondary">
          {MODE_LABELS[source.mode]}
        </Text>
      </div>
      <ul className="fc-preview-counts" aria-label={`Contagens de ${label}`}>
        {source.mode === 'linear' ? (
          <>
            <li>
              <Status tone={(source.found ?? 0) > 0 ? 'green' : 'gray'}>{countText.found(source.found ?? 0)}</Status>
            </li>
            <li>
              <Status tone={noMatchTone(source.no_match ?? 0, node?.no_match)}>{countText.noMatch(source.no_match ?? 0)}</Status>
            </li>
            <li>
              <Status tone={multipleRowsTone(source.multiple_rows ?? 0, node?.multiple_rows)}>
                {countText.multipleRows(source.multiple_rows ?? 0, source.max_rows)}
              </Status>
            </li>
          </>
        ) : (
          <>
            <li>
              <Status tone={(source.kept ?? 0) > 0 ? 'green' : 'gray'}>{countText.kept(source.kept ?? 0)}</Status>
            </li>
            <li>
              <Status tone={(source.filtered ?? 0) > 0 ? 'multi' : 'gray'}>{countText.filtered(source.filtered ?? 0)}</Status>
            </li>
          </>
        )}
      </ul>
      <ExampleKeys title="Sem correspondência" label={label} keys={source.no_match_keys} />
      <ExampleKeys title="Com mais de uma linha" label={label} keys={source.multiple_rows_keys} />
      <ValuesTable caption={`Amostra de ${label}`} rows={source.rows} types={types} empty="Nenhuma linha trazida." />
    </li>
  );
}

function ExampleKeys({ title, label, keys }: { title: string; label: string; keys: readonly RecordKey[] }) {
  if (keys.length === 0) return null;
  return (
    <div className="fc-preview-keys">
      <Text as="span" variant="label-12" emphasis="secondary">
        {title}:
      </Text>
      <ul className="fc-preview-key-list" aria-label={`${title} em ${label}: chaves de exemplo`}>
        {keys.map((key, index) => (
          <li key={index} className="fc-preview-key">
            {recordKeyText(key)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The lines brought by a Fonte block: one column per variable, `mono-13`, scrolling sideways. */
function ValuesTable({ caption, rows, types, empty }: { caption: string; rows: readonly Record<string, Value>[]; types: Types; empty: string }) {
  const columns = columnsOf(rows);
  if (rows.length === 0 || columns.length === 0) {
    return (
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-preview-none">
        {empty}
      </Text>
    );
  }
  return (
    <div className="fc-preview-scroll" tabIndex={0} role="region" aria-label={caption}>
      <table className="fc-preview-table">
        <caption className="fc-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{formatValue(row[column], types.get(column))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GroupItemProps {
  group: PreviewGroup;
  name: ReactNode;
  label: string;
  inputTypes: Types;
  outputTypes: Types;
}

/** The example records of a group: the key and the status, then the Input and the Output side by side. */
function GroupItem({ group, name, label, inputTypes, outputTypes }: GroupItemProps) {
  const inputs = columnsOf(group.records.map((record) => record.inputs));
  const outputs = columnsOf(group.records.map((record) => record.outputs));
  const caption = `Registros de exemplo de ${label}`;
  return (
    <li className="fc-preview-item">
      <div className="fc-preview-item-head">{name}</div>
      {group.records.length === 0 ? (
        <Text as="p" variant="label-13" emphasis="secondary" className="fc-preview-none">
          Nenhum registro chegou a este grupo.
        </Text>
      ) : (
        <div className="fc-preview-scroll" tabIndex={0} role="region" aria-label={caption}>
          <table className="fc-preview-table">
            <caption className="fc-visually-hidden">{caption}</caption>
            <thead>
              <tr>
                <th scope="col" rowSpan={2}>
                  Registro
                </th>
                <th scope="col" rowSpan={2}>
                  Situação
                </th>
                <th scope="colgroup" colSpan={Math.max(inputs.length, 1)} className="fc-preview-side">
                  Input
                </th>
                <th scope="colgroup" colSpan={Math.max(outputs.length, 1)} className="fc-preview-side">
                  Output
                </th>
              </tr>
              <tr>
                {inputs.length > 0 ? (
                  inputs.map((column, index) => (
                    <th key={column} scope="col" className={index === 0 ? 'fc-preview-side' : undefined}>
                      {column}
                    </th>
                  ))
                ) : (
                  <th scope="col" className="fc-preview-side">
                    —
                  </th>
                )}
                {outputs.length > 0 ? (
                  outputs.map((column, index) => (
                    <th key={column} scope="col" className={index === 0 ? 'fc-preview-side' : undefined}>
                      {column}
                    </th>
                  ))
                ) : (
                  <th scope="col" className="fc-preview-side">
                    —
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {group.records.map((record) => {
                const status = recordStatus[record.status];
                return (
                  <tr key={recordKeyText(record.record_key)}>
                    <th scope="row">{recordKeyText(record.record_key)}</th>
                    <td className="fc-preview-status">
                      <Status tone={status.tone}>{status.word}</Status>
                    </td>
                    {inputs.length > 0 ? (
                      inputs.map((column, index) => (
                        <td key={column} className={index === 0 ? 'fc-preview-side' : undefined}>
                          {formatValue(record.inputs[column], inputTypes.get(column))}
                        </td>
                      ))
                    ) : (
                      <td className="fc-preview-side">—</td>
                    )}
                    {outputs.length > 0 ? (
                      outputs.map((column, index) => (
                        <td key={column} className={index === 0 ? 'fc-preview-side' : undefined}>
                          {formatValue(record.outputs[column], outputTypes.get(column))}
                        </td>
                      ))
                    ) : (
                      <td className="fc-preview-side">—</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}
