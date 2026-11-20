import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorScreen, type EditorScreenProps } from '.';
import { ANALYSIS_DELAY_MS, SAVE_DELAY_MS } from '../draft';
import {
  ANALYSIS_ROUTE,
  DRAFT,
  DRAFT_ROUTE,
  DraftProbe,
  SAVE_ROUTE,
  TYPE_MISMATCH,
  VIEWER_PERMISSIONS,
  WORKFLOW,
  draftWith,
  expressionOf,
  json,
  pendingResponse,
  problem,
  renderScreen,
  simulateApi,
  testQueryClient,
  type SimulatedApi,
} from '../draft/editor.test-support';
import type { Schemas } from '../../api';
import { workflowDraftKey } from '../../workflows';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderEditor(props: Partial<EditorScreenProps> = {}) {
  const onBack = vi.fn();
  const rendered = renderScreen(
    <EditorScreen workflowId={DRAFT.workflow_id} onBack={onBack} canvas={<DraftProbe />} layers={<p>Árvore</p>} properties={<p>Campos</p>} {...props} />,
  );
  return { ...rendered, onBack };
}

/** The editor region ("Editor", or "Editor de <nome>" once the workflow name arrives). */
const editorRegion = () => screen.getByRole('region', { name: /^Editor/ });
const formula = () => screen.getByRole('textbox', { name: 'Fórmula de Pontos' }) as HTMLTextAreaElement;
const type = (value: string) => fireEvent.change(formula(), { target: { value } });
const bodies = (route: string) => api.bodiesTo(route) as Schemas['DraftUpdate'][];

/** Advances the fake clock and lets the promises that the timers started run. */
async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

/** Switches to the fake clock (timers and Date) once the editor is on screen. */
async function openWithFakeClock() {
  const rendered = renderEditor();
  await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  return rendered;
}

