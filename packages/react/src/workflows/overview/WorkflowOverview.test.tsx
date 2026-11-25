import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowOverview } from '.';
import { workflowDraftKey, workflowKey } from '../queries';
import {
  BONUS,
  SCORING,
  VIEWER_PERMISSIONS,
  json,
  pendingResponse,
  problem,
  renderScreen,
  simulateApi,
  type SimulatedApi,
} from './overview.test-support';

let api: SimulatedApi;

const DETAIL = `GET /v1/workflows/${SCORING.id}`;
/** The saved draft the "Executar lote" dialog reads (revision 3, no parameters, no problems). */
function savedDraftOf(workflowId: string) {
  return {
    workflow_id: workflowId,
    revision: 3,
    definition: {
      schema_version: 3,
      kind: 'batch',
      settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard', pre_validation_alert_percent: '1' },
      parameters: [],
      root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
    },
    problems: [],
    symbols: [],
    dependencies: [],
    order: [],
    groups: [],
    updated_at: SCORING.draft.updated_at,
    updated_by: SCORING.draft.updated_by,
  };
}

const UPDATE = `PUT /v1/workflows/${SCORING.id}`;
const REMOVE = `DELETE /v1/workflows/${SCORING.id}`;

beforeEach(() => {
  // Only the clock is fake: "now" is 30 min after the last change of the draft, in any time zone.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(Date.parse(SCORING.draft.updated_at) + 30 * 60_000));
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderOverview(props: Partial<Parameters<typeof WorkflowOverview>[0]> = {}) {
  const handlers = { onOpenEditor: vi.fn(), onBack: vi.fn(), onDeleted: vi.fn() };
  const rendered = renderScreen(<WorkflowOverview workflowId={SCORING.id} {...handlers} {...props} />);
  return { ...rendered, ...handlers };
}

const section = (name: string) => screen.getByRole('region', { name });
const moreActions = (name = SCORING.name) => screen.findByRole('button', { name: `Mais ações para ${name}` });

describe('Visão geral do workflow: partes', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pending = pendingResponse(() => json(SCORING));
    api.respond(DETAIL, pending.promise);
    renderOverview();

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o workflow');
    expect(screen.queryByRole('button', { name: 'Abrir editor' })).not.toBeInTheDocument();

    pending.release();
    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra o título, o objetivo e Abrir editor como ação principal', async () => {
    api.respond(DETAIL, json(SCORING));
    const { user, onOpenEditor } = renderOverview();

    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(screen.getByText('Calcula os pontos de cada item da nota na campanha.')).toBeInTheDocument();
    const open = screen.getByRole('button', { name: 'Abrir editor' });
    expect(open).toHaveClass('fc-button-primary');

    await user.click(open);
    expect(onOpenEditor).toHaveBeenCalledWith(SCORING.id);
  });

  it('sem objetivo, não mostra a linha do objetivo', async () => {
    api.respond(`GET /v1/workflows/${BONUS.id}`, json(BONUS));
    renderOverview({ workflowId: BONUS.id });

    const title = await screen.findByRole('heading', { level: 1, name: 'Bônus de metas' });
    expect(title.parentElement?.querySelector('p')).toBeNull();
  });

  it('Versão em produção e Execuções aparecem vazias', async () => {
    api.respond(DETAIL, json(SCORING));
    renderOverview();
    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });

    expect(within(section('Versão em produção')).getByText('Nenhuma versão publicada')).toBeInTheDocument();
    const executions = section('Execuções');
    expect(within(executions).getByText('Nenhuma execução ainda')).toBeInTheDocument();
    expect(within(executions).getByText('Publique uma versão e execute o primeiro lote.')).toBeInTheDocument();
    // Running a batch comes in a later epic: no action that leads nowhere.
    expect(within(executions).queryByRole('button')).not.toBeInTheDocument();
  });

  it('mostra o rascunho em uma linha: revisão, blocos, quem editou e quando, sem selo quando não há problema', async () => {
    api.respond(DETAIL, json(SCORING));
    renderOverview();
    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });

    const draft = section('Rascunho');
    expect(within(draft).getByText('revisão 3')).toBeInTheDocument();
    expect(within(draft).getByText('3 blocos')).toBeInTheDocument();
    expect(within(draft).getByText('editado por Bruno Lima há 30 min')).toBeInTheDocument();
    expect(within(draft).queryByText(/problema/)).not.toBeInTheDocument();
  });

  it('mostra o selo vermelho com a contagem de problemas do rascunho', async () => {
    api.respond(`GET /v1/workflows/${BONUS.id}`, json(BONUS));
    renderOverview({ workflowId: BONUS.id });
    await screen.findByRole('heading', { level: 1, name: 'Bônus de metas' });

    const draft = section('Rascunho');
    expect(within(draft).getByText('revisão 1')).toBeInTheDocument();
    expect(within(draft).getByText('1 bloco')).toBeInTheDocument();
    expect(within(draft).getByText('editado por Ana Souza há 30 min')).toBeInTheDocument();
    expect(within(draft).getByText('2 problemas')).toHaveClass('fc-badge-red');
  });

  it('Voltar para workflows chama onBack', async () => {
    api.respond(DETAIL, json(SCORING));
    const { user, onBack } = renderOverview();

    await user.click(await screen.findByRole('button', { name: 'Voltar para workflows' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('sem onBack, não mostra o caminho de volta', async () => {
    api.respond(DETAIL, json(SCORING));
    renderOverview({ onBack: undefined });

    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });
    expect(screen.queryByRole('button', { name: 'Voltar para workflows' })).not.toBeInTheDocument();
  });

  it('sem workflows.edit, não tem o menu "…" e o botão continua Abrir editor', async () => {
    api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(DETAIL, json(SCORING));
    const { user, onOpenEditor } = renderOverview();

    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });
    // The session loads apart from the workflow: wait until it is there before asserting the menu is absent.
    await waitFor(() => expect(api.callsTo('GET /v1/session')).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Abrir editor' }));
    expect(onOpenEditor).toHaveBeenCalledWith(SCORING.id);
    expect(screen.queryByRole('button', { name: /Mais ações/ })).not.toBeInTheDocument();
  });

  it('com workflows.edit, o menu "…" tem Renomear e Remover workflow', async () => {
    api.respond(DETAIL, json(SCORING));
    const { user } = renderOverview();

    await user.click(await moreActions());
    expect(await screen.findByRole('menuitem', { name: 'Renomear' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remover workflow' })).toBeInTheDocument();
  });
});

describe('Visão geral do workflow: renomear', () => {
  async function openRename() {
    const rendered = renderOverview();
    await rendered.user.click(await moreActions());
    await rendered.user.click(await screen.findByRole('menuitem', { name: 'Renomear' }));
    const dialog = await screen.findByRole('dialog', { name: 'Renomear workflow' });
    return { ...rendered, dialog };
  }

  it('salva o nome e o objetivo, fecha o diálogo e mostra o nome novo', async () => {
    api.respond(DETAIL, json(SCORING));
    const renamed = { ...SCORING, name: 'Pontuação por item de NF', objective: null };
    api.respond(UPDATE, json(renamed));
    const { user, dialog } = await openRename();

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    const objective = within(dialog).getByRole('textbox', { name: /Objetivo/ });
    expect(name).toHaveValue('Pontuação de exemplo');
    expect(objective).toHaveValue('Calcula os pontos de cada item da nota na campanha.');

    await user.clear(name);
    await user.click(name);
    await user.paste('Pontuação por item de NF');
    await user.clear(objective);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação por item de NF' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await api.callsTo(UPDATE)[0]!.json()).toEqual({ name: 'Pontuação por item de NF', objective: null });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para Pontuação por item de NF' })).toHaveFocus());
  });

  it('workflow_exists aparece no campo do nome e some ao mudar o nome', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(UPDATE, problem(409, 'workflow_exists'));
    const { user, dialog } = await openRename();

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.click(name);
    await user.paste('Bônus de metas');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription('Já existe um workflow com esse nome neste tenant. Escolha outro nome.');
    expect(screen.getByRole('dialog', { name: 'Renomear workflow' })).toBeInTheDocument();
    // The modal hides the page from the accessibility tree; the title is still the old one.
    expect(screen.getByRole('heading', { level: 1, name: 'Pontuação de exemplo', hidden: true })).toBeInTheDocument();

    await user.type(name, ' 2');
    expect(name).not.toHaveAttribute('aria-invalid');
  });

  it('não envia sem nome e diz o que falta', async () => {
    api.respond(DETAIL, json(SCORING));
    const { user, dialog } = await openRename();

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await user.clear(name);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(name).toHaveAccessibleDescription('Informe o nome do workflow'));
    expect(api.callsTo(UPDATE)).toHaveLength(0);
  });

  it('not_found diz que o workflow não existe mais e desabilita Salvar com o motivo', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(UPDATE, problem(404, 'not_found'));
    const { user, dialog } = await openRename();

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Este workflow não existe mais. Volte para a lista de workflows.')).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Salvar' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription('O workflow não existe mais');
  });

  it('no_permission mostra o que fazer, numa nota', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(UPDATE, problem(403, 'no_permission'));
    const { user, dialog } = await openRename();

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(
      await within(dialog).findByText('Você não tem permissão para editar workflows neste tenant. Peça acesso a um Admin.'),
    ).toBeInTheDocument();
  });

  it('workflow_busy mostra a mensagem da API numa nota, sem quebrar a tela, e deixa tentar de novo', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(UPDATE, problem(409, 'workflow_busy'), json(SCORING));
    const { user, dialog } = await openRename();

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Texto do servidor para workflow_busy.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Cancelar fecha sem enviar', async () => {
    api.respond(DETAIL, json(SCORING));
    const { user, dialog } = await openRename();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(UPDATE)).toHaveLength(0);
  });
});

