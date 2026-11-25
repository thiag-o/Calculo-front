import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CREATE,
  DRAFT,
  LIST,
  SCHEDULER_PERMISSIONS,
  WORKFLOW_ID,
  bodyOf,
  draftProblem,
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
import { ScheduleDialog, ScheduleList } from '.';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PARAMETERS = [parameter('periodo', 'period'), parameter('regiao', 'text')];

function prepare(draft = savedDraft(42, PARAMETERS)) {
  const api = simulateApi(SCHEDULER_PERMISSIONS);
  api.respond(DRAFT, json(draft));
  return api;
}

function renderNew(onSaved = vi.fn()) {
  const screenParts = renderScreen(<ScheduleDialog workflowId={WORKFLOW_ID} timeZone="America/Sao_Paulo" onClose={vi.fn()} onSaved={onSaved} />);
  return { ...screenParts, onSaved };
}

const dialog = () => screen.getByRole('dialog');
const save = () => within(dialog()).getByRole('button', { name: 'Salvar' });

async function typeInto(user: UserEvent, label: string, text: string) {
  const field = within(dialog()).getByLabelText(label);
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

async function chooseRelative(user: UserEvent, name: string, label: string) {
  await user.click(within(screen.getByRole('radiogroup', { name: `Valor de ${name}` })).getByRole('radio', { name: 'Relativo' }));
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: label }));
}

