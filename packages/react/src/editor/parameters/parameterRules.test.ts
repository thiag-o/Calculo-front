import { describe, expect, it } from 'vitest';
import { allowedSpot, defaultSpot } from './parameterProblems';
import {
  defaultOfKind,
  fromLiteral,
  readErrorLimit,
  relativesFor,
  takesFixedDefault,
  toLiteral,
  withList,
  withParameterType,
  type WorkflowParameter,
} from './parameterRules';

function parameter(changes: Partial<WorkflowParameter> = {}): WorkflowParameter {
  return { name: 'p', type: 'text', required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...changes };
}

describe('literais dos parâmetros (D86)', () => {
  it('converte o que se digita no padrão brasileiro para o literal da linguagem e volta', () => {
    expect(toLiteral('text', null, 'diz "oi"')).toEqual({ ok: true, value: '"diz ""oi"""' });
    expect(fromLiteral('text', '"diz ""oi"""')).toBe('diz "oi"');
    expect(toLiteral('decimal', 2, '1.500,50')).toEqual({ ok: true, value: '1500.50' });
    expect(fromLiteral('decimal', '1500.50')).toBe('1.500,50');
    expect(toLiteral('integer', null, '1.500')).toEqual({ ok: true, value: '1500' });
    expect(toLiteral('date', null, '2026-10-01')).toEqual({ ok: true, value: 'DATA(2026, 10, 1)' });
    expect(fromLiteral('date', 'DATA(2026, 10, 1)')).toBe('2026-10-01');
    expect(toLiteral('boolean', null, 'verdadeiro')).toEqual({ ok: true, value: 'verdadeiro' });
    expect(fromLiteral('boolean', 'FALSO')).toBe('falso');
  });

  it('a data e hora não tem padrão fixo, só Nenhum ou o relativo Agora (D36)', () => {
    expect(takesFixedDefault('datetime')).toBe(false);
    expect(defaultOfKind(parameter({ type: 'datetime' }), 'fixed')).toBeNull();
    expect(defaultOfKind(parameter({ type: 'datetime' }), 'relative')).toEqual({ kind: 'relative', value: 'now' });
    // A text with a fixed default that becomes a date and time loses it.
    expect(withParameterType(parameter({ default: { kind: 'fixed', value: '"A"' } }), 'datetime', 2).default).toBeNull();
  });

  it('recusa o que não vira literal, sem arredondar', () => {
    expect(toLiteral('decimal', 2, '1,505')).toEqual({ ok: false, message: 'Use no máximo 2 casas decimais.' });
    expect(toLiteral('integer', null, '1,5').ok).toBe(false);
    expect(toLiteral('date', null, '01/10/2026').ok).toBe(false);
    expect(toLiteral('date', null, '2026-02-30').ok).toBe(false);
    expect(toLiteral('date', null, '2026-13-01').ok).toBe(false);
    expect(toLiteral('date', null, '2028-02-29')).toEqual({ ok: true, value: 'DATA(2028, 2, 29)' });
  });

  it('um literal que não cabe no seletor aparece como está', () => {
    expect(fromLiteral('date', 'hoje')).toBeNull();
    expect(fromLiteral('boolean', 'talvez')).toBeNull();
  });

  it('uma data que não existe no calendário também aparece como está, no modo texto', () => {
    expect(fromLiteral('date', 'DATA(2026, 2, 30)')).toBeNull();
    expect(fromLiteral('date', 'DATA(2026, 13, 1)')).toBeNull();
    expect(fromLiteral('date', 'DATA(2026, 0, 10)')).toBeNull();
    expect(fromLiteral('date', 'DATA(2028, 2, 29)')).toBe('2028-02-29');
    expect(fromLiteral('date', 'DATA(2026, 2, 29)')).toBeNull();
  });
});

describe('regras do parâmetro', () => {
  it('só os relativos que servem ao tipo, e nenhum numa lista', () => {
    expect(relativesFor('date', false)).toEqual(['today', 'yesterday', 'first_day_of_current_month', 'first_day_of_previous_month', 'last_day_of_previous_month']);
    expect(relativesFor('datetime', false)).toEqual(['now']);
    expect(relativesFor('period', false)).toEqual(['current_month', 'previous_month', 'last_7_days', 'last_30_days']);
    expect(relativesFor('decimal', false)).toEqual([]);
    expect(relativesFor('date', true)).toEqual([]);
  });

  it('trocar o tipo ajusta as casas, a lista, o padrão e os valores permitidos', () => {
    const text = parameter({ list: true, default: { kind: 'fixed', value: ['"A"'] }, allowed_values: ['"A"', '"B"'] });
    expect(withParameterType(text, 'period', 2)).toEqual(parameter({ type: 'period' }));
    expect(withParameterType(parameter({ type: 'integer', default: { kind: 'fixed', value: '10' } }), 'decimal', 2)).toEqual(
      parameter({ type: 'decimal', scale: 2, default: { kind: 'fixed', value: '10' } }),
    );
    expect(withParameterType(parameter({ type: 'date', default: { kind: 'relative', value: 'today' } }), 'datetime', 2).default).toBeNull();
  });

  it('virar lista leva o padrão fixo para uma lista de um valor, e voltar leva o primeiro', () => {
    const one = withList(parameter({ default: { kind: 'fixed', value: '"A"' } }), true);
    expect(one.default).toEqual({ kind: 'fixed', value: ['"A"'] });
    expect(withList({ ...one, default: { kind: 'fixed', value: ['"B"', '"C"'] } }, false).default).toEqual({ kind: 'fixed', value: '"B"' });
    expect(withList(parameter({ type: 'date', default: { kind: 'relative', value: 'today' } }), true).default).toBeNull();
  });

  it('o padrão fixo começa no formato do parâmetro', () => {
    expect(defaultOfKind(parameter({ type: 'period' }), 'fixed')).toEqual({ kind: 'fixed', value: { start: '', end: '' } });
    expect(defaultOfKind(parameter({ list: true }), 'fixed')).toEqual({ kind: 'fixed', value: [''] });
    expect(defaultOfKind(parameter({ type: 'period' }), 'relative')).toEqual({ kind: 'relative', value: 'current_month' });
  });

  it('o limite de erro vai de 0 a 100, com até 2 casas', () => {
    expect(readErrorLimit('2,5')).toBe('2.5');
    expect(readErrorLimit('100')).toBe('100');
    expect(readErrorLimit('100,01')).toBeNull();
    expect(readErrorLimit('2,555')).toBeNull();
    expect(readErrorLimit('-1')).toBeNull();
  });
});

describe('onde cai o problema do padrão e dos valores permitidos', () => {
  it('pelo path, no valor da lista ou numa ponta do período', () => {
    expect(defaultSpot('parameters[1].default', 'parameters[1]')).toBe('whole');
    expect(defaultSpot('parameters[1].default.value[2]', 'parameters[1]')).toBe(2);
    expect(defaultSpot('parameters[1].default.value.end', 'parameters[1]')).toBe('end');
    expect(allowedSpot('parameters[0].allowed_values[1]', 'parameters[0]')).toBe(1);
    expect(allowedSpot('parameters[0].allowed_values', 'parameters[0]')).toBeNull();
  });
});
