import { describe, expect, it } from 'vitest';
import { hasKeyOf, keyFields, keyText, readRecordKey, sameKey, typedFromKey, type KeyField } from './recordKey';
import { DRAFT_WITH_SOURCES } from './unit-run.test-support';
import { originPath, shortHash } from './UnitRunResult';

const FIELDS: KeyField[] = [
  { name: 'nf_id', type: 'text', scale: null },
  { name: 'item_seq', type: 'integer', scale: null },
  { name: 'valor', type: 'decimal', scale: 2 },
  { name: 'emissao', type: 'date', scale: null },
];

describe('chave do registro', () => {
  it('vem da fonte do lote, na ordem dela, com o tipo dos símbolos da análise', () => {
    expect(keyFields(DRAFT_WITH_SOURCES.definition, DRAFT_WITH_SOURCES.symbols)).toEqual([
      { name: 'nf_id', type: 'text', scale: null },
      { name: 'item_seq', type: 'integer', scale: null },
    ]);
  });

  it('sem o símbolo (análise ainda não chegou), o tipo é desconhecido', () => {
    expect(keyFields(DRAFT_WITH_SOURCES.definition, [])).toEqual([
      { name: 'nf_id', type: null, scale: null },
      { name: 'item_seq', type: null, scale: null },
    ]);
  });

  it('vai como texto: o texto como digitado, o número com ponto, a data como no campo', () => {
    expect(readRecordKey(FIELDS, { nf_id: ' 10', item_seq: '1.500', valor: '1.500,5', emissao: '2026-10-05' })).toEqual({
      ok: true,
      key: { nf_id: ' 10', item_seq: '1500', valor: '1500.5', emissao: '2026-10-05' },
    });
  });

  it('recusa o vazio, o número que não se lê e a data pela metade, no campo de cada um', () => {
    const reading = readRecordKey(FIELDS, { nf_id: '', item_seq: '1,5', valor: 'abc', emissao: '' }, new Set(['emissao']));
    expect(reading).toEqual({
      ok: false,
      errors: {
        nf_id: 'Digite o valor de nf_id.',
        item_seq: 'Use um número inteiro, sem casas decimais.',
        valor: 'Digite um número, como 1.500,50.',
        emissao: 'Digite a data completa.',
      },
    });
  });

  it('a chave de um registro da amostra preenche os campos no padrão brasileiro', () => {
    expect(typedFromKey(FIELDS, { nf_id: '10', item_seq: '1500', valor: '1500.50', emissao: '2026-10-05' })).toEqual({
      nf_id: '10',
      item_seq: '1.500',
      valor: '1.500,50',
      emissao: '2026-10-05',
    });
  });

  it('compara chaves e confere as variáveis', () => {
    expect(sameKey({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true);
    expect(sameKey({ a: '1' }, { a: '1', b: '2' })).toBe(false);
    expect(hasKeyOf(FIELDS.slice(0, 2), { nf_id: '1', item_seq: '2' })).toBe(true);
    expect(hasKeyOf(FIELDS.slice(0, 2), { nf_id: '1' })).toBe(false);
    expect(keyText({ nf_id: '10', item_seq: '1' })).toBe('nf_id 10 · item_seq 1');
  });
});

describe('trace na tela', () => {
  it('encurta o hash e mantém o algoritmo', () => {
    expect(shortHash('sha256:77b0db21bf50cd73110d3ba398acc52c')).toBe('sha256:77b0db21bf50…');
    expect(shortHash('abc')).toBe('abc');
  });

  it('a origem é conexão › dataset › coluna, sem conexão no Excel', () => {
    expect(originPath({ connection: 'ERP', dataset: 'Itens NF', column: 'vl_itm', row_key: {} })).toBe('ERP › Itens NF › vl_itm');
    expect(originPath({ connection: null, dataset: 'Cotações.xlsx', column: 'cotacao', row_key: {} })).toBe('Cotações.xlsx › cotacao');
  });
});
