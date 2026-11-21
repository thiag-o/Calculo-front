import { describe, expect, it } from 'vitest';
import type { Schemas } from '../../api';
import { producedNames } from './tree';
import { withSourceAndEmptyGroup } from './groups.test-support';

describe('producedNames', () => {
  it('o bloco Fonte Linear produz as saídas e o Filtro não produz nenhuma', () => {
    const linear = withSourceAndEmptyGroup().definition.root.nodes.find((node) => node.id === 'produto');
    if (linear?.type !== 'source' || linear.mode !== 'linear') throw new Error('expected the Linear source "produto"');
    expect(producedNames(linear)).toEqual(linear.outputs.map((output) => output.name));
    const filter: Schemas['FilterSourceNode'] = {
      id: linear.id,
      type: 'source',
      name: linear.name,
      description: null,
      position: linear.position,
      mode: 'filter',
      dataset_id: linear.dataset_id,
      links: linear.links,
      filters: [],
      exists: true,
    };
    expect(producedNames(filter)).toEqual([]);
  });
});
