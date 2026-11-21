import { describe, expect, it } from 'vitest';
import { countText, problemsReason, readErrorTitle } from './messages';
import { columnsOf, formatValue, recordKeyText } from './values';

describe('valores da prévia', () => {
  it('mostra cada tipo no padrão brasileiro', () => {
    expect(formatValue('1500.00', 'decimal')).toBe('1.500,00');
    expect(formatValue('-3', 'integer')).toBe('-3');
    expect(formatValue('2026-10-05', 'date')).toBe('05/10/2026');
    expect(formatValue(true, 'boolean')).toBe('verdadeiro');
    expect(formatValue(null, 'text')).toBe('—');
    expect(formatValue(undefined, 'text')).toBe('—');
    expect(formatValue('', 'text')).toBe('—');
    expect(formatValue([{ a: '1' }, { a: '2' }], null)).toBe('lista com 2 itens');
    expect(formatValue('1500.00', null)).toBe('1500.00');
  });

  it('escreve a chave do registro com os nomes, na ordem', () => {
    expect(recordKeyText({ nf_id: '10', item_seq: '1' })).toBe('nf_id 10 · item_seq 1');
  });

  it('junta as colunas das linhas na ordem em que aparecem', () => {
    expect(columnsOf([{ a: 1 }, { b: 2, a: 3 }, {}])).toEqual(['a', 'b']);
  });
});

describe('textos da prévia', () => {
  it('contagens com singular e plural', () => {
    expect(countText.found(1)).toBe('1 encontrado');
    expect(countText.found(1480)).toBe('1.480 encontrados');
    expect(countText.noMatch(12)).toBe('12 sem correspondência');
    expect(countText.multipleRows(8, 3)).toBe('8 com mais de uma linha (máx. 3)');
    expect(countText.multipleRows(0, 1)).toBe('0 com mais de uma linha');
    expect(countText.kept(1)).toBe('1 passou no filtro');
    expect(countText.filtered(50)).toBe('50 filtrados');
  });

  it('motivo do botão desabilitado e títulos dos erros de leitura', () => {
    expect(problemsReason(1)).toBe('Resolva 1 problema para rodar a prévia');
    expect(problemsReason(3)).toBe('Resolva 3 problemas para rodar a prévia');
    expect(readErrorTitle('schema_drift')).toBe('O dataset mudou na origem');
    expect(readErrorTitle('source_read_denied')).toBe('Sem permissão de leitura na origem');
    expect(readErrorTitle('parameter_table_rows')).toBe('A tabela de parâmetros não tem exatamente uma linha');
    expect(readErrorTitle('division_by_zero')).toBe('Não foi possível ler a fonte');
  });
});
