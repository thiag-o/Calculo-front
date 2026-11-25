import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../api';
import { FluxoCalculo, type FluxoCalculoProps } from '.';
import { API, json, sessionWith, simulateApi, simulateWidth } from './module.test-support';

// The epic 7 screens inside <FluxoCalculo>, by role (F131): the Operador schedules and decides the alert of the batch; the
// Configurador sends the reference file and simulates; the Aprovador simulates and sees the diff, without scheduling; the Auditor
// sees everything for reading only, the bell included.

const ANA = { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' };
const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
const WORKFLOW_NAME = 'Pontuação de exemplo';
const WORKFLOW: Schemas['Workflow'] = {
  id: WORKFLOW_ID,
  name: WORKFLOW_NAME,
  objective: null,
  kind: 'batch',
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: ANA,
  draft: { revision: 5, updated_at: '2026-11-18T14:05:00Z', updated_by: ANA, node_count: 3, problem_count: 0 },
  created_at: '2026-11-18T13:40:00Z',
  created_by: ANA,
};
const DRAFT: Schemas['Draft'] = {
  workflow_id: WORKFLOW_ID,
  revision: 5,
  definition: {
    schema_version: 4,
    kind: 'batch',
    settings: {
      error_policy: 'error',
      rounding: { scale: 2, mode: 'half_up' },
      error_limit_percent: '5',
      trace_level: 'standard',
      pre_validation_alert_percent: '1',
    },
    parameters: [],
    root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
  },
  problems: [],
  symbols: [],
  dependencies: [],
  order: [],
  groups: [],
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: ANA,
};

function execution(id: string, partial: Partial<Schemas['Execution']> = {}): Schemas['Execution'] {
  return {
    id,
    workflow_id: WORKFLOW_ID,
    workflow_name: WORKFLOW_NAME,
    draft_revision: 5,
    workflow_version: null,
    status: 'calculating',
    abort_reason: null,
    cancel_requested_at: null,
    next_retry_at: null,
    parameters: {},
    now: '2026-11-21T15:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: ANA,
    created_at: '2026-11-21T15:00:00Z',
    started_at: '2026-11-21T15:00:05Z',
    data_read_at: '2026-11-21T15:00:06Z',
    finished_at: null,
    total_records: 9,
    progress: { chunks_done: 1, records_done: 4 },
    totals: { read: 9, ok: 4, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
    error_groups: [],
    output: { available: false, expires_at: null, rows: null },
    mode: 'batch',
    schedule: null,
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: null,
    comparison: null,
    ...partial,
  };
}

const AWAITING_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const ALERTED: Schemas['PreValidation'] = {
  status: 'alerted',
  records: 9,
  empty_rows: 0,
  null_key_records: 0,
  duplicate_keys: { count: 0, examples: [] },
  empty_values: [{ variable: 'quantidade', empty: 2, percent: '22.22', alert: true }],
  alert_percent: '1',
  decision: null,
  decision_expires_at: '2026-11-25T14:30:00Z',
};
const AWAITING = execution(AWAITING_ID, { status: 'awaiting_decision', pre_validation: ALERTED });
const PROCEEDED = execution(AWAITING_ID, {
  status: 'calculating',
  pre_validation: { ...ALERTED, decision: { choice: 'proceed', by: ANA, at: '2026-11-21T15:05:00Z' } },
});

const SIMULATION_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c20';
const REFERENCE_FILE = { id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01', name: 'esperado-outubro.csv' };
const COMPARISON: Schemas['ComparisonSummary'] = {
  compared: 58,
  equal: 57,
  different: 1,
  status_differs: 0,
  missing_from_result: 0,
  missing_from_file: 0,
  not_compared: 0,
  equal_percent: '98.27',
};
const SIMULATION = execution(SIMULATION_ID, {
  mode: 'simulation',
  status: 'completed',
  finished_at: '2026-11-21T15:04:17Z',
  progress: { chunks_done: 3, records_done: 58 },
  totals: { read: 58, ok: 58, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
  reference_file: REFERENCE_FILE,
  comparison: COMPARISON,
});
const FILE: Schemas['ReferenceFile'] = {
  id: REFERENCE_FILE.id,
  workflow_id: WORKFLOW_ID,
  name: REFERENCE_FILE.name,
  size_bytes: 152,
  sha256: '6f1e3a5c7b9d2e4f6a8c0b2d4e6f8a1c3e5b7d9f0a2c4e6b8d1f3a5c7e9b0d2f',
  records: 2,
  key_columns: ['nf_id', 'item_seq'],
  field_columns: ['pontos'],
  has_status: false,
  uploaded_by: ANA,
  uploaded_at: '2026-11-24T15:50:00Z',
  last_comparison: null,
};
const NEW_FILE: Schemas['ReferenceFile'] = { ...FILE, id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a02', name: 'esperado-novembro.csv' };

const SCHEDULE: Schemas['Schedule'] = {
  id: '7b8c9d0e-1f2a-4b3c-8d4e-000000000001',
  workflow_id: WORKFLOW_ID,
  workflow_name: WORKFLOW_NAME,
  name: 'Fechamento mensal',
  enabled: true,
  recurrence: { kind: 'monthly', time: '02:00', day: 1 },
  timezone: 'America/Sao_Paulo',
  parameters: {},
  draft_revision: 5,
  current_draft_revision: 5,
  next_run_at: '2026-12-01T05:00:00Z',
  last_run: null,
  created_by: ANA,
  created_at: '2026-10-20T13:00:00Z',
  updated_at: '2026-10-20T13:00:00Z',
};

const SCHEDULE_ALERT_ID = '0f1a2b3c-4d5e-4f6a-8b7c-000000000002';
const ALERTS: Schemas['Notification'][] = [
  {
    id: '0f1a2b3c-4d5e-4f6a-8b7c-000000000001',
    kind: 'awaiting_decision',
    title: 'Execução aguarda decisão',
    detail: 'Pontuação de exemplo: a pré-validação encontrou campos vazios acima do limite.',
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    read: false,
    workflow: { id: WORKFLOW_ID, name: WORKFLOW_NAME },
    execution: { id: AWAITING_ID },
    schedule: null,
  },
  {
    id: SCHEDULE_ALERT_ID,
    kind: 'schedule_skipped',
    title: 'Agendamento não executou',
    detail: 'Fechamento mensal (Pontuação de exemplo): o escopo já foi entregue.',
    created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    read: false,
    workflow: { id: WORKFLOW_ID, name: WORKFLOW_NAME },
    execution: null,
    schedule: { id: SCHEDULE.id, name: SCHEDULE.name },
  },
];

const OPERATOR = ['workflows.view', 'executions.view', 'executions.trigger', 'executions.schedule'];
const CONFIGURATOR = ['workflows.view', 'workflows.edit', 'test_cases.edit', 'versions.submit', 'simulations.run', 'connections.view', 'executions.view'];
const APPROVER = ['workflows.view', 'versions.approve', 'simulations.run', 'executions.view'];
const AUDITOR = ['workflows.view', 'connections.view', 'executions.view', 'audit.view', 'traces.view'];

// The upload of the reference file goes by XMLHttpRequest (progress): the test answers it.
class SimulatedUpload {
  static sent: SimulatedUpload[] = [];
  url = '';
  status = 0;
  responseText = '';
  responseType = '';
  withCredentials = false;
  readonly upload = new EventTarget();
  private readonly events = new EventTarget();
  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener);
  }
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader() {}
  send() {
    SimulatedUpload.sent.push(this);
  }
  abort() {}
  respond(status: number, body: unknown) {
    act(() => {
      this.status = status;
      this.responseText = JSON.stringify(body);
      this.events.dispatchEvent(new Event('load'));
    });
  }
}

let alerts: Schemas['Notification'][];

beforeEach(() => {
  alerts = ALERTS;
  SimulatedUpload.sent = [];
  window.history.replaceState(null, '', '/');
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function simulateApiWith(permissions: string[]) {
  vi.stubGlobal('XMLHttpRequest', SimulatedUpload);
  return simulateApi({
    'GET /v1/session': json(sessionWith(permissions)),
    'GET /v1/workflows': json({ items: [], next_cursor: null }),
    [`GET /v1/workflows/${WORKFLOW_ID}`]: json(WORKFLOW),
    [`GET /v1/workflows/${WORKFLOW_ID}/draft`]: json(DRAFT),
    'GET /v1/executions': json({ items: [AWAITING], next_cursor: null }),
    [`GET /v1/executions/${AWAITING_ID}`]: json(AWAITING),
    [`POST /v1/executions/${AWAITING_ID}/proceed`]: json(PROCEEDED, 202),
    [`GET /v1/executions/${SIMULATION_ID}`]: json(SIMULATION),
    [`GET /v1/executions/${SIMULATION_ID}/records`]: json({ items: [], next_cursor: null }),
    [`GET /v1/executions/${SIMULATION_ID}/comparison/records`]: json({
      items: [
        {
          result_key: 'nf_id=10|item_seq=1',
          record_key: { nf_id: '10', item_seq: '1' },
          outcome: 'different',
          expected_status: null,
          obtained_status: 'ok',
          fields: [{ name: 'pontos', expected: '1500.00', obtained: '1250.5' }],
        },
      ],
      next_cursor: null,
    }),
    'GET /v1/schedules': json({ items: [SCHEDULE], next_cursor: null }),
    'GET /v1/notifications': () => json({ items: alerts, next_cursor: null, unread_count: alerts.filter((item) => !item.read).length }),
    'POST /v1/notifications/read': new Response(null, { status: 204 }),
    [`GET /v1/workflows/${WORKFLOW_ID}/reference-files`]: json({ items: [FILE] }),
    [`POST /v1/workflows/${WORKFLOW_ID}/reference-files/${FILE.id}/simulations`]: json(
      execution(SIMULATION_ID, { mode: 'simulation', status: 'pending', reference_file: REFERENCE_FILE }),
      202,
    ),
  });
}

function renderScreen(props: Partial<FluxoCalculoProps> = {}) {
  const user = userEvent.setup({ delay: null });
  render(<FluxoCalculo apiUrl={API} navigation="url" {...props} />);
  return { user };
}

const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const bell = () => screen.findByRole('button', { name: /^Alertas/ });

function open(path: string) {
  window.history.replaceState(null, '', path);
}

describe('Épico 7 no casca: o Operador', () => {
  it('abre Agendamentos pela aba da lista do workflow, com Novo agendamento, e volta para Execuções', async () => {
    open(`/workflows/${WORKFLOW_ID}`);
    simulateApiWith(OPERATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: WORKFLOW_NAME });

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Execuções' }));
    const tabs = await screen.findByRole('tablist', { name: 'Abas de Execuções do workflow' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Execuções', 'Agendamentos']);
    expect(within(tabs).getByRole('tab', { name: 'Execuções', selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();

    await user.click(within(tabs).getByRole('tab', { name: 'Agendamentos' }));
    expect(window.location.pathname).toBe(`/workflows/${WORKFLOW_ID}/executions/schedules`);
    expect(await screen.findByRole('heading', { level: 2, name: 'Agendamentos' })).toBeInTheDocument();
    // One h1 per screen, and the menu item of the workflow stays on Execuções.
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(mainNavigation()).getByRole('link', { name: 'Execuções' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Novo agendamento' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: 'Fechamento mensal ativo' })).toBeChecked();

    await user.click(within(tabs).getByRole('tab', { name: 'Execuções' }));
    expect(window.location.pathname).toBe(`/workflows/${WORKFLOW_ID}/executions`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
  });

  it('abre a rota da aba direto, nas duas telas de execuções', async () => {
    open(`/workflows/${WORKFLOW_ID}/executions/schedules`);
    simulateApiWith(OPERATOR);
    renderScreen();
    expect(await screen.findByRole('tab', { name: 'Agendamentos', selected: true })).toBeInTheDocument();
    expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    cleanup();

    open('/executions/schedules');
    simulateApiWith(OPERATOR);
    renderScreen();
    const tab = await screen.findByRole('tab', { name: 'Agendamentos', selected: true });
    expect(within(tab.closest('[role="tablist"]') as HTMLElement).getAllByRole('tab')).toHaveLength(2);
    expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    // The tenant list shows the workflow of each schedule and has no "Novo agendamento" (a schedule belongs to a workflow).
    expect(screen.getAllByText(WORKFLOW_NAME).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Execuções' })).toHaveAttribute('aria-current', 'page');
  });

  it('a Visão geral mostra a próxima execução agendada', async () => {
    open(`/workflows/${WORKFLOW_ID}`);
    simulateApiWith(OPERATOR);
    renderScreen();
    expect(await screen.findByText(/Próxima execução: 01\/12 às 02:00 · Fechamento mensal/)).toBeInTheDocument();
  });

  it('o sino abre a execução que aguarda decisão, e o Operador decide Prosseguir', async () => {
    const api = simulateApiWith(OPERATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    await user.click(await screen.findByRole('button', { name: 'Alertas, 2 não lidos' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir execução' }));

    await waitFor(() => expect(window.location.pathname).toBe(`/executions/${AWAITING_ID}`));
    expect(await screen.findByText('A pré-validação encontrou campos vazios acima do limite.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prosseguir' }));
    await waitFor(() => expect(api.calls()).toContain(`POST /v1/executions/${AWAITING_ID}/proceed`));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Prosseguir' })).not.toBeInTheDocument());
  });

  it('o sino abre a aba Agendamentos do workflow com o alerta de um agendamento', async () => {
    simulateApiWith(OPERATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    await user.click(await screen.findByRole('button', { name: 'Alertas, 2 não lidos' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir agendamentos' }));

    await waitFor(() => expect(window.location.pathname).toBe(`/workflows/${WORKFLOW_ID}/executions/schedules`));
    expect(await screen.findByRole('heading', { level: 2, name: 'Agendamentos' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Novo agendamento' }).length).toBeGreaterThan(0);
  });
});

describe('Épico 7 no casca: o Configurador', () => {
  it('abre Testes pelo menu do workflow, envia o arquivo de referência e simula', async () => {
    open(`/workflows/${WORKFLOW_ID}`);
    const api = simulateApiWith(CONFIGURATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: WORKFLOW_NAME });

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Testes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Testes' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/workflows/${WORKFLOW_ID}/tests`);
    expect(within(mainNavigation()).getByRole('link', { name: 'Testes' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText(FILE.name)).toBeInTheDocument();

    // Sends a file: the API answers the upload and the list is read again.
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['nf_id,item_seq,pontos'], 'esperado-novembro.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(SimulatedUpload.sent).toHaveLength(1));
    expect(SimulatedUpload.sent[0]!.url).toContain(`/v1/workflows/${WORKFLOW_ID}/reference-files`);
    api.set({ [`GET /v1/workflows/${WORKFLOW_ID}/reference-files`]: json({ items: [FILE, NEW_FILE] }) });
    SimulatedUpload.sent[0]!.respond(201, NEW_FILE);
    expect(await screen.findByText(/Arquivo esperado-novembro\.csv enviado/)).toBeInTheDocument();

    // Simulates: the confirmation opens the panel of the simulation.
    await user.click(screen.getByRole('button', { name: `Simular com ${FILE.name}` }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Simular' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/executions/${SIMULATION_ID}`));
    expect(await screen.findByText('Comparação com o arquivo de referência')).toBeInTheDocument();
  });

  it('um endereço de Testes de outro workflow abre a tela daquele workflow', async () => {
    open(`/workflows/${WORKFLOW_ID}/tests`);
    simulateApiWith(CONFIGURATOR);
    renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: 'Testes' })).toBeInTheDocument();
    expect(await screen.findByText(FILE.name)).toBeInTheDocument();
  });
});

describe('Épico 7 no casca: o Aprovador', () => {
  it('simula e vê o diff do painel, sem agendar nem enviar arquivo', async () => {
    open(`/workflows/${WORKFLOW_ID}/tests`);
    simulateApiWith(APPROVER);
    const { user } = renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: 'Testes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: `Simular com ${FILE.name}` }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Simular' }));
    await waitFor(() => expect(window.location.pathname).toBe(`/executions/${SIMULATION_ID}`));
    expect(await screen.findByText('Comparação com o arquivo de referência')).toBeInTheDocument();
    expect(await screen.findByText('98,27% iguais · 57 de 58 registros')).toBeInTheDocument();
    expect(await screen.findByText('pontos')).toBeInTheDocument();
  });

  it('vê os agendamentos só para leitura', async () => {
    open(`/workflows/${WORKFLOW_ID}/executions/schedules`);
    simulateApiWith(APPROVER);
    renderScreen();
    expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mais ações para o agendamento/ })).not.toBeInTheDocument();
  });
});

describe('Épico 7 no casca: o Auditor', () => {
  it('vê Testes, agendamentos e o sino só para leitura', async () => {
    open(`/workflows/${WORKFLOW_ID}/tests`);
    simulateApiWith(AUDITOR);
    const { user } = renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: 'Testes' })).toBeInTheDocument();
    expect(await screen.findByText(FILE.name)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Simular/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mais ações para o arquivo/ })).not.toBeInTheDocument();

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Execuções' }));
    await user.click(await screen.findByRole('tab', { name: 'Agendamentos' }));
    expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    // The bell reads the alerts and opens them.
    await user.click(await bell());
    expect(await screen.findByRole('dialog', { name: 'Alertas' })).toBeInTheDocument();
    expect(screen.getByText('Execução aguarda decisão')).toBeInTheDocument();
  });
});

describe('Barra do conteúdo e sino', () => {
  it('a barra do conteúdo tem o sino à direita nas três faixas de largura', async () => {
    simulateApiWith(OPERATOR);
    renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    for (const [width, narrow] of [
      [1440, false],
      [1280, false],
      [1100, true],
    ] as const) {
      act(() => simulateWidth(width));
      const bar = await waitFor(() => {
        const found = document.querySelector('.fc-content-bar');
        if (!found) throw new Error('sem barra');
        return found as HTMLElement;
      });
      // Bar and menu side by side: the bar is the first thing of the column beside the sidebar, above the content.
      expect(bar.parentElement).toHaveClass('fc-shell-body');
      expect(bar.nextElementSibling?.tagName).toBe('MAIN');
      expect(within(bar).getByRole('button', { name: /^Alertas/ })).toBeInTheDocument();
      const shell = document.querySelector('.fc-shell')!;
      expect(shell.classList.contains('fc-shell-narrow')).toBe(narrow);
    }
  });

  it('sem executions.view, o casca não tem sino nem barra, e não pede os alertas', async () => {
    const api = simulateApiWith(['workflows.view']);
    renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(document.querySelector('.fc-content-bar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Alertas/ })).not.toBeInTheDocument();
    expect(api.calls().filter((call) => call.includes('/v1/notifications'))).toHaveLength(0);
  });

  it('no incorporado, o sino fica no fim da linha das abas; sem executions.view, sem sino', async () => {
    simulateApiWith(OPERATOR);
    const { user } = renderScreen({ token: 'embed', navigation: 'memory' });
    const tabs = await screen.findByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });
    const embeddedBell = (await bell()).closest('.fc-embedded-bell');
    expect(embeddedBell).toBeInTheDocument();
    expect(embeddedBell?.previousElementSibling).toContainElement(tabs);

    // The alert of an execution opens the panel inside the module, without touching the host app address.
    await user.click(screen.getByRole('button', { name: 'Alertas, 2 não lidos' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir execução' }));
    expect(await screen.findByText('A pré-validação encontrou campos vazios acima do limite.')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    cleanup();

    simulateApiWith(['workflows.view']);
    renderScreen({ token: 'embed', navigation: 'memory' });
    await screen.findByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });
    expect(screen.queryByRole('button', { name: /^Alertas/ })).not.toBeInTheDocument();
    expect(document.querySelector('.fc-embedded-bell')).not.toBeInTheDocument();
  });

  it('sem Workflows, o alerta de um agendamento abre os agendamentos do cliente', async () => {
    // `executions.view` alone: no Workflows screen, so the tab of the tenant is where the schedule alert goes.
    simulateApiWith(['executions.view']);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Início' });
    await user.click(await screen.findByRole('button', { name: 'Alertas, 2 não lidos' }));
    await user.click(await screen.findByRole('button', { name: 'Abrir agendamentos' }));
    await waitFor(() => expect(window.location.pathname).toBe('/executions/schedules'));
    expect(await screen.findByRole('tab', { name: 'Agendamentos', selected: true })).toBeInTheDocument();
  });
});
