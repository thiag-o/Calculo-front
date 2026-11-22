import { describe, expect, it } from 'vitest';
import { outputFileName } from './execution';

const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';

describe('nome do arquivo do CSV', () => {
  it('usa o filename do Content-Disposition', () => {
    expect(outputFileName(`attachment; filename="execution-${ID}.csv"`, ID)).toBe(`execution-${ID}.csv`);
    expect(outputFileName('attachment; filename=lote.csv', ID)).toBe('lote.csv');
  });

  it('prefere o filename* em UTF-8', () => {
    expect(outputFileName(`attachment; filename="x.csv"; filename*=UTF-8''pontua%C3%A7%C3%A3o.csv`, ID)).toBe('pontuação.csv');
  });

  it('tira qualquer pasta do nome', () => {
    expect(outputFileName('attachment; filename="../../etc/lote.csv"', ID)).toBe('lote.csv');
    expect(outputFileName('attachment; filename="C:\\temp\\lote.csv"', ID)).toBe('lote.csv');
  });

  it('sem o cabeçalho ou sem nome (incorporado, D40): execution-<id>.csv', () => {
    expect(outputFileName(null, ID)).toBe(`execution-${ID}.csv`);
    expect(outputFileName('attachment', ID)).toBe(`execution-${ID}.csv`);
    expect(outputFileName('attachment; filename=".."', ID)).toBe(`execution-${ID}.csv`);
  });
});
