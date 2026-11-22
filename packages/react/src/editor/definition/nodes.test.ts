import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../draft';
import { allNodes, declaredVariableNames, locateNode, producedNames, variableNameCounts } from './nodes';

const base = { description: null, position: { x: 0, y: 0 }, rounding_mode: null, error_policy: null };
const calculation = (id: string, name: string) =>
  ({ ...base, id, type: 'calculation', name: id, expression: '1', output: { name, type: 'decimal', scale: 2 }, default_value: null }) as const;

function definition(): WorkflowDefinition {
  const inner = { ...base, id: 'grp_in', type: 'group', name: 'Interno', nodes: [calculation('calc_b', 'bonus')], outputs: ['bonus'], collapsed: false };
  const outer = { ...base, id: 'grp_out', type: 'group', name: 'Externo', nodes: [calculation('calc_a', 'pontos'), inner], outputs: ['pontos'], collapsed: false };
  return {
    settings: { rounding: { mode: 'half_up', scale: 2 }, error_policy: 'error' },
    root: {
      inputs: [{ name: 'valor', cardinality: 'linear', type: 'decimal', scale: 2 }],
      batch_source: null,
      nodes: [outer, calculation('calc_c', 'bonus')],
      output: { fields: [] },
    },
  } as unknown as WorkflowDefinition;
}

describe('leituras da definição', () => {
  it('lista os nós em profundidade, o grupo antes do que há dentro', () => {
    expect(allNodes(definition()).map((node) => node.id)).toEqual(['grp_out', 'calc_a', 'grp_in', 'calc_b', 'calc_c']);
  });

  it('diz os nomes que um nó produz, e o Output de um grupo', () => {
    const [outer, calc] = allNodes(definition());
    expect(producedNames(calc!)).toEqual(['pontos']);
    expect(producedNames(outer!)).toEqual(['pontos']);
  });

  it('conta cada variável uma vez por uso, sem contar o Output do grupo', () => {
    expect(declaredVariableNames(definition())).toEqual(['valor', 'pontos', 'bonus', 'bonus']);
    expect(variableNameCounts(definition()).get('bonus')).toBe(2);
    expect(variableNameCounts(definition()).get('pontos')).toBe(1);
  });

  it('acha um nó e os grupos em volta dele, em qualquer profundidade', () => {
    expect(locateNode(definition(), 'calc_b')).toMatchObject({ path: 'root.nodes[0].nodes[1].nodes[0]', groups: ['grp_out', 'grp_in'] });
    expect(locateNode(definition(), 'calc_c')).toMatchObject({ path: 'root.nodes[1]', groups: [] });
    expect(locateNode(definition(), 'nao_existe')).toBeNull();
  });
});
