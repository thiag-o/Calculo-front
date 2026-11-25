import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIST, SCHEDULER_PERMISSIONS, WORKFLOW_ID, problem, renderScreen, schedule, schedulePage, simulateApi } from './schedules.test-support';
import { NextScheduledRun } from '.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Visão geral: próxima execução', () => {
  it('o agendamento ativo que dispara primeiro, no fuso dele', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(
      LIST,
      schedulePage([
        schedule({ name: 'Conferência semanal', next_run_at: '2026-12-03T11:00:00Z' }),
        schedule({ name: 'Fechamento mensal', next_run_at: '2026-12-01T05:00:00Z' }),
        schedule({ name: 'Pausado', enabled: false, next_run_at: null }),
      ]),
    );
    renderScreen(<NextScheduledRun workflowId={WORKFLOW_ID} />);

    expect(await screen.findByText('Próxima execução: 01/12 às 02:00 · Fechamento mensal')).toBeInTheDocument();
    expect(new URL(api.callsTo(LIST)[0]!.url).searchParams.get('workflow_id')).toBe(WORKFLOW_ID);
  });

  it('sem agendamento ativo', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(LIST, schedulePage([schedule({ enabled: false, next_run_at: null })]));
    renderScreen(<NextScheduledRun workflowId={WORKFLOW_ID} />);
    expect(await screen.findByText('Nenhuma execução agendada')).toBeInTheDocument();
  });

  it('carregando e erro', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    let release: (response: Response) => void = () => {};
    api.respond(LIST, new Promise<Response>((resolve) => (release = resolve)));
    renderScreen(<NextScheduledRun workflowId={WORKFLOW_ID} />);
    expect(await screen.findByText('Carregando a próxima execução')).toBeInTheDocument();
    release(problem(500, 'internal_error'));
    expect(await screen.findByText('Não foi possível ler os agendamentos deste workflow.')).toBeInTheDocument();
  });

  it('sem executions.view: nada aparece e nada é pedido', async () => {
    const api = simulateApi(['workflows.view']);
    renderScreen(<NextScheduledRun workflowId={WORKFLOW_ID} />);
    await waitFor(() => expect(api.callsTo('GET /v1/session')).toHaveLength(1));
    // The session answer arrives and is read: still nothing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/execução/)).not.toBeInTheDocument();
    expect(api.callsTo(LIST)).toHaveLength(0);
  });
});
