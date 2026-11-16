import { describe, expect, it } from 'vitest';
import { ateDe, desdeDe, diaValido, periodoInvertido } from './periodo';

describe('período do filtro', () => {
  it('"De" é o início do dia, no fuso de quem usa', () => {
    expect(desdeDe('2026-11-01')).toBe(new Date(2026, 10, 1).toISOString());
  });

  it('"Até" é exclusivo na API: vira o início do dia seguinte, e o dia escolhido entra inteiro', () => {
    expect(ateDe('2026-11-05')).toBe(new Date(2026, 10, 6).toISOString());
    expect(ateDe('2026-11-30')).toBe(new Date(2026, 11, 1).toISOString());
    expect(ateDe('2026-12-31')).toBe(new Date(2027, 0, 1).toISOString());
  });

  it('vazio, incompleto ou dia que não existe não vira filtro', () => {
    for (const valor of ['', '2026-11', '2026-02-30', '01/11/2026']) {
      expect(diaValido(valor)).toBe(false);
      expect(desdeDe(valor)).toBeUndefined();
      expect(ateDe(valor)).toBeUndefined();
    }
  });

  it('invertido só quando "De" vem depois de "Até"; o mesmo dia é um período de um dia', () => {
    expect(periodoInvertido('2026-11-06', '2026-11-05')).toBe(true);
    expect(periodoInvertido('2026-11-05', '2026-11-05')).toBe(false);
    expect(periodoInvertido('2026-11-01', '2026-11-05')).toBe(false);
    expect(periodoInvertido('2026-11-06', '')).toBe(false);
  });
});
