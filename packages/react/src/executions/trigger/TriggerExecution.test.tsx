import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VIEWER_PERMISSIONS,
  WORKFLOW_ID,
  draftProblem,
  execution,
  json,
  parameter,
  problem,
  renderScreen,
  savedDraft,
  simulateApi,
  type SimulatedApi,
} from '../api/executions.test-support';
import { clearSessionData } from '../../session';
import { TriggerExecution } from '.';
import type { OverlappingExecution } from './messages';

const DRAFT = `GET /v1/workflows/${WORKFLOW_ID}/draft`;
const TRIGGER = `POST /v1/workflows/${WORKFLOW_ID}/executions`;

const PERIOD = parameter('periodo', 'period', { required: true, default: { kind: 'relative', value: 'previous_month' } });
const GOAL = parameter('meta_minima', 'decimal', { scale: 2 });

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function bodyOf(request: Request): Promise<unknown> {
  return JSON.parse(await request.clone().text());
}

/** An execution of the same scope (a `scope_already_delivered` row), by the day it was created. */
function overlapping(day: number): OverlappingExecution {
  return {
    id: `6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c0${day}`,
    status: 'completed',
    created_at: `2026-11-0${day}T05:00:00Z`,
    finished_at: `2026-11-0${day}T05:09:30Z`,
    triggered_by: { id: 'b1b2c3d4-0000-4000-8000-000000000002', name: 'Maria Souza' },
    schedule: null,
  };
}

function renderTrigger(props: { onTriggered?: () => void; onOpenProblems?: () => void; onOpenExecution?: (id: string) => void } = {}) {
  const onTriggered = props.onTriggered ?? vi.fn();
  const screenResult = renderScreen(
    <TriggerExecution
      workflowId={WORKFLOW_ID}
      onTriggered={onTriggered}
      onOpenProblems={props.onOpenProblems}
      onOpenExecution={props.onOpenExecution}
    />,
  );
  return { ...screenResult, onTriggered };
}

async function openDialog(user: ReturnType<typeof renderScreen>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Executar lote' }));
  return screen.findByRole('dialog', { name: 'Executar lote' });
}

const confirmButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Executar lote' });

describe('Executar lote: botão', () => {
  it('sem executions.trigger, o botão não aparece', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    const { queryClient } = renderTrigger();

    // The session arrived (with its permissions) and the button still is not there.
    await waitFor(() => expect(queryClient.getQueryState(['session'])?.status).toBe('success'));
    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
  });

  it('Cancelar fecha sem disparar e devolve o foco ao botão', async () => {
    api.respond(DRAFT, json(savedDraft(5)));
    const { user, onTriggered } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Executar lote' })).toHaveFocus();
    expect(api.callsTo(TRIGGER)).toHaveLength(0);
    expect(onTriggered).not.toHaveBeenCalled();
  });
});

