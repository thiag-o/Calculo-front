import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../api';
import { FluxoCalculo, type FluxoCalculoProps } from '.';
import { API, BRANCH_TENANT, json, sessionWith, simulateApi, simulateWidth } from './module.test-support';

// Draws the trace of a stored record as the editor does, counting how many times the module's `renderRecordTrace` runs.
const traceRenders = vi.hoisted(() => vi.fn());

// The editor has its own tests; here it is only the screen of the `/workflows/:id/editor` route, which also receives the way to
// open the panel of an execution (the "Executar lote" of its bar is tested in editor/layout/EditorBar.test.tsx).
vi.mock('../editor', async (importOriginal) => {
  const original = await importOriginal<typeof import('../editor')>();
  return {
    ...original,
    UnitRunResult: (props: ComponentProps<typeof original.UnitRunResult>) => {
      traceRenders();
      return <original.UnitRunResult {...props} />;
    },
    Editor: ({ workflowId, onOpenExecution }: { workflowId: string; onOpenExecution?: (id: string) => void }) => (
      <section aria-label="Editor de teste">
        <p>Editando {workflowId}</p>
        {onOpenExecution ? <button type="button" onClick={() => onOpenExecution(RUNNING.id)}>Abrir execução pelo editor</button> : null}
      </section>
    ),
  };
});

// Execuções inside <FluxoCalculo>, by role (E6-19 to E6-21): the Operador triggers and follows; the Aprovador sees the list and the
// panel and does not trigger; the Auditor sees the panel and the trace, with no "Executar lote" and no "Cancelar execução".

const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };
const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
const WORKFLOW: Schemas['Workflow'] = {
  id: WORKFLOW_ID,
  name: 'Pontuação de exemplo',
  objective: null,
  kind: 'batch',
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
  draft: { revision: 3, updated_at: '2026-11-18T14:05:00Z', updated_by: BRUNO, node_count: 3, problem_count: 0 },
  created_at: '2026-11-18T13:40:00Z',
  created_by: BRUNO,
};
const DRAFT: Schemas['Draft'] = {
  workflow_id: WORKFLOW_ID,
  revision: 3,
  definition: {
    schema_version: 3,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
    parameters: [],
    root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
  },
  problems: [],
  symbols: [],
  dependencies: [],
  order: [],
  groups: [],
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
};

