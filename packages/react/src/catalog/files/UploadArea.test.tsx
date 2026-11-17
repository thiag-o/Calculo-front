import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExcelFileList } from '.';
import { MAX_FILE_BYTES } from './format';
import {
  API,
  EXCEL_FILE,
  dropFiles,
  fileOf,
  json,
  problemBody,
  renderScreen,
  simulateApi,
  simulateUploads,
  type SimulatedApi,
} from './files.test-support';

let api: SimulatedApi;
let uploads: ReturnType<typeof simulateUploads>;

beforeEach(() => {
  api = simulateApi();
  api.respond('GET /v1/excel-files', json({ items: [] }));
  uploads = simulateUploads();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

const dropArea = () => screen.getByRole('group', { name: 'Área para soltar o arquivo Excel' });
const fileInput = () => screen.getByLabelText<HTMLInputElement>('Arquivo Excel (.xlsx)');

async function renderList() {
  const onOpen = vi.fn();
  const rendered = renderScreen(<ExcelFileList onOpen={onOpen} />);
  await screen.findByText('Nenhum arquivo ainda');
  return { ...rendered, onOpen };
}

describe('Arquivos: envio', () => {
  it('pelo botão: envia o arquivo no campo file, mostra o progresso e abre o arquivo enviado', async () => {
    document.cookie = 'fc_csrf=csrf-7; path=/';
    const { user, onOpen } = await renderList();
    const file = fileOf('metas-2026.xlsx', 2048);

    expect(fileInput()).toHaveAttribute('accept', expect.stringContaining('.xlsx'));
    await user.upload(fileInput(), file);

    const upload = await uploads.nth(1);
    expect(upload.method).toBe('POST');
    expect(upload.url).toBe(`${API}/v1/excel-files`);
    expect(upload.file).toBe(file);
    expect(upload.headers['X-CSRF-Token']).toBe('csrf-7');

    expect(screen.getByText('Enviando metas-2026.xlsx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar arquivo' })).toHaveAttribute('aria-busy', 'true');

    upload.progress(1024, 2048);
    const bar = screen.getByRole('progressbar', { name: 'Envio de metas-2026.xlsx' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50% de 2 KB')).toBeInTheDocument();

    upload.progress(2048, 2048);
    expect(screen.getByText('Lendo as abas de metas-2026.xlsx')).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuetext', 'Enviado; lendo as abas');

    upload.respond(201, EXCEL_FILE);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(EXCEL_FILE.id));
    // The list (and the rest of the catalog) is fetched again.
    await waitFor(() => expect(api.callsTo('GET /v1/excel-files')).toHaveLength(2));
  });

  it('arrastando e soltando: envia o arquivo e abre o arquivo enviado', async () => {
    const { onOpen } = await renderList();
    const file = fileOf('metas-2026.xlsx');

    fireEvent.dragEnter(dropArea(), { dataTransfer: { files: [file], types: ['Files'] } });
    expect(screen.getByText('Solte para enviar')).toBeInTheDocument();
    dropFiles(dropArea(), [file]);

    const upload = await uploads.nth(1);
    expect(upload.file).toBe(file);
    upload.respond(201, EXCEL_FILE);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(EXCEL_FILE.id));
  });

  it('enquanto envia, ignora outro arquivo solto na área', async () => {
    const { onOpen } = await renderList();
    dropFiles(dropArea(), [fileOf('metas-2026.xlsx')]);
    const upload = await uploads.nth(1);
    dropFiles(dropArea(), [fileOf('outro.xlsx')]);

    expect(screen.getByText('Enviando metas-2026.xlsx')).toBeInTheDocument();
    upload.respond(201, EXCEL_FILE);
    await waitFor(() => expect(onOpen).toHaveBeenCalledTimes(1));
    expect(uploads.sent).toHaveLength(1);
  });

  it('limite no cliente: arquivo acima de 20 MB nem é enviado', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('vendas-do-ano.xlsx', MAX_FILE_BYTES + 1024 * 1024)]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível enviar vendas-do-ano.xlsx');
    expect(alert).toHaveTextContent('O arquivo tem 21 MB e o limite é de 20 MB.');
    expect(alert).toHaveTextContent('Divida a planilha');
    expect(uploads.sent).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('arquivo de exatamente 20 MB ainda é enviado', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('no-limite.xlsx', MAX_FILE_BYTES)]);

    expect((await uploads.nth(1)).file?.name).toBe('no-limite.xlsx');
  });

  it('só .xlsx: outro tipo nem é enviado', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('metas.xls', 2048, 'application/vnd.ms-excel')]);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Só dá para enviar planilhas .xlsx.');
    expect(uploads.sent).toHaveLength(0);
  });

  it('um arquivo por vez', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('a.xlsx'), fileOf('b.xlsx')]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Envie um arquivo por vez.');
    expect(uploads.sent).toHaveLength(0);
  });

  it('file_too_large: mostra o limite que a API aplica, sem "Tentar de novo"', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('grande.xlsx')]);
    (await uploads.nth(1)).respond(413, problemBody(413, 'file_too_large', { detail: 'O arquivo passa do limite de 10 MB.' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível enviar grande.xlsx');
    expect(alert).toHaveTextContent('O arquivo passa do limite de 10 MB. Divida a planilha');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    // The area is ready for another file.
    expect(screen.getByRole('button', { name: 'Enviar arquivo' })).not.toHaveAttribute('aria-busy');
  });

  it('invalid_file: diz para salvar como .xlsx e enviar de novo', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('corrompido.xlsx')]);
    (await uploads.nth(1)).respond(422, problemBody(422, 'invalid_file'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo não é uma planilha .xlsx que possa ser lida. Abra no Excel, salve como .xlsx e envie de novo.',
    );
  });

  it('invalid_header: aponta cada célula do cabeçalho com problema', async () => {
    await renderList();
    dropFiles(dropArea(), [fileOf('metas-2026.xlsx')]);
    (await uploads.nth(1)).respond(
      422,
      problemBody(422, 'invalid_header', { fields: { 'Vendas!C1': 'Coluna sem nome.', 'Vendas!E1': "Nome repetido: 'valor'." } }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('A primeira linha de cada aba precisa ter um nome único em cada coluna.');
    const cells = screen.getByRole('list', { name: 'Células do cabeçalho com problema' });
    const items = within(cells).getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['Vendas!C1 Coluna sem nome.', "Vendas!E1 Nome repetido: 'valor'."]);
  });

  it('sem resposta do servidor: "Tentar de novo" envia o mesmo arquivo', async () => {
    const { user, onOpen } = await renderList();
    const file = fileOf('metas-2026.xlsx');
    dropFiles(dropArea(), [file]);
    (await uploads.nth(1)).fail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    const retry = await uploads.nth(2);
    expect(retry.file).toBe(file);
    retry.respond(201, EXCEL_FILE);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(EXCEL_FILE.id));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('um envio novo apaga o erro do anterior', async () => {
    const { user } = await renderList();
    dropFiles(dropArea(), [fileOf('metas.csv', 100, 'text/csv')]);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.upload(fileInput(), fileOf('metas-2026.xlsx'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await uploads.nth(1);
  });
});
