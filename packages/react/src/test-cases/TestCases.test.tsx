import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  COMPARED_FILE,
  DRAFT_ROUTE,
  LIST_ROUTE,
  fileList,
  fileOf,
  json,
  problemBody,
  renderTestCases,
  savedDraft,
  simulateApi,
  simulateUploads,
} from './reference-files/reference-files.test-support';

const OTHER_WORKFLOW_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const OTHER_LIST_ROUTE = `GET /v1/workflows/${OTHER_WORKFLOW_ID}/reference-files`;

function fileInput(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>('Arquivo de referência (.csv)');
}

describe('Testes › troca de workflow com a tela aberta', () => {
  it('com um envio que falhou: o workflow novo começa do zero, sem o arquivo nem o Tentar de novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    api.respond(OTHER_LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user, showWorkflow } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv'));
    (await uploads.nth(1)).respond(500, problemBody(500, 'internal_error'));
    await screen.findByRole('button', { name: 'Tentar de novo' });

    showWorkflow(OTHER_WORKFLOW_ID);

    await waitFor(() => expect(api.callsTo(OTHER_LIST_ROUTE)).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/esperado\.csv/)).not.toBeInTheDocument();
    expect(uploads.sent).toHaveLength(1);
  });

  it('com um envio em andamento: o envio é cancelado e o workflow novo não mostra o progresso', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    api.respond(OTHER_LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user, showWorkflow } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv', 2048));
    const sent = await uploads.nth(1);
    let aborted = false;
    sent.addEventListener('abort', () => {
      aborted = true;
    });
    sent.progress(1024, 2048);

    showWorkflow(OTHER_WORKFLOW_ID);

    expect(aborted).toBe(true);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await waitFor(() => expect(api.callsTo(OTHER_LIST_ROUTE)).toHaveLength(1));
    expect(screen.queryByText(/Não foi possível enviar/)).not.toBeInTheDocument();
  });

  it('com o diálogo Simular aberto: o diálogo fecha e nada é simulado no workflow novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(DRAFT_ROUTE, json(savedDraft(5)));
    api.respond(OTHER_LIST_ROUTE, fileList([]));
    const { user, showWorkflow } = renderTestCases();

    await user.click(await screen.findByRole('button', { name: 'Simular com esperado-outubro.csv' }));
    await screen.findByRole('dialog', { name: 'Simular' });

    showWorkflow(OTHER_WORKFLOW_ID);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Nenhum arquivo de referência')).toBeInTheDocument();
  });

  it('com o diálogo Remover arquivo aberto: o diálogo fecha e o arquivo do workflow anterior não é removido', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([COMPARED_FILE]));
    api.respond(OTHER_LIST_ROUTE, fileList([]));
    const { user, showWorkflow } = renderTestCases();

    await user.click(await screen.findByRole('button', { name: 'Mais ações para o arquivo esperado-outubro.csv' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    expect(within(dialog).getByRole('button', { name: 'Remover arquivo' })).toBeInTheDocument();

    showWorkflow(OTHER_WORKFLOW_ID);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Nenhum arquivo de referência')).toBeInTheDocument();
    expect(api.callsTo(`DELETE /v1/workflows/${OTHER_WORKFLOW_ID}/reference-files/${COMPARED_FILE.id}`)).toHaveLength(0);
  });
});