function execution(id: string, partial: Partial<Schemas['Execution']> = {}): Schemas['Execution'] {
  return {
    id,
    workflow_id: WORKFLOW_ID,
    workflow_name: WORKFLOW.name,
    draft_revision: 3,
    workflow_version: null,
    status: 'calculating',
    abort_reason: null,
    cancel_requested_at: null,
    next_retry_at: null,
    parameters: {},
    now: '2026-11-21T15:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: BRUNO,
    created_at: '2026-11-21T15:00:00Z',
    started_at: '2026-11-21T15:00:05Z',
    data_read_at: '2026-11-21T15:00:06Z',
    finished_at: null,
    total_records: 1000,
    progress: { chunks_done: 1, records_done: 400 },
    totals: { read: 1000, ok: 400, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
    error_groups: [],
    output: { available: false, expires_at: null, rows: null },
    ...partial,
  };
}

const RUNNING = execution('6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d');
const CREATED = execution('7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e', { status: 'pending', started_at: null, total_records: null });
const RESULT_KEY = 'a'.repeat(64);
const TRACE: Schemas['UnitRunTrace'] = {
  status: 'ok',
  record_key: { nf_id: '10', item_seq: '1' },
  inputs: [],
  nodes: [],
  outputs: { pontos: '1500.00' },
  input_hash: 'sha256:77b0db21bf50aa',
  output_hash: 'sha256:1c2d3e4f5a6b7c',
  error: null,
  warnings: [],
};

const OPERATOR = ['workflows.view', 'executions.view', 'executions.trigger'];
const APPROVER = ['workflows.view', 'versions.approve', 'simulations.run', 'executions.view'];
const AUDITOR = ['workflows.view', 'executions.view', 'traces.view', 'audit.view'];

beforeEach(() => {
  traceRenders.mockClear();
  window.history.replaceState(null, '', '/');
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function simulateApiWith(permissions: string[]) {
  return simulateApi({
    'GET /v1/session': json(sessionWith(permissions)),
    'GET /v1/workflows': json({ items: [WORKFLOW], next_cursor: null }),
    [`GET /v1/workflows/${WORKFLOW_ID}`]: json(WORKFLOW),
    [`GET /v1/workflows/${WORKFLOW_ID}/draft`]: json(DRAFT),
    [`POST /v1/workflows/${WORKFLOW_ID}/executions`]: json(CREATED, 201),
    'GET /v1/executions': json({ items: [RUNNING], next_cursor: null }),
    [`GET /v1/executions/${RUNNING.id}`]: json(RUNNING),
    [`GET /v1/executions/${CREATED.id}`]: json(CREATED),
    [`GET /v1/executions/${RUNNING.id}/definition`]: json({ draft_revision: 3, definition: DRAFT.definition }),
    [`GET /v1/executions/${RUNNING.id}/records`]: json({
      items: [{ result_key: RESULT_KEY, record_key: { nf_id: '10', item_seq: '1' }, status: 'ok', error_node_id: null, error_code: null }],
      next_cursor: null,
    }),
    [`GET /v1/executions/${RUNNING.id}/records/${RESULT_KEY}`]: json({
      execution_id: RUNNING.id,
      trace_level: 'standard',
      record_key: { nf_id: '10', item_seq: '1' },
      status: 'ok',
      input_hash: TRACE.input_hash,
      output_hash: TRACE.output_hash,
      outputs: TRACE.outputs,
      trace: TRACE,
    }),
  });
}

function renderScreen(props: Partial<FluxoCalculoProps> = {}) {
  const user = userEvent.setup({ delay: null });
  render(<FluxoCalculo apiUrl={API} navigation="url" {...props} />);
  return { user };
}

const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const menuLinks = () => within(mainNavigation()).getAllByRole('link').map((link) => link.textContent);

describe('Execuções no casca, por papel', () => {
  it('o Operador abre a lista pelo menu, entra no painel e volta para a lista', async () => {
    simulateApiWith(OPERATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Início' });

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/executions');
    expect(within(mainNavigation()).getByRole('link', { name: 'Execuções' })).toHaveAttribute('aria-current', 'page');

    await user.click(await screen.findByRole('button', { name: /Pontuação de exemplo, execução 6a7b8c9d/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/executions/${RUNNING.id}`);
    // Still running: the Operador can cancel it.
    expect(screen.getByRole('button', { name: 'Cancelar execução' })).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Execuções' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Voltar para execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/executions');
  });

  it('o Operador dispara pela Visão geral e acompanha: o painel da execução nova abre', async () => {
    window.history.replaceState(null, '', `/workflows/${WORKFLOW_ID}`);
    const api = simulateApiWith(OPERATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: WORKFLOW.name });

    await user.click(screen.getByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    await user.click(await within(dialog).findByRole('button', { name: 'Executar lote' }));

    await waitFor(() => expect(window.location.pathname).toBe(`/executions/${CREATED.id}`));
    expect(await screen.findByRole('heading', { level: 1, name: WORKFLOW.name })).toBeInTheDocument();
    expect(api.calls().filter((call) => call === `POST /v1/workflows/${WORKFLOW_ID}/executions`)).toHaveLength(1);
  });

  it('a Visão geral leva à lista do workflow, e o menu do workflow tem Visão geral e Execuções', async () => {
    window.history.replaceState(null, '', `/workflows/${WORKFLOW_ID}`);
    simulateApiWith(OPERATOR);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: WORKFLOW.name });
    expect(menuLinks()).toEqual(['Visão geral', 'Execuções']);
    expect(within(mainNavigation()).getByRole('link', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/workflows/${WORKFLOW_ID}/executions`);
    expect(within(mainNavigation()).getByRole('link', { name: 'Execuções' })).toHaveAttribute('aria-current', 'page');
    expect(within(mainNavigation()).getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current');
    // The list of the workflow has the button and no workflow filter.
    expect(screen.getByRole('button', { name: 'Executar lote' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Workflow' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Pontuação de exemplo, execução 6a7b8c9d/ }));
    expect(window.location.pathname).toBe(`/executions/${RUNNING.id}`);
  });

  it('o botão Ver execuções da Visão geral abre a lista do workflow, e o voltar leva à Visão geral', async () => {
    simulateApiWith(OPERATOR);
    const { user } = renderScreen({ navigation: 'memory', token: 'embed', screen: 'workflows' });
    await user.click(await screen.findByText(WORKFLOW.name));
    await screen.findByRole('heading', { level: 1, name: WORKFLOW.name });

    await user.click(screen.getByRole('button', { name: 'Ver execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar para a visão geral' }));
    expect(await screen.findByRole('heading', { level: 1, name: WORKFLOW.name })).toBeInTheDocument();
  });

  it('o Aprovador vê a lista e o painel, sem Executar lote nem Cancelar execução', async () => {
    window.history.replaceState(null, '', `/workflows/${WORKFLOW_ID}`);
    const { user } = renderScreenWith(APPROVER);
    await screen.findByRole('heading', { level: 1, name: WORKFLOW.name });
    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Pontuação de exemplo, execução 6a7b8c9d/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
    // No traces.view: the records table does not show.
    expect(screen.queryByRole('table', { name: /Registros/ })).not.toBeInTheDocument();
  });

  it('o Auditor vê o painel e o trace do registro pelo componente do editor, sem Executar lote nem Cancelar execução', async () => {
    window.history.replaceState(null, '', `/executions/${RUNNING.id}`);
    simulateApiWith(AUDITOR);
    const { user } = renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar execução' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' }));
    const drawer = await screen.findByRole('dialog', { name: 'Trace do registro' });
    // The trace of the record is the one of "Calcular" (UnitRunResult), handed over by the module: its hashes are in it.
    expect(await within(drawer).findByText(/sha256:77b0db21bf50/)).toBeInTheDocument();
  });

  it('sem executions.view, o menu não tem Execuções e a rota volta ao Início', async () => {
    window.history.replaceState(null, '', '/executions');
    simulateApiWith(['workflows.view']);
    renderScreen();

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(menuLinks()).not.toContain('Execuções');
    expect(window.location.pathname).toBe('/home');
  });

  it('o editor recebe o caminho para abrir o painel de uma execução', async () => {
    window.history.replaceState(null, '', `/workflows/${WORKFLOW_ID}/editor`);
    simulateApiWith(OPERATOR);
    const { user } = renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Abrir execução pelo editor' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/executions/${RUNNING.id}`);
  });

  it('no modo incorporado, Execuções é uma aba, e a aba abre a lista', async () => {
    simulateApiWith(OPERATOR);
    const { user } = renderScreen({ token: 'embed', navigation: 'memory' });
    const tabs = await screen.findByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Início', 'Workflows', 'Execuções']);

    await user.click(within(tabs).getByRole('tab', { name: 'Execuções' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
  });
});

describe('Execuções: executions.view e troca de cliente', () => {
  it('sem executions.view, /workflows/:id/executions cai na Visão geral, sem Ver execuções', async () => {
    window.history.replaceState(null, '', `/workflows/${WORKFLOW_ID}/executions`);
    const api = simulateApiWith(['workflows.view', 'executions.trigger']);
    renderScreen();

    expect(await screen.findByRole('heading', { level: 1, name: WORKFLOW.name })).toBeInTheDocument();
    expect(menuLinks()).toEqual(['Visão geral']);
    expect(screen.queryByRole('button', { name: 'Ver execuções' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Executar lote' })).toBeInTheDocument();
    expect(api.calls().filter((call) => call === 'GET /v1/executions')).toHaveLength(0);
  });

  it('sem executions.view, quem dispara o lote fica na Visão geral, com o aviso de que o lote foi criado', async () => {
    window.history.replaceState(null, '', `/workflows/${WORKFLOW_ID}`);
    const api = simulateApiWith(['workflows.view', 'executions.trigger']);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: WORKFLOW.name });

    await user.click(screen.getByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    await user.click(await within(dialog).findByRole('button', { name: 'Executar lote' }));

    expect(await screen.findByText(/O lote foi criado\. Você não tem permissão para acompanhar as execuções/)).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/workflows/${WORKFLOW_ID}`);
    expect(api.calls().filter((call) => call === `POST /v1/workflows/${WORKFLOW_ID}/executions`)).toHaveLength(1);
    expect(api.calls().filter((call) => call.startsWith('GET /v1/executions'))).toHaveLength(0);
  });

  it('o painel só chama o trace do módulo com traces.view: o Aprovador não, o Auditor sim', async () => {
    window.history.replaceState(null, '', `/executions/${RUNNING.id}`);
    const approver = simulateApiWith(APPROVER);
    renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    await waitFor(() => expect(approver.calls()).toContain(`GET /v1/executions/${RUNNING.id}`));
    expect(approver.calls().filter((call) => call.includes('/records'))).toHaveLength(0);
    expect(traceRenders).not.toHaveBeenCalled();
    cleanup();

    simulateApiWith(AUDITOR);
    const { user } = renderScreen();
    await user.click(await screen.findByRole('button', { name: 'Abrir o trace de nf_id 10 · item_seq 1' }));
    expect(await screen.findByRole('dialog', { name: 'Trace do registro' })).toBeInTheDocument();
    await waitFor(() => expect(traceRenders).toHaveBeenCalled());
  });

  it('trocar de cliente com o painel de uma execução aberto volta para as execuções do cliente novo', async () => {
    window.history.replaceState(null, '', `/executions/${RUNNING.id}`);
    document.cookie = 'fc_csrf=csrf-de-teste; path=/';
    const branch = { ...sessionWith(OPERATOR), current_tenant: BRANCH_TENANT };
    simulateApi({
      'GET /v1/session': json(sessionWith(OPERATOR)),
      'PUT /v1/session/tenant': json(branch),
      'GET /v1/executions': json({ items: [], next_cursor: null }),
      [`GET /v1/executions/${RUNNING.id}`]: json(RUNNING),
    });
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });

    await user.click(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
    await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.name }));

    await waitFor(() => expect(window.location.pathname).toBe('/executions'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Execuções' })).toBeInTheDocument();
    document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });
});

function renderScreenWith(permissions: string[]) {
  simulateApiWith(permissions);
  return renderScreen();
}
