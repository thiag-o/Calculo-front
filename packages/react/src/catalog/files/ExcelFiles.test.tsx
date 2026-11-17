import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcelFiles } from '.';
import {
  EXCEL_FILE,
  OTHER_FILE,
  dropFiles,
  fileOf,
  json,
  renderScreen,
  simulateApi,
  simulateUploads,
  type SimulatedApi,
} from './files.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
  api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE, OTHER_FILE] }));
  api.respond(`GET /v1/excel-files/${EXCEL_FILE.id}`, json(EXCEL_FILE));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Arquivos: lista e detalhe', () => {
  it('abre o detalhe pelo nome (foco no título) e volta à lista com o foco no nome', async () => {
    const onFileChange = vi.fn();
    const { user } = renderScreen(<ExcelFiles onFileChange={onFileChange} />);

    await user.click(await screen.findByRole('button', { name: 'metas-2026.xlsx' }));
    expect(onFileChange).toHaveBeenLastCalledWith(EXCEL_FILE.id);
    expect(await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Voltar para Arquivos' }));
    expect(onFileChange).toHaveBeenLastCalledWith(null);
    expect(await screen.findByRole('button', { name: 'metas-2026.xlsx' })).toHaveFocus();
  });

  it('controlado pela rota: abre direto no arquivo, sem roubar o foco', async () => {
    renderScreen(<ExcelFiles fileId={EXCEL_FILE.id} onFileChange={vi.fn()} />);

    const title = await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' });
    expect(title).not.toHaveFocus();
    expect(api.callsTo('GET /v1/excel-files')).toHaveLength(0);
  });

  it('um arquivo enviado abre o detalhe dele', async () => {
    const uploads = simulateUploads();
    renderScreen(<ExcelFiles />);

    await screen.findByText('2 arquivos');
    dropFiles(screen.getByRole('group', { name: 'Área para soltar o arquivo Excel' }), [fileOf('metas-2026.xlsx')]);
    (await uploads.nth(1)).respond(201, EXCEL_FILE);

    expect(await screen.findByRole('heading', { level: 2, name: 'metas-2026.xlsx' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Abas de metas-2026.xlsx' })).toBeInTheDocument();
  });

  it('depois de remover, volta à lista e diz que o arquivo saiu', async () => {
    api.respond(`DELETE /v1/excel-files/${EXCEL_FILE.id}`, new Response(null, { status: 204 }));
    const { user } = renderScreen(<ExcelFiles />);

    await user.click(await screen.findByRole('button', { name: 'metas-2026.xlsx' }));
    await user.click(await screen.findByRole('button', { name: 'Remover arquivo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover arquivo' });
    api.respond('GET /v1/excel-files', json({ items: [OTHER_FILE] }));
    await user.click(within(dialog).getByRole('button', { name: 'Remover arquivo' }));

    expect(await screen.findByText('Arquivo metas-2026.xlsx removido.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'metas-2026.xlsx' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: OTHER_FILE.file_name })).toBeInTheDocument();
  });
});
