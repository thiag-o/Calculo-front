import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../draft';
import { EXAMPLE_DEPENDENCIES, EXAMPLE_SYMBOLS, exampleDefinition } from './canvas.test-support';
import { moveBlocks } from './blocks';
import { INPUTS_ID, OUTPUT_ID, canvasGraph, readersOf } from './graph';

function linksOf(definition: WorkflowDefinition, symbols = EXAMPLE_SYMBOLS, dependencies = EXAMPLE_DEPENDENCIES) {
  return canvasGraph(definition, symbols, dependencies).links.map((link) => `${link.source}.${link.name} -> ${link.target}`);
}

describe('canvasGraph', () => {
  it('as ligações do rascunho de exemplo saem das dependencies e dos symbols', () => {
    expect(linksOf(exampleDefinition())).toEqual([
      `${INPUTS_ID}.categoria -> td_elegibilidade`,
      'td_elegibilidade.fator -> calc_pontos',
      `${INPUTS_ID}.valor_item -> calc_pontos`,
      `${INPUTS_ID}.valor_compra -> calc_total`,
      `calc_pontos.pontos -> ${OUTPUT_ID}`,
    ]);
  });

  it('as fórmulas não contam: sem dependencies, nenhuma ligação de bloco, mesmo com a fórmula citando nomes', () => {
    expect(linksOf(exampleDefinition(), EXAMPLE_SYMBOLS, [])).toEqual([`calc_pontos.pontos -> ${OUTPUT_ID}`]);
  });

  it('o produtor vem do symbol: uma leitura sem symbol não liga a nada', () => {
    const symbols = EXAMPLE_SYMBOLS.filter((symbol) => symbol.name !== 'fator');
    expect(linksOf(exampleDefinition(), symbols)).not.toContain('td_elegibilidade.fator -> calc_pontos');
  });

  it('as portas de entrada são os reads do nó, com o tipo do symbol; as de saída, o que o bloco produz', () => {
    const graph = canvasGraph(exampleDefinition(), EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES);
    const pontos = graph.blocks.find((view) => view.block.id === 'calc_pontos')!;
    expect(pontos.reads.map((port) => [port.label, port.type])).toEqual([
      ['fator', 'decimal(4)'],
      ['valor_item', 'decimal(2)'],
    ]);
    expect(pontos.outputs.map((port) => [port.label, port.type])).toEqual([['pontos', 'decimal(2)']]);
    const total = graph.blocks.find((view) => view.block.id === 'calc_total')!;
    expect(total.reads.map((port) => [port.label, port.type])).toEqual([['valor_compra[]', 'decimal(2)']]);
  });

  it('a barra Entradas mostra a múltipla com os campos, e a barra Saída os campos de saída', () => {
    const graph = canvasGraph(exampleDefinition(), EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES);
    expect(graph.inputs.map((row) => [row.kind, row.label, row.type])).toEqual([
      ['linear', 'valor_item', 'decimal(2)'],
      ['linear', 'categoria', 'text'],
      ['multiple', 'compras[]', 'lista'],
      ['field', 'valor_compra[]', 'decimal(2)'],
    ]);
    expect(graph.output.map((row) => [row.label, row.type])).toEqual([['pontos', 'decimal(2)']]);
  });

  it('as barras ficam à esquerda do primeiro bloco e à direita do último', () => {
    const graph = canvasGraph(exampleDefinition(), EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES);
    expect(graph.inputsPosition).toEqual({ x: -280, y: 0 });
    expect(graph.outputPosition).toEqual({ x: 520, y: 0 });
  });

  it('um bloco que saiu ou uma saída renomeada depois da análise ficam sem ligação até a próxima', () => {
    const definition = exampleDefinition();
    const withoutTable: WorkflowDefinition = {
      ...definition,
      root: { ...definition.root, nodes: definition.root.nodes.filter((node) => node.id !== 'td_elegibilidade') },
    };
    expect(linksOf(withoutTable)).not.toContain('td_elegibilidade.fator -> calc_pontos');
    expect(linksOf(withoutTable)).not.toContain(`${INPUTS_ID}.categoria -> td_elegibilidade`);

    const renamed: WorkflowDefinition = {
      ...definition,
      root: {
        ...definition.root,
        nodes: definition.root.nodes.map((node) =>
          node.id === 'calc_pontos' && node.type === 'calculation' ? { ...node, output: { ...node.output, name: 'pontos_novo' } } : node,
        ),
      },
    };
    expect(linksOf(renamed)).not.toContain(`calc_pontos.pontos -> ${OUTPUT_ID}`);
  });

  it('com o grafo anterior, mover um bloco recria só a vista dele: os outros blocos, as barras e as ligações são os mesmos objetos', () => {
    const definition = exampleDefinition();
    const before = canvasGraph(definition, EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES);
    const moved = moveBlocks(definition, new Map([['calc_total', { x: 240, y: 320 }]]));
    const after = canvasGraph(moved, EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES, before);

    expect(after.blocks).not.toBe(before.blocks);
    expect(after.blocks[0]).toBe(before.blocks[0]);
    expect(after.blocks[1]).toBe(before.blocks[1]);
    expect(after.blocks[2]).not.toBe(before.blocks[2]);
    // The moved block keeps its ports: only its view is new.
    expect(after.blocks[2]!.reads).toBe(before.blocks[2]!.reads);
    expect(after.blocks[2]!.outputs).toBe(before.blocks[2]!.outputs);
    expect(after.inputs).toBe(before.inputs);
    expect(after.output).toBe(before.output);
    expect(after.links).toBe(before.links);
    expect(after.inputsPosition).toBe(before.inputsPosition);
    expect(after.outputPosition).toBe(before.outputPosition);
  });

  it('com o grafo anterior e nada mudado, devolve as mesmas listas; uma ligação nova não recria as outras', () => {
    const definition = exampleDefinition();
    const before = canvasGraph(definition, EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES);
    const same = canvasGraph(definition, [...EXAMPLE_SYMBOLS], EXAMPLE_DEPENDENCIES.map((dependency) => ({ ...dependency })), before);
    expect(same.blocks).toBe(before.blocks);
    expect(same.links).toBe(before.links);

    const dependencies = [...EXAMPLE_DEPENDENCIES.slice(0, 2), { node_id: 'calc_total', reads: ['valor_compra', 'fator'] }];
    const more = canvasGraph(definition, EXAMPLE_SYMBOLS, dependencies, before);
    expect(more.links).toHaveLength(before.links.length + 1);
    for (const link of before.links) expect(more.links).toContain(link);
    expect(more.blocks[0]).toBe(before.blocks[0]);
    expect(more.blocks[1]).toBe(before.blocks[1]);
    expect(more.blocks[2]!.reads.map((port) => port.label)).toEqual(['valor_compra[]', 'fator']);
  });

  it('um bloco novo, ainda sem análise, não tem portas de entrada', () => {
    const definition = exampleDefinition();
    const graph = canvasGraph(definition, EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES.slice(0, 1));
    expect(graph.blocks.find((view) => view.block.id === 'calc_pontos')!.reads).toEqual([]);
  });
});

