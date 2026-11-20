import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { TYPE_MISMATCH, exampleDraft, renderWithDraft } from '../canvas/canvas.test-support';
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

describe('Layers', () => {
  it('mostra Entradas, os blocos na ordem de root.nodes e Saída, com o que há dentro de cada barra', () => {
    renderWithDraft(<Layers />);
    expect(items()).toEqual([
      '1 Entradas',
      '2 valor_item',
      '2 categoria',
      '2 compras[]',
      '3 valor_compra',
      '1 Elegibilidade, Tabela de Decisão',
      '1 Pontos, Cálculo',
      '1 Total de compras, Cálculo',
      '1 Saída',
      '2 pontos',
    ]);
    expect(item('Entradas')).toHaveAttribute('aria-expanded', 'true');
    expect(item('Pontos, Cálculo')).not.toHaveAttribute('aria-expanded');
  });

  it('marca com o ícone de problema o bloco, as Entradas e a Saída que têm problema', () => {
    const inputsProblem: Schemas['WorkflowProblem'] = {
      code: 'duplicate_name',
      message: 'O nome categoria já existe.',
      path: 'root.inputs[1].name',
      node_id: null,
      start: null,
      end: null,
      suggestion: null,
    };
    renderWithDraft(<Layers />, { draft: exampleDraft({ problems: [TYPE_MISMATCH, inputsProblem] }) });
    expect(within(item(/^Pontos/)).getByRole('img', { name: '1 problema' })).toBeInTheDocument();
    expect(within(item(/^Entradas/)).getByRole('img', { name: '1 problema' })).toBeInTheDocument();
    expect(within(item(/^Elegibilidade/)).queryByRole('img')).not.toBeInTheDocument();
    expect(within(item(/^Saída/)).queryByRole('img')).not.toBeInTheDocument();
  });

  it('o clique seleciona o item; uma parte das Entradas seleciona as Entradas', async () => {
    const { user, probe } = renderWithDraft(<Layers />);
    await user.click(item('Pontos, Cálculo'));
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
    expect(item('Pontos, Cálculo')).toHaveAttribute('aria-selected', 'true');

    await user.click(item('valor_compra'));
    expect(probe.selection.item).toEqual({ type: 'inputs' });
    expect(item('Entradas')).toHaveAttribute('aria-selected', 'true');
    expect(item('Pontos, Cálculo')).toHaveAttribute('aria-selected', 'false');
  });

  it('acompanha a seleção feita em outro painel', () => {
    const { probe } = renderWithDraft(<Layers />);
    act(() => probe.select({ type: 'output' }));
    expect(item('Saída')).toHaveAttribute('aria-selected', 'true');
    expect(item('Saída')).toHaveAttribute('tabindex', '0');
  });

  it('teclado de árvore: setas, Home, End, abrir e fechar, Enter seleciona', async () => {
    const { user, probe } = renderWithDraft(<Layers />);
    const entradas = item('Entradas');
    expect(entradas).toHaveAttribute('tabindex', '0');
    entradas.focus();

    await user.keyboard('{ArrowLeft}');
    expect(entradas).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: 'valor_item' })).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(item('Elegibilidade, Tabela de Decisão')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowRight}');
    expect(item('Entradas')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowRight}');
    expect(item('valor_item')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(item('Entradas')).toHaveFocus();

    await user.keyboard('{End}');
    expect(item('pontos')).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}');
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_total' });
    await user.keyboard('{Home}');
    expect(item('Entradas')).toHaveFocus();
    await user.keyboard(' ');
    expect(probe.selection.item).toEqual({ type: 'inputs' });
  });

  it('sem entradas, blocos nem campos de saída, ficam só Entradas e Saída', () => {
    const draft = exampleDraft({ symbols: [], dependencies: [], order: [] });
    draft.definition = { ...draft.definition, root: { inputs: [], nodes: [], output: { fields: [] } } };
    renderWithDraft(<Layers />, { draft });
    expect(items()).toEqual(['1 Entradas', '1 Saída']);
    expect(item('Entradas')).not.toHaveAttribute('aria-expanded');
  });
});