describe('Agendamentos: Novo agendamento', () => {
  it('pela lista do workflow: abre o diálogo com a revisão do rascunho salvo e o fuso como texto; Salvar cria e fecha', async () => {
    const api = prepare();
    const created = schedule({ name: 'Diário' });
    api.respond(LIST, schedulePage([schedule()]), schedulePage([schedule(), created]));
    api.respond(CREATE, json(created, 201));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    await user.click(await screen.findByRole('button', { name: 'Novo agendamento' }));
    expect(await within(dialog()).findByText('Roda a revisão 42 do rascunho salvo.')).toBeInTheDocument();
    expect(within(dialog()).getByText('Horário de America/Sao_Paulo')).toBeInTheDocument();
    expect(within(dialog()).getByRole('switch', { name: 'Ativo' })).toBeChecked();

    await typeInto(user, 'Nome', 'Diário');
    await typeInto(user, 'Horário', '6:30');
    await chooseRelative(user, 'periodo', 'Mês anterior');
    await typeInto(user, 'regiao', 'Sul');
    await user.click(save());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(CREATE)[0]!)).toEqual({
      revision: 42,
      name: 'Diário',
      enabled: true,
      recurrence: { kind: 'daily', time: '06:30' },
      parameters: { periodo: { kind: 'relative', value: 'previous_month' }, regiao: { kind: 'fixed', value: 'Sul' } },
    });
    expect(await screen.findByText('Diário')).toBeInTheDocument();
  });

  it('semanal, com o período fixo e desativado', async () => {
    const api = prepare();
    api.respond(CREATE, json(schedule(), 201));
    const { user, onSaved } = renderNew();

    await within(await screen.findByRole('dialog')).findByText('Roda a revisão 42 do rascunho salvo.');
    await typeInto(user, 'Nome', 'Conferência');
    await user.click(within(dialog()).getByRole('radio', { name: 'Semanal' }));
    // Monday is already chosen; Thursday joins it.
    expect(within(dialog()).getByRole('checkbox', { name: 'Segunda' })).toBeChecked();
    await user.click(within(dialog()).getByRole('checkbox', { name: 'Quinta' }));
    await typeInto(user, 'Horário', '08:00');
    fireEvent.change(within(dialog()).getByLabelText('Início'), { target: { value: '2026-02-01' } });
    fireEvent.change(within(dialog()).getByLabelText('Fim'), { target: { value: '2026-02-28' } });
    await user.click(within(dialog()).getByRole('switch', { name: 'Ativo' }));
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await bodyOf(api.callsTo(CREATE)[0]!)).toEqual({
      revision: 42,
      name: 'Conferência',
      enabled: false,
      recurrence: { kind: 'weekly', time: '08:00', weekdays: [1, 4] },
      parameters: { periodo: { kind: 'fixed', value: { start: '2026-02-01', end: '2026-02-28' } } },
    });
  });

  it('mensal no último dia, com o período relativo e o texto fixo', async () => {
    const api = prepare();
    api.respond(CREATE, json(schedule(), 201));
    const { user, onSaved } = renderNew();

    await within(await screen.findByRole('dialog')).findByText('Roda a revisão 42 do rascunho salvo.');
    await typeInto(user, 'Nome', 'Fim do mês');
    await user.click(within(dialog()).getByRole('radio', { name: 'Mensal' }));
    await user.click(within(dialog()).getByRole('combobox', { name: 'Dia do mês' }));
    await user.click(await screen.findByRole('option', { name: 'Último dia' }));
    await typeInto(user, 'Horário', '23:00');
    await chooseRelative(user, 'periodo', 'Mês atual');
    await typeInto(user, 'regiao', 'Norte');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await bodyOf(api.callsTo(CREATE)[0]!)).toEqual({
      revision: 42,
      name: 'Fim do mês',
      enabled: true,
      recurrence: { kind: 'monthly', time: '23:00', day: 'last' },
      parameters: { periodo: { kind: 'relative', value: 'current_month' }, regiao: { kind: 'fixed', value: 'Norte' } },
    });
  });

  it('mensal num dia numerado', async () => {
    const api = prepare();
    api.respond(CREATE, json(schedule(), 201));
    const { user, onSaved } = renderNew();

    await within(await screen.findByRole('dialog')).findByText('Roda a revisão 42 do rascunho salvo.');
    await typeInto(user, 'Nome', 'Fechamento mensal');
    await user.click(within(dialog()).getByRole('radio', { name: 'Mensal' }));
    await user.click(within(dialog()).getByRole('combobox', { name: 'Dia do mês' }));
    await user.click(await screen.findByRole('option', { name: '5' }));
    await typeInto(user, 'Horário', '02:00');
    await chooseRelative(user, 'periodo', 'Mês anterior');
    await user.click(save());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await bodyOf(api.callsTo(CREATE)[0]!)).toMatchObject({ recurrence: { kind: 'monthly', time: '02:00', day: 5 } });
  });

  it('confere os campos antes de enviar: nome, horário e dias da semana', async () => {
    const api = prepare();
    const { user } = renderNew();

    await within(await screen.findByRole('dialog')).findByText('Roda a revisão 42 do rascunho salvo.');
    await user.click(within(dialog()).getByRole('radio', { name: 'Semanal' }));
    await user.click(within(dialog()).getByRole('checkbox', { name: 'Segunda' }));
    await typeInto(user, 'Horário', '25:00');
    await user.click(save());

    expect(within(dialog()).getByLabelText('Nome')).toHaveAccessibleDescription('Dê um nome ao agendamento.');
    expect(within(dialog()).getByLabelText('Horário')).toHaveAccessibleDescription(
      'Use o formato HH:MM, de 00:00 a 23:59. Horário de America/Sao_Paulo',
    );
    expect(within(dialog()).getByText('Escolha pelo menos um dia da semana.')).toBeInTheDocument();
    expect(api.callsTo(CREATE)).toHaveLength(0);
  });

  it('sem fuso conhecido (nenhum agendamento ainda): diz que é o fuso do sistema', async () => {
    prepare();
    renderScreen(<ScheduleDialog workflowId={WORKFLOW_ID} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText('Horário do fuso configurado no sistema')).toBeInTheDocument();
  });

  it('rascunho salvo com problemas: Salvar desabilitado com o motivo e a nota', async () => {
    prepare(savedDraft(42, PARAMETERS, [draftProblem()]));
    renderNew();
    expect(await screen.findByText('O rascunho salvo tem 1 problema')).toBeInTheDocument();
    expect(save()).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog()).getByText('Resolva 1 problema do rascunho para agendar')).toBeInTheDocument();
  });

  it('erro ao ler o rascunho: nota com Tentar de novo', async () => {
    const api = simulateApi(SCHEDULER_PERMISSIONS);
    api.respond(DRAFT, problem(500, 'internal_error'), json(savedDraft(42, PARAMETERS)));
    const { user } = renderNew();
    expect(await screen.findByText('Não foi possível ler o rascunho salvo', { selector: 'p' })).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(dialog()).findByText('Roda a revisão 42 do rascunho salvo.')).toBeInTheDocument();
  });
});

