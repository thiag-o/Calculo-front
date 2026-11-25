// The conflicts of a change (E7-24), the other workflow taking the place of the list, the recurrence's day error and the time
// zone the browser does not know: the finishing touches of the schedules (F139).
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT,
  LIST,
  SCHEDULER_PERMISSIONS,
  WORKFLOW_ID,
  bodyOf,
  json,
  parameter,
  problem,
  renderScreen,
  savedDraft,
  schedule,
  schedulePage,
  simulateApi,
  update,
} from './schedules.test-support';
import { scheduleDateTime } from './format';
import { ScheduleList } from '.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PERIOD_ONLY = [parameter('periodo', 'period')];
const dialog = () => screen.getByRole('dialog');
const save = () => within(dialog()).getByRole('button', { name: 'Salvar' });

async function openEdit(user: ReturnType<typeof renderScreen>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Mais ações para Fechamento mensal' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Editar agendamento' }));
  return screen.findByRole('dialog', { name: 'Editar agendamento' });
}

describe('Agendamentos: conflito ao editar', () => {
  it('draft_conflict: texto próprio, a lista é lida de novo e o próximo Salvar envia a revisão do agendamento atualizado', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, json(savedDraft(43, PERIOD_ONLY)));
    const old = schedule({ draft_revision: 42, current_draft_revision: 43 });
    const fresh = { ...old, draft_revision: 43 };
    api.respond(LIST, schedulePage([old]), schedulePage([fresh]));
    api.respond(update(old.id), problem(409, 'draft_conflict', { current_revision: 43 }), json(fresh));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await within(opened).findByText('Roda a revisão 42 do rascunho salvo.');
    await user.click(save());

    expect(await within(opened).findByText('O agendamento mudou')).toBeInTheDocument();
    expect(within(opened).getByText(/A janela já leu a versão atual/)).toBeInTheDocument();
    expect(within(opened).queryByText('O rascunho foi salvo de novo')).not.toBeInTheDocument();
    // The list was read again and the dialog took the schedule from it: no conflict repeated.
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
    expect(await within(opened).findByText('Roda a revisão 43 do rascunho salvo.')).toBeInTheDocument();

    await user.click(save());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(update(old.id))[0]!)).toMatchObject({ revision: 42 });
    expect(await bodyOf(api.callsTo(update(old.id))[1]!)).toMatchObject({ revision: 43 });
  });

  it('schedule_name_taken: no campo Nome, e a lista é lida de novo', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, json(savedDraft(42, PERIOD_ONLY)));
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(409, 'schedule_name_taken'));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await within(opened).findByText('Roda a revisão 42 do rascunho salvo.');
    await user.click(save());

    await waitFor(() =>
      expect(within(opened).getByLabelText('Nome')).toHaveAccessibleDescription(
        'Já existe um agendamento com esse nome neste workflow. Escolha outro nome.',
      ),
    );
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
  });

  it('draft_has_problems: a nota fica no diálogo e a lista é lida de novo', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, json(savedDraft(42, PERIOD_ONLY)));
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(409, 'draft_has_problems', { problems: [] }));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await within(opened).findByText('Roda a revisão 42 do rascunho salvo.');
    await user.click(save());

    expect(await within(opened).findByText('O rascunho salvo tem problemas')).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
  });

  it('o erro de recurrence.day aparece sob o dia do mês, não sob o horário', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, json(savedDraft(42, PERIOD_ONLY)));
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(422, 'invalid_data', { fields: { 'recurrence.day': 'O dia do mês vai de 1 a 28 ou o último dia.' } }));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await within(opened).findByText('Roda a revisão 42 do rascunho salvo.');
    await user.click(save());

    await waitFor(() =>
      expect(within(opened).getByRole('combobox', { name: 'Dia do mês' })).toHaveAccessibleDescription(
        expect.stringContaining('O dia do mês vai de 1 a 28 ou o último dia.'),
      ),
    );
    expect(within(opened).getByLabelText('Horário')).not.toHaveAccessibleDescription(/dia do mês/);
  });

  it('o rascunho do diálogo aberto não é lido de novo quando a janela volta a ter o foco', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, json(savedDraft(42, PERIOD_ONLY)), json(savedDraft(57, PERIOD_ONLY)));
    api.respond(LIST, schedulePage([schedule()]));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await within(opened).findByText('Roda a revisão 42 do rascunho salvo.');
    expect(api.callsTo(DRAFT)).toHaveLength(1);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(api.callsTo(DRAFT)).toHaveLength(1);
    expect(within(opened).getByText('Roda a revisão 42 do rascunho salvo.')).toBeInTheDocument();
    focusManager.setFocused(undefined);
  });
});

describe('Agendamentos: o switch Ativo diante de um conflito', () => {
  it.each([
    ['draft_conflict', /O agendamento ou o rascunho mudou depois que a lista foi lida/],
    ['draft_has_problems', /O rascunho salvo tem problemas e o agendamento não pode ser mudado agora/],
    ['no_batch_source', /O rascunho salvo não tem fonte do lote/],
    ['workflow_busy', /O workflow está ocupado com outra mudança/],
    ['schedule_name_taken', /Já existe um agendamento com esse nome neste workflow/],
  ])('%s: texto próprio, sem a mensagem crua da API', async (code, text) => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(409, code));
    const { user } = renderScreen(<ScheduleList />);

    await user.click(await screen.findByRole('switch', { name: 'Fechamento mensal ativo' }));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByText(`Texto do servidor para ${code}.`)).not.toBeInTheDocument();
  });

  it('draft_conflict também lê a lista de novo', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(409, 'draft_conflict', { current_revision: 43 }));
    const { user } = renderScreen(<ScheduleList />);

    await user.click(await screen.findByRole('switch', { name: 'Fechamento mensal ativo' }));

    await waitFor(() => expect(api.callsTo(LIST)).toHaveLength(2));
  });
});

describe('Agendamentos: outro workflow no lugar da lista montada', () => {
  function Host() {
    const [workflowId, setWorkflowId] = useState<string | undefined>(WORKFLOW_ID);
    return (
      <>
        <button type="button" onClick={() => setWorkflowId('4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f99')}>
          Outro workflow
        </button>
        <ScheduleList workflowId={workflowId} />
      </>
    );
  }

  it('o diálogo aberto e a nota de erro do workflow anterior somem', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, json(savedDraft(42, PERIOD_ONLY)));
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(404, 'not_found'));
    const { user } = renderScreen(<Host />);

    // The note of a failed change, and then a dialog open.
    await user.click(await screen.findByRole('switch', { name: 'Fechamento mensal ativo' }));
    expect(await screen.findByText('Não foi possível mudar o agendamento Fechamento mensal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Novo agendamento' }));
    expect(await screen.findByRole('dialog', { name: 'Novo agendamento' })).toBeInTheDocument();

    api.respond(LIST, schedulePage([]));
    await act(async () => {
      screen.getByText('Outro workflow').click();
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Não foi possível mudar o agendamento Fechamento mensal')).not.toBeInTheDocument();
  });
});

describe('Agendamentos: fuso que o navegador não conhece', () => {
  it('avisa no console, uma vez por fuso, e mostra no fuso do navegador', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = scheduleDateTime('2026-12-01T05:00:00Z', 'Marte/Olympus_Mons');
    const second = scheduleDateTime('2026-12-02T05:00:00Z', 'Marte/Olympus_Mons');

    expect(first).toMatch(/^\d{2}\/12 às \d{2}:\d{2}$/);
    expect(second).toMatch(/^\d{2}\/12 às \d{2}:\d{2}$/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('Marte/Olympus_Mons');
  });
});
