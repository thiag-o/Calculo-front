import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  APPROVER_PERMISSIONS,
  COMPARED_FILE,
  CONFIGURATOR_PERMISSIONS,
  EDITOR_PERMISSIONS,
  LIST_ROUTE,
  NEW_FILE,
  VIEWER_PERMISSIONS,
  deleteRoute,
  fileList,
  pendingResponse,
  problem,
  renderTestCases,
  simulateApi,
} from './reference-files.test-support';

function table() {
  return screen.getByRole('table', { name: 'Arquivos de referência do workflow' });
}

function rowOf(name: string): HTMLElement {
  const row = within(table())
    .getAllByRole('row')
    .find((candidate) => within(candidate).queryByText(name) !== null);
  if (!row) throw new Error(`a linha de ${name} não está na tabela`);
  return row;
}

describe('Testes › Arquivo de referência: lista', () => {
  it('carregando: mostra o esqueleto da lista e depois os arquivos', async () => {
    const api = simulateApi();
    const answer = pendingResponse(() => fileList([COMPARED_FILE]));
    api.respond(LIST_ROUTE, answer.promise);
    renderTestCases();

    expect(await screen.findByRole('heading', { level: 1, name: 'Testes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Arquivo de referência' })).toBeInTheDocument();
    expect(table()).toHaveAttribute('aria-busy', 'true');

    answer.release();
    expect(await screen.findByText('esperado-outubro.csv')).toBeInTheDocument();
    expect(table()).not.toHaveAttribute('aria-busy', 'true');
  });

  it('com e sem comparação: registros, quem enviou e quando, SHA-256 encurtado e a última comparação', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([NEW_FILE, COMPARED_FILE]));
    const { onOpenExecution, user } = renderTestCases();

    await screen.findByText('esperado-outubro.csv');
    expect(screen.getByText('2 arquivos')).toBeInTheDocument();

    const compared = rowOf('esperado-outubro.csv');
    expect(within(compared).getByText('152 B · Chave: nf_id, item_seq · Campos: pontos, elegivel, status')).toBeInTheDocument();
    expect(within(compared).getByText('2')).toBeInTheDocument();
    expect(within(compared).getByText('Ana Souza')).toBeInTheDocument();
    expect(within(compared).getByText(/^24\/11\/2026 às \d{2}:50$/)).toBeInTheDocument();
    expect(within(compared).getByText('6f1e3a5c7b9d…')).toBeInTheDocument();
    const link = within(compared).getByRole('button', { name: '100% iguais, abrir a simulação de esperado-outubro.csv' });
    expect(link).toHaveTextContent('100% iguais');

    const fresh = rowOf('esperado-novembro.csv');
    expect(within(fresh).getByText('Nenhuma simulação ainda')).toBeInTheDocument();
    expect(within(fresh).queryByRole('button', { name: /abrir a simulação/ })).not.toBeInTheDocument();

    await user.click(link);
    expect(onOpenExecution).toHaveBeenCalledWith(COMPARED_FILE.last_comparison!.execution_id);
  });

  it('a comparação diz o percentual da API no padrão brasileiro, a simulação em andamento e a sem comparação', async () => {
    const api = simulateApi();
    const base = COMPARED_FILE.last_comparison!;
    api.respond(
      LIST_ROUTE,
      fileList([
        { ...COMPARED_FILE, id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a11', name: 'divergente.csv', last_comparison: { ...base, status: 'completed_with_errors', equal_percent: '98.27' } },
        { ...COMPARED_FILE, id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a12', name: 'rodando.csv', last_comparison: { ...base, status: 'comparing', equal_percent: null, finished_at: null } },
        { ...COMPARED_FILE, id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a13', name: 'abortada.csv', last_comparison: { ...base, status: 'aborted', equal_percent: null } },
      ]),
    );
    renderTestCases();

    await screen.findByText('divergente.csv');
    expect(within(rowOf('divergente.csv')).getByRole('button', { name: /^98,27% iguais/ })).toBeInTheDocument();
    expect(within(rowOf('rodando.csv')).getByRole('button', { name: /^Simulação em andamento/ })).toBeInTheDocument();
    expect(within(rowOf('abortada.csv')).getByRole('button', { name: /^Simulação sem comparação/ })).toBeInTheDocument();
  });

  it('vazio: diz o que falta e oferece Enviar arquivo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    renderTestCases();

    expect(await screen.findByText('Nenhum arquivo de referência')).toBeInTheDocument();
    expect(screen.getByText('Envie um CSV com os resultados que você já conhece.')).toBeInTheDocument();
    expect(within(table()).getByRole('button', { name: 'Enviar arquivo' })).toBeInTheDocument();
  });

  it('vazio, sem test_cases.edit: só a frase, sem ação', async () => {
    const api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(LIST_ROUTE, fileList([]));
    renderTestCases();

    expect(await screen.findByText('Nenhum arquivo de referência')).toBeInTheDocument();
    expect(screen.getByText('Quem edita os testes deste workflow ainda não enviou nenhum arquivo.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
  });

  it('erro: diz o que houve e Tentar de novo lê de novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, problem(500, 'internal_error'), fileList([COMPARED_FILE]));
    const { user } = renderTestCases();

    expect(await screen.findByText('Não foi possível carregar os arquivos de referência')).toBeInTheDocument();
    expect(screen.getByText('Texto do servidor para internal_error.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('esperado-outubro.csv')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar os arquivos de referência')).not.toBeInTheDocument();
  });

  it('erro sem permissão: explica, sem Tentar de novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, problem(403, 'no_permission'));
    renderTestCases();

    expect(await screen.findByText('Você não tem permissão para ver os testes deste workflow. Peça acesso a um Admin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('copia o SHA-256 inteiro e avisa', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    const { user } = renderTestCases();
    const write = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(await screen.findByRole('button', { name: 'Copiar SHA-256 de esperado-outubro.csv' }));

    expect(write).toHaveBeenCalledWith(COMPARED_FILE.sha256);
    expect(await screen.findByText('SHA-256 de esperado-outubro.csv copiado.')).toHaveAttribute('role', 'status');
    expect(within(rowOf('esperado-outubro.csv')).getByText('Copiado')).toBeInTheDocument();
  });

  it('sem poder copiar, mostra o SHA-256 inteiro para copiar à mão', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    const { user } = renderTestCases();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));

    await user.click(await screen.findByRole('button', { name: 'Copiar SHA-256 de esperado-outubro.csv' }));

    expect(await screen.findByText('Não foi possível copiar o SHA-256')).toBeInTheDocument();
    expect(screen.getByText(COMPARED_FILE.sha256)).toBeInTheDocument();
  });
});

