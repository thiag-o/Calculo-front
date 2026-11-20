import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Layers } from '../layers';
import { WorkflowCanvas } from './WorkflowCanvas';
import { TYPE_MISMATCH, blockOf, exampleDraft, renderWithDraft } from './canvas.test-support';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A canvas node (a block or a bar) by its accessible name. */
function node(name: string | RegExp): HTMLElement {
  return screen.getByRole('group', { name });
}

/**
 * A click on the canvas. user-event sends the mouse events with `view` null (it cannot be changed on its events), and
 * React Flow's drag (d3) needs the window there: the canvas gets the click itself, like after a press without moving.
 */
function clickOnCanvas(element: Element) {
  fireEvent.click(element);
}

function links(): Element[] {
  return [...document.querySelectorAll('.react-flow__edge')];
}

/** "Remover bloco", once the count of who uses the block is known (the analysis of the latest change is back). */
async function confirmRemoval(user: UserEvent) {
  // The button is drawn again when it stops waiting: found again on each try.
  const remove = () => screen.getByRole('button', { name: 'Remover bloco' });
  await waitFor(() => expect(remove()).not.toHaveAttribute('aria-disabled'), { timeout: 3000 });
  await user.click(remove());
}

async function renderCanvas(options: Parameters<typeof renderWithDraft>[1] = {}, onOpenProperties?: () => void) {
  const rendered = renderWithDraft(<WorkflowCanvas onOpenProperties={onOpenProperties} />, options);
  await screen.findByRole('group', { name: /^Pontos/ });
  return rendered;
}

