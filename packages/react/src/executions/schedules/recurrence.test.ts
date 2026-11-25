import { describe, expect, it } from 'vitest';
import { NEW_RECURRENCE, readRecurrence, recurrenceText, type Recurrence } from './recurrence';

describe('Agendamentos: texto da recorrência', () => {
  const cases: [Recurrence, string][] = [
    [{ kind: 'daily', time: '02:00' }, 'Todo dia às 02:00'],
    [{ kind: 'weekly', time: '08:00', weekdays: [4, 1] }, 'Toda segunda e quinta às 08:00'],
    [{ kind: 'weekly', time: '08:00', weekdays: [1, 3, 5] }, 'Toda segunda, quarta e sexta às 08:00'],
    [{ kind: 'weekly', time: '09:30', weekdays: [6, 7] }, 'Todo sábado e domingo às 09:30'],
    [{ kind: 'weekly', time: '07:00', weekdays: [1, 2, 3, 4, 5, 6, 7] }, 'Todo dia às 07:00'],
    [{ kind: 'monthly', time: '02:00', day: 1 }, 'Todo dia 1 às 02:00'],
    [{ kind: 'monthly', time: '06:15', day: 28 }, 'Todo dia 28 às 06:15'],
    [{ kind: 'monthly', time: '23:00', day: 'last' }, 'Todo último dia do mês às 23:00'],
  ];
  it.each(cases)('%j → %s', (recurrence, text) => {
    expect(recurrenceText(recurrence)).toBe(text);
  });
});

describe('Agendamentos: leitura dos campos da recorrência', () => {
  it('completa a hora com zero e ordena os dias', () => {
    expect(readRecurrence({ ...NEW_RECURRENCE, kind: 'weekly', time: ' 8:05 ', weekdays: [5, 1, 5] })).toEqual({
      ok: true,
      recurrence: { kind: 'weekly', time: '08:05', weekdays: [1, 5] },
    });
  });

  it('cada tipo leva só os seus campos', () => {
    expect(readRecurrence({ ...NEW_RECURRENCE, time: '02:00', day: 'last' })).toEqual({ ok: true, recurrence: { kind: 'daily', time: '02:00' } });
    expect(readRecurrence({ ...NEW_RECURRENCE, kind: 'monthly', time: '23:00', day: 'last' })).toEqual({
      ok: true,
      recurrence: { kind: 'monthly', time: '23:00', day: 'last' },
    });
  });

  it.each([
    ['', 'Informe o horário, como 02:00.'],
    ['24:00', 'Use o formato HH:MM, de 00:00 a 23:59.'],
    ['2h', 'Use o formato HH:MM, de 00:00 a 23:59.'],
    ['12:60', 'Use o formato HH:MM, de 00:00 a 23:59.'],
  ])('recusa o horário %j', (time, message) => {
    expect(readRecurrence({ ...NEW_RECURRENCE, time })).toEqual({ ok: false, errors: { time: message } });
  });

  it('semanal sem dia: pede pelo menos um', () => {
    expect(readRecurrence({ ...NEW_RECURRENCE, kind: 'weekly', time: '08:00', weekdays: [] })).toEqual({
      ok: false,
      errors: { weekdays: 'Escolha pelo menos um dia da semana.' },
    });
  });
});