describe('Visão geral do workflow: remover', () => {
  async function openRemove(props: Partial<Parameters<typeof WorkflowOverview>[0]> = {}) {
    const rendered = renderOverview(props);
    await rendered.user.click(await moreActions());
    await rendered.user.click(await screen.findByRole('menuitem', { name: 'Remover workflow' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover workflow' });
    return { ...rendered, dialog };
  }

  it('confirma com o nome, remove, tira o detalhe do cache e volta para a lista', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(REMOVE, new Response(null, { status: 204 }));
    const { user, dialog, queryClient, onDeleted } = await openRemove();
    queryClient.setQueryData(workflowDraftKey(SCORING.id), { revision: 3 });

    expect(dialog).toHaveAccessibleDescription(
      'O workflow Pontuação de exemplo e o rascunho dele deixam de existir neste tenant. Não dá para desfazer.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(api.callsTo(REMOVE)).toHaveLength(1);
    expect(queryClient.getQueryData(workflowKey(SCORING.id))).toBeUndefined();
    expect(queryClient.getQueryData(workflowDraftKey(SCORING.id))).toBeUndefined();
    // The removed workflow is not fetched again.
    expect(api.callsTo(DETAIL)).toHaveLength(1);
  });

  it('sem onDeleted, diz que o workflow foi removido', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(REMOVE, new Response(null, { status: 204 }));
    const { user, dialog } = await openRemove({ onDeleted: undefined });

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Workflow removido' })).toBeInTheDocument();
    expect(screen.getByText('O workflow e o rascunho dele foram removidos.')).toBeInTheDocument();
    expect(api.callsTo(DETAIL)).toHaveLength(1);
  });

  it('not_found diz que o workflow não existe mais e desabilita a remoção com o motivo', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(REMOVE, problem(404, 'not_found'));
    const { user, dialog, onDeleted } = await openRemove();

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));

    expect(await within(dialog).findByText('Este workflow não existe mais. Volte para a lista de workflows.')).toBeInTheDocument();
    const remove = within(dialog).getByRole('button', { name: 'Remover workflow' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    expect(remove).toHaveAccessibleDescription('O workflow não existe mais');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('outro erro fica no diálogo e deixa tentar de novo', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(REMOVE, problem(403, 'no_permission'), new Response(null, { status: 204 }));
    const { user, dialog, onDeleted } = await openRemove();

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));
    expect(
      await within(dialog).findByText('Você não tem permissão para editar workflows neste tenant. Peça acesso a um Admin.'),
    ).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('workflow_has_executions mostra a mensagem da API no diálogo, sem desabilitar nem chamar onDeleted', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(REMOVE, problem(409, 'workflow_has_executions'));
    const { user, dialog, onDeleted } = await openRemove();

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));

    expect(await within(dialog).findByText('Texto do servidor para workflow_has_executions.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remover workflow' })).not.toHaveAttribute('aria-disabled');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('workflow_busy mostra a mensagem da API e deixa tentar de novo', async () => {
    api.respond(DETAIL, json(SCORING));
    api.respond(REMOVE, problem(409, 'workflow_busy'), new Response(null, { status: 204 }));
    const { user, dialog, onDeleted } = await openRemove();

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));
    expect(await within(dialog).findByText('Texto do servidor para workflow_busy.')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Remover workflow' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it('Cancelar fecha sem remover e devolve o foco ao "…"', async () => {
    api.respond(DETAIL, json(SCORING));
    const { user, dialog } = await openRemove();

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(REMOVE)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: `Mais ações para ${SCORING.name}` })).toHaveFocus());
  });
});

