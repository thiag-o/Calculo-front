import { describe, expect, it } from 'vitest';
import { PARAMETERS } from './formula.test-support';
import {
  fixLabel,
  fixText,
  formulaSegments,
  parameterCompletionAt,
  parameterReferences,
  parameterTypeLabel,
  readParameterReference,
} from './parameters';

describe('parâmetros de execução na fórmula', () => {
  it('depois de @, oferece todos os parâmetros, trocando a partir do @; o período completa com o ponto', () => {
    expect(parameterCompletionAt('valor_item >= @', PARAMETERS)).toEqual({
      from: 14,
      items: [
        { label: '@periodo', insertText: '@periodo.', typeLabel: 'período', description: 'Parâmetro', reopens: true },
        { label: '@meta_minima', insertText: '@meta_minima', typeLabel: 'decimal(2)', description: 'Parâmetro', reopens: false },
        { label: '@categorias', insertText: '@categorias', typeLabel: 'lista de texto', description: 'Parâmetro', reopens: false },
        { label: '@lojas', insertText: '@lojas', typeLabel: 'lista de inteiro', description: 'Parâmetro', reopens: false },
      ],
    });
    // In the middle of the name, the same list, from the same `@` (the editor filters by what was typed).
    expect(parameterCompletionAt('valor_item >= @me', PARAMETERS)?.from).toBe(14);
  });

  it('depois de @periodo., oferece inicio e fim, trocando só a parte', () => {
    expect(parameterCompletionAt('data_emissao >= @periodo.', PARAMETERS)).toEqual({
      from: 25,
      items: [
        { label: 'inicio', insertText: 'inicio', typeLabel: 'data', description: 'Início do período', reopens: false },
        { label: 'fim', insertText: 'fim', typeLabel: 'data', description: 'Fim do período', reopens: false },
      ],
    });
    expect(parameterCompletionAt('@PERIODO.in', PARAMETERS)).toMatchObject({ from: 9, items: [{ label: 'inicio' }, { label: 'fim' }] });
  });

  it('depois do ponto de um parâmetro que não é período, não oferece nada', () => {
    expect(parameterCompletionAt('@meta_minima.', PARAMETERS)).toEqual({ from: 13, items: [] });
  });

  it('fora de uma referência, não é com ele: número com ponto, @ colado num nome e @ dentro de texto', () => {
    expect(parameterCompletionAt('valor_item * 1.', PARAMETERS)).toBeNull();
    expect(parameterCompletionAt('valor_item', PARAMETERS)).toBeNull();
    expect(parameterCompletionAt('email@', PARAMETERS)).toBeNull();
    expect(parameterCompletionAt('categoria = "a@', PARAMETERS)).toBeNull();
    expect(parameterCompletionAt('categoria = "a" + @', PARAMETERS)).not.toBeNull();
  });

  it('separa as referências do resto, para o realce do campo simples', () => {
    expect(formulaSegments('SE(data >= @periodo.inicio e loja em @lojas, "@nao", 0)')).toEqual([
      { text: 'SE(data >= ', parameter: false },
      { text: '@periodo.inicio', parameter: true },
      { text: ' e loja em ', parameter: false },
      { text: '@lojas', parameter: true },
      { text: ', "@nao", 0)', parameter: false },
    ]);
    // A part that is not one of the period's stays out of the reference.
    expect(formulaSegments('@periodo.meio')).toEqual([
      { text: '@periodo', parameter: true },
      { text: '.meio', parameter: false },
    ]);
    expect(formulaSegments('')).toEqual([]);
  });

  it('cada parâmetro vira as referências que ele oferece: o período pelas duas partes', () => {
    expect(parameterReferences(PARAMETERS).map((reference) => [reference.text, reference.part, reference.typeLabel])).toEqual([
      ['@periodo.inicio', 'inicio', 'data'],
      ['@periodo.fim', 'fim', 'data'],
      ['@meta_minima', null, 'decimal(2)'],
      ['@categorias', null, 'lista de texto'],
      ['@lojas', null, 'lista de inteiro'],
    ]);
  });

  it('lê uma referência escrita inteira, com ou sem parte', () => {
    expect(readParameterReference('@periodo.inicio')).toEqual({ name: 'periodo', part: 'inicio' });
    expect(readParameterReference(' @lojas ')).toEqual({ name: 'lojas', part: null });
    expect(readParameterReference('@')).toBeNull();
    expect(readParameterReference('@ lojas')).toBeNull();
    expect(readParameterReference('lojas')).toBeNull();
  });

  it('nomeia o tipo como o autocomplete mostra', () => {
    expect(parameterTypeLabel({ type: 'datetime', scale: null, list: false })).toBe('data e hora');
    expect(parameterTypeLabel({ type: 'decimal', scale: 4, list: true })).toBe('lista de decimal(4)');
  });

  it('a correção de um parâmetro desconhecido mantém o @ quando o trecho marcado o tem', () => {
    expect(fixText('unknown_parameter', '@categoria', 'categorias')).toBe('@categorias');
    expect(fixText('unknown_parameter', 'categoria', 'categorias')).toBe('categorias');
    expect(fixText('unknown_variable', 'valor_iten', 'valor_item')).toBe('valor_item');
    expect(fixLabel('unknown_parameter', 'categorias')).toBe('@categorias');
    expect(fixLabel('unknown_variable', 'valor_item')).toBe('valor_item');
  });
});
