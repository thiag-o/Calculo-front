import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider, type Schemas } from '../../../api';
import { groupedDraft } from '../../groups/groups.test-support';
import { keepLastUnitRun, useLastUnitRun } from '../../unit-run/lastRun';
import { API } from '../canvas.test-support';
import { moduleQueryClient, renderEditor, simulateApi } from './run-values.test-support';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Trace = Schemas['UnitRunTrace'];
type TraceNode = Trace['nodes'][number];
type FormulaNode = Schemas['TraceFormulaNode'];

const ELIGIBILITY_OK: FormulaNode = {
  type: 'decision_table',
  node_id: 'td_elegibilidade',
  status: 'ok',
  values: { fator: '0.1500' },
  matched_rule: 2,
  warnings: [],
  error: null,
};

const POINTS_WARNING: FormulaNode = {
  type: 'calculation',
  node_id: 'calc_pontos',
  status: 'warning',
  values: { pontos: '225.00' },
  matched_rule: null,
  warnings: [{ code: 'null_result', message: 'pontos ficou vazio.' }],
  error: null,
};

const BONUS_ERROR: FormulaNode = {
  type: 'calculation',
  node_id: 'calc_bonus',
  status: 'error',
  values: {},
  matched_rule: null,
  warnings: [],
  error: { code: 'numeric_overflow', message: 'O resultado de pontos * 2 passou do limite.' },
};

/** The trace of the grouped draft: Pontuação (Elegibilidade and Pontos) gives `pontos`, read by Bônus outside it. */
function trace(bonus: TraceNode = BONUS_ERROR, points: TraceNode = POINTS_WARNING): Trace {
  return {
    status: bonus.status === 'error' ? 'error' : 'ok',
    record_key: null,
    inputs: [
      { variable: 'valor_item', value: '1500.00', origin: null },
      { variable: 'categoria', value: 'A', origin: null },
    ],
    nodes: [
      {
        type: 'group',
        node_id: 'grp_pontuacao',
        status: points.status,
        inputs: { categoria: 'A', valor_item: '1500.00' },
        outputs: { pontos: '225.00' },
        nodes: [ELIGIBILITY_OK, points],
      },
      bonus,
    ],
    outputs: bonus.status === 'error' ? {} : { bonus: '450.00' },
    input_hash: 'sha256:75165c8bcd4ca4b534982d17cc7dd60932f8b98416eda295284fc4c82bc6e14f',
    output_hash: null,
    error: bonus.status === 'error' ? { ...BONUS_ERROR.error!, node_id: 'calc_bonus', values: {} } : null,
    warnings: [],
  };
}

function node(name: string | RegExp): HTMLElement {
  return screen.getByRole('group', { name });
}

/** The canvas beside the "Calcular" tab, as in the editor; the API answers the run with `answer`. */
async function renderAndCalculate(answer: Trace, collapsed = false, queryClient = moduleQueryClient()) {
  const draft = groupedDraft(collapsed);
  const api = simulateApi(draft);
  api.answerRuns(answer);
  const rendered = renderEditor(draft, queryClient);
  await screen.findByRole('group', { name: /^Bônus, Cálculo/ });
  await rendered.user.click(screen.getByRole('button', { name: 'Calcular' }));
  await screen.findByRole('region', { name: 'Valores do último cálculo' });
  return { ...rendered, api, queryClient };
}

/** The last run kept for the workflow, as the canvas reads it. */
function lastRunOf(queryClient: QueryClient, workflowId: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApiProvider apiUrl={API}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiProvider>
  );
  return renderHook(() => useLastUnitRun(workflowId), { wrapper }).result.current.lastRun;
}

function banner(): HTMLElement | null {
  return screen.queryByRole('region', { name: 'Valores do último cálculo' });
}

