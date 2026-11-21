import { useMemo } from 'react';
import type { Schemas } from '../../api';
import { Status, Text, type StatusTone } from '../../design-system';
import type { WorkflowDefinition } from '../draft';
import type { UnitRun } from './queries';
import { formatValue, variableTypes } from './values';

/** The record status (estilos.md §7.5): dot + word. */
export const recordStatus: Record<UnitRun['status'], { tone: StatusTone; word: string }> = {
  ok: { tone: 'green', word: 'ok' },
  ok_with_warnings: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  ignored: { tone: 'gray', word: 'ignorado' },
  filtered: { tone: 'gray', word: 'filtrado' },
};

/** The block status, as the record's; a block that did not run is gray (estilos.md §7.5 and §8, "Debug"). */
const nodeStatus: Record<Schemas['NodeRunStatus'], { tone: StatusTone; word: string }> = {
  ok: { tone: 'green', word: 'ok' },
  warning: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  not_run: { tone: 'gray', word: 'não rodado' },
};

export interface UnitRunResultProps {
  run: UnitRun;
  /** The definition that ran (to name the blocks and to know each value's type). */
  definition: WorkflowDefinition;
  /** The definition being edited: a block removed since the run can no longer be selected. */
  currentDefinition: WorkflowDefinition;
  /** Selects the block in the canvas. */
  onSelectNode: (nodeId: string) => void;
}

/**
 * The result of "Calcular" (E4-14): the record status, the output fields and, per block in the run order, its status,
 * values, the Decision Table rule that matched ("Regra N"), warnings and error. Numbers in the Brazilian pattern.
 */
export function UnitRunResult({ run, definition, currentDefinition, onSelectNode }: UnitRunResultProps) {
  const types = useMemo(() => variableTypes(definition), [definition]);
  const outputTypes = useMemo(
    () => new Map(definition.root.output.fields.map((field) => [field.name, types.get(field.variable)])),
    [definition, types],
  );
  const names = useMemo(() => new Map(definition.root.nodes.map((node) => [node.id, node.name])), [definition]);
  const status = recordStatus[run.status];

  return (
    <div className="fc-unit-run-result">
      <div className="fc-unit-run-result-head">
        <h3 className="fc-unit-run-title">Resultado</h3>
        <Status tone={status.tone}>{status.word}</Status>
      </div>

      <section className="fc-unit-run-section" aria-label="Saídas">
        <h4 className="fc-unit-run-subtitle">Saídas</h4>
        {Object.keys(run.outputs).length > 0 ? (
          <dl className="fc-unit-run-values">
            {Object.entries(run.outputs).map(([name, value]) => (
              <div key={name} className="fc-unit-run-value">
                <dt className="fc-unit-run-name">{name}</dt>
                <dd>{formatValue(value, outputTypes.get(name))}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
            {run.status === 'error' ? 'Sem saídas: o registro deu erro.' : 'O workflow não tem campos de saída.'}
          </Text>
        )}
      </section>

      <section className="fc-unit-run-section" aria-label="Blocos">
        <h4 className="fc-unit-run-subtitle">Blocos</h4>
        {run.nodes.length > 0 ? (
          <ul className="fc-unit-run-nodes">
            {run.nodes.map((node) => {
              const name = names.get(node.node_id) ?? node.node_id;
              const exists = currentDefinition.root.nodes.some((current) => current.id === node.node_id);
              const { tone, word } = nodeStatus[node.status];
              const values = Object.entries(node.type === 'group' ? node.outputs : node.values);
              const matchedRule = node.type === 'group' || node.type === 'source' ? null : node.matched_rule;
              const warnings = node.type === 'group' ? [] : node.warnings;
              const failure = node.type === 'group' ? null : node.error;
              return (
                <li key={node.node_id} className={node.status === 'not_run' ? 'fc-unit-run-node fc-unit-run-node-not-run' : 'fc-unit-run-node'}>
                  <div className="fc-unit-run-node-head">
                    <Status tone={tone} className="fc-unit-run-node-status">
                      {word}
                    </Status>
                    {exists ? (
                      <button
                        type="button"
                        className="fc-unit-run-node-name"
                        aria-label={`${name}: selecionar no canvas`}
                        onClick={() => onSelectNode(node.node_id)}
                      >
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
                  </div>
                  {values.length > 0 ? (
                    <dl className="fc-unit-run-values fc-unit-run-node-values">
                      {values.map(([valueName, value]) => (
                        <div key={valueName} className="fc-unit-run-value">
                          <dt className="fc-unit-run-name">{valueName}</dt>
                          <dd>{formatValue(value, types.get(valueName))}</dd>
                        </div>
                      ))}
                    </dl>
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
            })}
          </ul>
        ) : (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
            O workflow não tem blocos.
          </Text>
        )}
      </section>
    </div>
  );
}
