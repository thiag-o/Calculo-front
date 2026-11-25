import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '../../draft';
import {
  analyzedOrderPath,
  analyzedOutputPath,
  batchSourceBarRows,
  updateBatchSource,
  withBatchSource,
  withDataset,
  withKey,
  withNewOrder,
  withOrderMoved,
  withOutput,
  withOutputName,
  withoutBatchSource,
  withoutOutput,
  type BatchSource,
} from './batchSource';

const DATASET = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01';

function source(): BatchSource {
  return {
    dataset_id: DATASET,
    key: ['nf_id'],
    filters: [{ variable: 'status', operator: '=', values: ['"A"'] }],
    order_by: [
      { variable: 'data_emissao', direction: 'asc' },
      { variable: 'nf_id', direction: 'desc' },
    ],
    outputs: [
      { variable_id: 'v1', name: 'nf_id' },
      { variable_id: 'v2', name: 'status' },
      { variable_id: 'v3', name: 'data_emissao' },
    ],
  };
}

function definition(batch: BatchSource | null = null): WorkflowDefinition {
  return {
    schema_version: 1,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard', pre_validation_alert_percent: '1' },
    parameters: [],
    root: {
      batch_source: batch,
      inputs: [{ name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 }],
      nodes: [],
      output: { fields: [] },
    },
  };
}

describe('fonte do lote na definição', () => {
  it('com a fonte do lote, as entradas declaradas saem e a versão fica como está (quem salva grava a 3)', () => {
    const before = definition();
    const after = withBatchSource(before, DATASET);
    expect(after.schema_version).toBe(before.schema_version);
    expect(after.root.inputs).toEqual([]);
    expect(after.root.batch_source).toEqual({ dataset_id: DATASET, key: [], filters: [], order_by: [], outputs: [] });
    expect(after.root.output).toBe(before.root.output);
    expect(after.settings).toBe(before.settings);

    expect(withoutBatchSource(after).root.batch_source).toBeNull();
    expect(withoutBatchSource(before)).toBe(before);
  });

  it('nada muda sem fonte do lote ou quando a edição não muda nada', () => {
    const without = definition();
    expect(updateBatchSource(without, (current) => withKey(current, 'nf_id', true))).toBe(without);
    const with_ = definition(source());
    expect(updateBatchSource(with_, (current) => withKey(current, 'nf_id', true))).toBe(with_);
    expect(updateBatchSource(with_, (current) => withDataset(current, DATASET))).toBe(with_);
  });

  it('outro dataset recomeça tudo', () => {
    expect(withDataset(source(), 'outro')).toEqual({ dataset_id: 'outro', key: [], filters: [], order_by: [], outputs: [] });
  });

  it('trazer uma variável usa o nome do catálogo e mantém os outros objetos', () => {
    const before = source();
    const after = withOutput(before, { id: 'v4', name: 'valor_item' });
    expect(after.outputs.at(-1)).toEqual({ variable_id: 'v4', name: 'valor_item' });
    after.outputs.slice(0, 3).forEach((output, index) => expect(output).toBe(before.outputs[index]));
    expect(after.key).toBe(before.key);
    expect(withOutput(after, { id: 'v4', name: 'valor_item' })).toBe(after);
  });

  it('tirar uma variável tira também da chave, dos filtros e da ordenação', () => {
    const before = source();
    const after = withoutOutput(before, before.outputs[0]!);
    expect(after.outputs.map((output) => output.name)).toEqual(['status', 'data_emissao']);
    expect(after.key).toEqual([]);
    expect(after.filters).toBe(before.filters);
    expect(after.order_by).toEqual([before.order_by[0]]);
    expect(after.order_by[0]).toBe(before.order_by[0]);
  });

  it('o nome novo segue na chave, nos filtros e na ordenação', () => {
    const before = source();
    const after = withOutputName(before, before.outputs[0]!, 'nota_id');
    expect(after.outputs[0]).toEqual({ variable_id: 'v1', name: 'nota_id' });
    expect(after.outputs[1]).toBe(before.outputs[1]);
    expect(after.key).toEqual(['nota_id']);
    expect(after.filters).toBe(before.filters);
    expect(after.order_by[0]).toBe(before.order_by[0]);
    expect(after.order_by[1]).toEqual({ variable: 'nota_id', direction: 'desc' });

    const renamed = withOutputName(before, before.outputs[1]!, 'situacao');
    expect(renamed.filters).toEqual([{ variable: 'situacao', operator: '=', values: ['"A"'] }]);
    expect(renamed.key).toBe(before.key);
  });

  it('a chave guarda a ordem em que foi montada', () => {
    const after = withKey(withKey(source(), 'data_emissao', true), 'status', true);
    expect(after.key).toEqual(['nf_id', 'data_emissao', 'status']);
    expect(withKey(after, 'nf_id', false).key).toEqual(['data_emissao', 'status']);
  });

  it('a ordenação: critério novo com a primeira variável que falta, e as setas trocam com o vizinho', () => {
    const before = source();
    expect(withNewOrder(before).order_by.at(-1)).toEqual({ variable: 'status', direction: 'asc' });
    expect(withNewOrder({ ...before, outputs: [] })).toEqual({ ...before, outputs: [] });

    const moved = withOrderMoved(before, before.order_by[1]!, -1);
    expect(moved.order_by[0]).toBe(before.order_by[1]);
    expect(moved.order_by[1]).toBe(before.order_by[0]);
    expect(withOrderMoved(before, before.order_by[0]!, -1)).toBe(before);
  });

  it('o lugar na definição analisada segue a variável, não a posição na tela', () => {
    const analyzed = definition(source());
    const moved = withOrderMoved(analyzed.root.batch_source!, analyzed.root.batch_source!.order_by[1]!, -1);
    expect(analyzedOrderPath(analyzed, moved.order_by[0]!)).toBe('root.batch_source.order_by[1]');
    expect(analyzedOutputPath(analyzed, { variable_id: 'v3', name: 'outro' })).toBe('root.batch_source.outputs[2]');
    expect(analyzedOutputPath(analyzed, { variable_id: 'v9', name: 'novo' })).toBeNull();
  });

  it('as linhas da barra: o tipo da análise e a chave', () => {
    expect(
      batchSourceBarRows(source(), [
        { name: 'nf_id', type: 'integer', scale: null, cardinality: 'linear', list: null, origin: 'batch_source', node_id: null, group_id: null },
        { name: 'status', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'x', group_id: null },
      ]),
    ).toEqual([
      { name: 'nf_id', type: 'integer', key: true },
      { name: 'status', type: null, key: false },
      { name: 'data_emissao', type: null, key: false },
    ]);
  });
});