describe('readersOf', () => {
  it('conta os blocos que leem a saída do bloco, pelas dependencies', () => {
    const definition = exampleDefinition();
    expect(readersOf('td_elegibilidade', definition, EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES)).toBe(1);
    expect(readersOf('calc_pontos', definition, EXAMPLE_SYMBOLS, EXAMPLE_DEPENDENCIES)).toBe(0);
    const twoReaders = [...EXAMPLE_DEPENDENCIES.slice(0, 2), { node_id: 'calc_total', reads: ['fator', 'valor_compra'] }];
    expect(readersOf('td_elegibilidade', definition, EXAMPLE_SYMBOLS, twoReaders)).toBe(2);
  });

  it('não conta o próprio bloco nem um bloco que já saiu da definição', () => {
    const definition = exampleDefinition();
    const dependencies = [...EXAMPLE_DEPENDENCIES, { node_id: 'td_elegibilidade', reads: ['fator'] }, { node_id: 'calc_removido', reads: ['fator'] }];
    expect(readersOf('td_elegibilidade', definition, EXAMPLE_SYMBOLS, dependencies)).toBe(1);
  });
});

describe('canvasGraph com a fonte do lote', () => {
  const symbols = [
    { name: 'valor_item', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'batch_source', node_id: null, group_id: null },
    { name: 'pontos', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_pontos', group_id: null },
  ] as const;

  function withBatchSource(): WorkflowDefinition {
    const base = exampleDefinition();
    const nodes = base.root.nodes.filter((node) => node.id === 'calc_pontos');
    return {
      ...base,
      schema_version: 2,
      root: {
        ...base.root,
        inputs: [],
        nodes,
        batch_source: {
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
          key: ['valor_item'],
          filters: [],
          order_by: [{ variable: 'valor_item', direction: 'asc' }],
          outputs: [{ variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03', name: 'valor_item' }],
        },
      },
    };
  }

  it('a barra da esquerda tem as variáveis da fonte do lote, com o tipo da análise, e as ligações saem dela', () => {
    const graph = canvasGraph(withBatchSource(), symbols, [{ node_id: 'calc_pontos', reads: ['valor_item'] }]);
    expect(graph.inputs).toEqual([{ kind: 'linear', handle: 'var:valor_item', label: 'valor_item', type: 'decimal(2)' }]);
    expect(graph.links.map((link) => `${link.source}.${link.name} -> ${link.target}`)).toContain(`${INPUTS_ID}.valor_item -> calc_pontos`);
  });

  it('sem a análise, a variável da fonte do lote aparece sem tipo e sem ligação', () => {
    const graph = canvasGraph(withBatchSource(), [], []);
    expect(graph.inputs).toEqual([{ kind: 'linear', handle: 'var:valor_item', label: 'valor_item', type: null }]);
    expect(graph.links.map((link) => link.source)).not.toContain(INPUTS_ID);
  });
});
