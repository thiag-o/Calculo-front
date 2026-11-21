import { describe, expect, it } from 'vitest';
import { fromLiteral, operatorsFor, toLiteral, valuesFor, withVariableType } from './filterRules';

describe('regras do filtro', () => {
  it('oferece a um texto só =, <>, em e os de nulo; a um booleano só =, <> e os de nulo; aos demais, todos', () => {
    expect(operatorsFor('text')).toEqual(['=', '<>', 'in', 'is_null', 'is_not_null']);
    expect(operatorsFor('boolean')).toEqual(['=', '<>', 'is_null', 'is_not_null']);
    for (const type of ['integer', 'decimal', 'date', 'datetime'] as const) {
      expect(operatorsFor(type)).toEqual(['=', '<>', '>', '>=', '<', '<=', 'between', 'in', 'is_null', 'is_not_null']);
    }
  });

  it('dá a cada operador o número de valores do contrato, mantendo os que cabem', () => {
    expect(valuesFor('is_null', ['1'])).toEqual([]);
    expect(valuesFor('between', ['1'])).toEqual(['1', '']);
    expect(valuesFor('in', [])).toEqual(['']);
    expect(valuesFor('in', ['1', '2'])).toEqual(['1', '2']);
    expect(valuesFor('=', ['1', '2'])).toEqual(['1']);
    expect(valuesFor('>', [])).toEqual(['']);
  });

  it('ao trocar a variável, volta para = o operador que o tipo novo não aceita e esvazia os valores de outro tipo', () => {
    expect(withVariableType({ operator: 'between', values: ['1', '2'] }, 'decimal', 'text')).toEqual({ operator: '=', values: [''] });
    expect(withVariableType({ operator: 'in', values: ['1', '2'] }, 'integer', 'decimal')).toEqual({ operator: 'in', values: ['1', '2'] });
    expect(withVariableType({ operator: '<>', values: ['"A"'] }, 'text', 'date')).toEqual({ operator: '<>', values: [''] });
  });

  it('escreve o literal da linguagem a partir do que foi digitado', () => {
    expect(toLiteral('text', null, 'A')).toEqual({ ok: true, value: '"A"' });
    expect(toLiteral('text', null, 'diz "oi"')).toEqual({ ok: true, value: '"diz ""oi"""' });
    expect(toLiteral('decimal', 2, '1.500,50')).toEqual({ ok: true, value: '1500.50' });
    expect(toLiteral('integer', null, '1.500')).toEqual({ ok: true, value: '1500' });
    expect(toLiteral('date', null, '2026-10-01')).toEqual({ ok: true, value: 'DATA(2026, 10, 1)' });
    expect(toLiteral('datetime', null, '2026-10-01T08:00:00-03:00')).toEqual({ ok: true, value: '2026-10-01T08:00:00-03:00' });
    expect(toLiteral('datetime', null, '2026-10-01T11:00Z')).toEqual({ ok: true, value: '2026-10-01T11:00Z' });
    expect(toLiteral('decimal', 2, '')).toEqual({ ok: true, value: '' });
    expect(toLiteral('decimal', 2, ' @periodo ')).toEqual({ ok: true, value: '@periodo' });
  });

  it('recusa o número fora do padrão brasileiro ou com casas a mais, sem arredondar', () => {
    expect(toLiteral('decimal', 2, '1500.50')).toEqual({ ok: false, message: 'Use vírgula para separar os decimais, como 1.500,50.' });
    expect(toLiteral('decimal', 2, '1,505')).toEqual({ ok: false, message: 'Use no máximo 2 casas decimais.' });
    expect(toLiteral('integer', null, '1,5')).toEqual({ ok: false, message: 'Use um número inteiro, sem casas decimais.' });
  });

  it('só aceita data e hora em ISO 8601 com fuso', () => {
    const refused = { ok: false, message: 'Use data e hora em ISO 8601 com fuso, como 2026-10-01T08:00:00-03:00.' };
    expect(toLiteral('datetime', null, '2026-10-01T08:00:00')).toEqual(refused);
    expect(toLiteral('datetime', null, '01/10/2026 08:00')).toEqual(refused);
    expect(toLiteral('datetime', null, '2026-13-01T08:00:00Z')).toEqual(refused);
    expect(toLiteral('datetime', null, 'DATA(2026, 1, 1)')).toEqual(refused);
  });

  it('recusa data e hora de um dia que não existe e aceita o 29 de fevereiro de ano bissexto', () => {
    const refused = { ok: false, message: 'Use data e hora em ISO 8601 com fuso, como 2026-10-01T08:00:00-03:00.' };
    expect(toLiteral('datetime', null, '2026-02-30T08:00-03:00')).toEqual(refused);
    expect(toLiteral('datetime', null, '2026-13-01T00:00Z')).toEqual(refused);
    expect(toLiteral('datetime', null, '2026-04-31T10:00+00:00')).toEqual(refused);
    expect(toLiteral('datetime', null, '2026-02-29T08:00-03:00')).toEqual(refused);
    expect(toLiteral('datetime', null, '2028-02-29T08:00-03:00')).toEqual({ ok: true, value: '2028-02-29T08:00-03:00' });
  });

  it('mostra o literal como a pessoa digita', () => {
    expect(fromLiteral('text', '"A"')).toBe('A');
    expect(fromLiteral('text', '"diz ""oi"""')).toBe('diz "oi"');
    expect(fromLiteral('decimal', '1500.50')).toBe('1.500,50');
    expect(fromLiteral('date', 'DATA(2026, 10, 1)')).toBe('2026-10-01');
    expect(fromLiteral('decimal', '@periodo')).toBe('@periodo');
    expect(fromLiteral('text', 'sem_aspas')).toBe('sem_aspas');
  });
});
