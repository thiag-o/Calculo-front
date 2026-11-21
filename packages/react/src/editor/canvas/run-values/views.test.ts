import { describe, expect, it } from 'vitest';
import type { LastUnitRun } from '../../unit-run';
import { groupedDraft } from '../../groups/groups.test-support';
import { runViews } from './views';

function lastRun(trace: LastUnitRun['trace']): LastUnitRun {
  const draft = groupedDraft();
  return { revision: draft.revision, definition: draft.definition, symbols: draft.symbols, trace };
}

const TRACE: LastUnitRun['trace'] = {
  status: 'error',
  record_key: null,
  inputs: [],
  nodes: [
    {
      type: 'group',
      node_id: 'grp_pontuacao',
      status: 'ok',
      inputs: { categoria: 'A', valor_item: '1500.00' },
      outputs: { pontos: '225.00' },
      nodes: [
        { type: 'decision_table', node_id: 'td_elegibilidade', status: 'ok', values: { fator: '0.1500' }, matched_rule: 2, warnings: [], error: null },
        { type: 'calculation', node_id: 'calc_pontos', status: 'ok', values: { pontos: '225.00' }, matched_rule: null, warnings: [], error: null },
      ],
    },
    {
      type: 'calculation',
      node_id: 'calc_bonus',
      status: 'error',
      values: {},
      matched_rule: null,
      warnings: [],
      error: { code: 'division_by_zero', message: 'Divisão por zero em pontos / 0.' },
    },
  ],
  outputs: {},
  input_hash: 'sha256:00',
  output_hash: null,
  error: null,
  warnings: [],
};

describe('valores do último cálculo por nó', () => {
  it('lê cada nó do trace, os de dentro dos grupos também, com os valores no padrão brasileiro pelo tipo', () => {
    const views = runViews(lastRun(TRACE));
    expect(views.record).toBe('error');
    expect(views.nodes.get('grp_pontuacao')).toEqual({ kind: 'group', status: 'ok', values: [{ name: 'pontos', text: '225,00' }], error: null });
    expect(views.nodes.get('td_elegibilidade')).toEqual({
      kind: 'decision_table',
      status: 'ok',
      values: [{ name: 'fator', text: '0,1500' }],
      matchedRule: 2,
      error: null,
    });
    expect(views.nodes.get('calc_pontos')?.values).toEqual([{ name: 'pontos', text: '225,00' }]);
    expect(views.nodes.get('calc_bonus')).toEqual({ kind: 'calculation', status: 'error', values: [], error: 'Divisão por zero em pontos / 0.' });
  });

  it('a Tabela que não rodou não tem regra, e a Fonte que rodou diz quantas linhas achou', () => {
    const views = runViews(
      lastRun({
        ...TRACE,
        nodes: [
          { type: 'decision_table', node_id: 'td_elegibilidade', status: 'not_run', values: {}, matched_rule: null, warnings: [], error: null },
          { type: 'source', node_id: 'produto', status: 'ok', values: { limite: '10.00' }, rows_found: 1, warnings: [], error: null },
        ],
      }),
    );
    expect(views.nodes.get('td_elegibilidade')).not.toHaveProperty('matchedRule');
    expect(views.nodes.get('produto')).toMatchObject({ rowsFound: 1 });
  });
});
