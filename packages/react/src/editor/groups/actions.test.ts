import { describe, expect, it } from 'vitest';
import { groupNodes, groupReason, moveTargets, moveToGroup, outputCandidates, setCollapsed, setGroupOutputs, takeOutOfGroup, ungroup } from './actions';
import { GROUP_CONTENT } from './layout';
import { NOTHING_TO_GROUP_REASON, SAME_GROUP_REASON } from './messages';
import { groupedDraft, nestedDraft, ungroupedDraft, withSourceAndEmptyGroup } from './groups.test-support';
import { findEntry, findGroup, findNode, freeNodeId, declaredNames, treeEntries } from './tree';
import type { WorkflowDefinition } from '../draft';

/** Where each node is drawn, from the canvas origin: a node inside a group counts from the group's content area. */
function onScreen(definition: WorkflowDefinition): Record<string, { x: number; y: number }> {
  const at: Record<string, { x: number; y: number }> = {};
  for (const entry of treeEntries(definition)) {
    const parent = entry.parent === null ? { x: 0, y: 0 } : { x: at[entry.parent]!.x + GROUP_CONTENT.x, y: at[entry.parent]!.y + GROUP_CONTENT.y };
    at[entry.node.id] = { x: parent.x + entry.node.position.x, y: parent.y + entry.node.position.y };
  }
  return at;
}

describe('Agrupar e Desagrupar', () => {
  it('agrupa os blocos no lugar do primeiro, sem mover nenhum na tela, com o Output do que é lido fora', () => {
    const draft = ungroupedDraft();
    const before = onScreen(draft.definition);
    const grouped = groupNodes(draft.definition, ['calc_pontos', 'td_elegibilidade'], draft.dependencies)!;
    expect(grouped.group).toMatchObject({ id: 'grp_1', name: 'Grupo 1', collapsed: false, outputs: ['pontos'] });
    expect(grouped.definition.root.nodes.map((node) => node.id)).toEqual(['grp_1', 'calc_bonus']);
    expect(grouped.group.nodes.map((node) => node.id)).toEqual(['td_elegibilidade', 'calc_pontos']);
    const after = onScreen(grouped.definition);
    for (const id of ['td_elegibilidade', 'calc_pontos', 'calc_bonus']) expect(after[id]).toEqual(before[id]);
    // The blocks left untouched keep their object.
    expect(findNode(grouped.definition, 'calc_bonus')).toBe(findNode(draft.definition, 'calc_bonus'));
  });

  it('desagrupar devolve os blocos ao pai, no lugar do grupo, cada um onde estava na tela', () => {
    const draft = ungroupedDraft();
    const grouped = groupNodes(draft.definition, ['td_elegibilidade', 'calc_pontos'], draft.dependencies)!;
    const back = ungroup(grouped.definition, grouped.group.id);
    expect(back.root.nodes.map((node) => node.id)).toEqual(['td_elegibilidade', 'calc_pontos', 'calc_bonus']);
    expect(onScreen(back)).toEqual(onScreen(draft.definition));
    expect(back.root.nodes.map((node) => node.position)).toEqual(draft.definition.root.nodes.map((node) => node.position));
  });

  it('agrupa dentro de um grupo e o id novo é livre em todos os níveis', () => {
    const draft = groupedDraft();
    const grouped = groupNodes(draft.definition, ['calc_pontos'], draft.dependencies)!;
    expect(grouped.group.id).toBe('grp_1');
    expect(findEntry(grouped.definition, 'grp_1')!.parent).toBe('grp_pontuacao');
    // Pontos is read by the group's own Output: the new group gives it out.
    expect(grouped.group.outputs).toEqual(['pontos']);
    expect(freeNodeId(grouped.definition, 'grp').name).toBe('grp_2');
  });

  it('diz por que não agrupa: nada escolhido, ou blocos de grupos diferentes', () => {
    const draft = groupedDraft();
    expect(groupReason(draft.definition, [])).toBe(NOTHING_TO_GROUP_REASON);
    expect(groupReason(draft.definition, ['calc_pontos', 'calc_bonus'])).toBe(SAME_GROUP_REASON);
    expect(groupReason(draft.definition, ['grp_pontuacao', 'calc_bonus'])).toBeNull();
    expect(groupNodes(draft.definition, ['calc_pontos', 'calc_bonus'], draft.dependencies)).toBeNull();
  });
});