describe('Visão geral do workflow: erros', () => {
  it('not_found mostra "não encontrado" com o caminho de volta, sem Tentar de novo', async () => {
    api.respond(DETAIL, problem(404, 'not_found'));
    const { user, onBack } = renderOverview();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Workflow não encontrado');
    expect(alert).toHaveTextContent('Este workflow não existe neste tenant ou foi removido. Volte para a lista de workflows.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir editor' })).not.toBeInTheDocument();

    const backButtons = screen.getAllByRole('button', { name: 'Voltar para workflows' });
    expect(backButtons).toHaveLength(2);
    await user.click(backButtons[1]!);
    expect(onBack).toHaveBeenCalled();
  });

  it('id mal formado (422 invalid_data) também mostra "não encontrado"', async () => {
    api.respond('GET /v1/workflows/nao-e-um-id', problem(422, 'invalid_data', { fields: { id: 'Id inválido' } }));
    renderOverview({ workflowId: 'nao-e-um-id' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Workflow não encontrado');
    expect(alert).toHaveTextContent('Este workflow não existe neste tenant ou foi removido.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('no_permission diz o que fazer, sem Tentar de novo', async () => {
    api.respond(DETAIL, problem(403, 'no_permission'));
    renderOverview();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir o workflow');
    expect(alert).toHaveTextContent('Você não tem permissão para ver os workflows deste tenant. Peça acesso a um Admin.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('outro erro mostra a nota com Tentar de novo, que busca de novo', async () => {
    api.respond(DETAIL, new Response('falhou', { status: 500 }), json(SCORING));
    const { user } = renderOverview();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir o workflow');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' })).toBeInTheDocument();
    expect(api.callsTo(DETAIL)).toHaveLength(2);
  });
});