describe('valores do último cálculo no canvas', () => {
  it('nenhum valor antes de calcular', async () => {
    simulateApi(groupedDraft());
    renderEditor(groupedDraft(), moduleQueryClient());
    await screen.findByRole('group', { name: 'Bônus, Cálculo' });
    expect(banner()).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Valores de/ })).not.toBeInTheDocument();
  });

  it('cada bloco mostra o status com ponto e palavra, na cor do status, e os valores embaixo do nome', async () => {
    await renderAndCalculate(trace());

    const eligibility = node('Elegibilidade, Tabela de Decisão, ok no último cálculo');
    expect(within(eligibility).getByText('ok').closest('.fc-status')).toHaveClass('fc-status-green');
    expect(within(within(eligibility).getByRole('list', { name: 'Valores de Elegibilidade' })).getByRole('listitem')).toHaveTextContent(
      'fator0,1500',
    );

    const points = node('Pontos, Cálculo, com avisos no último cálculo');
    expect(within(points).getByText('com avisos').closest('.fc-status')).toHaveClass('fc-status-amber');
    expect(within(points).getByRole('list', { name: 'Valores de Pontos' })).toHaveTextContent('pontos225,00');

    // The block that failed: red, outlined, with the message.
    const bonus = node('Bônus, Cálculo, erro no último cálculo');
    expect(within(bonus).getByText('erro').closest('.fc-status')).toHaveClass('fc-status-red');
    expect(within(bonus).getByText('O resultado de pontos * 2 passou do limite.')).toBeInTheDocument();
    expect(bonus.querySelector('.fc-canvas-block')).toHaveAttribute('data-run-status', 'error');
  });

  it('o bloco que não rodou fica cinza, com "não rodado" no nome acessível', async () => {
    const notRun: FormulaNode = { ...BONUS_ERROR, status: 'not_run', error: null };
    await renderAndCalculate(trace(notRun));
    const bonus = node('Bônus, Cálculo, não rodado no último cálculo');
    expect(within(bonus).getByText('não rodado').closest('.fc-status')).toHaveClass('fc-status-gray');
    expect(bonus.querySelector('.fc-canvas-block')).toHaveAttribute('data-run-status', 'not_run');
    expect(within(bonus).queryByRole('list', { name: 'Valores de Bônus' })).not.toBeInTheDocument();
  });

  it('a Tabela de Decisão mostra a regra que casou, em destaque', async () => {
    await renderAndCalculate(trace());
    const rule = within(node(/^Elegibilidade, Tabela de Decisão/)).getByText('Regra 2');
    expect(rule).toHaveClass('fc-run-rule');
  });

  it('grupo expandido: o status no cabeçalho, e cada bloco de dentro com os seus valores', async () => {
    await renderAndCalculate(trace());
    const group = node('Pontuação, Grupo, 2 blocos, com avisos no último cálculo');
    expect(within(group).getByText('com avisos')).toBeInTheDocument();
    // Expanded, the Output keeps its type: the values are on the blocks inside.
    expect(within(group).getByRole('list', { name: 'Output' })).toHaveTextContent('pontosdecimal(2)');
    expect(node(/^Pontos, Cálculo/)).toBeVisible();
    expect(within(node(/^Pontos, Cálculo/)).getByText('225,00')).toBeInTheDocument();
  });

  it('grupo recolhido: o Output mostra o valor de cada variável, e os blocos de dentro ficam escondidos', async () => {
    const ok: FormulaNode = { ...POINTS_WARNING, status: 'ok', warnings: [] };
    await renderAndCalculate(trace(BONUS_ERROR, ok), true);
    const group = node('Pontuação, Grupo, 2 blocos, recolhido, ok no último cálculo');
    const output = within(group).getByRole('list', { name: 'Output' });
    expect(within(output).getByRole('listitem')).toHaveTextContent('pontos225,00');
    expect(within(output).queryByText('decimal(2)')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Pontos, Cálculo/ })).not.toBeInTheDocument();
  });

  it('a faixa diz que os valores são do último cálculo, com o status do registro, e Limpar tira os valores', async () => {
    const { user } = await renderAndCalculate(trace());
    const strip = banner()!;
    expect(strip).toHaveTextContent('Os valores são do último cálculo');
    expect(within(strip).getByText('Registro erro')).toBeInTheDocument();

    await user.click(within(strip).getByRole('button', { name: 'Limpar' }));

    expect(banner()).not.toBeInTheDocument();
    expect(node('Bônus, Cálculo')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /^Valores de/ })).not.toBeInTheDocument();
    expect(document.querySelector('.fc-canvas')).toHaveFocus();
    expect(document.querySelector('.fc-canvas-visually-hidden')).toHaveTextContent('Valores do último cálculo limpos');
  });

  it('qualquer edição limpa os valores, e desfazer a edição não os traz de volta', async () => {
    const { user, probe } = await renderAndCalculate(trace());
    node(/^Bônus, Cálculo/).focus();
    await user.keyboard('{ArrowDown}');

    await waitFor(() => expect(banner()).not.toBeInTheDocument());
    expect(node('Bônus, Cálculo')).toBeInTheDocument();
    expect(node('Pontuação, Grupo, 2 blocos')).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>('.fc-canvas')!).queryByText('Regra 2')).not.toBeInTheDocument();

    act(() => probe.undo());
    await waitFor(() => expect(node('Bônus, Cálculo')).toBeInTheDocument());
    expect(banner()).not.toBeInTheDocument();
  });

  it('anuncia quando os valores chegam ao canvas', async () => {
    await renderAndCalculate(trace());
    await waitFor(() =>
      expect(document.querySelector('.fc-canvas-visually-hidden')).toHaveTextContent('Os valores do último cálculo estão no canvas'),
    );
  });

  it('uma edição feita enquanto o Calcular salva entra no salvamento antes de calcular, e os valores aparecem', async () => {
    const draft = groupedDraft();
    const api = simulateApi(draft);
    api.answerRuns(trace());
    const { user } = renderEditor(draft, moduleQueryClient());
    await screen.findByRole('group', { name: /^Bônus, Cálculo/ });
    node(/^Bônus, Cálculo/).focus();
    await user.keyboard('{ArrowDown}');
    const save = api.holdNextSave();
    await user.click(screen.getByRole('button', { name: 'Calcular' }));
    node(/^Bônus, Cálculo/).focus();
    await user.keyboard('{ArrowRight}');
    save.release();

    // flush() saves the change made meanwhile too: the revision calculated has it, so the values are of the screen.
    await screen.findByRole('region', { name: 'Valores do último cálculo' });
    expect(node('Bônus, Cálculo, erro no último cálculo')).toBeInTheDocument();
  });

  it('um cálculo guardado com uma definição que não é a salva na revisão dele não mostra valores, e é esquecido', async () => {
    const draft = groupedDraft();
    simulateApi(draft);
    const queryClient = moduleQueryClient();
    const { user, probe } = renderEditor(draft, queryClient);
    await screen.findByRole('group', { name: /^Bônus, Cálculo/ });
    const keep = (definition: typeof probe.definition) => {
      const run = { revision: draft.revision, definition, symbols: draft.symbols, trace: trace() };
      act(() => keepLastUnitRun(queryClient, draft.workflow_id, run));
    };

    // The control: the definition saved at the revision that ran shows its values.
    keep(probe.definition);
    expect(banner()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar' }));

    // An edit not saved yet (as one made between the save of "Calcular" and its run): the trace of the revision does
    // not have it, so the canvas shows nothing and forgets the run.
    node(/^Bônus, Cálculo/).focus();
    await user.keyboard('{ArrowDown}');
    keep(probe.definition);
    expect(banner()).not.toBeInTheDocument();
    expect(node('Bônus, Cálculo')).toBeInTheDocument();
    await waitFor(() => expect(lastRunOf(queryClient, draft.workflow_id)).toBeNull());
  });

  it('reabrir o editor (o rascunho lido de novo) limpa os valores', async () => {
    const { unmount, queryClient } = await renderAndCalculate(trace());
    unmount();

    renderEditor(groupedDraft(), queryClient);
    await screen.findByRole('group', { name: 'Bônus, Cálculo' });
    expect(banner()).not.toBeInTheDocument();
  });

});