describe('Editor: estados da tela', () => {
  it('mostra o esqueleto do editor enquanto o rascunho carrega', async () => {
    const pending = pendingResponse(() => json(DRAFT));
    api.respond(DRAFT_ROUTE, pending.promise);
    renderEditor();

    expect(await screen.findByRole('status')).toHaveTextContent('Carregando o editor');
    expect(screen.queryByRole('textbox', { name: 'Fórmula de Pontos' })).not.toBeInTheDocument();

    pending.release();
    expect(await screen.findByRole('textbox', { name: 'Fórmula de Pontos' })).toHaveValue('ARRED(valor_item * fator, 2)');
  });

  it('com o rascunho, mostra a barra, os painéis e a aba Problemas vazia', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.parse(DRAFT.updated_at) + 12 * 60_000));
    renderEditor();

    const editor = await screen.findByRole('region', { name: 'Editor de Pontuação de exemplo' });
    const path = within(editor).getByRole('navigation', { name: 'Você está em' });
    expect(path).toHaveTextContent('Workflows/Pontuação de exemplo');
    expect(within(path).getByText('Pontuação de exemplo')).toHaveAttribute('aria-current', 'page');
    expect(within(editor).getByText('Rascunho')).toBeInTheDocument();
    expect(within(editor).getByText('Salvo há 12 min')).toBeInTheDocument();
    expect(within(editor).queryByText('Só leitura')).not.toBeInTheDocument();
    // Without problems there is no counter.
    expect(within(editor).queryByRole('button', { name: /problema/ })).not.toBeInTheDocument();

    expect(within(editor).getByRole('complementary', { name: 'Camadas' })).toHaveTextContent('Árvore');
    expect(within(editor).getByRole('complementary', { name: 'Propriedades' })).toHaveTextContent('Campos');
    expect(within(editor).getByRole('region', { name: 'Canvas' })).toContainElement(formula());

    expect(within(editor).getByRole('tab', { name: 'Problemas' })).toHaveAttribute('aria-selected', 'true');
    expect(within(editor).getByText('Nenhum problema')).toBeInTheDocument();
  });

  it('se o rascunho não carrega, diz o que houve e tenta de novo', async () => {
    api.respond(DRAFT_ROUTE, problem(503, 'unavailable'), json(DRAFT));
    const { user } = renderEditor();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir o editor');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('textbox', { name: 'Fórmula de Pontos' })).toBeInTheDocument();
  });

  it('workflow que não existe: diz que não existe, sem "Tentar de novo", e volta', async () => {
    api.respond(DRAFT_ROUTE, problem(404, 'not_found'));
    const { user, onBack } = renderEditor();

    expect(await screen.findByRole('alert')).toHaveTextContent('Este workflow não existe ou foi removido.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('o ← volta para a visão geral', async () => {
    const { user, onBack } = renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Voltar para a visão geral' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('Editor: salvar e analisar', () => {
  it('salva 2 s depois da última mudança, e não antes, sobre a revisão do rascunho', async () => {
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item * 3' })));
    await openWithFakeClock();

    type('valor_item * 2');
    await advance(1500);
    type('valor_item * 3');
    await advance(SAVE_DELAY_MS - 1);
    expect(api.calledTimes(SAVE_ROUTE)).toBe(0);

    await advance(1);
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    const [saved] = bodies(SAVE_ROUTE);
    expect(saved?.revision).toBe(3);
    expect(expressionOf(saved!.definition)).toBe('valor_item * 3');

    vi.useRealTimers();
    expect(await screen.findByText('Salvo há instantes')).toBeInTheDocument();
  });

  it('mostra "Salvando…" enquanto o rascunho é salvo', async () => {
    const pending = pendingResponse(() => json(draftWith({ revision: 4, expression: 'valor_item' })));
    api.respond(SAVE_ROUTE, pending.promise);
    renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    expect(await screen.findByText('Salvando…')).toBeInTheDocument();

    pending.release();
    expect(await screen.findByText('Salvo há instantes')).toBeInTheDocument();
    // Each save by itself is not announced (it would talk every 2 s of typing); only the failure and the conflict are.
    expect(screen.queryByText('Rascunho salvo')).not.toBeInTheDocument();
    expect(screen.queryByText('Salvando o rascunho')).not.toBeInTheDocument();
  });

  it('a análise roda 400 ms depois da última tecla, não salva, e os problemas aparecem', async () => {
    api.respond(ANALYSIS_ROUTE, json({ problems: [TYPE_MISMATCH], symbols: DRAFT.symbols }));
    await openWithFakeClock();

    type('categoria');
    await advance(200);
    type('categoria * 2');
    await advance(ANALYSIS_DELAY_MS - 1);
    expect(api.calledTimes(ANALYSIS_ROUTE)).toBe(0);

    await advance(1);
    await vi.waitFor(() => expect(api.callCount(ANALYSIS_ROUTE)).toBe(1));
    const [analyzed] = api.bodiesTo(ANALYSIS_ROUTE) as Schemas['NewAnalysis'][];
    expect(expressionOf(analyzed!.definition)).toBe('categoria * 2');
    expect(api.calledTimes(SAVE_ROUTE)).toBe(0);

    vi.useRealTimers();
    expect(await screen.findByRole('button', { name: '1 problema' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Problemas em Pontos' })).toHaveTextContent('1');
    // The 2 s save was left in the fake clock: the analysis alone saved nothing.
    expect(api.calledTimes(SAVE_ROUTE)).toBe(0);
  });

  it('salva o que está pendente ao sair do editor', async () => {
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item' })));
    const { unmount } = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item');
    expect(api.calledTimes(SAVE_ROUTE)).toBe(0);
    unmount();

    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    expect(expressionOf(bodies(SAVE_ROUTE)[0]!.definition)).toBe('valor_item');
  });

  it('sem mudança, sair não salva', async () => {
    const { unmount } = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });
    unmount();
    await act(() => Promise.resolve());
    expect(api.calledTimes(SAVE_ROUTE)).toBe(0);
  });

  it('"Salvar agora" salva na hora e devolve a revisão nova; o salvamento seguinte vai sobre ela', async () => {
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item' })), json(draftWith({ revision: 5, expression: 'valor_item * 2' })));
    renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    expect(await screen.findByRole('status', { name: 'Revisão salva' })).toHaveTextContent('4');

    type('valor_item * 2');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(2));
    expect(bodies(SAVE_ROUTE).map((body) => body.revision)).toEqual([3, 4]);
    expect(await screen.findByRole('status', { name: 'Revisão salva' })).toHaveTextContent('5');
  });

  it('falha ao salvar: avisa e tenta de novo', async () => {
    api.respond(SAVE_ROUTE, problem(503, 'unavailable'), json(draftWith({ revision: 4, expression: 'valor_item' })));
    const { user } = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível salvar o rascunho');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');
    expect(screen.getByText('Não foi possível salvar')).toBeInTheDocument();
    expect(screen.getByText('Não foi possível salvar o rascunho', { selector: '[role="status"]' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Salvo há instantes')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The button went away with the note: the focus goes back to the editor, not to the page.
    expect(editorRegion()).toHaveFocus();
    expect(bodies(SAVE_ROUTE).map((body) => body.revision)).toEqual([3, 3]);
  });

  it('409 draft_conflict: para de salvar, avisa, e "Recarregar rascunho" traz a versão nova', async () => {
    api.respond(SAVE_ROUTE, problem(409, 'draft_conflict', { current_revision: 4 }));
    const { user } = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item * 9');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    const warning = await screen.findByText('Este rascunho mudou em outra aba ou por outra pessoa');
    expect(screen.getByText('Não salvo')).toBeInTheDocument();

    // Nothing more is saved while the conflict lasts.
    type('valor_item * 10');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await act(() => Promise.resolve());
    expect(api.calledTimes(SAVE_ROUTE)).toBe(1);

    api.respond(DRAFT_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item * 7', updated_at: new Date().toISOString() })));
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 5, expression: 'valor_item * 8' })));
    await user.click(screen.getByRole('button', { name: 'Recarregar rascunho' }));

    await vi.waitFor(() => expect(formula()).toHaveValue('valor_item * 7'));
    expect(warning).not.toBeInTheDocument();
    expect(screen.getByText('Salvo há instantes')).toBeInTheDocument();
    expect(editorRegion()).toHaveFocus();

    // Saving again goes over the new revision.
    type('valor_item * 8');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(2));
    expect(bodies(SAVE_ROUTE)[1]?.revision).toBe(4);
  });

  it('se a recarga falha, o aviso continua com o motivo e o botão', async () => {
    api.respond(SAVE_ROUTE, problem(409, 'draft_conflict', { current_revision: 4 }));
    const { user } = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item * 9');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await screen.findByText('Este rascunho mudou em outra aba ou por outra pessoa');

    api.respond(DRAFT_ROUTE, problem(503, 'unavailable'));
    await user.click(screen.getByRole('button', { name: 'Recarregar rascunho' }));
    expect(await screen.findByText(/Não foi possível recarregar o rascunho/)).toBeInTheDocument();
    expect(formula()).toHaveValue('valor_item * 9');
    expect(screen.getByRole('button', { name: 'Recarregar rascunho' })).toBeInTheDocument();
  });
});

