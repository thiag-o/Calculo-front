import { describe, expect, it } from 'vitest';
import { definitionWith, problemAt, table } from './decision-table.test-support';
import { insertRule, moveRule, removeColumn, removeRule, setCell } from './tableModel';
import { cellKey, isGridPath, tableProblems } from './tableProblems';

const message = 'Problema de exemplo.';

describe('tableProblems', () => {
  it('põe cada problema na célula, na regra, no campo ou na tabela', () => {
    const node = table();
    const problems = [
      problemAt('.rules[1].when[0]', message),
      problemAt('.rules[0].then[1]', message),
      problemAt('.rules[2]', message, 'rule_width'),
      problemAt('.conditions[1].expression', message),
      problemAt('.results[0].default_value', message, 'missing_default_value'),
      problemAt('.name', message),
      problemAt('.rules', message, 'empty_decision_table'),
      { ...problemAt('', message, 'cycle'), path: null },
      { ...problemAt('.rules[0].when[0]', message), node_id: 'calc_antes', path: 'root.nodes[0].expression' },
    ];
    const placed = tableProblems(problems, definitionWith(node), node);
    expect([...placed.cells.keys()]).toEqual([cellKey(1, 0), cellKey(0, 3)]);
    expect([...placed.rules.keys()]).toEqual([2]);
    expect([...placed.fields.keys()]).toEqual(['condition:1', 'result:0:default_value', 'name']);
    expect(placed.table).toHaveLength(2);
    expect(placed.inGrid).toBe(3);
  });

  it('a marca segue a regra movida ou com outras incluídas antes, e some com a regra removida', () => {
    const analyzed = table();
    const definition = definitionWith(analyzed);
    const problems = [problemAt('.rules[0].then[1]', message)];

    expect([...tableProblems(problems, definition, moveRule(analyzed, 0, 1)).cells.keys()]).toEqual([cellKey(1, 3)]);
    expect([...tableProblems(problems, definition, insertRule(analyzed, 0)).cells.keys()]).toEqual([cellKey(1, 3)]);
    expect([...tableProblems(problems, definition, removeRule(analyzed, 0)).cells.keys()]).toEqual([]);
    // Edited in place (a new object at the same index): stays on the cell.
    expect([...tableProblems(problems, definition, setCell(analyzed, 0, 3, '0.2')).cells.keys()]).toEqual([cellKey(0, 3)]);
  });

  it('a marca segue a coluna quando outra coluna antes dela é removida', () => {
    const analyzed = table();
    const definition = definitionWith(analyzed);
    const problems = [problemAt('.rules[0].then[1]', message), problemAt('.rules[0].when[0]', message)];
    const current = removeColumn(analyzed, 0);
    expect([...tableProblems(problems, definition, current).cells.keys()]).toEqual([cellKey(0, 2)]);
  });

  it('reconhece o path de uma célula ou de uma regra, que pede a grade', () => {
    expect(isGridPath('root.nodes[3].rules[1].when[2]')).toBe(true);
    expect(isGridPath('root.nodes[3].rules[1].then[0]')).toBe(true);
    expect(isGridPath('root.nodes[3].rules[1]')).toBe(true);
    expect(isGridPath('root.nodes[3].conditions[0].expression')).toBe(false);
    expect(isGridPath('root.nodes[3].rules')).toBe(false);
    expect(isGridPath(null)).toBe(false);
  });
});