describe('Executar lote: diálogo', () => {
  it('mostra a revisão salva e os parâmetros com os padrões, envia e abre o painel da execução nova', async () => {
    const created = execution({ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c06' });
    api.respond(DRAFT, json(savedDraft(5, [PERIOD, GOAL])));
    api.respond(TRIGGER, json(created, 202));
    const { user, onTriggered } = renderTrigger();
    const dialog = await openDialog(user);

    expect(
      await within(dialog).findByText('Executa o rascunho salvo (revisão 5). Mudanças feitas depois não entram nesta execução.'),
    ).toBeInTheDocument();
    // The relative default by its label (E6-19); the back resolves it.
    expect(within(within(dialog).getByRole('group', { name: 'periodo' })).getByText('Mês anterior')).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('meta_minima'));
    await user.paste('1.500,5');

    await user.click(confirmButton(dialog));

    await waitFor(() => expect(onTriggered).toHaveBeenCalledWith(created));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await bodyOf(api.callsTo(TRIGGER)[0]!)).toEqual({ revision: 5, parameters: { meta_minima: '1500.5' }, confirm_overlap: false });
  });

  it('enquanto lê o rascunho salvo, o botão fica desabilitado com o motivo', async () => {
    let release: (response: Response) => void = () => {};
    api.respond(DRAFT, new Promise<Response>((resolve) => (release = resolve)));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);

    expect(within(dialog).getByText('Carregando o rascunho salvo')).toBeInTheDocument();
    expect(confirmButton(dialog)).toHaveAttribute('aria-disabled', 'true');
    expect(confirmButton(dialog)).toHaveAccessibleDescription('Aguarde a leitura do rascunho salvo');

    release(json(savedDraft(5)));
    await within(dialog).findByText(/revisão 5/);
    expect(confirmButton(dialog)).not.toHaveAttribute('aria-disabled');
  });

  it('não lendo o rascunho salvo, explica e "Tentar de novo" lê outra vez', async () => {
    api.respond(DRAFT, problem(404, 'not_found'), json(savedDraft(5)));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este workflow não existe mais');
    expect(confirmButton(dialog)).toHaveAccessibleDescription('Não foi possível ler o rascunho salvo');

    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(dialog).findByText(/revisão 5/)).toBeInTheDocument();
  });

  it('com problemas no rascunho salvo: botão desabilitado com o motivo e "Ver problemas"', async () => {
    const onOpenProblems = vi.fn();
    api.respond(DRAFT, json(savedDraft(5, [], [draftProblem()])));
    const { user } = renderTrigger({ onOpenProblems });
    const dialog = await openDialog(user);

    expect(await within(dialog).findByText('O rascunho salvo tem 1 problema')).toBeInTheDocument();
    expect(confirmButton(dialog)).toHaveAttribute('aria-disabled', 'true');
    expect(confirmButton(dialog)).toHaveAccessibleDescription('Resolva 1 problema do rascunho para executar');
    await user.click(confirmButton(dialog));
    expect(api.callsTo(TRIGGER)).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Ver problemas' }));
    expect(onOpenProblems).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem onOpenProblems, o aviso dos problemas não tem "Ver problemas"', async () => {
    api.respond(DRAFT, json(savedDraft(5, [], [draftProblem(), draftProblem('Outro problema')])));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);

    expect(await within(dialog).findByText('O rascunho salvo tem 2 problemas')).toBeInTheDocument();
    expect(confirmButton(dialog)).toHaveAccessibleDescription('Resolva 2 problemas do rascunho para executar');
    expect(within(dialog).queryByRole('button', { name: 'Ver problemas' })).not.toBeInTheDocument();
  });
});

describe('Executar lote: durante o envio', () => {
  /** Opens the dialog and sends, with the trigger answer held until `release`. */
  async function sendHeld() {
    let release: (response: Response) => void = () => {};
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, new Promise<Response>((resolve) => (release = resolve)));
    const rendered = renderTrigger();
    const dialog = await openDialog(rendered.user);
    await within(dialog).findByText(/revisão 5/);
    await rendered.user.click(confirmButton(dialog));
    await waitFor(() => expect(confirmButton(dialog)).toHaveAttribute('aria-busy', 'true'));
    return { ...rendered, dialog, release: (response: Response) => release(response) };
  }

  it('Cancelar fica desabilitado com o motivo e não fecha; ao responder, abre o painel', async () => {
    const created = execution();
    const { user, dialog, release, onTriggered } = await sendHeld();
    const cancel = within(dialog).getByRole('button', { name: 'Cancelar' });
    expect(cancel).toHaveAttribute('aria-disabled', 'true');
    expect(cancel).toHaveAccessibleDescription('Aguarde o envio do lote');

    await user.click(cancel);
    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }));

    expect(screen.getByRole('dialog', { name: 'Executar lote' })).toBeInTheDocument();
    release(json(created, 202));
    await waitFor(() => expect(onTriggered).toHaveBeenCalledWith(created));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo(TRIGGER)).toHaveLength(1);
  });

  it('Esc não fecha; um segundo envio não sai', async () => {
    const created = execution();
    const { user, dialog, release, onTriggered } = await sendHeld();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Executar lote' })).toBeInTheDocument();
    await user.click(confirmButton(dialog));
    expect(api.callsTo(TRIGGER)).toHaveLength(1);

    release(json(created, 202));
    await waitFor(() => expect(onTriggered).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a resposta que chega depois de a sessão acabar não abre o painel', async () => {
    const { queryClient, release, onTriggered } = await sendHeld();

    act(() => clearSessionData(queryClient));
    release(json(execution(), 202));

    await waitFor(() => expect(confirmButton(screen.getByRole('dialog'))).not.toHaveAttribute('aria-busy'));
    expect(onTriggered).not.toHaveBeenCalled();
  });
});

