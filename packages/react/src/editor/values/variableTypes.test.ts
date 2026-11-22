import { describe, expect, it } from 'vitest';
import type { Schemas } from '../../api';
import { allNodes, variableTypes } from './variableTypes';

type Definition = Schemas['Draft']['definition'];
type Node = Definition['root']['nodes'][number];

const calculation: Node = {
  id: 'calc_pontos',
  type: 'calculation',
  name: 'Pontos',
  description: null,
  position: { x: 0, y: 0 },
  expression: 'valor_item * 2',
  output: { name: 'pontos', type: 'decimal', scale: 2 },
  rounding_mode: null,
  error_policy: null,
  default_value: null,
};
const table: Node = {
  id: 'td_elegibilidade',
  type: 'decision_table',
  name: 'Elegibilidade',
  description: null,
  position: { x: 0, y: 0 },
  hit_policy: 'first',
  rounding_mode: null,
  error_policy: null,
  conditions: [{ expression: 'categoria' }],
  results: [{ name: 'elegivel', type: 'boolean', scale: null, default_value: null }],
  rules: [{ when: ['"A"'], then: ['verdadeiro'] }],
};
const group: Node = {
  id: 'grupo',
  type: 'group',
  name: 'Grupo',
  description: null,
  position: { x: 0, y: 0 },
  collapsed: false,
  nodes: [table],
  outputs: [],
};
const definition: Definition = {
  schema_version: 1,
  kind: 'batch',
  settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
  parameters: [],
  root: {
    batch_source: null,
    inputs: [
      { name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 },
      { name: 'categoria', cardinality: 'linear', type: 'text' },
    ],
    nodes: [calculation, group],
    output: { fields: [] },
  },
};

describe('tipos das variáveis', () => {
  it('lista os blocos, os de dentro dos grupos também, na ordem da definição', () => {
    expect(allNodes(definition).map((node) => node.id)).toEqual(['calc_pontos', 'grupo', 'td_elegibilidade']);
  });

  it('pega o tipo das entradas, das saídas dos cálculos e dos resultados das tabelas, dentro de grupos também', () => {
    const types = variableTypes(definition);
    expect(types.get('valor_item')).toBe('decimal');
    expect(types.get('categoria')).toBe('text');
    expect(types.get('pontos')).toBe('decimal');
    expect(types.get('elegivel')).toBe('boolean');
  });

  it('usa os símbolos da análise, e a definição vale mais quando os dois têm a variável', () => {
    const symbols: Schemas['Draft']['symbols'] = [
      { name: 'nota', type: 'integer', scale: null, cardinality: 'linear', list: null, origin: 'batch_source', node_id: null, group_id: null },
      { name: 'pontos', type: 'text', scale: null, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_pontos', group_id: null },
      { name: 'itens', type: null, scale: null, cardinality: 'multiple', list: null, origin: 'input', node_id: null, group_id: null },
    ];
    const types = variableTypes(definition, symbols);
    expect(types.get('nota')).toBe('integer');
    expect(types.get('pontos')).toBe('decimal');
    expect(types.has('itens')).toBe(false);
  });
});