describe('Agendamentos: erros no lugar certo', () => {
  async function fillAndSave(user: UserEvent) {
    await within(await screen.findByRole('dialog')).findByText(/Roda a revisão/);
    await typeInto(user, 'Nome', 'Fechamento mensal');
    await typeInto(user, 'Horário', '02:00');
    await typeInto(user, 'regiao', 'Sul');
    await user.click(save());
  }

  it('schedule_name_taken: no campo Nome, e some ao mudar o nome', async () => {
    const api = prepare();
    api.respond(CREATE, problem(409, 'schedule_name_taken'));
    const { user } = renderNew();
    await fillAndSave(user);

    await waitFor(() =>
      expect(within(dialog()).getByLabelText('Nome')).toHaveAccessibleDescription(
        'Já existe um agendamento com esse nome neste workflow. Escolha outro nome.',
      ),
    );
    expect(within(dialog()).queryByText('Não foi possível salvar o agendamento')).not.toBeInTheDocument();
    await user.type(within(dialog()).getByLabelText('Nome'), ' 2');
    expect(within(dialog()).getByLabelText('Nome')).not.toHaveAccessibleDescription(/Já existe/);
  });

  it('too_many_schedules: nota no diálogo', async () => {
    const api = prepare();
    api.respond(CREATE, problem(409, 'too_many_schedules'));
    const { user } = renderNew();
    await fillAndSave(user);
    expect(await within(dialog()).findByText('Este workflow já tem 20 agendamentos')).toBeInTheDocument();
    expect(within(dialog()).getByText('Remova um agendamento que não serve mais para criar outro.')).toBeInTheDocument();
  });

  it('draft_conflict: nota com a revisão atual, lê o rascunho de novo e o próximo Salvar congela a revisão nova', async () => {
    const api = prepare();
    api.respond(DRAFT, json(savedDraft(42, PARAMETERS)), json(savedDraft(43, PARAMETERS)));
    api.respond(CREATE, problem(409, 'draft_conflict', { current_revision: 43 }), json(schedule(), 201));
    const { user, onSaved } = renderNew();
    await fillAndSave(user);

    expect(await within(dialog()).findByText('O rascunho foi salvo de novo')).toBeInTheDocument();
    expect(within(dialog()).getByText(/está agora na revisão 43/)).toBeInTheDocument();
    expect(await within(dialog()).findByText('Roda a revisão 43 do rascunho salvo.')).toBeInTheDocument();

    await user.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await bodyOf(api.callsTo(CREATE)[1]!)).toMatchObject({ revision: 43 });
  });

  it('draft_has_problems: nota, lê o rascunho de novo e Salvar fica desabilitado', async () => {
    const api = prepare();
    api.respond(DRAFT, json(savedDraft(42, PARAMETERS)), json(savedDraft(43, PARAMETERS, [draftProblem(), draftProblem()])));
    api.respond(CREATE, problem(409, 'draft_has_problems', { problems: [draftProblem(), draftProblem()] }));
    const { user } = renderNew();
    await fillAndSave(user);

    // The note of the error gives way to the one of the draft read again, with the count.
    expect(await within(dialog()).findByText('O rascunho salvo tem 2 problemas')).toBeInTheDocument();
    expect(within(dialog()).queryByText('O rascunho salvo tem problemas')).not.toBeInTheDocument();
    await waitFor(() => expect(save()).toHaveAttribute('aria-disabled', 'true'));
    expect(within(dialog()).getByText('Resolva 2 problemas do rascunho para agendar')).toBeInTheDocument();
  });

  it.each([
    ['missing_parameter', 'regiao', 'é obrigatório e não tem valor'],
    ['invalid_parameter', 'regiao', 'não é um texto válido'],
  ])('%s: no campo do parâmetro', async (code, name, message) => {
    const api = prepare();
    api.respond(CREATE, problem(422, code, { fields: { [name]: message } }));
    const { user } = renderNew();
    await fillAndSave(user);

    await waitFor(() => expect(within(dialog()).getByLabelText(name)).toHaveAccessibleDescription(expect.stringContaining(message)));
    expect(within(dialog()).queryByText('Não foi possível salvar o agendamento')).not.toBeInTheDocument();
  });

  it('invalid_data do horário: no campo Horário', async () => {
    const api = prepare();
    api.respond(CREATE, problem(422, 'invalid_data', { fields: { 'recurrence.time': 'Horário fora da forma HH:MM.' } }));
    const { user } = renderNew();
    await fillAndSave(user);
    await waitFor(() =>
      expect(within(dialog()).getByLabelText('Horário')).toHaveAccessibleDescription(expect.stringContaining('Horário fora da forma HH:MM.')),
    );
  });

  it('o diálogo fica travado durante o envio', async () => {
    const api = prepare();
    let release: (response: Response) => void = () => {};
    api.respond(CREATE, new Promise<Response>((resolve) => (release = resolve)));
    const onClose = vi.fn();
    const { user } = renderScreen(<ScheduleDialog workflowId={WORKFLOW_ID} onClose={onClose} onSaved={vi.fn()} />);
    await fillAndSave(user);

    await waitFor(() => expect(save()).toHaveAttribute('aria-busy', 'true'));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole('button', { name: 'Cancelar' })).toHaveAttribute('aria-disabled', 'true');
    release(json(schedule(), 201));
  });
});

