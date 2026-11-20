import { describe, expect, it } from 'vitest';
import { relativeTime } from './relativeTime';

// Local dates (the browser time zone), as the screen shows them.
const NOW = new Date(2026, 10, 18, 14, 5);
const at = (...parts: [number, number, number, number, number]) => new Date(...parts).toISOString();

describe('relativeTime', () => {
  it('menos de um minuto vira "há instantes", inclusive com o relógio um pouco adiantado', () => {
    expect(relativeTime(at(2026, 10, 18, 14, 4), new Date(2026, 10, 18, 14, 4, 30))).toBe('há instantes');
    expect(relativeTime(at(2026, 10, 18, 14, 6), NOW)).toBe('há instantes');
  });

  it('menos de uma hora conta em minutos', () => {
    expect(relativeTime(at(2026, 10, 18, 13, 53), NOW)).toBe('há 12 min');
    expect(relativeTime(at(2026, 10, 18, 13, 6), NOW)).toBe('há 59 min');
  });

  it('mais cedo no mesmo dia conta em horas', () => {
    expect(relativeTime(at(2026, 10, 18, 12, 0), NOW)).toBe('há 2 h');
    expect(relativeTime(at(2026, 10, 18, 0, 10), NOW)).toBe('há 13 h');
  });

  it('ontem mostra a hora', () => {
    expect(relativeTime(at(2026, 10, 17, 3, 0), NOW)).toBe('ontem 03:00');
    expect(relativeTime(at(2026, 10, 17, 23, 30), new Date(2026, 10, 18, 0, 30))).toBe('ontem 23:30');
  });

  it('antes de ontem mostra o dia e o mês, e o ano quando não é o atual', () => {
    expect(relativeTime(at(2026, 9, 2, 10, 0), NOW)).toBe('em 02/10');
    expect(relativeTime(at(2025, 11, 31, 10, 0), NOW)).toBe('em 31/12/2025');
  });
});