describe('WorkflowCanvas', () => {
  it('mostra os blocos com o tipo, as portas que leem e produzem e as barras Entradas e Saída', async () => {
    await renderCanvas();
    const pontos = node('Pontos, Cálculo');
    expect(within(pontos).getByText('Cálculo')).toBeInTheDocument();
    const reads = within(pontos).getByRole('list', { name: 'Lê' });
    expect(within(reads).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['fatordecimal(4)', 'valor_itemdecimal(2)']);
    const produces = within(pontos).getByRole('list', { name: 'Produz' });
    expect(produces).toHaveTextContent('pontosdecimal(2)');
    expect(within(node('Elegibilidade, Tabela de Decisão')).getByText('Tabela de Decisão')).toBeInTheDocument();

    const inputs = within(node('Entradas')).getByRole('list', { name: 'Entradas declaradas' });
    expect(within(inputs).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'valor_itemdecimal(2)',
      'categoriatext',
      'compras[]lista',
      'valor_compra[]decimal(2)',
    ]);
    expect(within(node('Saída')).getByRole('list', { name: 'Campos de saída' })).toHaveTextContent('pontosdecimal(2)');
  });

  it('as ligações vêm da análise do rascunho de exemplo, sem nenhuma desenhada à mão', async () => {
    await renderCanvas();
    await waitFor(() => expect(links()).toHaveLength(5));
    expect(links().map((link) => link.getAttribute('aria-label'))).toEqual([
      'categoria, de Entradas para Elegibilidade',
      'fator, de Elegibilidade para Pontos',
      'valor_item, de Entradas para Pontos',
      'valor_compra, de Entradas para Total de compras',
      'pontos, de Pontos para Saída',
    ]);
    // Nothing connects by hand: the ports are not connectable.
    for (const handle of document.querySelectorAll('.react-flow__handle')) expect(handle).not.toHaveClass('connectable');
  });

  it('as ligações do bloco selecionado ficam em destaque', async () => {
    await renderCanvas();
    await waitFor(() => expect(links()).toHaveLength(5));
    clickOnCanvas(within(node('Pontos, Cálculo')).getByText('Pontos'));
    const active = () => document.querySelectorAll('.react-flow__edge.fc-canvas-link-active');
    await waitFor(() => expect(active()).toHaveLength(3));
    expect([...active()].map((link) => link.getAttribute('aria-label'))).toEqual([
      'fator, de Elegibilidade para Pontos',
      'valor_item, de Entradas para Pontos',
      'pontos, de Pontos para Saída',
    ]);
  });

  it('mostra o ícone vermelho e o número de problemas no cabeçalho do bloco', async () => {
    await renderCanvas({ draft: exampleDraft({ problems: [TYPE_MISMATCH] }) });
    const pontos = node('Pontos, Cálculo, 1 problema');
    expect(within(pontos).getByRole('img', { name: '1 problema' })).toHaveTextContent('1');
    expect(within(node('Elegibilidade, Tabela de Decisão')).queryByRole('img')).not.toBeInTheDocument();
  });

  it('a marca do problema acompanha o bloco quando outro é incluído ou removido antes da nova análise', async () => {
    const { user } = await renderCanvas({ draft: exampleDraft({ problems: [TYPE_MISMATCH] }) });
    fireEvent.keyDown(node('Elegibilidade, Tabela de Decisão'), { key: 'Delete' });
    await user.click(await screen.findByRole('button', { name: 'Remover bloco' }));
    // "Pontos" is now root.nodes[0]: the mark stays on it, not on the block that took its old position.
    expect(node('Pontos, Cálculo, 1 problema')).toBeInTheDocument();
    expect(node('Total de compras, Cálculo')).toBeInTheDocument();
  });

  it('a barra de ferramentas inclui um Cálculo perto do centro, com id e saída livres, e o seleciona', async () => {
    const { user, probe } = await renderCanvas();
    const before = probe.definition.root.nodes;
    const toolbar = screen.getByRole('toolbar', { name: 'Incluir bloco' });
    await user.click(within(toolbar).getByRole('button', { name: 'Cálculo' }));

    const nodes = probe.definition.root.nodes;
    expect(nodes.map((candidate) => candidate.id)).toEqual(['td_elegibilidade', 'calc_pontos', 'calc_total', 'calc_1']);
    before.forEach((block, index) => expect(nodes[index]).toBe(block));
    expect(nodes[3]).toMatchObject({ name: 'Cálculo 1', output: { name: 'resultado_1' } });
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_1' });
    expect(await screen.findByRole('group', { name: 'Cálculo 1, Cálculo' })).toHaveAttribute('aria-current', 'true');
  });

  it('a barra de ferramentas inclui uma Tabela de Decisão; as setas passam entre as ferramentas', async () => {
    const { user, probe } = await renderCanvas();
    const calculation = screen.getByRole('button', { name: 'Cálculo' });
    const table = screen.getByRole('button', { name: 'Tabela de Decisão' });
    expect(calculation).toHaveAttribute('tabindex', '0');
    expect(table).toHaveAttribute('tabindex', '-1');
    calculation.focus();
    await user.keyboard('{ArrowRight}');
    expect(table).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(blockOf(probe.definition, 'td_1')).toMatchObject({ type: 'decision_table', name: 'Tabela de Decisão 1' });
  });

  it('as setas movem o bloco e gravam a position; pressões seguidas são um passo de desfazer', async () => {
    const { user, probe } = await renderCanvas();
    const pontos = node('Pontos, Cálculo');
    const others = [blockOf(probe.definition, 'td_elegibilidade'), blockOf(probe.definition, 'calc_total')];
    pontos.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}');
    expect(blockOf(probe.definition, 'calc_pontos')!.position).toEqual({ x: 256, y: 8 });
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(blockOf(probe.definition, 'calc_pontos')!.position).toEqual({ x: 224, y: 8 });
    expect(blockOf(probe.definition, 'td_elegibilidade')).toBe(others[0]);
    expect(blockOf(probe.definition, 'calc_total')).toBe(others[1]);
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
    expect(screen.getByRole('status')).toHaveTextContent('Pontos na posição 224, 8');

    act(() => probe.undo());
    expect(blockOf(probe.definition, 'calc_pontos')!.position).toEqual({ x: 240, y: 0 });
  });

  it('arrastar com o mouse grava a position ao soltar', async () => {
    const { probe } = await renderCanvas();
    const pontos = node('Pontos, Cálculo');
    fireEvent.mouseDown(pontos, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { button: 0, clientX: 140, clientY: 132 });
    fireEvent.mouseMove(document, { button: 0, clientX: 180, clientY: 164 });
    fireEvent.mouseUp(document, { button: 0, clientX: 180, clientY: 164 });
    // The first move only passes the drag threshold; the second one moves the block by (40, 32).
    await waitFor(() => expect(blockOf(probe.definition, 'calc_pontos')!.position).toEqual({ x: 280, y: 32 }));
    expect(blockOf(probe.definition, 'td_elegibilidade')!.position).toEqual({ x: 0, y: 0 });
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
  });

  it('Delete pede confirmação com quantos blocos usam a saída; Cancelar mantém e Remover bloco remove', async () => {
    const { user, probe } = await renderCanvas();
    const table = node('Elegibilidade, Tabela de Decisão');
    table.focus();
    await user.keyboard('{Delete}');
    const dialog = await screen.findByRole('dialog', { name: 'Remover bloco' });
    expect(dialog).toHaveAccessibleDescription('Elegibilidade sai do rascunho. 1 bloco usa a saída dele e passa a mostrar problema. Ctrl Z desfaz.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(blockOf(probe.definition, 'td_elegibilidade')).toBeDefined();
    await waitFor(() => expect(table).toHaveFocus());

    const others = [blockOf(probe.definition, 'calc_pontos'), blockOf(probe.definition, 'calc_total')];
    await user.keyboard('{Delete}');
    await user.click(await screen.findByRole('button', { name: 'Remover bloco' }));
    expect(probe.definition.root.nodes).toEqual(others);
    expect(probe.definition.root.nodes[0]).toBe(others[0]);
    expect(probe.selection.item).toEqual({ type: 'workflow' });
    expect(screen.queryByRole('group', { name: /^Elegibilidade/ })).not.toBeInTheDocument();
  });

  it('a confirmação diz quando nenhum bloco usa a saída', async () => {
    const { user } = await renderCanvas();
    node('Pontos, Cálculo').focus();
    await user.keyboard('{Delete}');
    expect(await screen.findByRole('dialog', { name: 'Remover bloco' })).toHaveAccessibleDescription(
      'Pontos sai do rascunho. Nenhum bloco usa a saída dele. Ctrl Z desfaz.',
    );
  });

  it('com a análise atrasada, a confirmação diz "Conferindo quem usa este bloco…" e espera a análise para dar a contagem', async () => {
    const { user, probe } = await renderCanvas();
    const table = node('Elegibilidade, Tabela de Decisão');
    table.focus();
    // A move changes the definition: its analysis comes 400 ms later.
    await user.keyboard('{ArrowRight}{Delete}');
    const dialog = await screen.findByRole('dialog', { name: 'Remover bloco' });
    expect(dialog).toHaveAccessibleDescription('Elegibilidade sai do rascunho. Conferindo quem usa este bloco… Ctrl Z desfaz.');
    const remove = within(dialog).getByRole('button', { name: 'Remover bloco' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(remove).toHaveAccessibleDescription('Espere a conferência de quem usa este bloco');
    await user.click(remove);
    expect(blockOf(probe.definition, 'td_elegibilidade')).toBeDefined();

    await waitFor(
      () => expect(dialog).toHaveAccessibleDescription('Elegibilidade sai do rascunho. 1 bloco usa a saída dele e passa a mostrar problema. Ctrl Z desfaz.'),
      { timeout: 3000 },
    );
    await confirmRemoval(user);
    expect(blockOf(probe.definition, 'td_elegibilidade')).toBeUndefined();
  });

  it('se a análise falhou, a confirmação diz que não deu para conferir e deixa remover', async () => {
    const { user, probe } = await renderCanvas({ failAnalysis: true });
    node('Elegibilidade, Tabela de Decisão').focus();
    await user.keyboard('{ArrowRight}{Delete}');
    const dialog = await screen.findByRole('dialog', { name: 'Remover bloco' });
    expect(dialog).toHaveAccessibleDescription('Elegibilidade sai do rascunho. Conferindo quem usa este bloco… Ctrl Z desfaz.');
    await waitFor(
      () => expect(dialog).toHaveAccessibleDescription('Elegibilidade sai do rascunho. Não foi possível conferir quem usa este bloco. Ctrl Z desfaz.'),
      { timeout: 3000 },
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remover bloco' }));
    expect(blockOf(probe.definition, 'td_elegibilidade')).toBeUndefined();
  });

  it('incluir um bloco é anunciado ao leitor de tela', async () => {
    const { user } = await renderCanvas();
    await user.click(within(screen.getByRole('toolbar', { name: 'Incluir bloco' })).getByRole('button', { name: 'Tabela de Decisão' }));
    expect(screen.getByRole('status')).toHaveTextContent('Bloco Tabela de Decisão 1 incluído');
  });

  it('duas inclusões antes de a tela atualizar ganham ids, saídas e lugares diferentes', async () => {
    const { probe } = await renderCanvas();
    const calculation = within(screen.getByRole('toolbar', { name: 'Incluir bloco' })).getByRole('button', { name: 'Cálculo' });
    act(() => {
      calculation.click();
      calculation.click();
    });
    const added = probe.definition.root.nodes.slice(3);
    expect(added.map((block) => block.id)).toEqual(['calc_1', 'calc_2']);
    expect(added.map((block) => (block.type === 'calculation' ? block.output.name : null))).toEqual(['resultado_1', 'resultado_2']);
    expect(added[1]!.position).not.toEqual(added[0]!.position);
  });

  it('remover é anunciado e o foco vai para o bloco seguinte; sem seguinte, para o anterior; sem nenhum, para o canvas', async () => {
    const { user } = await renderCanvas();
    node('Elegibilidade, Tabela de Decisão').focus();
    await user.keyboard('{Delete}');
    await confirmRemoval(user);
    expect(screen.getByRole('status')).toHaveTextContent('Bloco Elegibilidade removido');
    await waitFor(() => expect(node('Pontos, Cálculo')).toHaveFocus());

    node('Total de compras, Cálculo').focus();
    await user.keyboard('{Delete}');
    await confirmRemoval(user);
    await waitFor(() => expect(node('Pontos, Cálculo')).toHaveFocus());

    await user.keyboard('{Delete}');
    await confirmRemoval(user);
    expect(screen.getByRole('status')).toHaveTextContent('Bloco Pontos removido');
    await waitFor(() => expect(document.querySelector('.fc-canvas')).toHaveFocus());
  });

  it('Tab passa pelos blocos na ordem, Enter abre as propriedades e Esc tira a seleção', async () => {
    const { user, probe } = await renderCanvas();
    node('Entradas').focus();
    await user.tab();
    expect(node('Elegibilidade, Tabela de Decisão')).toHaveFocus();
    await user.tab();
    expect(node('Pontos, Cálculo')).toHaveFocus();
    await user.tab();
    expect(node('Total de compras, Cálculo')).toHaveFocus();
    await user.tab();
    expect(node('Saída')).toHaveFocus();

    await user.tab({ shift: true });
    await user.keyboard('{Enter}');
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_total' });
    // Without onOpenProperties, the focus goes to the first field of the Propriedades panel.
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nome do item' })).toHaveFocus());

    node('Total de compras, Cálculo').focus();
    await user.keyboard('{Escape}');
    expect(probe.selection.item).toEqual({ type: 'workflow' });
    expect(node('Total de compras, Cálculo')).not.toHaveAttribute('aria-current');
  });

  it('Enter chama onOpenProperties com o item selecionado, quando a tela o passa', async () => {
    const onOpenProperties = vi.fn();
    const { user } = await renderCanvas({}, onOpenProperties);
    node('Saída').focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onOpenProperties).toHaveBeenCalledWith({ type: 'output' }));
  });

  it('o clique seleciona o bloco, e o clique no fundo tira a seleção', async () => {
    const { probe } = await renderCanvas();
    clickOnCanvas(within(node('Pontos, Cálculo')).getByText('Pontos'));
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
    expect(node('Pontos, Cálculo')).toHaveAttribute('aria-current', 'true');
    clickOnCanvas(document.querySelector('.react-flow__pane')!);
    expect(probe.selection.item).toEqual({ type: 'workflow' });
  });

  it('a seleção fica ligada entre o canvas e as camadas', async () => {
    const { user, probe } = renderWithDraft(
      <>
        <Layers />
        <WorkflowCanvas />
      </>,
    );
    await screen.findByRole('group', { name: /^Pontos/ });
    const tree = screen.getByRole('tree', { name: 'Camadas' });

    clickOnCanvas(within(node('Pontos, Cálculo')).getByText('Pontos'));
    expect(within(tree).getByRole('treeitem', { name: 'Pontos, Cálculo' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tree).getByRole('treeitem', { name: 'Elegibilidade, Tabela de Decisão' }));
    expect(probe.selection.item).toEqual({ type: 'node', id: 'td_elegibilidade' });
    expect(node('Elegibilidade, Tabela de Decisão')).toHaveAttribute('aria-current', 'true');
    expect(node('Pontos, Cálculo')).not.toHaveAttribute('aria-current');

    await user.click(within(tree).getByRole('treeitem', { name: 'Saída' }));
    expect(node('Saída')).toHaveAttribute('aria-current', 'true');
  });

  it('só leitura: sem barra de ferramentas, sem mover e sem remover', async () => {
    const { user, probe } = await renderCanvas({ readOnly: true });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    const pontos = node('Pontos, Cálculo');
    expect(pontos).not.toHaveClass('draggable');
    pontos.focus();
    await user.keyboard('{ArrowRight}{Delete}');
    expect(blockOf(probe.definition, 'calc_pontos')!.position).toEqual({ x: 240, y: 0 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(probe.selection.item).toEqual({ type: 'node', id: 'calc_pontos' });
  });

  it('sem blocos, diz o que falta e aponta a barra de ferramentas', async () => {
    const draft = exampleDraft();
    draft.definition = { ...draft.definition, root: { ...draft.definition.root, nodes: [] } };
    renderWithDraft(<WorkflowCanvas />, { draft: { ...draft, dependencies: [], order: [] } });
    expect(await screen.findByText('Nenhum bloco ainda')).toBeInTheDocument();
    expect(screen.getByText('Inclua um Cálculo ou uma Tabela de Decisão pela barra de ferramentas.')).toBeInTheDocument();
    expect(node('Entradas')).toBeInTheDocument();
  });

  it('o zoom fica no canto, e o minimapa some até 1280px de largura do módulo, com as ferramentas só em ícone', async () => {
    await renderCanvas();
    expect(screen.getByRole('button', { name: 'Aumentar zoom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Diminuir zoom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustar à tela' })).toBeInTheDocument();
    expect(screen.getByLabelText('Minimapa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cálculo' })).toHaveTextContent('Cálculo');
    cleanup();

    const measure = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return this.classList.contains('fc-root') ? ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800 } as DOMRect) : measure.call(this);
    });
    await renderCanvas();
    expect(screen.queryByLabelText('Minimapa')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aumentar zoom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cálculo' })).not.toHaveTextContent('Cálculo');
  });
});