describe('Agendamentos: editar', () => {
  const PERIOD_ONLY = [parameter('periodo', 'period')];

  async function openEdit(user: UserEvent) {
    await user.click(await screen.findByRole('button', { name: 'Mais ações para Fechamento mensal' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Editar agendamento' }));
    return screen.findByRole('dialog', { name: 'Editar agendamento' });
  }

  it('abre com o que está salvo e, sem mudar a revisão, envia a congelada', async () => {
    const api = prepare(savedDraft(42, PERIOD_ONLY));
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), json({ ...item, name: 'Fechamento' }));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    expect(await within(opened).findByText('Roda a revisão 42 do rascunho salvo.')).toBeInTheDocument();
    expect(within(opened).queryByRole('button', { name: 'Usar a revisão atual' })).not.toBeInTheDocument();
    expect(within(opened).getByLabelText('Nome')).toHaveValue('Fechamento mensal');
    expect(within(opened).getByLabelText('Horário')).toHaveValue('02:00');
    expect(within(opened).getByRole('radio', { name: 'Mensal' })).toBeChecked();
    expect(within(opened).getByRole('combobox', { name: 'Dia do mês' })).toHaveTextContent('1');
    expect(within(opened).getByRole('combobox', { name: 'periodo' })).toHaveTextContent('Mês anterior');

    await typeInto(user, 'Nome', 'Fechamento');
    await user.click(save());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(update(item.id))[0]!)).toEqual({
      revision: 42,
      name: 'Fechamento',
      enabled: true,
      recurrence: { kind: 'monthly', time: '02:00', day: 1 },
      parameters: { periodo: { kind: 'relative', value: 'previous_month' } },
    });
  });

  it('revisão desatualizada: mostra as duas revisões; sem Usar a revisão atual, salva a congelada', async () => {
    const api = prepare(savedDraft(57, PERIOD_ONLY));
    const item = schedule({ draft_revision: 42, current_draft_revision: 57 });
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), json(item));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    expect(await within(opened).findByText('Roda a revisão 42 do rascunho salvo.')).toBeInTheDocument();
    expect(within(opened).getByText('O rascunho está na revisão 57.')).toBeInTheDocument();
    expect(within(opened).getByRole('button', { name: 'Usar a revisão atual' })).toBeInTheDocument();

    await user.click(save());
    await waitFor(() => expect(api.callsTo(update(item.id))).toHaveLength(1));
    expect(await bodyOf(api.callsTo(update(item.id))[0]!)).toMatchObject({ revision: 42 });
  });

  it('Usar a revisão atual: o diálogo passa a dizer a revisão 57 e Salvar a congela', async () => {
    const api = prepare(savedDraft(57, PERIOD_ONLY));
    const item = schedule({ draft_revision: 42, current_draft_revision: 57 });
    api.respond(LIST, schedulePage([item]), schedulePage([{ ...item, draft_revision: 57 }]));
    api.respond(update(item.id), json({ ...item, draft_revision: 57 }));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await user.click(await within(opened).findByRole('button', { name: 'Usar a revisão atual' }));
    expect(within(opened).getByText('Roda a revisão 57 do rascunho salvo.')).toBeInTheDocument();
    expect(within(opened).queryByText('O rascunho está na revisão 57.')).not.toBeInTheDocument();
    expect(within(opened).getByText('Ao salvar, o agendamento passa a rodar esta revisão.')).toBeInTheDocument();

    await user.click(save());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(update(item.id))[0]!)).toMatchObject({ revision: 57 });
    expect(await screen.findByText('Revisão 57')).toBeInTheDocument();
  });

  it('Usar a revisão atual fica desabilitado, com o motivo, enquanto o rascunho tem problemas', async () => {
    const api = prepare(savedDraft(57, PERIOD_ONLY, [draftProblem()]));
    const item = schedule({ draft_revision: 42, current_draft_revision: 57 });
    api.respond(LIST, schedulePage([item]));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    const useCurrent = await within(opened).findByRole('button', { name: 'Usar a revisão atual' });
    expect(useCurrent).toHaveAttribute('aria-disabled', 'true');
    expect(within(opened).getByText('Resolva 1 problema do rascunho para usar a revisão atual')).toBeInTheDocument();
    // The frozen revision has no problems: the rest of the schedule can still change.
    expect(save()).not.toHaveAttribute('aria-disabled');
  });

  it('agendamento removido por outra pessoa: nota no diálogo', async () => {
    const api = prepare(savedDraft(42, PERIOD_ONLY));
    const item = schedule();
    api.respond(LIST, schedulePage([item]));
    api.respond(update(item.id), problem(404, 'not_found'));
    const { user } = renderScreen(<ScheduleList workflowId={WORKFLOW_ID} />);

    const opened = await openEdit(user);
    await within(opened).findByText('Roda a revisão 42 do rascunho salvo.');
    await user.click(save());
    expect(
      await within(opened).findByText('Este agendamento não existe mais. Ele pode ter sido removido por outra pessoa.'),
    ).toBeInTheDocument();
  });
});