describe('Visão geral do workflow: execuções', () => {
  const OPERATOR = ['workflows.view', 'executions.view', 'executions.trigger'];

  it('com o caminho para as execuções e executions.trigger, mostra Executar lote ao lado de Abrir editor', async () => {
    api = simulateApi(OPERATOR);
    api.respond(DETAIL, json(SCORING));
    renderOverview({ onOpenExecution: vi.fn(), onOpenExecutions: vi.fn() });

    expect(await screen.findByRole('button', { name: 'Executar lote' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir editor' })).toHaveClass('fc-button-primary');
  });

  it('sem executions.trigger (o Aprovador e o Auditor), não mostra Executar lote, mas a seção leva à lista', async () => {
    api = simulateApi(['workflows.view', 'executions.view']);
    api.respond(DETAIL, json(SCORING));
    const onOpenExecutions = vi.fn();
    const { user } = renderOverview({ onOpenExecution: vi.fn(), onOpenExecutions });
    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });

    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
    await user.click(within(section('Execuções')).getByRole('button', { name: 'Ver execuções' }));
    expect(onOpenExecutions).toHaveBeenCalledTimes(1);
  });

  it('sem executions.view, a seção não leva à lista', async () => {
    api = simulateApi(['workflows.view']);
    api.respond(DETAIL, json(SCORING));
    renderOverview({ onOpenExecution: vi.fn(), onOpenExecutions: vi.fn() });
    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });

    expect(within(section('Execuções')).queryByRole('button', { name: 'Ver execuções' })).not.toBeInTheDocument();
  });

  it('workflow_busy ao executar o lote mostra a mensagem da API no diálogo, sem fechá-lo', async () => {
    api = simulateApi(OPERATOR);
    api.respond(DETAIL, json(SCORING));
    api.respond(`GET /v1/workflows/${SCORING.id}/draft`, json(savedDraftOf(SCORING.id)));
    api.respond(`POST /v1/workflows/${SCORING.id}/executions`, problem(409, 'workflow_busy'));
    const { user } = renderOverview({ onOpenExecution: vi.fn(), onOpenExecutions: vi.fn() });

    await user.click(await screen.findByRole('button', { name: 'Executar lote' }));
    const dialog = await screen.findByRole('dialog', { name: 'Executar lote' });
    await within(dialog).findByText(/revisão 3/);
    await user.click(within(dialog).getByRole('button', { name: 'Executar lote' }));

    expect(await within(dialog).findByText('Texto do servidor para workflow_busy.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Executar lote' })).toBeInTheDocument();
  });

  it('sem o caminho para as execuções (a tela avulsa), não há Executar lote nem Ver execuções', async () => {
    api = simulateApi(OPERATOR);
    api.respond(DETAIL, json(SCORING));
    renderOverview();
    await screen.findByRole('heading', { level: 1, name: 'Pontuação de exemplo' });

    expect(screen.queryByRole('button', { name: 'Executar lote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver execuções' })).not.toBeInTheDocument();
  });
});