describe('Executar lote: erros do disparo', () => {
  it('draft_conflict: explica, lê o rascunho de novo e o próximo envio usa a revisão atual', async () => {
    const created = execution();
    api.respond(DRAFT, json(savedDraft(5)), json(savedDraft(6)));
    api.respond(TRIGGER, problem(409, 'draft_conflict', { current_revision: 6 }), json(created, 202));
    const { user, onTriggered } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('O rascunho foi salvo de novo');
    expect(alert).toHaveTextContent('ele está agora na revisão 6');
    expect(await within(dialog).findByText(/Executa o rascunho salvo \(revisão 6\)/)).toBeInTheDocument();
    expect(onTriggered).not.toHaveBeenCalled();

    await user.click(confirmButton(dialog));
    await waitFor(() => expect(onTriggered).toHaveBeenCalledWith(created));
    expect(await bodyOf(api.callsTo(TRIGGER)[1]!)).toEqual({ revision: 6, parameters: {}, confirm_overlap: false });
  });

  it('draft_has_problems: lê o rascunho de novo e desabilita o botão com o motivo', async () => {
    const onOpenProblems = vi.fn();
    api.respond(DRAFT, json(savedDraft(5)), json(savedDraft(5, [], [draftProblem()])));
    api.respond(TRIGGER, problem(409, 'draft_has_problems', { problems: [draftProblem()] }));
    const { user } = renderTrigger({ onOpenProblems });
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    expect(await within(dialog).findByText('O rascunho salvo tem 1 problema')).toBeInTheDocument();
    expect(confirmButton(dialog)).toHaveAccessibleDescription('Resolva 1 problema do rascunho para executar');
    expect(within(dialog).getByText('Corrija-os no editor e salve antes de executar o lote.')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Ver problemas' })).toHaveLength(1);
  });

  it('draft_has_problems sem problemas no rascunho lido de novo: a nota explica e oferece "Ver problemas"', async () => {
    const onOpenProblems = vi.fn();
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'draft_has_problems', { problems: [draftProblem(), draftProblem('Outro')] }));
    const { user } = renderTrigger({ onOpenProblems });
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('O rascunho salvo tem 2 problemas. Corrija-os no editor e salve antes de executar o lote.');
    await user.click(within(dialog).getByRole('button', { name: 'Ver problemas' }));
    expect(onOpenProblems).toHaveBeenCalledTimes(1);
  });

  it('no_batch_source: explica que falta a fonte do lote e o que fazer', async () => {
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'no_batch_source'));
    const { user, onTriggered } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Este workflow não tem fonte do lote');
    expect(alert).toHaveTextContent('Escolha a fonte do lote no painel do workflow, salve e execute de novo.');
    expect(onTriggered).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(api.callsTo(DRAFT)).toHaveLength(1);
  });

  it('missing_parameter: o erro cai no campo do parâmetro, sem nota', async () => {
    api.respond(DRAFT, json(savedDraft(5, [GOAL])));
    api.respond(TRIGGER, problem(422, 'missing_parameter', { fields: { meta_minima: 'Informe um valor; o parâmetro é obrigatório e não tem padrão.' } }));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('meta_minima')).toHaveAccessibleDescription(
        expect.stringContaining('Informe um valor; o parâmetro é obrigatório e não tem padrão.'),
      ),
    );
    expect(within(dialog).queryByRole('alert', { name: /Não foi possível executar/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Não foi possível executar o lote')).not.toBeInTheDocument();
  });

  it('scope_already_delivered não sai como erro: vira a nota do escopo, sem fechar o diálogo', async () => {
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'scope_already_delivered', { overlapping: [overlapping(1)] }));
    const { user, onTriggered } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    expect(await within(dialog).findByText('Este escopo já foi entregue')).toBeInTheDocument();
    expect(within(dialog).getByText(/Executar de novo entrega tudo outra vez, com uma revisão nova/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Não foi possível executar o lote')).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(within(dialog).getByText('Entregue')).toBeInTheDocument();
    expect(within(dialog).getByText('por Maria Souza')).toBeInTheDocument();
    expect(onTriggered).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Executar lote' })).toBeInTheDocument();
  });

  it('scope_already_delivered com cinco execuções: lista as cinco e "Agendada" quando ninguém disparou', async () => {
    const five = [1, 2, 3, 4].map((day) => overlapping(day));
    five.push({ ...overlapping(5), triggered_by: null, schedule: { id: 'a1b2c3d4-0000-4000-8000-000000000001', name: 'Fechamento mensal' } });
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'scope_already_delivered', { overlapping: five }));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    expect(await within(dialog).findAllByRole('listitem')).toHaveLength(5);
    expect(within(dialog).getByText('Agendada (Fechamento mensal)')).toBeInTheDocument();
    expect(within(dialog).getAllByText('por Maria Souza')).toHaveLength(4);
  });

  it('Executar lote de novo envia confirm_overlap: true e abre o painel da execução nova', async () => {
    const created = execution({ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c07' });
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'scope_already_delivered', { overlapping: [overlapping(1)] }), json(created, 202));
    const { user, onTriggered } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);
    await user.click(confirmButton(dialog));
    await within(dialog).findByText('Este escopo já foi entregue');

    await user.click(confirmButton(dialog));

    await waitFor(() => expect(onTriggered).toHaveBeenCalledWith(created));
    expect(await bodyOf(api.callsTo(TRIGGER)[0]!)).toEqual({ revision: 5, parameters: {}, confirm_overlap: false });
    expect(await bodyOf(api.callsTo(TRIGGER)[1]!)).toEqual({ revision: 5, parameters: {}, confirm_overlap: true });
  });

  it('mudar um parâmetro tira a nota e o próximo envio pergunta de novo (confirm_overlap: false)', async () => {
    api.respond(DRAFT, json(savedDraft(5, [GOAL])));
    api.respond(TRIGGER, problem(409, 'scope_already_delivered', { overlapping: [overlapping(1)] }), json(execution(), 202));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);
    await user.click(confirmButton(dialog));
    await within(dialog).findByText('Este escopo já foi entregue');

    await user.click(within(dialog).getByLabelText('meta_minima'));
    await user.paste('200');

    expect(within(dialog).queryByText('Este escopo já foi entregue')).not.toBeInTheDocument();
    await user.click(confirmButton(dialog));
    await waitFor(() => expect(api.callsTo(TRIGGER)).toHaveLength(2));
    expect(await bodyOf(api.callsTo(TRIGGER)[1]!)).toEqual({ revision: 5, parameters: { meta_minima: '200' }, confirm_overlap: false });
  });

  it('o link da execução fecha o diálogo e abre o painel dela', async () => {
    const onOpenExecution = vi.fn();
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'scope_already_delivered', { overlapping: [overlapping(1), overlapping(2)] }));
    const { user, onTriggered } = renderTrigger({ onOpenExecution });
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);
    await user.click(confirmButton(dialog));

    const links = await within(dialog).findAllByRole('button', { name: /Abrir a execução de/ });
    expect(links).toHaveLength(2);
    await user.click(links[1]!);

    expect(onOpenExecution).toHaveBeenCalledWith(overlapping(2).id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onTriggered).not.toHaveBeenCalled();
  });

  it('sem onOpenExecution, as execuções aparecem sem link', async () => {
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(409, 'scope_already_delivered', { overlapping: [overlapping(1)] }));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);
    await user.click(confirmButton(dialog));

    expect(await within(dialog).findAllByRole('listitem')).toHaveLength(1);
    expect(within(dialog).queryByRole('button', { name: /Abrir a execução de/ })).not.toBeInTheDocument();
  });

  it('sem permissão no disparo: diz o que fazer', async () => {
    api.respond(DRAFT, json(savedDraft(5)));
    api.respond(TRIGGER, problem(403, 'no_permission'));
    const { user } = renderTrigger();
    const dialog = await openDialog(user);
    await within(dialog).findByText(/revisão 5/);

    await user.click(confirmButton(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Você não tem permissão para executar este workflow');
    // Only draft_conflict and draft_has_problems read the saved draft again.
    expect(api.callsTo(DRAFT)).toHaveLength(1);
  });
});
