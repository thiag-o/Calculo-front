import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithDraft } from '../canvas/canvas.test-support';
import { findEntry } from '../groups';
import { nestedDraft, withSourceAndEmptyGroup } from '../groups/groups.test-support';
import { Layers } from './Layers';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function items(): string[] {
  return within(screen.getByRole('tree', { name: 'Camadas' }))
    .getAllByRole('treeitem')
    .map((item) => `${item.getAttribute('aria-level')} ${item.textContent}`);
}

function item(name: string | RegExp): HTMLElement {
  return screen.getByRole('treeitem', { name });
}

describe('Layers: grupos', () => {
  it('mostra a árvore aninhada: cada grupo com o que há dentro dele, grupo dentro de grupo', () => {
    renderWithDraft(<Layers />, { draft: nestedDraft() });
    expect(items()).toEqual([
      '1 Entradas',
      '2 valor_item',
      '2 categoria',
      '1 Campanha, Grupo',
      '2 Pontuação, Grupo',
      '3 Elegibilidade, Tabela de Decisão',
      '3 Pontos, Cálculo',
      '1 Bônus, Cálculo',
      '1 Saída',
      '2 bonus',
    ]);
    expect(item('Campanha, Grupo')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Pontuação, Grupo')).toHaveAttribute('aria-posinset', '1');
    expect(item('Pontuação, Grupo')).toHaveAttribute('aria-setsize', '1');
    expect(item('Pontos, Cálculo')).toHaveAttribute('aria-posinset', '2');
    expect(item('Campanha, Grupo').querySelector('.fc-layers-category')).toHaveAttribute('data-kind', 'group');
  });

  it('o grupo recolhe e expande pelas setas, e as setas entram e saem dos níveis', async () => {
    const { user, probe } = renderWithDraft(<Layers />, { draft: nestedDraft() });
    await user.click(item('Campanha, Grupo'));
    await user.keyboard('{ArrowLeft}');
    expect(item('Campanha, Grupo')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: 'Pontuação, Grupo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'Pontos, Cálculo' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(item('Bônus, Cálculo')).toHaveFocus();

    await user.keyboard('{ArrowUp}{ArrowRight}');
    expect(item('Campanha, Grupo')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    expect(item('Pontuação, Grupo')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(item('Elegibilidade, Tabela de Decisão')).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
    await user.keyboard('{ArrowLeft}');
    expect(item('Pontuação, Grupo')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Pontuação, Grupo')).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowLeft}');
    expect(item('Campanha, Grupo')).toHaveFocus();
    // Collapsing in the layers does not touch the draft: the canvas collapses by the group header.
    expect((findEntry(probe.definition, 'grp_pontuacao')!.node as { collapsed: boolean }).collapsed).toBe(false);
  });

  it('o bloco Fonte e um grupo vazio aparecem com o tipo; Delete num bloco de dentro do grupo pede a confirmação', async () => {
    const { user, probe } = renderWithDraft(<Layers />, { draft: nestedDraft() });
    await user.click(item('Pontos, Cálculo'));
    await user.keyboard('{Delete}');
    const dialog = await screen.findByRole('dialog', { name: 'Remover bloco' });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Remover bloco' })).not.toHaveAttribute('aria-disabled'), { timeout: 3000 });
    await user.click(within(dialog).getByRole('button', { name: 'Remover bloco' }));
    expect(findEntry(probe.definition, 'calc_pontos')).toBeUndefined();
    await waitFor(() => expect(item('Elegibilidade, Tabela de Decisão')).toHaveFocus());
    cleanup();

    renderWithDraft(<Layers />, { draft: withSourceAndEmptyGroup() });
    expect(item('Produto, Fonte').querySelector('.fc-layers-category')).toHaveAttribute('data-kind', 'source');
    expect(item('Grupo de bônus, Grupo')).not.toHaveAttribute('aria-expanded');
  });
});
