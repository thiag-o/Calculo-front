// The "Fontes" section of the panel (E7-21): the counts of each Fonte block in the calculation, with dot + word, as in the
// Prévia tab of the editor (F66). The dot is the status those records get, by the policy of the block in the frozen
// definition; without the definition (no permission to read it, or it failed), a count that is not zero stays neutral.
import { useMemo } from 'react';
import type { Schemas } from '../../api';
import { Status, Text, type StatusTone } from '../../design-system';
import { useExecutionDefinition, type Execution, type ExecutionDefinition } from '../api';
import { countText } from './format';

type SourceCount = Schemas['SourceCount'];
type LinearSourceNode = Schemas['LinearSourceNode'];
type DefinitionNode = ExecutionDefinition['definition']['root']['nodes'][number];

const MODE_LABELS: Readonly<Record<Schemas['SourceMode'], string>> = { linear: 'Linear', filter: 'Filtro' };

function counted(count: number, one: string, many: string): string {
  return `${countText(count)} ${count === 1 ? one : many}`;
}

/** The words of each count, as in the Prévia. */
export const SOURCE_COUNT_TEXT = {
  found: (count: number) => counted(count, 'encontrado', 'encontrados'),
  noMatch: (count: number) => `${countText(count)} sem correspondência`,
  multipleRows: (count: number) => `${countText(count)} com mais de uma linha`,
  kept: (count: number) => counted(count, 'passou no filtro', 'passaram no filtro'),
  filtered: (count: number) => counted(count, 'filtrado', 'filtrados'),
};

/** The Fonte blocks in Linear mode of the frozen definition, in any group, by id. */
function linearSources(nodes: readonly DefinitionNode[], found = new Map<string, LinearSourceNode>()): Map<string, LinearSourceNode> {
  for (const node of nodes) {
    if (node.type === 'source' && node.mode === 'linear') found.set(node.id, node);
    else if (node.type === 'group') linearSources(node.nodes, found);
  }
  return found;
}

/** No line with "Gerar erro" is an error, with "Manter vazio" a warning, with "Descartar" ignored. */
function noMatchTone(count: number, policy: Schemas['NoMatchPolicy'] | undefined): StatusTone {
  if (count === 0 || policy === undefined || policy === 'discard') return 'gray';
  return policy === 'keep_null' ? 'amber' : 'red';
}

/** More than one line with "Gerar erro" is an error and with "Aceitar a primeira linha" a warning. */
function multipleRowsTone(count: number, policy: Schemas['MultipleRowsPolicy'] | undefined): StatusTone {
  if (count === 0 || policy === undefined) return 'gray';
  return policy === 'accept_first' ? 'amber' : 'red';
}

export interface SourceCountsProps {
  execution: Execution;
  /** Whether the person may read the frozen definition (`traces.view`, or `simulations.run` in a simulation). */
  canReadDefinition: boolean;
}

/** Hidden while there is no count (before the first chunk, or a workflow without a Fonte block). */
export function SourceCounts({ execution, canReadDefinition }: SourceCountsProps) {
  const counts = execution.source_counts;
  const definition = useExecutionDefinition(execution.id, canReadDefinition && counts.length > 0);
  const policies = useMemo(
    () => (definition.data ? linearSources(definition.data.definition.root.nodes) : new Map<string, LinearSourceNode>()),
    [definition.data],
  );
  if (counts.length === 0) return null;
  return (
    <section className="fc-execution-box" aria-label="Fontes">
      <Text as="h2" variant="heading-16">
        Fontes
      </Text>
      <ul className="fc-execution-sources">
        {counts.map((source) => (
          <SourceItem key={source.node_id} source={source} node={policies.get(source.node_id)} />
        ))}
      </ul>
    </section>
  );
}

function SourceItem({ source, node }: { source: SourceCount; node: LinearSourceNode | undefined }) {
  return (
    <li className="fc-execution-source">
      <span className="fc-execution-source-head">
        <span className="fc-execution-group-name">{source.node_name}</span>
        <Text as="span" variant="label-12" emphasis="secondary">
          {MODE_LABELS[source.mode]}
        </Text>
      </span>
      <ul className="fc-execution-source-counts" aria-label={`Contagens de ${source.node_name}`}>
        {source.mode === 'linear' ? (
          <>
            <li>
              <Status tone={(source.found ?? 0) > 0 ? 'green' : 'gray'}>{SOURCE_COUNT_TEXT.found(source.found ?? 0)}</Status>
            </li>
            <li>
              <Status tone={noMatchTone(source.no_match ?? 0, node?.no_match)}>{SOURCE_COUNT_TEXT.noMatch(source.no_match ?? 0)}</Status>
            </li>
            <li>
              <Status tone={multipleRowsTone(source.multiple_rows ?? 0, node?.multiple_rows)}>
                {SOURCE_COUNT_TEXT.multipleRows(source.multiple_rows ?? 0)}
              </Status>
            </li>
          </>
        ) : (
          <>
            <li>
              <Status tone={(source.kept ?? 0) > 0 ? 'green' : 'gray'}>{SOURCE_COUNT_TEXT.kept(source.kept ?? 0)}</Status>
            </li>
            <li>
              <Status tone={(source.filtered ?? 0) > 0 ? 'multi' : 'gray'}>{SOURCE_COUNT_TEXT.filtered(source.filtered ?? 0)}</Status>
            </li>
          </>
        )}
      </ul>
    </li>
  );
}
