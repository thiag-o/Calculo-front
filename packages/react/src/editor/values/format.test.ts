import { describe, expect, it } from 'vitest';
import { formatValue } from './format';

describe('formatValue', () => {
  it('formata cada tipo no padrão da tela', () => {
    expect(formatValue('1500.50', 'decimal')).toBe('1.500,50');
    expect(formatValue('1500', 'integer')).toBe('1.500');
    expect(formatValue('2026-11-20', 'date')).toBe('20/11/2026');
    expect(formatValue('1500.50', 'text')).toBe('1500.50');
    expect(formatValue('1500.50', undefined)).toBe('1500.50');
    expect(formatValue(true, 'boolean')).toBe('verdadeiro');
    expect(formatValue(false, 'boolean')).toBe('falso');
    expect(formatValue(null, 'decimal')).toBe('—');
    expect(formatValue([{ a: '1' }], null)).toBe('lista com 1 item');
    expect(formatValue([{ a: '1' }, { a: '2' }], undefined)).toBe('lista com 2 itens');
  });

  it('mostra "—" para o que não veio (undefined) e para o texto vazio, em qualquer tipo', () => {
    expect(formatValue(undefined, 'text')).toBe('—');
    expect(formatValue(undefined, 'decimal')).toBe('—');
    expect(formatValue('', 'text')).toBe('—');
    expect(formatValue('', undefined)).toBe('—');
  });
});
