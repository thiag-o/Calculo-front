import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LIST,
  SCHEDULER_PERMISSIONS,
  SCHEDULE_VIEWER_PERMISSIONS,
  WORKFLOW_ID,
  bodyOf,
  json,
  problem,
  remove,
  renderScreen,
  schedule,
  schedulePage,
  simulateApi,
  update,
} from './schedules.test-support';
import { ScheduleList } from '.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const rowOf = (text: string) => screen.getAllByText(text)[0]!.closest('tr')!;
const listQueries = (api: ReturnType<typeof simulateApi>) => api.callsTo(LIST).map((request) => new URL(request.url).searchParams);

/** The (decorative) dot color of a status word. */
function dotOf(word: HTMLElement): string | undefined {
  const status = word.closest('.fc-status')!;
  return Array.from(status.classList).find((cssClass) => cssClass.startsWith('fc-status-') && cssClass !== 'fc-status-pulsing');
}

describe('Agendamentos: lista', () => {
  it('mostra o esqueleto enquanto carrega', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(LIST, new Promise<Response>(() => {}));
    renderScreen(<ScheduleList />);
    expect(screen.getByRole('heading', { name: 'Agendamentos' })).toBeInTheDocument();
    expect(await screen.findByText('Carregando agendamentos do tenant')).toBeInTheDocument();
  });

  it('lista do tenant: pede sem filtro e mostra o workflow, a recorrência, os parâmetros e a próxima execução no fuso do agendamento', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(
      LIST,
      schedulePage([
        schedule(),
        schedule({
          name: 'Conferência semanal',
          workflow_name: 'Bônus de metas',
          recurrence: { kind: 'weekly', time: '08:00', weekdays: [1, 4] },
          parameters: { periodo: { kind: 'fixed', value: { start: '2026-02-01', end: '2026-02-28' } }, regiao: { kind: 'fixed', value: 'Sul' } },
          next_run_at: '2026-11-26T11:00:00Z',
        }),
        schedule({ name: 'Fim do mês', recurrence: { kind: 'monthly', time: '23:00', day: 'last' }, parameters: {} }),
      ]),
    );
    renderScreen(<ScheduleList />);

    expect(await screen.findByText('Todo dia 1 às 02:00')).toBeInTheDocument();
    expect(listQueries(api)[0]!.has('workflow_id')).toBe(false);
    expect(screen.getByText('3 agendamentos')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Workflow' })).toBeInTheDocument();
    expect(within(rowOf('Conferência semanal')).getByText('Bônus de metas')).toBeInTheDocument();
    expect(screen.getByText('Toda segunda e quinta às 08:00')).toBeInTheDocument();
    expect(screen.getByText('Todo último dia do mês às 23:00')).toBeInTheDocument();
    expect(within(rowOf('Fechamento mensal')).getByText('periodo: Mês anterior')).toBeInTheDocument();
    expect(within(rowOf('Conferência semanal')).getByText('periodo: 01/02/2026 a 28/02/2026 · regiao: Sul')).toBeInTheDocument();
    // 05:00 UTC is 02:00 in America/Sao_Paulo, whatever the zone of whoever runs the test.
    expect(within(rowOf('Fechamento mensal')).getByText('01/12 às 02:00')).toBeInTheDocument();
    expect(within(rowOf('Conferência semanal')).getByText('26/11 às 08:00')).toBeInTheDocument();
  });

  it('lista do workflow: filtra pelo workflow e esconde a coluna Workflow', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(LIST, schedulePage([schedule()]));
    renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    expect(listQueries(api)[0]!.get('workflow_id')).toBe(WORKFLOW_ID);
    expect(screen.queryByRole('columnheader', { name: 'Workflow' })).not.toBeInTheDocument();
    expect(screen.getByText('1 agendamento')).toBeInTheDocument();
  });

  describe('último disparo, com cada resultado', () => {
    it('Disparou: ponto verde e o link para a execução', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      const executionId = '6a7b8c9d-0e1f-4a2b-8c3d-000000000099';
      api.respond(
        LIST,
        schedulePage([
          schedule({
            last_run: {
              scheduled_for: '2026-11-01T05:00:00Z',
              fired_at: '2026-11-01T05:00:12Z',
              outcome: 'triggered',
              execution_id: executionId,
              message: null,
            },
          }),
        ]),
      );
      const onOpenExecution = vi.fn();
      const { user } = renderScreen(<ScheduleList onOpenExecution={onOpenExecution} />);

      const word = await screen.findByText('Disparou');
      expect(dotOf(word)).toBe('fc-status-green');
      expect(within(rowOf('Fechamento mensal')).getByText('01/11 às 02:00')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Abrir a execução de 01/11 às 02:00, do agendamento Fechamento mensal' }));
      expect(onOpenExecution).toHaveBeenCalledWith(executionId);
    });

    it('Não executou (sobreposição): ponto âmbar e o motivo, sem link', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(
        LIST,
        schedulePage([
          schedule({
            last_run: {
              scheduled_for: '2026-11-01T05:00:00Z',
              fired_at: '2026-11-01T05:00:12Z',
              outcome: 'skipped_overlap',
              execution_id: null,
              message: 'Este escopo já foi entregue ou está em execução.',
            },
          }),
        ]),
      );
      renderScreen(<ScheduleList onOpenExecution={vi.fn()} />);

      const word = await screen.findByText('Não executou');
      expect(dotOf(word)).toBe('fc-status-amber');
      expect(screen.getByText('Este escopo já foi entregue ou está em execução.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Abrir a execução/ })).not.toBeInTheDocument();
    });

    it('Não disparou (falha): ponto vermelho e o motivo', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(
        LIST,
        schedulePage([
          schedule({
            last_run: {
              scheduled_for: '2026-11-01T05:00:00Z',
              fired_at: '2026-11-01T05:00:12Z',
              outcome: 'failed',
              execution_id: null,
              message: 'O parâmetro regiao não está entre os valores permitidos.',
            },
          }),
        ]),
      );
      renderScreen(<ScheduleList />);

      const word = await screen.findByText('Não disparou');
      expect(dotOf(word)).toBe('fc-status-red');
      expect(screen.getByText('O parâmetro regiao não está entre os valores permitidos.')).toBeInTheDocument();
    });

    it('sem disparo ainda e desativado: "—" no último disparo e na próxima execução', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(LIST, schedulePage([schedule({ enabled: false, next_run_at: null })]));
      renderScreen(<ScheduleList />);

      await screen.findByText('Fechamento mensal');
      expect(within(rowOf('Fechamento mensal')).getAllByText('—')).toHaveLength(2);
    });
  });

  it('a revisão desatualizada aparece na linha', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(LIST, schedulePage([schedule({ draft_revision: 42, current_draft_revision: 57 })]));
    renderScreen(<ScheduleList />);
    expect(await screen.findByText('Revisão 42 · rascunho na 57')).toBeInTheDocument();
  });

  describe('Ativo', () => {
    it('desativar envia o agendamento inteiro com enabled falso e a mesma revisão; ativar de novo envia verdadeiro', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      const item = schedule({ draft_revision: 42, current_draft_revision: 57 });
      const off = { ...item, enabled: false, next_run_at: null };
      api.respond(LIST, schedulePage([item]), schedulePage([off]), schedulePage([item]));
      api.respond(update(item.id), json(off));
      const { user } = renderScreen(<ScheduleList />);

      const toggle = await screen.findByRole('switch', { name: 'Fechamento mensal ativo' });
      expect(toggle).toBeChecked();
      await user.click(toggle);

      await waitFor(() => expect(screen.getByRole('switch', { name: 'Fechamento mensal ativo' })).not.toBeChecked());
      expect(await bodyOf(api.callsTo(update(item.id))[0]!)).toEqual({
        revision: 42,
        name: 'Fechamento mensal',
        enabled: false,
        recurrence: { kind: 'monthly', time: '02:00', day: 1 },
        parameters: { periodo: { kind: 'relative', value: 'previous_month' } },
      });

      api.respond(update(item.id), json(item));
      await user.click(screen.getByRole('switch', { name: 'Fechamento mensal ativo' }));
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Fechamento mensal ativo' })).toBeChecked());
      expect(await bodyOf(api.callsTo(update(item.id))[1]!)).toMatchObject({ enabled: true, revision: 42 });
    });

    it('um erro ao mudar fica numa nota acima da lista, e o switch continua como estava', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      const item = schedule();
      api.respond(LIST, schedulePage([item]));
      api.respond(update(item.id), problem(404, 'not_found'));
      const { user } = renderScreen(<ScheduleList />);

      await user.click(await screen.findByRole('switch', { name: 'Fechamento mensal ativo' }));
      expect(await screen.findByText('Não foi possível mudar o agendamento Fechamento mensal')).toBeInTheDocument();
      expect(screen.getByText('Este agendamento não existe mais. Ele pode ter sido removido por outra pessoa.')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Fechamento mensal ativo' })).toBeChecked();
    });
  });

  describe('sem executions.schedule', () => {
    it('esconde o switch, o menu "…" e Novo agendamento; Ativo vira palavra', async () => {
      const api = simulateApi(SCHEDULE_VIEWER_PERMISSIONS);
      api.respond(LIST, schedulePage([schedule(), schedule({ name: 'Pausado', enabled: false, next_run_at: null })]));
      renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

      expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mais ações/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Novo agendamento' })).not.toBeInTheDocument();
      expect(within(rowOf('Fechamento mensal')).getByText('Ativo')).toBeInTheDocument();
      expect(within(rowOf('Pausado')).getByText('Desativado')).toBeInTheDocument();
    });

    it('vazio do workflow: sem ação', async () => {
      const api = simulateApi(SCHEDULE_VIEWER_PERMISSIONS);
      api.respond(LIST, schedulePage([]));
      renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);
      expect(await screen.findByText('Nenhum agendamento')).toBeInTheDocument();
      expect(screen.getByText('Quem agenda lotes no tenant ainda não agendou este workflow.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    });
  });

  describe('vazio e erro', () => {
    it('vazio do workflow com permissão: oferece Novo agendamento', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(LIST, schedulePage([]));
      renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);
      expect(await screen.findByText('Nenhum agendamento')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Novo agendamento' })).toHaveLength(2);
    });

    it('vazio do tenant: diz onde os agendamentos são criados, sem Novo agendamento', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(LIST, schedulePage([]));
      renderScreen(<ScheduleList />);
      expect(
        await screen.findByText('Os agendamentos dos workflows do tenant aparecem aqui. Eles são criados na aba Agendamentos de cada workflow.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Novo agendamento' })).not.toBeInTheDocument();
    });

    it('erro: nota com Tentar de novo, que lê de novo', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(LIST, problem(500, 'internal_error'), schedulePage([schedule()]));
      const { user } = renderScreen(<ScheduleList />);

      expect(await screen.findByText('Não foi possível carregar os agendamentos')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      expect(await screen.findByText('Fechamento mensal')).toBeInTheDocument();
    });

    it('sem permissão de ver: nota sem Tentar de novo', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      api.respond(LIST, problem(403, 'no_permission'));
      renderScreen(<ScheduleList />);
      expect(await screen.findByText('Você não tem permissão para ver os agendamentos neste tenant. Peça acesso a um Admin.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    });
  });

  it('Carregar mais agendamentos pede a página seguinte pelo cursor', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(LIST, schedulePage([schedule({ name: 'A' }), schedule({ name: 'B' })], 'cursor-2'), schedulePage([schedule({ name: 'C' })]));
    const { user } = renderScreen(<ScheduleList />);

    expect(await screen.findByText('Mais de 2 agendamentos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Carregar mais agendamentos' }));
    expect(await screen.findByText('C')).toBeInTheDocument();
    expect(screen.getByText('3 agendamentos')).toBeInTheDocument();
    expect(listQueries(api)[1]!.get('cursor')).toBe('cursor-2');
    expect(screen.queryByRole('button', { name: 'Carregar mais agendamentos' })).not.toBeInTheDocument();
  });

  describe('remover', () => {
    it('pelo menu "…", com confirmação: remove e lê a lista de novo', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      const item = schedule();
      api.respond(LIST, schedulePage([item]), schedulePage([]));
      api.respond(remove(item.id), new Response(null, { status: 204 }));
      const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

      await user.click(await screen.findByRole('button', { name: 'Mais ações para Fechamento mensal' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Remover agendamento' }));
      const dialog = await screen.findByRole('dialog', { name: 'Remover agendamento' });
      expect(dialog).toHaveTextContent('O agendamento Fechamento mensal deixa de disparar.');
      expect(api.callsTo(remove(item.id))).toHaveLength(0);

      await user.click(within(dialog).getByRole('button', { name: 'Remover agendamento' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(api.callsTo(remove(item.id))).toHaveLength(1);
      expect(await screen.findByText('Nenhum agendamento')).toBeInTheDocument();
    });

    it('Cancelar não remove', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      const item = schedule();
      api.respond(LIST, schedulePage([item]));
      const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

      await user.click(await screen.findByRole('button', { name: 'Mais ações para Fechamento mensal' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Remover agendamento' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(api.callsTo(remove(item.id))).toHaveLength(0);
      expect(screen.getByText('Fechamento mensal')).toBeInTheDocument();
    });

    it('um erro fica no diálogo', async () => {
      const api = simulateApi(SCHEDULER_PERMISSIONS);
      const item = schedule();
      api.respond(LIST, schedulePage([item]));
      api.respond(remove(item.id), problem(403, 'no_permission'));
      const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

      await user.click(await screen.findByRole('button', { name: 'Mais ações para Fechamento mensal' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Remover agendamento' }));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: 'Remover agendamento' }));
      expect(
        await within(dialog).findByText('Você não tem permissão para mudar os agendamentos deste workflow. Peça acesso a um Admin.'),
      ).toBeInTheDocument();
    });
  });
});