describe('Editor: desfazer e refazer', () => {
  it('Ctrl Z desfaz e Ctrl Shift Z refaz, e o desfeito também é salvo', async () => {
    api.respond(SAVE_ROUTE, (request) => request.json().then((body: Schemas['DraftUpdate']) => json({ ...DRAFT, revision: body.revision + 1, definition: body.definition })));
    const { user } = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('a');
    type('a + b');
    // The keys go to the editor itself (outside the text field, which keeps its own undo).
    editorRegion().focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(formula()).toHaveValue('a');
    await user.keyboard('{Control>}z{/Control}');
    expect(formula()).toHaveValue('ARRED(valor_item * fator, 2)');
    // Nothing before the first step.
    await user.keyboard('{Control>}z{/Control}');
    expect(formula()).toHaveValue('ARRED(valor_item * fator, 2)');

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(formula()).toHaveValue('a');
    await user.keyboard('{Control>}{Shift>}Z{/Shift}{/Control}');
    expect(formula()).toHaveValue('a + b');
    // Ctrl Y also redoes.
    await user.keyboard('{Control>}z{/Control}');
    expect(formula()).toHaveValue('a');
    await user.keyboard('{Control>}y{/Control}');
    expect(formula()).toHaveValue('a + b');

    await user.keyboard('{Control>}z{/Control}');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    expect(expressionOf(bodies(SAVE_ROUTE)[0]!.definition)).toBe('a');
  });

  it('a mesma digitação junta as letras num passo só', async () => {
    renderScreen(<EditorScreen workflowId={DRAFT.workflow_id} onBack={() => {}} canvas={<DraftProbe merge />} />);
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('v');
    type('va');
    type('val');
    fireEvent.keyDown(editorRegion(), { key: 'z', ctrlKey: true });
    expect(formula()).toHaveValue('ARRED(valor_item * fator, 2)');
  });
});

