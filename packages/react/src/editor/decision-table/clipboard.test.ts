import { describe, expect, it } from 'vitest';
import { cleanCell, isBlock, parseClipboard } from './clipboard';

const cells = (text: string) => parseClipboard(text).cells;

describe('parseClipboard', () => {
  it('lê o bloco do Excel: linhas por quebra, células por tabulação, sem a quebra do fim', () => {
    expect(cells('"A"\tverdadeiro\r\n"B"\tfalso\r\n"C"\t-\r\n')).toEqual([
      ['"A"', 'verdadeiro'],
      ['"B"', 'falso'],
      ['"C"', '-'],
    ]);
    expect(parseClipboard('1\t2\n3\t4')).toEqual({
      cells: [
        ['1', '2'],
        ['3', '4'],
      ],
      rows: 2,
      width: 2,
    });
  });

  it('mantém as células vazias, no meio e no fim da linha', () => {
    expect(cells('a\t\tc\n\t\t\n')).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('guarda as aspas de um literal de texto, que o Excel copia sem aspas extras', () => {
    expect(cells('"A"\t"B C"\n')).toEqual([['"A"', '"B C"']]);
    expect(cells('EM ("A", "B")')).toEqual([['EM ("A", "B")']]);
    expect(cells('""\tx')).toEqual([['""', 'x']]);
  });

  it('desfaz a célula inteira entre aspas com as aspas internas dobradas, mesmo sem quebra de linha', () => {
    expect(cells('"""A"""\t"x ""y"""\n')).toEqual([['"A"', 'x "y"']]);
    expect(cells('""""')).toEqual([['"']]);
  });

  it('lê a célula com quebra de linha que o Excel põe entre aspas, e a quebra vira espaço', () => {
    expect(cells('"linha 1\nlinha ""2"""\tx\r\ny\tz\r\n')).toEqual([
      ['linha 1 linha "2"', 'x'],
      ['y', 'z'],
    ]);
  });

  it('tira os caracteres de controle de cada célula', () => {
    expect(cells('\uFEFFa\u0000b\u0008c\u000Bd\u000Ce\u001Ff\u007Fg\u2028h\u2029i\u001Bj\tk\n')).toEqual([['abcdefghij', 'k']]);
  });

  it('guarda só as linhas e as células dentro do limite, mas conta o bloco inteiro', () => {
    const text = 'a\tb\tc\n'.repeat(1000) + 'x\ty\tz\tw\n';
    const block = parseClipboard(text, { rows: 2, columns: 2 });
    expect(block.cells).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ]);
    expect(block.rows).toBe(1001);
    expect(block.width).toBe(4);
  });

  it('um bloco de centenas de milhares de linhas não estoura a pilha', () => {
    const block = parseClipboard('1\t2\n'.repeat(400000), { rows: 500, columns: 2 });
    expect(block.cells).toHaveLength(500);
    expect(block.rows).toBe(400000);
    expect(block.width).toBe(2);
  });

  it('texto vazio não é bloco nenhum', () => {
    expect(parseClipboard('')).toEqual({ cells: [], rows: 0, width: 0 });
    expect(parseClipboard('\r\n')).toEqual({ cells: [], rows: 0, width: 0 });
  });
});

describe('cleanCell', () => {
  it('corta em 10.000 caracteres sem partir um par substituto', () => {
    expect(cleanCell('a'.repeat(10001))).toHaveLength(10000);
    const emoji = '\u{1F600}';
    expect(cleanCell(`${'a'.repeat(9999)}${emoji}`)).toBe('a'.repeat(9999));
    // Cleaned first, cut after: the removed characters do not count.
    expect(cleanCell(`${'\u0000'.repeat(5)}${'b'.repeat(10000)}`)).toBe('b'.repeat(10000));
  });
});

describe('isBlock', () => {
  it('é bloco com tabulação ou mais de uma linha; uma célula com a quebra do fim não é', () => {
    expect(isBlock('a\tb')).toBe(true);
    expect(isBlock('a\nb')).toBe(true);
    expect(isBlock('a\r\n')).toBe(false);
    expect(isBlock('"A"')).toBe(false);
  });
});
