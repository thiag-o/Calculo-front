import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../draft';
import { addBlock, freePosition, moveBlocks, newBlock, removeBlock } from './blocks';
import { exampleDefinition } from './canvas.test-support';

describe('newBlock', () => {
  it('o Cálculo nasce com id e nome de saída livres, fórmula vazia e as casas do workflow', () => {
    const block = newBlock(exampleDefinition(), 'calculation', { x: 32, y: 48 });
    expect(block).toEqual({
      id: 'calc_1',
      type: 'calculation',
      name: 'Cálculo 1',
      description: null,
      position: { x: 32, y: 48 },
      expression: '',
      output: { name: 'resultado_1', type: 'decimal', scale: 2 },
      rounding_mode: null,
      error_policy: null,
      default_value: null,
    });
  });

  it('a Tabela de Decisão nasce com uma coluna de resultado livre, sem condições nem regras', () => {
    const block = newBlock(exampleDefinition(), 'decision_table', { x: 0, y: 0 });
    expect(block).toMatchObject({
      id: 'td_1',
      type: 'decision_table',
      name: 'Tabela de Decisão 1',
      hit_policy: 'first',
      conditions: [],
      results: [{ name: 'resultado_1', type: 'decimal', scale: 2, default_value: null }],
      rules: [],
    });
  });

  it('pula os ids e os nomes já usados (entradas, campos, saídas e resultados)', () => {
    let definition = exampleDefinition();
    definition = addBlock(definition, newBlock(definition, 'calculation', { x: 0, y: 0 }));
    definition = {
      ...definition,
      root: {
        ...definition.root,
        inputs: [...definition.root.inputs, { name: 'resultado_2', cardinality: 'linear', type: 'integer' }],
      },
    };
    const next = newBlock(definition, 'calculation', { x: 0, y: 0 });
    expect(next.id).toBe('calc_2');
    expect(next.type === 'calculation' && next.output.name).toBe('resultado_3');
    const table = newBlock(addBlock(definition, next), 'decision_table', { x: 0, y: 0 });
    expect(table.type === 'decision_table' && table.results[0]!.name).toBe('resultado_4');
  });
});

describe('freePosition', () => {
  it('centra o bloco no ponto, na grade de 16px', () => {
    const empty: WorkflowDefinition = { ...exampleDefinition(), root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } } };
    expect(freePosition(empty, { x: 503, y: 301 })).toEqual({ x: 400, y: 256 });
  });

  it('desce e vai para a direita enquanto cobriria outro bloco', () => {
    // "Elegibilidade" is at (0, 0): a block centered on (100, 40) would land on it.
    expect(freePosition(exampleDefinition(), { x: 100, y: 40 })).toEqual({ x: 24, y: 24 });
  });
});

describe('edições da definição', () => {
  it('incluir acrescenta no fim e mantém os mesmos objetos dos outros blocos', () => {
    const definition = exampleDefinition();
    const block = newBlock(definition, 'calculation', { x: 0, y: 320 });
    const next = addBlock(definition, block);
    expect(next.root.nodes.map((node) => node.id)).toEqual(['td_elegibilidade', 'calc_pontos', 'calc_total', 'calc_1']);
    definition.root.nodes.forEach((node, index) => expect(next.root.nodes[index]).toBe(node));
    expect(next.root.inputs).toBe(definition.root.inputs);
    expect(next.root.output).toBe(definition.root.output);
  });

  it('mover troca só a posição do bloco movido', () => {
    const definition = exampleDefinition();
    const next = moveBlocks(definition, new Map([['calc_pontos', { x: 300, y: 16 }]]));
    expect(next.root.nodes[1]!.position).toEqual({ x: 300, y: 16 });
    expect(next.root.nodes[0]).toBe(definition.root.nodes[0]);
    expect(next.root.nodes[2]).toBe(definition.root.nodes[2]);
    expect(moveBlocks(definition, new Map([['calc_pontos', { x: 240, y: 0 }]]))).toBe(definition);
  });

  it('remover tira só o bloco e mantém os outros objetos', () => {
    const definition = exampleDefinition();
    const next = removeBlock(definition, 'calc_pontos');
    expect(next.root.nodes.map((node) => node.id)).toEqual(['td_elegibilidade', 'calc_total']);
    expect(next.root.nodes[0]).toBe(definition.root.nodes[0]);
    expect(next.root.nodes[1]).toBe(definition.root.nodes[2]);
    expect(removeBlock(definition, 'nao_existe')).toBe(definition);
  });
});