describe('Editor: só leitura', () => {
  it('sem workflows.edit, abre só para leitura: nada muda, nada é salvo nem analisado', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    renderEditor();
    const editor = await screen.findByRole('region', { name: 'Editor de Pontuação de exemplo' });

    expect(within(editor).getByText('Só leitura')).toBeInTheDocument();
    expect(within(editor).getByText('Você não tem permissão para editar este workflow')).toBeInTheDocument();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    type('valor_item * 100');
    expect(formula()).toHaveValue('ARRED(valor_item * fator, 2)');
    fireEvent.keyDown(formula(), { key: 'z', ctrlKey: true });
    await advance(SAVE_DELAY_MS * 2);
    vi.useRealTimers();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    expect(await screen.findByRole('status', { name: 'Revisão salva' })).toHaveTextContent('null');
    cleanup();
    await act(() => Promise.resolve());
    expect(api.calledTimes(SAVE_ROUTE)).toBe(0);
    expect(api.calledTimes(ANALYSIS_ROUTE)).toBe(0);
  });
});

describe('Editor: problemas', () => {
  const withProblems = draftWith({
    problems: [
      { code: 'unknown_variable', message: 'valor_iten não existe neste ponto do fluxo. Você quis dizer valor_item?', path: 'root.nodes[1].expression', node_id: 'calc_pontos', start: 6, end: 16, suggestion: 'valor_item' },
      { ...TYPE_MISMATCH, path: 'root.nodes[1].output.type' },
      { code: 'reserved_name', message: 'se é uma palavra reservada e não pode ser nome de entrada.', path: 'root.inputs[1].name', node_id: null, start: null, end: null, suggestion: null },
      { code: 'rule_width', message: 'A regra 1 tem 2 células de condição, mas a tabela tem 1 coluna.', path: 'root.nodes[0].rules[0].when', node_id: null, start: null, end: null, suggestion: null },
    ],
  });

  it('o contador abre a aba Problemas, e a lista vem agrupada por bloco com código e mensagem', async () => {
    api.respond(DRAFT_ROUTE, json(withProblems));
    const { user } = renderEditor({ bottomTabs: [{ value: 'unit-run', label: 'Calcular', content: <p>Formulário</p> }] });

    const counter = await screen.findByRole('button', { name: '4 problemas' });
    expect(screen.getByRole('status', { name: 'Problemas em Pontos' })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: 'Problemas 4' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Calcular' }));
    expect(screen.getByText('Formulário')).toBeInTheDocument();
    await user.click(counter);
    const problemsTab = screen.getByRole('tab', { name: 'Problemas 4' });
    expect(problemsTab).toHaveAttribute('aria-selected', 'true');
    expect(problemsTab).toHaveFocus();

    const groups = within(screen.getByRole('list', { name: 'Problemas por bloco' })).getAllByRole('heading', { level: 3 });
    expect(groups.map((group) => group.textContent)).toEqual([
      'PontosCálculo2 problemas',
      'Entradas1 problema',
      'ElegibilidadeTabela de Decisão1 problema',
    ]);
    const unknown = screen.getByRole('button', { name: /unknown_variable/ });
    expect(unknown).toHaveTextContent('unknown_variablevalor_iten não existe neste ponto do fluxo. Você quis dizer valor_item?');
  });

  it('o clique num problema seleciona o bloco e o campo', async () => {
    api.respond(DRAFT_ROUTE, json(withProblems));
    const onSelectProblem = vi.fn();
    const { user } = renderEditor({ onSelectProblem });
    await screen.findByRole('button', { name: '4 problemas' });
    const selection = screen.getByRole('status', { name: 'Seleção' });
    expect(selection).toHaveTextContent('workflow -');

    await user.click(screen.getByRole('button', { name: /type_mismatch/ }));
    expect(selection).toHaveTextContent('node:calc_pontos root.nodes[1].output.type');

    // Without node_id, the block comes from the path.
    await user.click(screen.getByRole('button', { name: /rule_width/ }));
    expect(selection).toHaveTextContent('node:td_elegibilidade root.nodes[0].rules[0].when');
    expect(onSelectProblem).toHaveBeenLastCalledWith({ type: 'node', id: 'td_elegibilidade' }, withProblems.problems[3]);

    await user.click(screen.getByRole('button', { name: /reserved_name/ }));
    expect(selection).toHaveTextContent('inputs root.inputs[1].name');
  });

  it('o painel inferior recolhe, e o contador o abre de novo', async () => {
    api.respond(DRAFT_ROUTE, json(withProblems));
    const { user } = renderEditor();
    await screen.findByRole('button', { name: '4 problemas' });

    await user.click(screen.getByRole('button', { name: 'Recolher o painel inferior' }));
    expect(screen.queryByRole('list', { name: 'Problemas por bloco' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir o painel inferior' })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: '4 problemas' }));
    expect(screen.getByRole('list', { name: 'Problemas por bloco' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recolher o painel inferior' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Editor: abrir sempre do rascunho atual', () => {
  it('com um rascunho mais velho no cache, abre na versão do servidor', async () => {
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowDraftKey(DRAFT.workflow_id), DRAFT);
    api.respond(DRAFT_ROUTE, json(draftWith({ revision: 6, expression: 'valor_item * 6' })));
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 7, expression: 'valor_item * 7' })));
    renderScreen(<EditorScreen workflowId={DRAFT.workflow_id} onBack={() => {}} canvas={<DraftProbe />} />, queryClient);

    // The cache alone does not open the editor.
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o editor');
    expect(await screen.findByRole('textbox', { name: 'Fórmula de Pontos' })).toHaveValue('valor_item * 6');

    type('valor_item * 7');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    expect(bodies(SAVE_ROUTE)[0]?.revision).toBe(6);
  });

  it('reaberto logo depois de sair, espera o salvamento em voo e abre na revisão dele', async () => {
    const pending = pendingResponse(() => json(draftWith({ revision: 4, expression: 'valor_item' })));
    api.respond(SAVE_ROUTE, pending.promise, json(draftWith({ revision: 5, expression: 'valor_item * 2' })));
    const first = renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });
    type('valor_item');
    first.unmount();
    await vi.waitFor(() => expect(api.calledTimes(SAVE_ROUTE)).toBe(1));

    api.respond(DRAFT_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item' })));
    renderScreen(<EditorScreen workflowId={DRAFT.workflow_id} onBack={() => {}} canvas={<DraftProbe />} />, first.queryClient);
    expect(await screen.findByRole('status')).toHaveTextContent('Carregando o editor');
    await act(() => Promise.resolve());
    // The draft is read only after the save of the editor that closed.
    expect(api.calledTimes(DRAFT_ROUTE)).toBe(1);

    pending.release();
    expect(await screen.findByRole('textbox', { name: 'Fórmula de Pontos' })).toHaveValue('valor_item');
    expect(api.calledTimes(DRAFT_ROUTE)).toBe(2);

    type('valor_item * 2');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(2));
    expect(bodies(SAVE_ROUTE).map((body) => body.revision)).toEqual([3, 4]);
    expect(await screen.findByRole('status', { name: 'Revisão salva' })).toHaveTextContent('5');
  });

  it('trocar de workflow na mesma tela abre o outro rascunho, e cada um salva no seu', async () => {
    const otherId = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
    const other = draftWith({ workflow_id: otherId, revision: 11, expression: 'categoria' });
    const otherSave = `PUT /v1/workflows/${otherId}/draft`;
    api.respond(`GET /v1/workflows/${otherId}/draft`, json(other));
    api.respond(`GET /v1/workflows/${otherId}`, json({ ...WORKFLOW, id: otherId, name: 'Outro workflow' }));
    api.respond(otherSave, json({ ...other, revision: 12 }));
    api.respond(SAVE_ROUTE, json(draftWith({ revision: 4, expression: 'valor_item * 2' })));
    // The other draft is already in the cache: a reused screen could start from it with the first one's state.
    const queryClient = testQueryClient();
    queryClient.setQueryData(workflowDraftKey(otherId), other);

    function Switcher() {
      const [workflowId, setWorkflowId] = useState(DRAFT.workflow_id);
      return (
        <>
          <button type="button" onClick={() => setWorkflowId(otherId)}>
            Abrir o outro workflow
          </button>
          <EditorScreen workflowId={workflowId} onBack={() => {}} canvas={<DraftProbe />} />
        </>
      );
    }
    renderScreen(<Switcher />, queryClient);
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });
    type('valor_item * 2');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir o outro workflow' }));
    await vi.waitFor(() => expect(formula()).toHaveValue('categoria'));
    expect(await screen.findByRole('region', { name: 'Editor de Outro workflow' })).toBeInTheDocument();

    // The change left in the first workflow went to the first one.
    await vi.waitFor(() => expect(api.callCount(SAVE_ROUTE)).toBe(1));
    expect(expressionOf(bodies(SAVE_ROUTE)[0]!.definition)).toBe('valor_item * 2');

    type('categoria * 2');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar agora' }));
    await vi.waitFor(() => expect(api.callCount(otherSave)).toBe(1));
    const [saved] = api.bodiesTo(otherSave) as Schemas['DraftUpdate'][];
    expect(saved?.revision).toBe(11);
    expect(expressionOf(saved!.definition)).toBe('categoria * 2');
    expect(api.callCount(SAVE_ROUTE)).toBe(1);
  });
});

describe('Editor: atalhos onde o elemento tem o próprio desfazer', () => {
  function OwnUndoPanel() {
    return (
      <div>
        <label>
          Nome do bloco
          <input />
        </label>
        <div role="textbox" aria-label="Nota" contentEditable suppressContentEditableWarning>
          texto
        </div>
        <label>
          Marcar
          <input type="checkbox" />
        </label>
        {createPortal(
          <div role="dialog" aria-label="Diálogo">
            <button type="button">Dentro do diálogo</button>
          </div>,
          document.body,
        )}
        {createPortal(<button type="button">Fora do editor</button>, document.body)}
      </div>
    );
  }

  it('campo de texto, texto editável, diálogo e portal ficam com o Ctrl Z; uma caixa de marcar, não', async () => {
    renderEditor({ properties: <OwnUndoPanel /> });
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });
    type('a');

    const ctrlZ = (element: Element) => fireEvent.keyDown(element, { key: 'z', ctrlKey: true });
    // fireEvent returns false when the default was prevented: the native undo of these elements stays.
    expect(ctrlZ(formula())).toBe(true);
    expect(ctrlZ(screen.getByRole('textbox', { name: 'Nome do bloco' }))).toBe(true);
    expect(ctrlZ(screen.getByRole('textbox', { name: 'Nota' }))).toBe(true);
    expect(ctrlZ(screen.getByRole('button', { name: 'Dentro do diálogo' }))).toBe(true);
    expect(ctrlZ(screen.getByRole('button', { name: 'Fora do editor' }))).toBe(true);
    expect(fireEvent.keyDown(formula(), { key: 'y', ctrlKey: true })).toBe(true);
    expect(formula()).toHaveValue('a');

    expect(ctrlZ(screen.getByRole('checkbox', { name: 'Marcar' }))).toBe(false);
    expect(formula()).toHaveValue('ARRED(valor_item * fator, 2)');
  });
});

describe('Editor: análise que falha', () => {
  it('avisa sem alarde que a lista pode estar desatualizada, até a próxima análise dar certo', async () => {
    api.respond(ANALYSIS_ROUTE, problem(503, 'unavailable'));
    // The 2 s save never answers: on a slow machine its problems (or its failure) would not mix with the analysis.
    api.respond(SAVE_ROUTE, pendingResponse(() => json(DRAFT)).promise);
    renderEditor();
    await screen.findByRole('textbox', { name: 'Fórmula de Pontos' });

    type('valor_item * 2');
    const note = await screen.findByText('Não foi possível conferir a última mudança. A lista pode estar desatualizada.');
    expect(note.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    api.respond(ANALYSIS_ROUTE, json({ problems: [], symbols: DRAFT.symbols }));
    type('valor_item * 3');
    await vi.waitFor(() => expect(note).not.toBeInTheDocument());
  });
});
