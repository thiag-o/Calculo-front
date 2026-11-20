import { describe, expect, it } from 'vitest';
import { savedAgo } from './savedAgo';

describe('"Salvo há…"', () => {
  const now = new Date(2026, 10, 18, 15, 30);
  const at = (date: Date) => savedAgo(date.toISOString(), now);

  it('fala em instantes, minutos e horas no mesmo dia', () => {
    expect(at(new Date(2026, 10, 18, 15, 29, 30))).toBe('Salvo há instantes');
    expect(at(new Date(2026, 10, 18, 15, 31))).toBe('Salvo há instantes');
    expect(at(new Date(2026, 10, 18, 15, 18))).toBe('Salvo há 12 min');
    expect(at(new Date(2026, 10, 18, 13, 10))).toBe('Salvo há 2 h');
  });

  it('ontem com a hora, e antes disso com a data', () => {
    expect(at(new Date(2026, 10, 17, 3, 0))).toBe('Salvo ontem 03:00');
    expect(at(new Date(2026, 9, 2, 9, 0))).toBe('Salvo em 02/10');
    expect(at(new Date(2025, 9, 2, 9, 0))).toBe('Salvo em 02/10/2025');
  });
});