describe('Mover para o grupo e Tirar do grupo', () => {
  it('as opções de grupo deixam de fora o grupo atual, o próprio bloco e os grupos de dentro dele', () => {
    const draft = nestedDraft();
    expect(moveTargets(draft.definition, 'calc_bonus').map((target) => target.label)).toEqual(['Campanha', 'Campanha › Pontuação']);
    expect(moveTargets(draft.definition, 'calc_pontos').map((target) => target.id)).toEqual(['grp_campanha']);
    expect(moveTargets(draft.definition, 'grp_campanha')).toEqual([]);
  });

  it('mover para o grupo põe o bloco no fim do grupo, embaixo do que já está lá', () => {
    const draft = withSourceAndEmptyGroup();
    const once = moveToGroup(draft.definition, 'calc_bonus', 'grp_bonus');
    expect(findEntry(once, 'calc_bonus')).toMatchObject({ parent: 'grp_bonus', node: { position: { x: 0, y: 0 } } });
    const twice = moveToGroup(once, 'produto', 'grp_bonus');
    expect(findGroup(twice, 'grp_bonus')!.nodes.map((node) => [node.id, node.position])).toEqual([
      ['calc_bonus', { x: 0, y: 0 }],
      ['produto', { x: 0, y: 104 }],
    ]);
    expect(twice.root.nodes.map((node) => node.id)).toEqual(['td_elegibilidade', 'calc_pontos', 'grp_bonus']);
  });

  it('tirar do grupo põe o bloco no grupo de fora, ao lado do grupo, e o grupo deixa de entregar o que ele produz', () => {
    const draft = groupedDraft();
    const out = takeOutOfGroup(draft.definition, 'calc_pontos');
    expect(out.root.nodes.map((node) => node.id)).toEqual(['grp_pontuacao', 'calc_pontos', 'calc_bonus']);
    const group = findGroup(out, 'grp_pontuacao')!;
    expect(group.nodes.map((node) => node.id)).toEqual(['td_elegibilidade']);
    expect(group.outputs).toEqual([]);
    const moved = findNode(out, 'calc_pontos')!;
    expect(moved.position.y).toBe(GROUP_CONTENT.y);
    expect(moved.position.x).toBeGreaterThan(GROUP_CONTENT.x + 240);
    expect(takeOutOfGroup(out, 'calc_pontos')).toBe(out);
  });

  it('mover um bloco para fora de dois grupos tira o nome do Output dos dois', () => {
    const draft = nestedDraft();
    const moved = moveToGroup(draft.definition, 'calc_pontos', 'grp_campanha');
    // Still inside Campanha: it keeps giving pontos out; Pontuação no longer produces it.
    expect(findGroup(moved, 'grp_campanha')!.outputs).toEqual(['pontos']);
    expect(findGroup(moved, 'grp_pontuacao')!.outputs).toEqual([]);
  });
});

describe('recolher, Output e nomes', () => {
  it('recolher e expandir mudam só o collapsed do grupo', () => {
    const draft = nestedDraft();
    const collapsed = setCollapsed(draft.definition, 'grp_pontuacao', true);
    expect(findGroup(collapsed, 'grp_pontuacao')!.collapsed).toBe(true);
    expect(findNode(collapsed, 'calc_bonus')).toBe(findNode(draft.definition, 'calc_bonus'));
    expect(setCollapsed(collapsed, 'grp_pontuacao', true)).toBe(collapsed);
  });

  it('o Output escolhe entre as variáveis lineares produzidas dentro do grupo', () => {
    const draft = nestedDraft();
    expect(outputCandidates(draft.definition, draft.symbols, 'grp_pontuacao').map((symbol) => symbol.name)).toEqual(['fator', 'pontos']);
    // From outside the inner group, only its Output is produced inside Campanha.
    expect(outputCandidates(draft.definition, draft.symbols, 'grp_campanha').map((symbol) => symbol.name)).toEqual(['pontos']);
    const changed = setGroupOutputs(draft.definition, 'grp_pontuacao', ['pontos', 'fator']);
    expect(findGroup(changed, 'grp_pontuacao')!.outputs).toEqual(['pontos', 'fator']);
  });

  it('os nomes declarados contam os de dentro dos grupos e os das Fontes', () => {
    const names = declaredNames(nestedDraft().definition);
    expect([...names]).toEqual(expect.arrayContaining(['valor_item', 'categoria', 'fator', 'pontos', 'bonus']));
    expect(declaredNames(withSourceAndEmptyGroup().definition).has('limite')).toBe(true);
  });
});
