import { describe, expect, it } from 'vitest';
import type { WorkflowProblem } from '../draft';
import { DRAFT, TYPE_MISMATCH } from '../draft/editor.test-support';
import { countProblems, groupProblems, problemCountText, problemItem } from './problemGroups';

const definition = DRAFT.definition;
const at = (path: string | null, nodeId: string | null = null): WorkflowProblem => ({
  code: 'syntax_error',
  message: 'Fórmula incompleta.',
  path,
  node_id: nodeId,
  start: null,
  end: null,
  suggestion: null,
});

describe('Problemas: dono de cada problema', () => {
  it('é o bloco do node_id, ou o do root.nodes[i] do caminho, ou as entradas, a saída e o workflow', () => {
    expect(problemItem(TYPE_MISMATCH, definition)).toEqual({ type: 'node', id: 'calc_pontos' });
    expect(problemItem(at('root.nodes[0].rules[2].then[0]'), definition)).toEqual({ type: 'node', id: 'td_elegibilidade' });
    expect(problemItem(at('root.inputs[1].name'), definition)).toEqual({ type: 'inputs' });
    expect(problemItem(at('root.output.fields[0].variable'), definition)).toEqual({ type: 'output' });
    expect(problemItem(at('settings.rounding.scale'), definition)).toEqual({ type: 'workflow' });
    expect(problemItem(at(null), definition)).toEqual({ type: 'workflow' });
    // A path to a block that is no longer there belongs to the workflow.
    expect(problemItem(at('root.nodes[9].expression'), definition)).toEqual({ type: 'workflow' });
  });
});

describe('Problemas: grupos e contagem', () => {
  const problems = [at('root.inputs[0].name'), TYPE_MISMATCH, at('root.nodes[1].output.type'), at('root.nodes[0].conditions[0].expression')];

  it('agrupa por bloco na ordem em que vêm, com o nome e o tipo do bloco', () => {
    const groups = groupProblems(problems, definition);
    expect(groups.map((group) => [group.key, group.kind, group.title, group.problems.length])).toEqual([
      ['inputs', 'inputs', 'Entradas', 1],
      ['node:calc_pontos', 'calculation', 'Pontos', 2],
      ['node:td_elegibilidade', 'decision_table', 'Elegibilidade', 1],
    ]);
  });

  it('conta por bloco, para o canvas e as camadas', () => {
    const counts = countProblems([...problems, at('root.output.fields[0].name'), at('settings.error_policy')], definition);
    expect(counts.total).toBe(6);
    expect(Object.fromEntries(counts.byNode)).toEqual({ calc_pontos: 2, td_elegibilidade: 1 });
    expect([counts.inputs, counts.output, counts.workflow]).toEqual([1, 1, 1]);
  });

  it('escreve a quantidade no singular e no plural', () => {
    expect(problemCountText(1)).toBe('1 problema');
    expect(problemCountText(2)).toBe('2 problemas');
    expect(problemCountText(1200)).toBe('1.200 problemas');
  });
});

describe('Problemas: achados numa definição que já mudou', () => {
  it('o bloco sai da definição analisada, e o nome, da atual', () => {
    // Analyzed with the blocks in the other order, and "Pontos" renamed since then.
    const [table, calculation] = definition.root.nodes;
    const analyzed = { ...definition, root: { ...definition.root, nodes: [calculation!, table!] } };
    const current = {
      ...definition,
      root: {
        ...definition.root,
        nodes: definition.root.nodes.map((node) => (node.id === 'calc_pontos' ? { ...node, name: 'Pontos novos' } : node)),
      },
    };
    const problems = [at('root.nodes[0].expression')];

    expect(problemItem(problems[0]!, analyzed)).toEqual({ type: 'node', id: 'calc_pontos' });
    const [group] = groupProblems(problems, analyzed, current);
    expect(group).toMatchObject({ item: { type: 'node', id: 'calc_pontos' }, kind: 'calculation', title: 'Pontos novos' });
    expect(countProblems(problems, analyzed).byNode.get('calc_pontos')).toBe(1);
  });
});
