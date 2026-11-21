import { describe, expect, it } from 'vitest';
import { DRAFT } from './unit-run.test-support';
import { readForm } from './values';

const inputs = DRAFT.definition.root.inputs;

describe('formulário do Calcular', () => {
  it('campo vazio vai como nulo e a múltipla vazia como lista vazia', () => {
    expect(readForm(inputs, {})).toEqual({
      ok: true,
      inputs: {
        valor_item: null,
        categoria: null,
        meta_atingida: null,
        quantidade: null,
        data_compra: null,
        momento: null,
        pontuacoes: [],
      },
    });
  });

  it('converte cada tipo para o valor da API', () => {
    const reading = readForm(inputs, {
      valor_item: '1.500,00',
      categoria: 'A',
      meta_atingida: 'false',
      quantidade: '3',
      data_compra: '2026-11-20',
      momento: '2026-11-20T10:30:15',
      pontuacoes: [
        { id: 1, fields: { valor_compra: '100,5', taxa: '0,15' } },
        { id: 2, fields: { valor_compra: '' } },
      ],
    });
    expect(reading).toEqual({
      ok: true,
      inputs: {
        valor_item: '1500.00',
        categoria: 'A',
        meta_atingida: false,
        quantidade: '3',
        data_compra: '2026-11-20',
        momento: new Date('2026-11-20T10:30:15').toISOString(),
        pontuacoes: [
          { valor_compra: '100.5', taxa: '0.15' },
          { valor_compra: null, taxa: null },
        ],
      },
    });
  });

  it('recusa no próprio campo, pelo caminho da API, e não monta o envio', () => {
    const reading = readForm(inputs, {
      valor_item: '1500,005',
      pontuacoes: [
        { id: 1, fields: { taxa: '0,1' } },
        { id: 2, fields: { taxa: '0,12345' } },
      ],
    });
    expect(reading).toEqual({
      ok: false,
      errors: { valor_item: 'Use no máximo 2 casas decimais.', 'pontuacoes[1].taxa': 'Use no máximo 4 casas decimais.' },
    });
  });

  it('campo só com espaços é vazio em número, data e booleano; o texto vai como digitado', () => {
    const reading = readForm(inputs, { valor_item: '   ', quantidade: ' ', data_compra: '  ', meta_atingida: ' ', momento: ' ', categoria: '  ' });
    expect(reading).toMatchObject({
      ok: true,
      inputs: { valor_item: null, quantidade: null, data_compra: null, meta_atingida: null, momento: null, categoria: '  ' },
    });
  });

  it('data que o navegador guarda incompleta é recusada, não vai como nulo', () => {
    expect(readForm(inputs, {}, new Set(['data_compra', 'momento']))).toEqual({
      ok: false,
      errors: { data_compra: 'Digite a data completa.', momento: 'Digite a data e a hora completas.' },
    });
  });
});
