import { describe, expect, it } from 'vitest';
import { definitionWith, table } from './decision-table.test-support';
import { freeResultName } from '../draft';
import { nestedDraft } from '../groups/groups.test-support';
import {
  MAX_RULES,
  addCondition,
  addResult,
  findTable,
  insertRule,
  moveRule,
  removeColumn,
  removeRule,
  setCell,
  setCells,
  updateTable,
  withType,
} from './tableModel';

describe('tableModel', () => {
  it('muda uma célula e mantém as outras regras como estavam (os mesmos objetos)', () => {
    const node = table();
    const next = setCell(node, 1, 3, '0.20');
    expect(next.rules[1]).toEqual({ when: ['"B"', ''], then: ['verdadeiro', '0.20'] });
    expect(next.rules[0]).toBe(node.rules[0]);
    expect(next.rules[2]).toBe(node.rules[2]);
    expect(setCell(node, 1, 3, '0.10')).toBe(node);
  });

  it('cola um bloco: acrescenta regras depois do fim, até 500, e ignora as colunas além da última', () => {
    const node = table();
    const next = setCells(node, 2, 2, [
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
    expect(next.rules.map((rule) => [...rule.when, ...rule.then])).toEqual([
      ['"A"', 'verdadeiro', 'verdadeiro', '0.15'],
      ['"B"', '', 'verdadeiro', '0.10'],
      ['-', '-', 'a', 'b'],
      ['', '', 'd', 'e'],
    ]);

    const full = table({ rules: Array.from({ length: MAX_RULES - 1 }, () => ({ when: ['', ''], then: ['', ''] })) });
    expect(setCells(full, MAX_RULES - 2, 0, [['1'], ['2'], ['3']]).rules).toHaveLength(MAX_RULES);
  });

  it('completa uma regra com menos células ao escrever nela', () => {
    const node = table({ rules: [{ when: ['"A"'], then: [] }] });
    expect(setCell(node, 0, 3, '1').rules[0]).toEqual({ when: ['"A"', ''], then: ['', '1'] });
  });

  it('inclui, remove e move regras', () => {
    const node = table();
    expect(insertRule(node, 1).rules[1]).toEqual({ when: ['', ''], then: ['', ''] });
    expect(insertRule(node).rules).toHaveLength(4);
    expect(removeRule(node, 0).rules[0]).toBe(node.rules[1]);
    const moved = moveRule(node, 0, 1);
    expect(moved.rules[0]).toBe(node.rules[1]);
    expect(moved.rules[1]).toBe(node.rules[0]);
    expect(moveRule(node, 0, -1)).toBe(node);
    expect(moveRule(node, 2, 1)).toBe(node);
  });

  it('inclui e remove colunas com a célula de cada regra', () => {
    const node = table();
    const withCondition = addCondition(node);
    expect(withCondition.rules[0]).toEqual({ when: ['"A"', 'verdadeiro', ''], then: ['verdadeiro', '0.15'] });
    const withResult = addResult(node, { name: 'bonus', type: 'integer', default_value: null });
    expect(withResult.rules[0]!.then).toEqual(['verdadeiro', '0.15', '']);
    expect(removeColumn(node, 0).rules[0]).toEqual({ when: ['verdadeiro'], then: ['verdadeiro', '0.15'] });
    expect(removeColumn(node, 3).rules[0]).toEqual({ when: ['"A"', 'verdadeiro'], then: ['verdadeiro'] });
    expect(removeColumn(node, 3).results.map((result) => result.name)).toEqual(['elegivel']);
  });

  it('o tipo decimal tem casas; os outros tipos ficam sem a chave', () => {
    const result = { name: 'fator', type: 'decimal' as const, scale: 4, default_value: null };
    expect(withType(result, 'integer', 2)).toEqual({ name: 'fator', type: 'integer', default_value: null });
    expect(withType({ name: 'x', type: 'text', default_value: null }, 'decimal', 2)).toEqual({ name: 'x', type: 'decimal', scale: 2, default_value: null });
  });

  it('o nome novo de resultado é o primeiro resultado_N livre no workflow', () => {
    const definition = definitionWith(table());
    expect(freeResultName(definition)).toBe('resultado_2');
  });

  it('muda só a tabela pedida e devolve a mesma definição quando nada muda', () => {
    const definition = definitionWith(table());
    expect(updateTable(definition, 'td_elegibilidade', (node) => node)).toBe(definition);
    expect(updateTable(definition, 'nao_existe', (node) => ({ ...node, name: 'x' }))).toBe(definition);
    const next = updateTable(definition, 'td_elegibilidade', (node) => ({ ...node, name: 'Outra' }));
    expect(next.root.nodes[0]).toBe(definition.root.nodes[0]);
    expect(next.root.nodes[1]!.name).toBe('Outra');
  });
});

describe('tableModel, Tabela dentro de grupos', () => {
  const inner = () => nestedDraft().definition;

  it('acha a Tabela em qualquer nível de grupo, e só ela (um Cálculo com o mesmo id não conta)', () => {
    expect(findTable(inner(), 'td_elegibilidade')?.node.name).toBe('Elegibilidade');
    expect(findTable(inner(), 'calc_pontos')).toBeNull();
    expect(findTable(inner(), 'nao_existe')).toBeNull();
  });

  it('edita a Tabela de dentro de dois grupos, recriando só os grupos em volta', () => {
    const definition = inner();
    const outer = definition.root.nodes[0]!;
    const bonus = definition.root.nodes[1]!;
    const next = updateTable(definition, 'td_elegibilidade', (node) => ({ ...node, name: 'Elegível' }));
    expect(findTable(next, 'td_elegibilidade')?.node.name).toBe('Elegível');
    expect(next.root.nodes[1]).toBe(bonus);
    expect(next.root.nodes[0]).not.toBe(outer);
    const pontos = (d: typeof definition) => {
      const campanha = d.root.nodes[0]!;
      const grupo = campanha.type === 'group' ? campanha.nodes[0]! : null;
      return grupo?.type === 'group' ? grupo.nodes[1] : null;
    };
    expect(pontos(next)).toBe(pontos(definition));
    expect(updateTable(definition, 'td_elegibilidade', (node) => node)).toBe(definition);
  });
});