describe('Testes › Arquivo de referência: remover', () => {
  it('pelo menu "…", com confirmação: remove, avisa e a lista sai sem ele', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([NEW_FILE, COMPARED_FILE]), fileList([NEW_FILE]));
    api.respond(deleteRoute(COMPARED_FILE.id), new Response(null, { status: 204 }));
    const { user } = renderTestCases();

    await user.click(await screen.findByRole('button', { name: 'Mais ações para o arquivo esperado-outubro.csv' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remover arquivo' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    expect(dialog).toHaveAccessibleDescription(
      'esperado-outubro.csv sai dos testes deste workflow e a cópia guardada é apagada. As simulações feitas com ele continuam. Não é possível desfazer.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remover arquivo' }));

    expect(await screen.findByText('Arquivo esperado-outubro.csv removido.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('esperado-outubro.csv')).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo(deleteRoute(COMPARED_FILE.id))).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Arquivo de referência' })).toHaveFocus();
  });

  it('Cancelar não remove e devolve o foco ao menu da linha', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    const { user } = renderTestCases();

    const menu = await screen.findByRole('button', { name: 'Mais ações para o arquivo esperado-outubro.csv' });
    await user.click(menu);
    await user.click(await screen.findByRole('menuitem', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(deleteRoute(COMPARED_FILE.id))).toHaveLength(0);
    expect(menu).toHaveFocus();
  });

  it('arquivo já removido por outra pessoa: explica e desabilita o botão com o motivo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(deleteRoute(COMPARED_FILE.id), problem(404, 'not_found'));
    const { user } = renderTestCases();

    await user.click(await screen.findByRole('button', { name: 'Mais ações para o arquivo esperado-outubro.csv' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover arquivo' }));

    expect(
      await within(dialog).findByText('Este arquivo de referência não existe mais. Ele pode ter sido removido por outra pessoa.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remover arquivo' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Testes › Arquivo de referência: permissões', () => {
  it('com test_cases.edit e simulations.run: envio, Simular e o menu "…"', async () => {
    const api = simulateApi(CONFIGURATOR_PERMISSIONS);
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    renderTestCases();

    await screen.findByText('esperado-outubro.csv');
    expect(screen.getByRole('group', { name: 'Área para soltar o arquivo de referência' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simular com esperado-outubro.csv' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações para o arquivo esperado-outubro.csv' })).toBeInTheDocument();
  });

  it('sem test_cases.edit: sem envio e sem Remover arquivo, mas com Simular', async () => {
    const api = simulateApi(APPROVER_PERMISSIONS);
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    renderTestCases();

    await screen.findByText('esperado-outubro.csv');
    expect(screen.getByRole('button', { name: 'Simular com esperado-outubro.csv' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Área para soltar o arquivo de referência' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mais ações/ })).not.toBeInTheDocument();
  });

  it('sem simulations.run: sem Simular, mas com envio e Remover arquivo', async () => {
    const api = simulateApi(EDITOR_PERMISSIONS);
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    renderTestCases();

    await screen.findByText('esperado-outubro.csv');
    expect(screen.queryByRole('button', { name: /^Simular/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Área para soltar o arquivo de referência' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações para o arquivo esperado-outubro.csv' })).toBeInTheDocument();
  });

  it('sem as duas: só a lista, sem a coluna de ações', async () => {
    const api = simulateApi(VIEWER_PERMISSIONS);
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    renderTestCases();

    await screen.findByText('esperado-outubro.csv');
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Simular/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mais ações/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Área para soltar o arquivo de referência' })).not.toBeInTheDocument();
    // The link to the last simulation stays: seeing it is up to the execution panel.
    expect(screen.getByRole('button', { name: /^100% iguais/ })).toBeInTheDocument();
  });
});
