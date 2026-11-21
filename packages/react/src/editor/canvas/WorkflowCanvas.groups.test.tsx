import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { findEntry, findGroup, findNode } from '../groups';
import { groupedDraft, nestedDraft, ungroupedDraft, withSourceAndEmptyGroup } from '../groups/groups.test-support';
import { renderWithDraft } from './canvas.test-support';
import { WorkflowCanvas } from './WorkflowCanvas';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function node(name: string | RegExp): HTMLElement {
  return screen.getByRole('group', { name });
}

/** Where React Flow draws a node, from the canvas origin (its absolute position). */
function placeOf(id: string): { x: number; y: number } {
  const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;
  // jsdom writes `translate(0px)` for `translate(0px, 0px)`.
  const match = /translate\((-?[\d.]+)px(?:,\s*(-?[\d.]+)px)?\)/.exec(element.style.transform)!;
  return { x: Number(match[1]), y: Number(match[2] ?? 0) };
}

/** A point of the flow on the screen, by the viewport React Flow fitted (the canvas itself sits at 0, 0 in jsdom). */
function toScreen(x: number, y: number): { clientX: number; clientY: number } {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform;
  const match = /translate\((-?[\d.]+)px(?:,\s*(-?[\d.]+)px)?\)\s*scale\(([\d.]+)\)/.exec(viewport)!;
  const [tx, ty, zoom] = [Number(match[1]), Number(match[2] ?? 0), Number(match[3])];
  return { clientX: x * zoom + tx, clientY: y * zoom + ty };
}

function linkLabels(): (string | null)[] {
  return [...document.querySelectorAll('.react-flow__edge')].map((link) => link.getAttribute('aria-label'));
}

async function renderCanvas(draft: Schemas['Draft'], readOnly = false) {
  const rendered = renderWithDraft(<WorkflowCanvas />, { draft, readOnly });
  await screen.findByRole('group', { name: /^Pontos/ });
  return rendered;
}

/** The definitions sent to the draft save (PUT), in order. */
async function savedDefinitions(): Promise<Schemas['WorkflowDefinition'][]> {
  const calls = vi.mocked(globalThis.fetch).mock.calls as unknown as [Request][];
  const saves = calls.filter(([request]) => request.method === 'PUT');
  return Promise.all(saves.map(async ([request]) => ((await request.clone().json()) as Schemas['DraftUpdate']).definition));
}

