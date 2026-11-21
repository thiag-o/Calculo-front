import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { renderWithDraft } from '../canvas/canvas.test-support';
import { useDraftEditor } from '../draft';
import { GroupProperties } from './GroupProperties';
import { groupedDraft, nestedDraft } from './groups.test-support';
import { findGroup } from './tree';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The properties of a group as the editor shows them: always of the group as it is in the definition. */
function Selected({ id }: { id: string }) {
  const { definition } = useDraftEditor();
  const group = findGroup(definition, id);
  return group ? <GroupProperties node={group} /> : null;
}

function problem(code: Schemas['ProblemCode'], message: string, path: string): Schemas['WorkflowProblem'] {
  return { code, message, path, node_id: 'grp_pontuacao', start: null, end: null, suggestion: null };
}

describe('GroupProperties', () => {
  it('mostra o nome, o Input derivado da análise e o Output escolhido entre as variáveis produzidas dentro', () => {
    renderWithDraft(<Selected id="grp_pontuacao" />, { draft: groupedDraft() });
    expect(screen.getByRole('heading', { name: 'Grupo' })).toBeInTheDocument();
    expect(screen.getByText('grp_pontuacao')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Nome do grupo/ })).toHaveValue('Pontuação');
    expect(within(screen.getByRole('list', { name: 'Input do grupo' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'categoria',
      'valor_item',
    ]);
    expect(screen.getByRole('checkbox', { name: 'fator' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'pontos' })).toBeChecked();
    // Bônus is produced outside the group: it is not offered.
    expect(screen.queryByRole('checkbox', { name: 'bonus' })).not.toBeInTheDocument();
  });

  it('marcar e desmarcar muda o Output do grupo no rascunho', async () => {
    const { user, probe } = renderWithDraft(<Selected id="grp_pontuacao" />, { draft: groupedDraft() });
    await user.click(screen.getByRole('checkbox', { name: 'fator' }));
    expect(findGroup(probe.definition, 'grp_pontuacao')!.outputs).toEqual(['pontos', 'fator']);
    await user.click(screen.getByRole('checkbox', { name: 'pontos' }));
    expect(findGroup(probe.definition, 'grp_pontuacao')!.outputs).toEqual(['fator']);
    fireEvent.change(screen.getByRole('textbox', { name: /^Nome do grupo/ }), { target: { value: 'Pontuação do item' } });
    expect(findGroup(probe.definition, 'grp_pontuacao')!.name).toBe('Pontuação do item');
  });

  it('o grupo de dentro de outro também é editado onde está, e os problemas do Output aparecem no campo', () => {
    const draft = nestedDraft();
    draft.problems = [
      problem('empty_group_output', 'O grupo Pontuação não entrega nenhuma variável.', 'root.nodes[0].nodes[0].outputs'),
      problem('multiple_in_output', 'pontos é múltipla e não pode sair do grupo.', 'root.nodes[0].nodes[0].outputs[0]'),
    ];
    renderWithDraft(<Selected id="grp_pontuacao" />, { draft });
    expect(screen.getByText('O grupo Pontuação não entrega nenhuma variável.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'pontos' })).toHaveAccessibleDescription(/pontos é múltipla/);
  });

  it('sem análise do grupo, o Input diz que não há nada de fora; sem variáveis dentro, diz o que falta', () => {
    const draft = { ...groupedDraft(), groups: [], symbols: [] };
    renderWithDraft(<Selected id="grp_pontuacao" />, { draft });
    expect(screen.getByText('Nenhuma variável de fora.')).toBeInTheDocument();
    // pontos stays listed, checked, so it can be unchecked.
    expect(screen.getByRole('checkbox', { name: 'pontos' })).toBeChecked();
  });

  it('só leitura: os campos ficam desabilitados com o motivo', () => {
    renderWithDraft(<Selected id="grp_pontuacao" />, { draft: groupedDraft(), readOnly: true });
    expect(screen.getByText('Você não tem permissão para editar este workflow')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'pontos' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'pontos' })).toHaveAccessibleDescription(/Você não tem permissão/);
    expect(screen.getByRole('textbox', { name: /^Nome do grupo/ })).toBeDisabled();
  });
});
