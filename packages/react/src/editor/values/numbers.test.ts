import { describe, expect, it } from 'vitest';
import { formatApiNumber, readBrazilianNumber } from './numbers';

describe('números no padrão brasileiro (E4-24)', () => {
  it('converte 1.500,00 e 1500,5 para o texto com ponto, sem mexer nas casas', () => {
    expect(readBrazilianNumber('1.500,00', 2)).toEqual({ ok: true, value: '1500.00' });
    expect(readBrazilianNumber('1500,5', 2)).toEqual({ ok: true, value: '1500.5' });
    expect(readBrazilianNumber('1500,00', 2)).toEqual({ ok: true, value: '1500.00' });
    expect(readBrazilianNumber('1.234.567,8', 2)).toEqual({ ok: true, value: '1234567.8' });
  });

  it('recusa 1500,005 numa entrada de 2 casas, sem arredondar', () => {
    expect(readBrazilianNumber('1500,005', 2)).toEqual({ ok: false, message: 'Use no máximo 2 casas decimais.' });
    expect(readBrazilianNumber('0,15', 1)).toEqual({ ok: false, message: 'Use no máximo 1 casa decimal.' });
  });

  it('aceita sinal, espaços nas pontas e zeros à esquerda', () => {
    expect(readBrazilianNumber(' -3 ', 0)).toEqual({ ok: true, value: '-3' });
    expect(readBrazilianNumber('+12,5', 2)).toEqual({ ok: true, value: '12.5' });
    expect(readBrazilianNumber('007', 0)).toEqual({ ok: true, value: '7' });
    expect(readBrazilianNumber('-0,00', 2)).toEqual({ ok: true, value: '0.00' });
  });

  it('no inteiro, recusa casas decimais', () => {
    expect(readBrazilianNumber('1.500', 0)).toEqual({ ok: true, value: '1500' });
    expect(readBrazilianNumber('10,0', 0)).toEqual({ ok: false, message: 'Use um número inteiro, sem casas decimais.' });
    expect(readBrazilianNumber('dez', 0)).toEqual({ ok: false, message: 'Digite um número inteiro, como 1.500.' });
  });

  it('recusa o ponto como separador decimal e os milhares mal agrupados', () => {
    expect(readBrazilianNumber('1500.5', 2)).toEqual({ ok: false, message: 'Use vírgula para separar os decimais, como 1.500,50.' });
    expect(readBrazilianNumber('1.50,0', 2)).toEqual({ ok: false, message: 'Digite um número, como 1.500,50.' });
    expect(readBrazilianNumber('1500,', 2)).toEqual({ ok: false, message: 'Digite um número, como 1.500,50.' });
    expect(readBrazilianNumber('1e3', 2).ok).toBe(false);
  });

  it('ponto com zero antes não é milhar: 0.001, 0.500 e 00.123 pedem vírgula, nunca viram 1, 500 e 123', () => {
    const useComma = { ok: false, message: 'Use vírgula para separar os decimais, como 1.500,50.' };
    expect(readBrazilianNumber('0.001', 4)).toEqual(useComma);
    expect(readBrazilianNumber('0.500', 4)).toEqual(useComma);
    expect(readBrazilianNumber('00.123', 4)).toEqual(useComma);
    expect(readBrazilianNumber('-0.500', 4)).toEqual(useComma);
    expect(readBrazilianNumber('0.500', 0).ok).toBe(false);
    expect(readBrazilianNumber('0.500.000', 2).ok).toBe(false);
    // The thousands dots still work when the first group starts at 1-9.
    expect(readBrazilianNumber('1.500,00', 2)).toEqual({ ok: true, value: '1500.00' });
    expect(readBrazilianNumber('10.500', 0)).toEqual({ ok: true, value: '10500' });
    expect(readBrazilianNumber('100.500,25', 2)).toEqual({ ok: true, value: '100500.25' });
  });

  it('sem casas declaradas, não limita as casas', () => {
    expect(readBrazilianNumber('0,123456789012345678', null)).toEqual({ ok: true, value: '0.123456789012345678' });
  });

  it('mostra o número da API no padrão brasileiro, com todas as casas', () => {
    expect(formatApiNumber('1500.00')).toBe('1.500,00');
    expect(formatApiNumber('-1234567.5')).toBe('-1.234.567,5');
    expect(formatApiNumber('225')).toBe('225');
    expect(formatApiNumber('0.1500')).toBe('0,1500');
    expect(formatApiNumber('99999999999999999999.123456789012345678')).toBe('99.999.999.999.999.999.999,123456789012345678');
    expect(formatApiNumber('texto')).toBe('texto');
  });
});
