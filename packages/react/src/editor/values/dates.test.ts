import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './dates';

describe('datas na tela', () => {
  it('mostra a data como dd/mm/aaaa, sem deslocar o dia', () => {
    expect(formatDate('2026-11-20')).toBe('20/11/2026');
    expect(formatDate('texto')).toBe('texto');
  });

  it('mostra data e hora no fuso do navegador e devolve o que não for data', () => {
    expect(formatDateTime(new Date(2026, 10, 20, 10, 30, 5).toISOString())).toBe('20/11/2026 10:30:05');
    expect(formatDateTime('texto')).toBe('texto');
  });
});
