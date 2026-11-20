import { describe, expect, it } from 'vitest';
import { codePointToUtf16, replaceCodePoints, utf16Range } from './positions';

describe('posições dos problemas (pontos de código → UTF-16)', () => {
  it('com acento de um caractere antes do trecho, a posição é a mesma', () => {
    const text = 'MÍN(preço_iten, 1)';
    expect(codePointToUtf16(text, 4)).toBe(4);
    expect(utf16Range(text, 4, 14)).toEqual({ start: 4, end: 14 });
    expect(text.slice(4, 14)).toBe('preço_iten');
  });

  it('um caractere de dois code units antes do trecho desloca a posição do Monaco', () => {
    // U+1D465 is one code point and two UTF-16 units.
    const text = '"\u{1D465}" + valor_iten';
    const start = [...'"\u{1D465}" + '].length;
    expect(start).toBe(6);
    expect(utf16Range(text, start, start + 10)).toEqual({ start: 7, end: 17 });
    expect(text.slice(7, 17)).toBe('valor_iten');
  });

  it('acento decomposto (letra e acento combinado) conta como dois pontos de código, como na API', () => {
    const text = '"é" + valor_iten';
    const start = [...'"é" + '].length;
    expect(utf16Range(text, start, start + 10)).toEqual({ start: 7, end: 17 });
  });

  it('sem posição, sem trecho; depois do fim, o fim do texto', () => {
    expect(utf16Range('abc', null, null)).toBeNull();
    expect(utf16Range('abc', 5, 9)).toEqual({ start: 3, end: 3 });
    expect(utf16Range('abc', 3, null)).toEqual({ start: 3, end: 3 });
  });

  it('troca o trecho do problema pela sugestão, contando pontos de código', () => {
    expect(replaceCodePoints('"\u{1D465}" + valor_iten * 2', 6, 16, 'valor_item')).toBe('"\u{1D465}" + valor_item * 2');
  });
});
