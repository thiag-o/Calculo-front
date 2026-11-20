import { describe, expect, it } from 'vitest';
import { buildCompletions, typeLabelOf } from './completions';
import { LANGUAGE, SYMBOLS } from './formula.test-support';

describe('itens do autocomplete', () => {
  it('cada símbolo traz nome, tipo, origem e a categoria do bloco de onde vem', () => {
    expect(buildCompletions(SYMBOLS, [], 'calculation')).toEqual([
      { type: 'symbol', label: 'valor_item', insertText: 'valor_item', typeLabel: 'decimal(2)', originLabel: 'Entrada', category: 'source' },
      { type: 'symbol', label: 'categoria', insertText: 'categoria', typeLabel: 'texto', originLabel: 'Entrada', category: 'source' },
      { type: 'symbol', label: 'pontuacoes', insertText: 'pontuacoes[]', typeLabel: 'lista', originLabel: 'Entrada múltipla', category: 'multi' },
      { type: 'symbol', label: 'valor_compra', insertText: 'valor_compra[]', typeLabel: 'decimal(2)', originLabel: 'Campo de pontuacoes', category: 'multi' },
      { type: 'symbol', label: 'fator', insertText: 'fator', typeLabel: 'decimal(4)', originLabel: 'Tabela de Decisão', category: 'decision' },
      { type: 'symbol', label: 'pontos_historico', insertText: 'pontos_historico', typeLabel: 'decimal(2)', originLabel: 'Cálculo', category: 'calc' },
    ]);
  });

  it('as funções do contexto, uma por nome, com as assinaturas, a descrição e os sinônimos', () => {
    const functions = buildCompletions([], LANGUAGE.functions, 'calculation');
    expect(functions.map((item) => item.label)).toEqual(['ARRED', 'MÍN', 'SOMA', 'MÉDIA']);
    expect(functions.find((item) => item.label === 'MÍN')).toEqual({
      type: 'function',
      label: 'MÍN',
      aliases: ['MIN'],
      signatures: ['MÍN(a, b, …)', 'MÍN(lista[])'],
      documentation: 'MÍN(a, b, …): O menor de dois ou mais números.\n\nMÍN(lista[]): O menor valor da lista, ignorando os nulos.',
    });
  });

  it('EXISTE só aparece nas condições da Tabela de Decisão', () => {
    expect(buildCompletions([], LANGUAGE.functions, 'decision_condition').map((item) => item.label)).toContain('EXISTE');
    expect(buildCompletions([], LANGUAGE.functions, 'decision_result').map((item) => item.label)).not.toContain('EXISTE');
  });

  it('nomeia os tipos como nas portas dos blocos', () => {
    const base = { name: 'x', scale: null, cardinality: 'linear', list: null, origin: 'input', node_id: null } as const;
    expect(typeLabelOf({ ...base, type: 'integer' })).toBe('inteiro');
    expect(typeLabelOf({ ...base, type: 'boolean' })).toBe('booleano');
    expect(typeLabelOf({ ...base, type: 'datetime' })).toBe('data e hora');
    expect(typeLabelOf({ ...base, type: 'decimal', scale: 0 })).toBe('decimal(0)');
  });
});
