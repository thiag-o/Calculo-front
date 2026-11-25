import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  COMPARED_FILE,
  DRAFT_ROUTE,
  LIST_ROUTE,
  MISMATCH_DETAIL,
  draftProblem,
  fileList,
  json,
  parameter,
  pendingResponse,
  problem,
  problemBody,
  renderTestCases,
  savedDraft,
  simulateApi,
  simulation,
  simulationRoute,
} from './reference-files.test-support';

const SIMULATION_ROUTE = simulationRoute(COMPARED_FILE.id);
const GOAL = parameter('meta_minima', 'decimal', { required: true, scale: 2, description: 'A meta mínima de pontos' });

async function openSimulate(user: ReturnType<typeof renderTestCases>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Simular com esperado-outubro.csv' }));
  return screen.findByRole('dialog', { name: 'Simular' });
}

describe('Testes › Arquivo de referência: Simular', () => {
  it('com sucesso: envia a revisão salva e os parâmetros, fecha e abre o painel da simulação', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5, [GOAL])));
    const created = simulation();
    api.respond(SIMULATION_ROUTE, json(created, 202));
    const { user, onOpenExecution, queryClient } = renderTestCases();

    const dialog = await openSimulate(user);
    expect(
      await within(dialog).findByText('Simula o rascunho salvo (revisão 5) e compara com o arquivo. Nada é entregue.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('esperado-outubro.csv')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: /meta_minima/ }), '100,00');
    await user.click(within(dialog).getByRole('button', { name: 'Simular' }));

    await waitFor(() => expect(onOpenExecution).toHaveBeenCalledWith(created.id));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const [request] = api.callsTo(SIMULATION_ROUTE);
    expect(await request!.json()).toEqual({ revision: 5, parameters: { meta_minima: '100.00' } });
    // The panel opens with the new simulation already in the cache of executions.
    expect(queryClient.getQueryData(['executions', created.id])).toEqual(created);
  });

  it('enquanto envia, o diálogo fica travado e o Simular não sai duas vezes', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5)));
    const answer = pendingResponse(() => json(simulation(), 202));
    api.respond(SIMULATION_ROUTE, answer.promise);
    const { user, onOpenExecution } = renderTestCases();

    const dialog = await openSimulate(user);
    const send = await within(dialog).findByRole('button', { name: 'Simular' });
    await user.click(send);
    await waitFor(() => expect(send).toHaveAttribute('aria-busy', 'true'));
    await user.click(send);
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Simular' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveAttribute('aria-disabled', 'true');

    answer.release();
    await waitFor(() => expect(onOpenExecution).toHaveBeenCalledTimes(1));
    expect(api.callsTo(SIMULATION_ROUTE)).toHaveLength(1);
  });

  it('409 reference_file_mismatch: a mensagem da API no diálogo, que continua aberto', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5)));
    api.respond(SIMULATION_ROUTE, new Response(JSON.stringify({ ...problemBody(409, 'reference_file_mismatch'), detail: MISMATCH_DETAIL }), {
      status: 409,
      headers: { 'Content-Type': 'application/problem+json' },
    }));
    const { user, onOpenExecution } = renderTestCases();

    const dialog = await openSimulate(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Simular' }));

    expect(await within(dialog).findByText('O arquivo não bate mais com o workflow')).toBeInTheDocument();
    expect(within(dialog).getByText(MISMATCH_DETAIL)).toBeInTheDocument();
    expect(onOpenExecution).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Simular' })).toBeInTheDocument();
  });

  it('422 de parâmetro: o erro vai para o campo, sem nota', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5, [GOAL])));
    api.respond(
      SIMULATION_ROUTE,
      problem(422, 'invalid_parameter', { fields: { meta_minima: 'Use no máximo 2 casas decimais.' } }),
    );
    const { user, onOpenExecution } = renderTestCases();

    const dialog = await openSimulate(user);
    const field = await within(dialog).findByRole('textbox', { name: /meta_minima/ });
    await user.type(field, '100');
    await user.click(within(dialog).getByRole('button', { name: 'Simular' }));

    await waitFor(() => expect(field).toHaveAccessibleDescription(expect.stringContaining('Use no máximo 2 casas decimais.')));
    expect(within(dialog).queryByText('Não foi possível simular')).not.toBeInTheDocument();
    expect(onOpenExecution).not.toHaveBeenCalled();
  });

  it('409 draft_conflict: explica, lê o rascunho de novo e o próximo envio usa a revisão atual', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5)), json(savedDraft(6)));
    const created = simulation();
    api.respond(SIMULATION_ROUTE, problem(409, 'draft_conflict', { current_revision: 6 }), json(created, 202));
    const { user, onOpenExecution } = renderTestCases();

    const dialog = await openSimulate(user);
    await user.click(await within(dialog).findByRole('button', { name: 'Simular' }));

    expect(await within(dialog).findByText('O rascunho foi salvo de novo')).toBeInTheDocument();
    expect(
      await within(dialog).findByText('Simula o rascunho salvo (revisão 6) e compara com o arquivo. Nada é entregue.'),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Simular' }));
    await waitFor(() => expect(onOpenExecution).toHaveBeenCalledWith(created.id));
    const [, second] = api.callsTo(SIMULATION_ROUTE);
    expect(await second!.json()).toEqual({ revision: 6, parameters: {} });
  });

  it('rascunho salvo com problemas: o Simular fica desabilitado com o motivo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5, [], [draftProblem(), draftProblem('Outro problema.')])));
    const { user } = renderTestCases();

    const dialog = await openSimulate(user);

    expect(await within(dialog).findByText('O rascunho salvo tem 2 problemas')).toBeInTheDocument();
    const send = within(dialog).getByRole('button', { name: 'Simular' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByText('Resolva 2 problemas do rascunho para simular')).toBeInTheDocument();
    await user.click(send);
    expect(api.callsTo(SIMULATION_ROUTE)).toHaveLength(0);
  });

  it('sem ler o rascunho salvo: explica e Tentar de novo lê de novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, problem(500, 'internal_error'), json(savedDraft(5)));
    const { user } = renderTestCases();

    const dialog = await openSimulate(user);

    expect(await within(dialog).findByText('Não foi possível ler o rascunho salvo', { selector: '*:not(span)' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tentar de novo' }));
    expect(
      await within(dialog).findByText('Simula o rascunho salvo (revisão 5) e compara com o arquivo. Nada é entregue.'),
    ).toBeInTheDocument();
  });

  it('Cancelar fecha sem simular e devolve o foco ao Simular da linha', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5)));
    const { user } = renderTestCases();

    const dialog = await openSimulate(user);
    await within(dialog).findByText('Simula o rascunho salvo (revisão 5) e compara com o arquivo. Nada é entregue.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(SIMULATION_ROUTE)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Simular com esperado-outubro.csv' })).toHaveFocus();
  });
});
