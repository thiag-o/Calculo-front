import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorScreen } from '.';
import { DRAFT, DraftProbe, WORKFLOW_ID, json, renderScreen, simulateApi, type SimulatedApi } from '../draft/editor.test-support';
import type { Schemas } from '../../api';

const TRIGGER_ROUTE = `POST /v1/workflows/${WORKFLOW_ID}/executions`;
const EXECUTION_ID = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';
const ANA = { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' };

/** The execution the API creates for the batch (`pending`). */
const CREATED: Schemas['Execution'] = {
  id: EXECUTION_ID,
  workflow_id: WORKFLOW_ID,
  workflow_name: 'Pontuação de exemplo',
  draft_revision: DRAFT.revision,
  workflow_version: null,
  status: 'pending',
  abort_reason: null,
  cancel_requested_at: null,
  next_retry_at: null,
  parameters: {},
  now: '2026-11-21T15:00:00Z',
  trace_level: 'standard',
  error_limit_percent: '5',
  triggered_by: ANA,
  created_at: '2026-11-21T15:00:00Z',
  started_at: null,
  data_read_at: null,
  finished_at: null,
  total_records: null,
  progress: { chunks_done: 0, records_done: 0 },
  totals: { read: 0, ok: 0, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
  error_groups: [],
  output: { available: false, expires_at: null, rows: null },
  mode: 'batch',
  schedule: null,
  pre_validation: null,
  source_counts: [],
  overlap_of: null,
  reference_file: null,
  comparison: null,
};

let api: SimulatedApi;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function openEditor(permissions: string[], onOpenExecution?: (id: string) => void) {
  api = simulateApi(permissions);
  api.respond(TRIGGER_ROUTE, json(CREATED, 201));
  return renderScreen(
    <EditorScreen workflowId={WORKFLOW_ID} onBack={() => {}} onOpenExecution={onOpenExecution} canvas={<DraftProbe />} />,
  );
}

const bar = () => screen.getByRole('banner');

describe('Editor: Executar lote na barra', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('com executions.trigger, o botão fica na barra e o lote disparado abre o painel da execução nova', async () => {
    const onOpenExecution = vi.fn();
    const { user } = openEditor(['workflows.view', 'executions.view', 'executions.trigger'], onOpenExecution);

    await user.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    expect(within(dialog).getByText(/Executa o rascunho salvo \(revisão/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Executar lote' }));

    await waitFor(() => expect(onOpenExecution).toHaveBeenCalledWith(EXECUTION_ID));
    expect(api.callCount(TRIGGER_ROUTE)).toBe(1);
  });

  it('sem executions.view, o lote é criado, a barra fica onde está e avisa, sem abrir o painel', async () => {
    const onOpenExecution = vi.fn();
    const { user } = openEditor(['workflows.view', 'executions.trigger'], onOpenExecution);

    await user.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    await user.click(within(dialog).getByRole('button', { name: 'Executar lote' }));

    expect(await within(bar()).findByText('Lote criado. Você não tem permissão para acompanhar as execuções.')).toBeInTheDocument();
    expect(api.callCount(TRIGGER_ROUTE)).toBe(1);
    expect(onOpenExecution).not.toHaveBeenCalled();
  });

  it('sem executions.trigger (o Aprovador e o Auditor), a barra não tem o botão', async () => {
    openEditor(['workflows.view', 'executions.view', 'traces.view'], vi.fn());

    await screen.findByRole('banner');
    await screen.findByText('Rascunho');
    expect(within(bar()).queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
  });

  it('sem onOpenExecution (o editor fora do módulo completo), a barra não tem o botão', async () => {
    openEditor(['workflows.view', 'executions.trigger']);

    await screen.findByRole('banner');
    await screen.findByText('Rascunho');
    expect(within(bar()).queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
  });
});

describe('Editor: nota de sobreposição do Executar lote', () => {
  const OVERLAP = {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01',
    status: 'completed',
    created_at: '2026-11-01T05:00:00Z',
    finished_at: '2026-11-01T05:09:30Z',
    triggered_by: ANA,
    schedule: null,
  };

  async function triggerOverlap(permissions: string[], onOpenExecution: (id: string) => void) {
    const { user } = openEditor(permissions, onOpenExecution);
    api.respond(TRIGGER_ROUTE, json({ type: 'about:blank', title: 'Erro', status: 409, detail: 'x', code: 'scope_already_delivered', overlapping: [OVERLAP] }, 409));
    await user.click(await within(await screen.findByRole('banner')).findByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    await within(dialog).findByText(/Executa o rascunho salvo \(revisão/);
    await user.click(within(dialog).getByRole('button', { name: 'Executar lote' }));
    return { user, dialog };
  }

  it('a execução da nota vira um link que abre o painel dela, com executions.view', async () => {
    const onOpenExecution = vi.fn();
    const { user, dialog } = await triggerOverlap(['workflows.view', 'executions.view', 'executions.trigger'], onOpenExecution);

    await user.click(await within(dialog).findByRole('button', { name: /Abrir a execução de/ }));

    expect(onOpenExecution).toHaveBeenCalledWith(OVERLAP.id);
  });

  it('sem executions.view, a nota lista as execuções sem link', async () => {
    const { dialog } = await triggerOverlap(['workflows.view', 'executions.trigger'], vi.fn());

    expect(await within(dialog).findByText('Este escopo já foi entregue')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Abrir a execução de/ })).not.toBeInTheDocument();
  });
});