describe('WorkflowCanvas: grupos', () => {
  it('desenha o grupo com o nome, a contagem de blocos, o Input derivado e o Output, e as ligações passam pelas barras', async () => {
    await renderCanvas(groupedDraft());
    const group = node('Pontuação, Grupo, 2 blocos');
    expect(within(group).getByText('2 blocos')).toBeInTheDocument();
    expect(within(group).getByRole('img', { name: /Derivado da análise/ })).toBeInTheDocument();
    expect(within(within(group).getByRole('list', { name: 'Input' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'categoriatext',
      'valor_itemdecimal(2)',
    ]);
    expect(within(group).getByRole('list', { name: 'Output' })).toHaveTextContent('pontosdecimal(2)');
    await waitFor(() => expect(linkLabels()).toHaveLength(8));
    expect(linkLabels()).toEqual([
      'categoria, de Entradas para Pontuação',
      'valor_item, de Entradas para Pontuação',
      'pontos, de Pontos para Output de Pontuação',
      'categoria, de Input de Pontuação para Elegibilidade',
      'fator, de Elegibilidade para Pontos',
      'valor_item, de Input de Pontuação para Pontos',
      'pontos, de Pontuação para Bônus',
      'bonus, de Bônus para Saída',
    ]);
  });

  it('o Input do grupo vem da análise: sem ela, fica vazio; a próxima análise o preenche', async () => {
    const draft = { ...groupedDraft(), groups: [] };
    const { user } = await renderCanvas(draft);
    const group = node(/^Pontuação, Grupo/);
    expect(within(group).queryByRole('list', { name: 'Input' })).not.toBeInTheDocument();
    expect(within(group).getByText('Nada de fora')).toBeInTheDocument();

    // The next analysis derives only valor_item (nothing comes from the formulas on screen).
    const analysis = { ...groupedDraft(), groups: [{ node_id: 'grp_pontuacao', inputs: ['valor_item'], outputs: ['pontos'], order: [] }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.method === 'POST' && request.url.endsWith('/draft/analysis')) {
          const { problems, symbols, dependencies, order, groups } = analysis;
          return new Response(JSON.stringify({ problems, symbols, dependencies, order, groups }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ ...analysis, revision: 5 }), { headers: { 'Content-Type': 'application/json' } });
      }),
    );
    node('Bônus, Cálculo').focus();
    await user.keyboard('{ArrowDown}');
    const input = await within(node(/^Pontuação, Grupo/)).findByRole('list', { name: 'Input' }, { timeout: 3000 });
    expect(within(input).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['valor_itemdecimal(2)']);
  });

  it('grupo dentro de grupo: cada um dentro do seu, com os blocos na área do grupo de dentro', async () => {
    await renderCanvas(nestedDraft());
    expect(node('Campanha, Grupo, 2 blocos')).toBeInTheDocument();
    expect(node('Pontuação, Grupo, 2 blocos')).toBeInTheDocument();
    // The content area of a group starts 196px in and 52px down (after the Input bar and the header).
    expect(placeOf('grp_campanha')).toEqual({ x: 0, y: 0 });
    expect(placeOf('grp_pontuacao')).toEqual({ x: 196, y: 52 });
    expect(placeOf('td_elegibilidade')).toEqual({ x: 392, y: 104 });
    expect(placeOf('calc_pontos')).toEqual({ x: 632, y: 104 });
    // The outer group holds the inner one: it is wider and taller.
    const outer = document.querySelector<HTMLElement>('.react-flow__node[data-id="grp_campanha"]')!;
    const inner = document.querySelector<HTMLElement>('.react-flow__node[data-id="grp_pontuacao"]')!;
    expect(parseFloat(outer.style.width)).toBeGreaterThan(196 + parseFloat(inner.style.width));
    expect(parseFloat(outer.style.height)).toBeGreaterThan(52 + parseFloat(inner.style.height));
    await waitFor(() => expect(linkLabels()).toContain('categoria, de Input de Campanha para Pontuação'));
    expect(linkLabels()).toContain('pontos, de Pontuação para Output de Campanha');
    expect(linkLabels()).toContain('pontos, de Campanha para Bônus');
    // Tab order: a group comes right before what is inside it.
    const order = [...document.querySelectorAll('.react-flow__node')].map((element) => element.getAttribute('data-id'));
    expect(order).toEqual(['@inputs', 'grp_campanha', 'grp_pontuacao', 'td_elegibilidade', 'calc_pontos', 'calc_bonus', '@output']);
  });

  it('recolher e expandir pelo cabeçalho grava o collapsed no rascunho e esconde os blocos de dentro', async () => {
    const { user, probe } = await renderCanvas(groupedDraft());
    await user.click(within(node(/^Pontuação, Grupo/)).getByRole('button', { name: 'Recolher grupo' }));
    expect(findGroup(probe.definition, 'grp_pontuacao')!.collapsed).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Grupo Pontuação recolhido');
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Pontos/ })).not.toBeInTheDocument());
    expect(node('Pontuação, Grupo, 2 blocos, recolhido')).toBeInTheDocument();
    await waitFor(() => expect(linkLabels()).not.toContain('fator, de Elegibilidade para Pontos'));
    expect(linkLabels()).toContain('pontos, de Pontuação para Bônus');

    // Saved in the draft (the PUT after the 2 s pause).
    await waitFor(
      async () => {
        const saved = await savedDefinitions();
        expect(saved.some((definition) => definition.root.nodes.some((item) => item.type === 'group' && item.collapsed))).toBe(true);
      },
      { timeout: 5000 },
    );

    await user.click(within(node(/^Pontuação, Grupo/)).getByRole('button', { name: 'Expandir grupo' }));
    expect(findGroup(probe.definition, 'grp_pontuacao')!.collapsed).toBe(false);
    expect(await screen.findByRole('group', { name: /^Pontos/ })).toBeInTheDocument();
    act(() => probe.undo());
    expect(findGroup(probe.definition, 'grp_pontuacao')!.collapsed).toBe(true);
  });

  it('Agrupar com Shift + clique junta os blocos num grupo sem tirá-los do lugar; Desagrupar pelo menu os devolve', async () => {
    const { user, probe } = await renderCanvas(ungroupedDraft());
    const before = { table: placeOf('td_elegibilidade'), points: placeOf('calc_pontos'), bonus: placeOf('calc_bonus') };
    const agrupar = () => screen.getByRole('button', { name: 'Agrupar' });
    expect(agrupar()).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(within(node(/^Elegibilidade/)).getByText('Elegibilidade'));
    fireEvent.click(within(node(/^Pontos/)).getByText('Pontos'), { shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('2 blocos selecionados para agrupar');
    expect(agrupar()).not.toHaveAttribute('aria-disabled');
    await user.click(agrupar());

    expect(probe.definition.root.nodes.map((item) => item.id)).toEqual(['grp_1', 'calc_bonus']);
    expect(findGroup(probe.definition, 'grp_1')!.nodes.map((item) => item.id)).toEqual(['td_elegibilidade', 'calc_pontos']);
    expect(probe.selection.item).toEqual({ type: 'node', id: 'grp_1' });
    expect(screen.getByRole('status')).toHaveTextContent('2 blocos no grupo Grupo 1');
    await screen.findByRole('group', { name: /^Grupo 1, Grupo, 2 blocos/ });
    expect(placeOf('td_elegibilidade')).toEqual(before.table);
    expect(placeOf('calc_pontos')).toEqual(before.points);
    expect(placeOf('calc_bonus')).toEqual(before.bonus);

    await user.click(within(node(/^Grupo 1, Grupo/)).getByRole('button', { name: 'Mais ações de Grupo 1' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Desagrupar' }));
    expect(probe.definition.root.nodes.map((item) => item.id)).toEqual(['td_elegibilidade', 'calc_pontos', 'calc_bonus']);
    expect(probe.definition.root.nodes.map((item) => item.position)).toEqual(ungroupedDraft().definition.root.nodes.map((item) => item.position));
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Grupo 1/ })).not.toBeInTheDocument());
    expect(placeOf('td_elegibilidade')).toEqual(before.table);
    expect(placeOf('calc_pontos')).toEqual(before.points);
  });

  it('o laço (Shift + arrastar no fundo) escolhe os blocos que cobre', async () => {
    const { user, probe } = await renderCanvas(ungroupedDraft());
    const pane = document.querySelector<HTMLElement>('.react-flow__pane')!;
    // The two first blocks (0 to 440 × 0 to 80, in the flow); Bônus starts at 480.
    const pointer = { button: 0, pointerId: 1, isPrimary: true, shiftKey: true };
    fireEvent.keyDown(document, { key: 'Shift' });
    fireEvent.pointerDown(pane, { ...pointer, ...toScreen(-10, -10) });
    fireEvent.pointerMove(pane, { ...pointer, ...toScreen(200, 50) });
    fireEvent.pointerMove(pane, { ...pointer, ...toScreen(460, 100) });
    fireEvent.pointerUp(pane, { ...pointer, ...toScreen(460, 100) });
    fireEvent.keyUp(document, { key: 'Shift' });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 blocos selecionados para agrupar'));
    await user.click(screen.getByRole('button', { name: 'Agrupar' }));
    expect(findGroup(probe.definition, 'grp_1')!.nodes.map((item) => item.id)).toEqual(['td_elegibilidade', 'calc_pontos']);
  });

  it('Shift + Espaço junta o bloco à seleção pelo teclado; blocos de grupos diferentes não se agrupam, com o motivo', async () => {
    const { user } = await renderCanvas(groupedDraft());
    node(/^Pontos/).focus();
    await user.keyboard('{Shift>} {/Shift}');
    node(/^Bônus/).focus();
    await user.keyboard('{Shift>} {/Shift}');
    expect(screen.getByRole('status')).toHaveTextContent('2 blocos selecionados para agrupar');
    const agrupar = () => screen.getByRole('button', { name: 'Agrupar' });
    expect(agrupar()).toHaveAttribute('aria-disabled', 'true');
    expect(agrupar()).toHaveAccessibleDescription('Os blocos precisam estar no mesmo grupo para agrupar');
    // Esc drops the multiple selection.
    await user.keyboard('{Escape}');
    expect(agrupar()).toHaveAccessibleDescription(/Selecione os blocos/);
  });

  it('"Mover para o grupo…" pelo menu põe o bloco no grupo escolhido', async () => {
    const { user, probe } = await renderCanvas(withSourceAndEmptyGroup());
    await user.click(within(node(/^Bônus/)).getByRole('button', { name: 'Mais ações de Bônus' }));
    expect(await screen.findByRole('menuitem', { name: /Tirar do grupo/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Mover para o grupo…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mover para o grupo' });
    expect(within(dialog).getByRole('combobox', { name: 'Grupo' })).toHaveTextContent('Grupo de bônus');
    await user.click(within(dialog).getByRole('button', { name: 'Mover' }));
    expect(findEntry(probe.definition, 'calc_bonus')!.parent).toBe('grp_bonus');
    expect(screen.getByRole('status')).toHaveTextContent('Bônus movido para o grupo Grupo de bônus');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(node(/^Grupo de bônus, Grupo, 1 bloco/)).toBeInTheDocument());
  });

  it('"Tirar do grupo" pelo menu aberto com Shift + F10 tira o bloco do grupo', async () => {
    const { user, probe } = await renderCanvas(groupedDraft());
    node(/^Pontos/).focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.click(await screen.findByRole('menuitem', { name: 'Tirar do grupo' }));
    expect(findEntry(probe.definition, 'calc_pontos')!.parent).toBeNull();
    expect(findGroup(probe.definition, 'grp_pontuacao')!.outputs).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Pontos tirado do grupo Pontuação');
  });

  it('o bloco Fonte aparece com o quadrado da fonte, as portas de ligação e de saída', async () => {
    await renderCanvas(withSourceAndEmptyGroup());
    const source = node('Produto, Fonte Linear');
    expect(source.querySelector('.fc-canvas-category')).toHaveAttribute('data-kind', 'source');
    expect(within(source).getByRole('list', { name: 'Liga por' })).toHaveTextContent('categoriatext');
    expect(within(source).getByRole('list', { name: 'Produz' })).toHaveTextContent('limitedecimal(2)');
    await waitFor(() => expect(linkLabels()).toContain('categoria, de Entradas para Produto'));
  });

  it('só leitura: sem menu, sem Agrupar e sem recolher, com o motivo', async () => {
    const { probe } = await renderCanvas(groupedDraft(), true);
    const group = node(/^Pontuação, Grupo/);
    expect(within(group).queryByRole('button', { name: /Mais ações/ })).not.toBeInTheDocument();
    const toggle = within(group).getByRole('button', { name: 'Recolher grupo' });
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    expect(toggle).toHaveAccessibleDescription('Você não tem permissão para editar este workflow');
    fireEvent.click(toggle);
    expect(findGroup(probe.definition, 'grp_pontuacao')!.collapsed).toBe(false);
    fireEvent.click(within(node(/^Pontos/)).getByText('Pontos'), { shiftKey: true });
    expect(findNode(probe.definition, 'calc_pontos')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Agrupar' })).not.toBeInTheDocument();
  });
});
