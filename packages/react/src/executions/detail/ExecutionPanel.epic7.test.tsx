// The panel of an execution with what epic 7 brings (E7-21): the new states, the pre-validation and its decision, the
// Fontes section, the abort by a repeated key, the scheduled execution, the confirmed overlap and the simulation.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import {
  OPERATOR_PERMISSIONS,
  VIEWER_PERMISSIONS,
  completed,
  execution,
  json,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from '../api/executions.test-support';
import { dateTime, shortDateTime } from '../list/format';
import { ExecutionPanel } from '.';

const ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
const OTHER_ID = '6a7b8c9d-0e1f-4a2b-8c3d-000000000099';
const GET = `GET /v1/executions/${ID}`;
const CANCEL = `POST /v1/executions/${ID}/cancel`;
const PROCEED = `POST /v1/executions/${ID}/proceed`;
const RECORDS = `GET /v1/executions/${ID}/records`;
const DEFINITION = `GET /v1/executions/${ID}/definition`;
const DEADLINE = '2026-11-22T17:30:00Z';
const SCHEDULE = { id: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e', name: 'Fechamento mensal' };
const ANA = { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' };

/** Who triggers simulations and does not run batches. */
const SIMULATOR_PERMISSIONS = ['workflows.view', 'executions.view', 'simulations.run'];

type Execution = Schemas['Execution'];
type PreValidation = Schemas['PreValidation'];

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi(OPERATOR_PERMISSIONS);
  api.respond(RECORDS, json({ items: [], next_cursor: null }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function preValidation(partial: Partial<PreValidation> = {}): PreValidation {
  return {
    status: 'passed',
    records: 1180,
    empty_rows: 4,
    null_key_records: 2,
    duplicate_keys: { count: 0, examples: [] },
    empty_values: [],
    alert_percent: '1',
    decision: null,
    decision_expires_at: null,
    ...partial,
  };
}

/** The pre-validation that stopped the execution: `quantidade` above the 1% limit, `desconto` below it. */
const ALERTED = preValidation({
  status: 'alerted',
  records: 9,
  empty_rows: 0,
  null_key_records: 0,
  empty_values: [
    { variable: 'desconto', empty: 0, percent: '0.5', alert: false },
    { variable: 'quantidade', empty: 2, percent: '22.22', alert: true },
  ],
  decision_expires_at: DEADLINE,
});

function awaiting(partial: Partial<Execution> = {}): Execution {
  return execution({
    id: ID,
    status: 'awaiting_decision',
    started_at: '2026-11-21T15:00:05Z',
    data_read_at: '2026-11-21T15:00:06Z',
    total_records: 9,
    pre_validation: ALERTED,
    ...partial,
  });
}

function withId(partial: Partial<Execution> = {}): Execution {
  return execution({ id: ID, ...partial });
}

function finished(partial: Partial<Execution> = {}): Execution {
  return completed({ id: ID, pre_validation: preValidation(), ...partial });
}

function renderPanel(props: Partial<Parameters<typeof ExecutionPanel>[0]> = {}, options: Parameters<typeof renderScreen>[1] = {}) {
  return renderScreen(<ExecutionPanel executionId={ID} {...props} />, options);
}

/** The (decorative) dot color of a status word. */
function dotOf(word: HTMLElement): string | undefined {
  const status = word.closest('.fc-status')!;
  return Array.from(status.classList).find((cssClass) => cssClass.startsWith('fc-status-') && cssClass !== 'fc-status-pulsing');
}

function pulses(word: HTMLElement): boolean {
  return word.closest('.fc-status')!.classList.contains('fc-status-pulsing');
}

function phases(): string[] {
  return within(screen.getByRole('region', { name: 'Fases' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

/** The status word in the header, beside the short id. */
async function headerStatus(label: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { level: 1 });
  const header = heading.closest('header')!;
  return within(header).findByText(label);
}

async function sessionLoaded(queryClient: ReturnType<typeof renderPanel>['queryClient']) {
  await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
}

describe('Painel da execução (épico 7): estados novos', () => {
  const cases: [Execution['status'], Execution['mode'], string, string, boolean][] = [
    ['pre_validating', 'batch', 'Calculando', 'fc-status-amber', true],
    ['comparing', 'simulation', 'Calculando', 'fc-status-amber', true],
    ['awaiting_decision', 'batch', 'Aguardando decisão', 'fc-status-amber', false],
  ];

  it.each(cases)('%s (%s) aparece como "%s", com o ponto certo', async (status, mode, label, dot, pulsing) => {
    api.respond(GET, json(withId({ status, mode, total_records: 9, pre_validation: status === 'awaiting_decision' ? ALERTED : null })));
    renderPanel();

    const word = await headerStatus(label);
    expect(dotOf(word)).toBe(dot);
    expect(pulses(word)).toBe(pulsing);
  });

  it('a simulação que termina sem erros é "Sem entrega", ponto cinza sem pulsar', async () => {
    api.respond(GET, json(finished({ mode: 'simulation', output: { available: false, expires_at: null, rows: null } })));
    renderPanel();

    const word = await headerStatus('Sem entrega');
    expect(dotOf(word)).toBe('fc-status-gray');
    expect(pulses(word)).toBe(false);
  });

  it('a simulação com erros continua "Com erros"', async () => {
    api.respond(GET, json(finished({ mode: 'simulation', status: 'completed_with_errors', output: { available: false, expires_at: null, rows: null } })));
    renderPanel();
    expect(dotOf(await headerStatus('Com erros'))).toBe('fc-status-red');
  });
});

describe('Painel da execução (épico 7): fases', () => {
  it('no lote: Carga → Pré-validação → Cálculo → Entrega, com a pré-validação em andamento', async () => {
    api.respond(GET, json(withId({ status: 'pre_validating', total_records: 1180 })));
    renderPanel();
    await screen.findByRole('region', { name: 'Fases' });
    expect(phases()).toEqual(['Cargaconcluída', 'Pré-validaçãoem andamento', 'Cálculoa fazer', 'Entregaa fazer']);
  });

  it('aguardando decisão: a pré-validação fica marcada como "aguardando decisão"', async () => {
    api.respond(GET, json(awaiting()));
    renderPanel();
    await screen.findByRole('region', { name: 'Fases' });
    expect(phases()).toEqual(['Cargaconcluída', 'Pré-validaçãoaguardando decisão', 'Cálculoa fazer', 'Entregaa fazer']);
    const current = within(screen.getByRole('region', { name: 'Fases' }))
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Pré-validação');
  });

  it('na simulação a última fase é Comparação', async () => {
    api.respond(GET, json(withId({ mode: 'simulation', status: 'comparing', total_records: 10, progress: { chunks_done: 1, records_done: 10 }, pre_validation: preValidation() })));
    renderPanel();
    await screen.findByRole('region', { name: 'Fases' });
    expect(phases()).toEqual(['Cargaconcluída', 'Pré-validaçãoconcluída', 'Cálculoconcluída', 'Comparaçãoem andamento']);
  });

  it('cancelada na decisão: para na pré-validação', async () => {
    const decision: Schemas['PreValidationDecision'] = { choice: 'cancel', by: ANA, at: '2026-11-21T15:10:00Z' };
    api.respond(GET, json(withId({ status: 'cancelled', total_records: 9, finished_at: '2026-11-21T15:10:00Z', pre_validation: { ...ALERTED, decision } })));
    renderPanel();
    await screen.findByRole('region', { name: 'Fases' });
    expect(phases()).toEqual(['Cargaconcluída', 'Pré-validaçãointerrompida', 'Cálculoa fazer', 'Entregaa fazer']);
  });
});

describe('Painel da execução (épico 7): decisão sobre o alerta', () => {
  it('mostra a nota âmbar com os campos acima do limite, o prazo e Prosseguir e Cancelar', async () => {
    api.respond(GET, json(awaiting()));
    renderPanel();

    const title = await screen.findByText('A pré-validação encontrou campos vazios acima do limite.');
    const note = title.closest('[role="status"]') as HTMLElement;
    const list = within(note).getByRole('list', { name: 'Campos vazios acima do limite' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['quantidade: 22,22% vazios, limite 1%']);
    expect(note).toHaveTextContent(`Sem resposta até ${shortDateTime(DEADLINE)}, a execução é cancelada.`);
    expect(shortDateTime(DEADLINE)).toMatch(/^\d{2}\/\d{2} às \d{2}:\d{2}$/);
    expect(screen.getByRole('button', { name: 'Prosseguir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    // One button per action: "Cancelar execução" in the header gives way to the alert's "Cancelar".
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
  });

  it('o diálogo de cancelar na pré-validação diz que nada foi calculado, e no cálculo, que os registros calculados não são entregues', async () => {
    api.respond(GET, json(awaiting()));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    expect(dialog).toHaveTextContent('Nada foi calculado ainda e a execução não gera CSV.');
    expect(dialog).not.toHaveTextContent('Os registros já calculados não são entregues');
  });

  it('pré-validando também: nada foi calculado', async () => {
    api.respond(GET, json(withId({ status: 'pre_validating', total_records: 1180 })));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar execução' }));
    expect(await screen.findByRole('dialog', { name: 'Cancelar execução' })).toHaveTextContent('Nada foi calculado ainda');
  });

  it('409 execution_finished no Cancelar do alerta: o diálogo fica com o erro e o foco não vai ao body', async () => {
    let answerRead: (response: Response) => void = () => {};
    api.respond(GET, json(awaiting()), () => new Promise<Response>((resolve) => (answerRead = resolve)));
    api.respond(CANCEL, problem(409, 'execution_finished'));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar execução' }));
    expect(await within(dialog).findByText(/A execução terminou antes do pedido de cancelamento/)).toBeInTheDocument();

    // The execution is read again and is no longer awaiting a decision: the alert (and its button) is gone, the dialog stays.
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(2));
    answerRead(json(awaiting({ status: 'cancelled', finished_at: DEADLINE, pre_validation: { ...ALERTED, decision: { choice: 'expired', by: null, at: DEADLINE } } })));
    // The open dialog hides the rest of the screen from the accessibility tree: the word is found by its text.
    expect((await screen.findAllByText('Cancelada')).length).toBeGreaterThan(0);
    expect(screen.queryByText('A pré-validação encontrou campos vazios acima do limite.')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Cancelar execução' })).toBe(dialog);
    expect(within(dialog).getByText(/A execução terminou antes do pedido de cancelamento/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body).not.toHaveFocus();
    expect(screen.getByRole('heading', { level: 1 }).closest('.fc-execution-title')).toHaveFocus();
  });

  it('Prosseguir envia a decisão e o painel segue para o cálculo', async () => {
    api.respond(GET, json(awaiting()));
    const decision: Schemas['PreValidationDecision'] = { choice: 'proceed', by: ANA, at: '2026-11-21T15:05:00Z' };
    api.respond(PROCEED, json(awaiting({ status: 'calculating', pre_validation: { ...ALERTED, decision } }), 202));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Prosseguir' }));

    await waitFor(() => expect(screen.queryByText('A pré-validação encontrou campos vazios acima do limite.')).not.toBeInTheDocument());
    expect(api.callsTo(PROCEED)).toHaveLength(1);
    expect(await headerStatus('Calculando')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pré-validação' })).toHaveTextContent(`DecisãoProsseguir · Ana Souza em ${dateTime('2026-11-21T15:05:00Z')}`);
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
  });

  it('Cancelar pede a confirmação e só cancela ao confirmar', async () => {
    api.respond(GET, json(awaiting()));
    const decision: Schemas['PreValidationDecision'] = { choice: 'cancel', by: ANA, at: '2026-11-21T15:05:00Z' };
    api.respond(CANCEL, json(awaiting({ status: 'cancelled', finished_at: '2026-11-21T15:05:00Z', pre_validation: { ...ALERTED, decision } }), 202));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    let dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(CANCEL)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar execução' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(CANCEL)).toHaveLength(1);
    expect(api.callsTo(PROCEED)).toHaveLength(0);
    expect(await headerStatus('Cancelada')).toBeInTheDocument();
    expect(screen.queryByText('A pré-validação encontrou campos vazios acima do limite.')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pré-validação' })).toHaveTextContent(`DecisãoCancelar · Ana Souza em ${dateTime('2026-11-21T15:05:00Z')}`);
  });

  it('enquanto Prosseguir está em andamento, Cancelar fica desabilitado com o motivo', async () => {
    api.respond(GET, json(awaiting()));
    let answer: (response: Response) => void = () => {};
    api.respond(PROCEED, () => new Promise<Response>((resolve) => (answer = resolve)));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Prosseguir' }));
    await waitFor(() => expect(api.callsTo(PROCEED)).toHaveLength(1));
    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancel).toHaveAttribute('aria-disabled', 'true');
    expect(cancel).toHaveAccessibleDescription('Aguarde a resposta do Prosseguir');
    // A second click does not send the decision twice.
    await user.click(screen.getByRole('button', { name: 'Prosseguir' }));
    expect(api.callsTo(PROCEED)).toHaveLength(1);

    await act(async () => answer(json(awaiting({ status: 'calculating' }), 202)));
    expect(await headerStatus('Calculando')).toBeInTheDocument();
  });

  it('sem executions.trigger, o lote mostra a nota sem os botões e diz quem pode decidir', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(GET, json(awaiting()));
    const { queryClient } = renderPanel();

    const title = await screen.findByText('A pré-validação encontrou campos vazios acima do limite.');
    await sessionLoaded(queryClient);
    expect(title.closest('[role="status"]')).toHaveTextContent('Só quem executa lotes pode decidir.');
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('na simulação a permissão é simulations.run: executions.trigger não basta', async () => {
    api.respond(GET, json(awaiting({ mode: 'simulation' })));
    const { queryClient } = renderPanel();

    const title = await screen.findByText('A pré-validação encontrou campos vazios acima do limite.');
    await sessionLoaded(queryClient);
    expect(title.closest('[role="status"]')).toHaveTextContent('Só quem executa simulações pode decidir.');
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('na simulação, quem tem simulations.run decide', async () => {
    api = simulateApi(SIMULATOR_PERMISSIONS);
    api.respond(GET, json(awaiting({ mode: 'simulation' })));
    renderPanel();

    expect(await screen.findByRole('button', { name: 'Prosseguir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.queryByText(/pode decidir/)).not.toBeInTheDocument();
  });

  it('409 not_awaiting_decision: explica e lê a execução de novo', async () => {
    const expired: Schemas['PreValidationDecision'] = { choice: 'expired', by: null, at: DEADLINE };
    let answerRead: (response: Response) => void = () => {};
    api.respond(GET, json(awaiting()), () => new Promise<Response>((resolve) => (answerRead = resolve)));
    api.respond(PROCEED, problem(409, 'not_awaiting_decision'));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Prosseguir' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível prosseguir');
    expect(alert).toHaveTextContent('A execução não está mais aguardando decisão');
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(2));
    answerRead(json(awaiting({ status: 'cancelled', finished_at: DEADLINE, pre_validation: { ...ALERTED, decision: expired } })));
    expect(await headerStatus('Cancelada')).toBeInTheDocument();
    // The error belonged to the alert: once the execution left `awaiting_decision`, it goes.
    expect(screen.queryByText('Não foi possível prosseguir')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pré-validação' })).toHaveTextContent(`DecisãoSem resposta no prazo: cancelada em ${dateTime(DEADLINE)}`);
  });

  /** Opens the panel awaiting a decision and leaves the next 2 s refresh in flight; returns how to answer it. */
  async function lateRefreshInFlight() {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let answerRefresh: (response: Response) => void = () => {};
    api.respond(GET, json(awaiting()), () => new Promise<Response>((resolve) => (answerRefresh = resolve)));
    const screenParts = renderPanel();
    expect(await headerStatus('Aguardando decisão')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(2));
    return { ...screenParts, answerRefresh: (response: Response) => answerRefresh(response) };
  }

  it('Prosseguir não é desfeito por uma atualização de 2 s que responde depois', async () => {
    const decision: Schemas['PreValidationDecision'] = { choice: 'proceed', by: ANA, at: '2026-11-21T15:05:00Z' };
    api.respond(PROCEED, json(awaiting({ status: 'calculating', pre_validation: { ...ALERTED, decision } }), 202));
    const { user, answerRefresh } = await lateRefreshInFlight();

    await user.click(screen.getByRole('button', { name: 'Prosseguir' }));
    expect(await headerStatus('Calculando')).toBeInTheDocument();
    // The refresh sent before the decision answers now, still awaiting it.
    await act(async () => answerRefresh(json(awaiting())));

    expect(await headerStatus('Calculando')).toBeInTheDocument();
    expect(screen.queryByText('A pré-validação encontrou campos vazios acima do limite.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
    expect(api.callsTo(PROCEED)).toHaveLength(1);
  });

  it('Prosseguir não é desfeito por uma atualização de 2 s enviada enquanto a decisão estava a caminho', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let answerRefresh: (response: Response) => void = () => {};
    let answerProceed: (response: Response) => void = () => {};
    api.respond(GET, json(awaiting()), () => new Promise<Response>((resolve) => (answerRefresh = resolve)));
    api.respond(PROCEED, () => new Promise<Response>((resolve) => (answerProceed = resolve)));
    const { user } = renderPanel();

    await user.click(await screen.findByRole('button', { name: 'Prosseguir' }));
    await waitFor(() => expect(api.callsTo(PROCEED)).toHaveLength(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(2));
    await act(async () => answerProceed(json(awaiting({ status: 'calculating' }), 202)));
    expect(await headerStatus('Calculando')).toBeInTheDocument();
    await act(async () => answerRefresh(json(awaiting())));

    expect(await headerStatus('Calculando')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
  });

  it('Cancelar não é desfeito por uma atualização de 2 s que responde depois', async () => {
    const decision: Schemas['PreValidationDecision'] = { choice: 'cancel', by: ANA, at: '2026-11-21T15:05:00Z' };
    api.respond(CANCEL, json(awaiting({ status: 'cancelled', finished_at: '2026-11-21T15:05:00Z', pre_validation: { ...ALERTED, decision } }), 202));
    const { user, answerRefresh } = await lateRefreshInFlight();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar execução' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar execução' }));
    expect(await headerStatus('Cancelada')).toBeInTheDocument();
    await act(async () => answerRefresh(json(awaiting())));

    expect(await headerStatus('Cancelada')).toBeInTheDocument();
    expect(screen.queryByText('A pré-validação encontrou campos vazios acima do limite.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument();
    expect(api.callsTo(CANCEL)).toHaveLength(1);
  });

  it('em awaiting_decision continua pedindo a execução a cada 2 s e para no estado final', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const expired: Schemas['PreValidationDecision'] = { choice: 'expired', by: null, at: DEADLINE };
    api.respond(
      GET,
      json(awaiting()),
      json(awaiting()),
      json(awaiting({ status: 'cancelled', finished_at: DEADLINE, pre_validation: { ...ALERTED, decision: expired } })),
    );
    renderPanel();
    expect(await headerStatus('Aguardando decisão')).toBeInTheDocument();
    expect(api.callsTo(GET)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await waitFor(() => expect(api.callsTo(GET)).toHaveLength(2));
    expect(screen.getByText('A pré-validação encontrou campos vazios acima do limite.')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(await headerStatus('Cancelada')).toBeInTheDocument();
    expect(api.callsTo(GET)).toHaveLength(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(api.callsTo(GET)).toHaveLength(3);
  });
});

describe('Painel da execução (épico 7): resumo da pré-validação', () => {
  it('sem pré-validação (antes dela), a seção não aparece', async () => {
    api.respond(GET, json(withId({ status: 'loading' })));
    renderPanel();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Pré-validação' })).not.toBeInTheDocument();
  });

  it('registros, linhas vazias, chaves nulas, chaves repetidas, limite e vazios por variável', async () => {
    api.respond(
      GET,
      json(
        finished({
          pre_validation: preValidation({
            status: 'alerted',
            records: 1180,
            empty_rows: 1200,
            null_key_records: 3,
            empty_values: [
              { variable: 'desconto', empty: 1, percent: '0.08', alert: false },
              { variable: 'quantidade', empty: 59, percent: '5', alert: true },
            ],
            alert_percent: '2.5',
            decision: { choice: 'automatic', by: null, at: '2026-11-21T15:00:30Z' },
          }),
        }),
      ),
    );
    renderPanel();

    const section = await screen.findByRole('region', { name: 'Pré-validação' });
    const status = within(section).getByText('Com alerta');
    expect(dotOf(status)).toBe('fc-status-amber');
    expect(section).toHaveTextContent('Registros1.180');
    expect(section).toHaveTextContent('Linhas vazias1.200');
    expect(section).toHaveTextContent('Chaves nulas3');
    expect(section).toHaveTextContent('Chaves repetidas0');
    expect(section).toHaveTextContent('Limite do alerta2,5%');
    expect(section).toHaveTextContent(`DecisãoSeguiu sozinha, por ser agendada, em ${dateTime('2026-11-21T15:00:30Z')}`);
    const empties = within(section).getAllByRole('listitem');
    expect(empties.map((item) => item.textContent)).toEqual(['desconto1 vazio · 0,08%', 'quantidade59 vazios · 5%acima do limite']);
    expect(dotOf(within(empties[1]!).getByText('acima do limite'))).toBe('fc-status-amber');
  });

  it('sem alerta: ponto verde e "Nenhuma variável com vazios."', async () => {
    api.respond(GET, json(finished()));
    renderPanel();
    const section = await screen.findByRole('region', { name: 'Pré-validação' });
    expect(dotOf(within(section).getByText('Sem alerta'))).toBe('fc-status-green');
    expect(section).toHaveTextContent('Nenhuma variável com vazios.');
    expect(section).not.toHaveTextContent('Decisão');
  });
});

describe('Painel da execução (épico 7): aborto por chave repetida', () => {
  it('mostra a mensagem, o que fazer e até 5 chaves de exemplo em mono; a pré-validação fica bloqueada', async () => {
    const examples = [
      { nf_id: '10', item_seq: '1' },
      { nf_id: '11', item_seq: '2' },
      { nf_id: '12', item_seq: '1' },
      { nf_id: '13', item_seq: '4' },
      { nf_id: '14', item_seq: '1' },
    ];
    api.respond(
      GET,
      json(
        withId({
          status: 'aborted',
          abort_reason: { code: 'duplicate_record_key', message: 'A chave do registro se repete no lote. Nada foi calculado: corrija a origem ou a chave do registro.' },
          started_at: '2026-11-21T15:00:05Z',
          finished_at: '2026-11-21T15:00:09Z',
          total_records: 1180,
          pre_validation: preValidation({ status: 'blocked', duplicate_keys: { count: 7, examples } }),
        }),
      ),
    );
    renderPanel();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('duplicate_record_key');
    expect(alert).toHaveTextContent('A chave do registro se repete no lote. Nada foi calculado');
    expect(alert).toHaveTextContent('Corrija a origem ou a chave do registro no workflow');
    expect(alert).toHaveTextContent('7 chaves se repetem no lote. Exemplos:');
    const keys = within(alert).getByRole('list', { name: 'Chaves repetidas: exemplos' });
    const items = within(keys).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'nf_id 10 · item_seq 1',
      'nf_id 11 · item_seq 2',
      'nf_id 12 · item_seq 1',
      'nf_id 13 · item_seq 4',
      'nf_id 14 · item_seq 1',
    ]);
    expect(items[0]).toHaveClass('fc-execution-key');
    expect(phases()).toEqual(['Cargaconcluída', 'Pré-validaçãointerrompida', 'Cálculoa fazer', 'Entregaa fazer']);
    const section = screen.getByRole('region', { name: 'Pré-validação' });
    expect(dotOf(within(section).getByText('Bloqueada'))).toBe('fc-status-red');
    expect(section).toHaveTextContent('Chaves repetidas7');
    expect(screen.getByRole('button', { name: 'Baixar CSV' })).toHaveAccessibleDescription('Execução abortada não entrega CSV');
  });
});

describe('Painel da execução (épico 7): Fontes', () => {
  const COUNTS: Schemas['SourceCount'][] = [
    { node_id: 'produto', node_name: 'Produto do item', mode: 'linear', found: 1100, no_match: 80, multiple_rows: 1, kept: null, filtered: null },
    { node_id: 'meta', node_name: 'Meta do vendedor', mode: 'linear', found: 1180, no_match: 0, multiple_rows: 3, kept: null, filtered: null },
    { node_id: 'ativos', node_name: 'Só ativos', mode: 'filter', found: null, no_match: null, multiple_rows: null, kept: 1, filtered: 1179 },
  ];

  function linear(id: string, noMatch: Schemas['NoMatchPolicy'], multipleRows: Schemas['MultipleRowsPolicy']): Schemas['LinearSourceNode'] {
    return {
      id,
      type: 'source',
      name: id,
      description: null,
      position: { x: 0, y: 0 },
      mode: 'linear',
      dataset_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      links: [],
      filters: [],
      order_by: [],
      no_match: noMatch,
      multiple_rows: multipleRows,
      exists: null,
      outputs: [],
    };
  }

  it('sem contagens (antes do primeiro chunk), a seção não aparece e a definição não é pedida', async () => {
    api = simulateApi([...OPERATOR_PERMISSIONS, 'traces.view']);
    api.respond(RECORDS, json({ items: [], next_cursor: null }));
    api.respond(GET, json(withId({ status: 'calculating' })));
    renderPanel();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Fontes' })).not.toBeInTheDocument();
    expect(api.callsTo(DEFINITION)).toHaveLength(0);
  });

  it('com traces.view: as contagens de cada bloco com ponto e palavra, na cor da política do bloco', async () => {
    api = simulateApi([...OPERATOR_PERMISSIONS, 'traces.view']);
    api.respond(RECORDS, json({ items: [], next_cursor: null }));
    api.respond(GET, json(finished({ source_counts: COUNTS })));
    const definition: Schemas['ExecutionDefinition'] = {
      draft_revision: 5,
      definition: {
        schema_version: 4,
        kind: 'batch',
        settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard', pre_validation_alert_percent: '1' },
        parameters: [],
        root: {
          batch_source: null,
          inputs: [],
          nodes: [
            linear('produto', 'keep_null', 'error'),
            { id: 'grupo', type: 'group', name: 'Metas', description: null, position: { x: 0, y: 0 }, collapsed: false, outputs: [], nodes: [linear('meta', 'error', 'accept_first')] },
          ],
          output: { fields: [] },
        },
      },
    };
    api.respond(DEFINITION, json(definition));
    renderPanel();

    const section = await screen.findByRole('region', { name: 'Fontes' });
    const product = within(section).getByRole('list', { name: 'Contagens de Produto do item' });
    await waitFor(() => expect(dotOf(within(product).getByText('80 sem correspondência'))).toBe('fc-status-amber'));
    expect(dotOf(within(product).getByText('1.100 encontrados'))).toBe('fc-status-green');
    expect(dotOf(within(product).getByText('1 com mais de uma linha'))).toBe('fc-status-red');
    const goal = within(section).getByRole('list', { name: 'Contagens de Meta do vendedor' });
    expect(dotOf(within(goal).getByText('0 sem correspondência'))).toBe('fc-status-gray');
    expect(dotOf(within(goal).getByText('3 com mais de uma linha'))).toBe('fc-status-amber');
    const active = within(section).getByRole('list', { name: 'Contagens de Só ativos' });
    expect(dotOf(within(active).getByText('1 passou no filtro'))).toBe('fc-status-green');
    expect(dotOf(within(active).getByText('1.179 filtrados'))).toBe('fc-status-multi');
    expect(section).toHaveTextContent('Linear');
    expect(section).toHaveTextContent('Filtro');
  });

  it('sem traces.view: as mesmas palavras, a cor segue o valor (aviso acima de zero) e a definição não é pedida', async () => {
    api.respond(GET, json(finished({ source_counts: COUNTS })));
    const { queryClient } = renderPanel();

    const section = await screen.findByRole('region', { name: 'Fontes' });
    await sessionLoaded(queryClient);
    const product = within(section).getByRole('list', { name: 'Contagens de Produto do item' });
    expect(dotOf(within(product).getByText('1.100 encontrados'))).toBe('fc-status-green');
    // Without the definition the policy is unknown, but a count above zero is still a warning (D111).
    expect(dotOf(within(product).getByText('80 sem correspondência'))).toBe('fc-status-amber');
    expect(dotOf(within(product).getByText('1 com mais de uma linha'))).toBe('fc-status-amber');
    expect(api.callsTo(DEFINITION)).toHaveLength(0);
  });
});

describe('Painel da execução (épico 7): agendada e sobreposição', () => {
  it('agendada: "Agendada · <agendamento>" no lugar de quem disparou', async () => {
    api.respond(GET, json(finished({ triggered_by: null, schedule: SCHEDULE })));
    renderPanel();
    await screen.findByRole('heading', { level: 1 });
    const run = screen.getByRole('region', { name: 'Resumo' });
    expect(run).toHaveTextContent(`Disparado porAgendada · Fechamento mensal em ${dateTime('2026-11-21T15:00:00Z')}`);
  });

  it('sobreposição confirmada: diz sobre qual execução rodou de novo e abre o painel dela', async () => {
    api.respond(GET, json(finished({ overlap_of: { id: OTHER_ID, created_at: '2026-11-03T05:00:00Z' } })));
    const onOpenExecution = vi.fn();
    const { user } = renderPanel({ onOpenExecution });

    const link = await screen.findByRole('button', { name: `execução de ${shortDateTime('2026-11-03T05:00:00Z')}` });
    expect(link.closest('p')).toHaveTextContent(`Executada de novo sobre a execução de ${shortDateTime('2026-11-03T05:00:00Z')}`);
    await user.click(link);
    expect(onOpenExecution).toHaveBeenCalledWith(OTHER_ID);
  });

  it('sem onOpenExecution, a execução sobreposta é texto', async () => {
    api.respond(GET, json(finished({ overlap_of: { id: OTHER_ID, created_at: '2026-11-03T05:00:00Z' } })));
    renderPanel();
    expect(await screen.findByText(`Executada de novo sobre a execução de ${shortDateTime('2026-11-03T05:00:00Z')}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /execução de/ })).not.toBeInTheDocument();
  });

  it('sem sobreposição, nada é dito', async () => {
    api.respond(GET, json(finished()));
    renderPanel();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/Executada de novo/)).not.toBeInTheDocument();
  });
});

describe('Painel da execução (épico 7): simulação', () => {
  it('Baixar CSV fica desabilitado com "A simulação não entrega arquivo."', async () => {
    api = simulateApi(SIMULATOR_PERMISSIONS);
    api.respond(GET, json(finished({ mode: 'simulation', output: { available: false, expires_at: null, rows: null } })));
    renderPanel();

    const button = await screen.findByRole('button', { name: 'Baixar CSV' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('A simulação não entrega arquivo.');
    expect(screen.getByText('A simulação não entrega arquivo.')).toBeInTheDocument();
    expect(phases().at(-1)).toBe('Comparaçãoconcluída');
  });

  it('enquanto roda, a simulação também diz que não entrega arquivo.', async () => {
    api.respond(GET, json(withId({ mode: 'simulation', status: 'calculating', total_records: 10, progress: { chunks_done: 0, records_done: 4 } })));
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Baixar CSV' })).toHaveAccessibleDescription('A simulação não entrega arquivo.');
  });

  it('Cancelar execução de uma simulação não aparece só com executions.trigger', async () => {
    api.respond(GET, json(withId({ mode: 'simulation', status: 'calculating' })));
    const { queryClient } = renderPanel();
    await screen.findByRole('heading', { level: 1 });
    await sessionLoaded(queryClient);
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
  });

  it('Cancelar execução de uma simulação aparece com simulations.run', async () => {
    api = simulateApi(SIMULATOR_PERMISSIONS);
    api.respond(RECORDS, json({ items: [], next_cursor: null }));
    api.respond(GET, json(withId({ mode: 'simulation', status: 'calculating' })));
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Cancelar execução' })).toBeInTheDocument();
  });
});
