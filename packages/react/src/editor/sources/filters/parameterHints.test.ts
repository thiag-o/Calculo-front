import { describe, expect, it } from 'vitest';
import type { Schemas } from '../../../api';
import { parameterHint, servingReferences } from './parameterHints';

function parameter(name: string, type: Schemas['ParameterType'], changes: Partial<Schemas['WorkflowParameter']> = {}): Schemas['WorkflowParameter'] {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...changes };
}

const PARAMETERS = [
  parameter('periodo', 'period'),
  parameter('data_corte', 'date'),
  parameter('agora', 'datetime'),
  parameter('lojas', 'integer', { list: true }),
  parameter('meta', 'decimal', { scale: 2 }),
];

const texts = (type: Schemas['DataType'], operator: Schemas['FilterOperator']) =>
  servingReferences(PARAMETERS, type, operator).map((reference) => reference.text);

describe('parâmetros que servem a um filtro (só dica)', () => {
  it('uma data aceita as partes do período e as datas; data e hora, só data e hora', () => {
    expect(texts('date', '>=')).toEqual(['@periodo.inicio', '@periodo.fim', '@data_corte']);
    expect(texts('datetime', '>=')).toEqual(['@agora']);
  });

  it('uma lista só no EM; inteiro e decimal servem um ao outro', () => {
    expect(texts('integer', '=')).toEqual(['@meta']);
    expect(texts('integer', 'in')).toEqual(['@lojas', '@meta']);
    expect(texts('text', 'in')).toEqual([]);
  });

  it('sem dica para o que não é uma referência inteira, nem para a que serve', () => {
    expect(parameterHint('@', PARAMETERS, 'text', '=')).toBeNull();
    expect(parameterHint('@ periodo', PARAMETERS, 'text', '=')).toBeNull();
    expect(parameterHint('A', PARAMETERS, 'text', '=')).toBeNull();
    expect(parameterHint('@PERIODO.FIM', PARAMETERS, 'date', '<=')).toBeNull();
    expect(parameterHint('@lojas', PARAMETERS, 'integer', 'in')).toBeNull();
  });
});
