import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { WorkflowCanvas } from '../canvas';
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

  it('Esc numa linha tira a seleção, e a linha continua sendo a parada do Tab', async () => {
    const { user, probe } = renderWithDraft(<Layers />);
    await user.click(item('Pontos, Cálculo'));
    await user.keyboard('{Escape}');
    expect(probe.selection.item).toEqual({ type: 'workflow' });
    expect(item('Pontos, Cálculo')).toHaveAttribute('aria-selected', 'false');
    expect(item('Pontos, Cálculo')).toHaveFocus();
    expect(item('Pontos, Cálculo')).toHaveAttribute('tabindex', '0');
  });

  it('Delete num bloco pede a mesma confirmação do canvas; Cancelar devolve o foco à linha', async () => {
    const { user, probe } = renderWithDraft(<Layers />);
    item('Elegibilidade, Tabela de Decisão').focus();
    await user.keyboard('{Delete}');
    const dialog = await screen.findByRole('dialog', { name: 'Remover bloco' });
    expect(dialog).toHaveAccessibleDescription('Elegibilidade sai do rascunho. 1 bloco usa a saída dele e passa a mostrar problema. Ctrl Z desfaz.');
    expect(probe.selection.item).toEqual({ type: 'node', id: 'td_elegibilidade' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(item('Elegibilidade, Tabela de Decisão')).toHaveFocus());
    expect(probe.definition.root.nodes).toHaveLength(3);
  });

  it('remover pelas camadas é anunciado e o foco vai para o bloco vizinho; sem blocos, para as Entradas', async () => {
    const draft = exampleDraft();
    draft.definition = { ...draft.definition, root: { ...draft.definition.root, nodes: draft.definition.root.nodes.slice(1, 3) } };
    const { user, probe } = renderWithDraft(<Layers />, { draft });

    item('Total de compras, Cálculo').focus();
    await user.keyboard('{Delete}');
    await user.click(await screen.findByRole('button', { name: 'Remover bloco' }));
    expect(probe.definition.root.nodes.map((node) => node.id)).toEqual(['calc_pontos']);
    expect(probe.selection.item).toEqual({ type: 'workflow' });
    expect(screen.getByRole('status')).toHaveTextContent('Bloco Total de compras removido');
    // The last block had no next one: the focus goes to the previous one.
    await waitFor(() => expect(item('Pontos, Cálculo')).toHaveFocus());
    expect(item('Pontos, Cálculo')).toHaveAttribute('tabindex', '0');

    await user.keyboard('{Delete}');
    const remove = () => screen.getByRole('button', { name: 'Remover bloco' });
    // The count waits for the analysis of the previous removal.
    await waitFor(() => expect(remove()).not.toHaveAttribute('aria-disabled'), { timeout: 3000 });
    await user.click(remove());
    expect(screen.getByRole('status')).toHaveTextContent('Bloco Pontos removido');
    await waitFor(() => expect(item('Entradas')).toHaveFocus());
  });

  it('um anúncio igual ao anterior é lido de novo (termina com espaço sem quebra)', async () => {
    const draft = exampleDraft();
    const [first, second] = draft.definition.root.nodes.slice(1, 3);
    if (!first || !second) throw new Error('The example draft needs two blocks.');
    draft.definition = {
      ...draft.definition,
      root: { ...draft.definition.root, nodes: [{ ...first, name: 'Repetido' }, { ...second, name: 'Repetido' }] as typeof draft.definition.root.nodes },
    };
    const { user } = renderWithDraft(<Layers />, { draft });

    screen.getAllByRole('treeitem', { name: 'Repetido, Cálculo' })[0]?.focus();
    await user.keyboard('{Delete}');
    await user.click(await screen.findByRole('button', { name: 'Remover bloco' }));
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Bloco Repetido removido');

    await waitFor(() => expect(item('Repetido, Cálculo')).toHaveFocus());
    await user.keyboard('{Delete}');
    const remove = () => screen.getByRole('button', { name: 'Remover bloco' });
    await waitFor(() => expect(remove()).not.toHaveAttribute('aria-disabled'), { timeout: 3000 });
    await user.click(remove());
    expect(screen.getByRole('status').textContent).toBe('Bloco Repetido removido ');
  });

  it('Delete não faz nada nas Entradas, na Saída nem em só leitura', async () => {
    const { user } = renderWithDraft(<Layers />);
    item('Entradas').focus();
    await user.keyboard('{Delete}');
    item('Saída').focus();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    cleanup();

    const readOnly = renderWithDraft(<Layers />, { readOnly: true });
    item('Pontos, Cálculo').focus();
    await readOnly.user.keyboard('{Delete}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readOnly.probe.definition.root.nodes).toHaveLength(3);
  });

  it('a parada do Tab das camadas segue a seleção feita no canvas', async () => {
    const { user } = renderWithDraft(
      <>
        <Layers />
        <WorkflowCanvas />
      </>,
    );
    const pontos = await screen.findByRole('group', { name: /^Pontos/ });
    // The last row focused in the tree was Elegibilidade.
    act(() => item('Elegibilidade, Tabela de Decisão').focus());
    expect(item('Elegibilidade, Tabela de Decisão')).toHaveAttribute('tabindex', '0');

    pontos.focus();
    await user.keyboard(' ');
    expect(item('Pontos, Cálculo')).toHaveAttribute('tabindex', '0');
    expect(item('Elegibilidade, Tabela de Decisão')).toHaveAttribute('tabindex', '-1');
    // Shift+Tab from the canvas lands on the tree's stop: the block selected on the canvas.
    item('Pontos, Cálculo').focus();
    expect(item('Pontos, Cálculo')).toHaveAttribute('aria-selected', 'true');
  });

  it('sem entradas, blocos nem campos de saída, ficam só Entradas e Saída', () => {
    const draft = exampleDraft({ symbols: [], dependencies: [], order: [], groups: [] });
    draft.definition = { ...draft.definition, root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } } };
    renderWithDraft(<Layers />, { draft });
    expect(items()).toEqual(['1 Entradas', '1 Saída']);
    expect(item('Entradas')).not.toHaveAttribute('aria-expanded');
  });
});
