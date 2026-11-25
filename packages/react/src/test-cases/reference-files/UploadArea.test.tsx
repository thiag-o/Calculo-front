import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LIST_ROUTE,
  NEW_FILE,
  THREE_LINE_ERRORS,
  UPLOAD_URL,
  dropFiles,
  fileList,
  fileOf,
  problemBody,
  renderTestCases,
  simulateApi,
  simulateUploads,
} from './reference-files.test-support';

function dropArea() {
  return screen.getByRole('group', { name: 'Área para soltar o arquivo de referência' });
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>('Arquivo de referência (.csv)');
}

describe('Testes › Arquivo de referência: envio', () => {
  it('mostra a nota do formato e o limite', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    renderTestCases();

    await screen.findByText('Nenhum arquivo de referência');
    expect(
      within(dropArea()).getByText('As colunas da chave do registro e os campos da saída. Um CSV entregue serve. Até 20 MB.'),
    ).toBeInTheDocument();
    expect(fileInput()).toHaveAttribute('accept', '.csv,text/csv');
  });

  it('envia com progresso, confere e a lista mostra o arquivo novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]), fileList([NEW_FILE]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado-novembro.csv', 2048));
    const sent = await uploads.nth(1);
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(UPLOAD_URL);
    expect(sent.file?.name).toBe('esperado-novembro.csv');

    const bar = await screen.findByRole('progressbar', { name: 'Envio de esperado-novembro.csv' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('Enviando esperado-novembro.csv')).toBeInTheDocument();
    expect(within(dropArea()).getByRole('button', { name: 'Enviar arquivo' })).toHaveAttribute('aria-busy', 'true');

    sent.progress(1024, 2048);
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('50% de 2 KB')).toBeInTheDocument();

    sent.progress(2048, 2048);
    expect(bar).toHaveAttribute('aria-valuetext', 'Enviado; conferindo as linhas');
    expect(screen.getByText('Conferindo esperado-novembro.csv')).toBeInTheDocument();

    sent.respond(201, NEW_FILE);
    expect(await screen.findByText('Arquivo esperado-novembro.csv enviado, com 2 registros.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(await screen.findByText('esperado-novembro.csv')).toBeInTheDocument();
    expect(api.callsTo(LIST_ROUTE)).toHaveLength(2);
  });

  it('aceita o arquivo solto na área', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    dropFiles(dropArea(), [fileOf('esperado.csv')]);

    const sent = await uploads.nth(1);
    expect(sent.file?.name).toBe('esperado.csv');
  });

  it('o Enviar arquivo do vazio abre a escolha do arquivo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');
    let opened = 0;
    fileInput().addEventListener('click', () => {
      opened += 1;
    });

    await user.click(within(screen.getByRole('table')).getByRole('button', { name: 'Enviar arquivo' }));

    expect(opened).toBe(1);
  });

  it('422 invalid_reference_file: lista os três erros por linha e coluna, sem Tentar de novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv'));
    const sent = await uploads.nth(1);
    sent.respond(422, problemBody(422, 'invalid_reference_file', { fields: THREE_LINE_ERRORS }));

    expect(await screen.findByText('Não foi possível enviar esperado.csv')).toBeInTheDocument();
    expect(screen.getByText('O arquivo tem erros. Corrija o que está abaixo e envie de novo.')).toBeInTheDocument();
    const errors = within(screen.getByRole('list', { name: 'Erros do arquivo' })).getAllByRole('listitem');
    expect(errors.map((item) => item.textContent)).toEqual([
      'linha 12, coluna pontos Use número com ponto, como 225.00.',
      'linha 15, coluna item_seq Preencha todas as partes da chave do registro.',
      'linha 21, coluna nf_id Chave repetida no arquivo: já apareceu na linha 9.',
    ]);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando os primeiros 20 erros/)).not.toBeInTheDocument();
  });

  it('422 invalid_reference_file no cabeçalho: mostra como Cabeçalho', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv'));
    const sent = await uploads.nth(1);
    sent.respond(
      422,
      problemBody(422, 'invalid_reference_file', {
        fields: { header: 'A coluna "observacao" não é da chave do registro nem um campo da saída.' },
      }),
    );

    const item = await screen.findByRole('listitem');
    expect(item).toHaveTextContent('Cabeçalho A coluna "observacao" não é da chave do registro nem um campo da saída.');
  });

  it('422 com 20 erros: avisa que podem existir outros', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');
    const fields = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`linha ${index + 2}, coluna pontos`, 'Use número com ponto, como 225.00.']));

    await user.upload(fileInput(), fileOf('esperado.csv'));
    (await uploads.nth(1)).respond(422, problemBody(422, 'invalid_reference_file', { fields }));

    expect(await screen.findByText('Mostrando os primeiros 20 erros. Corrija-os e envie de novo para ver se há outros.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
  });

  it('413 file_too_large: diz o limite da API e o que fazer, sem Tentar de novo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('grande.csv', 1024));
    (await uploads.nth(1)).respond(413, { ...problemBody(413, 'file_too_large'), detail: 'O arquivo passa de 20 MB.' });

    expect(await screen.findByText('Não foi possível enviar grande.csv')).toBeInTheDocument();
    expect(
      screen.getByText('O arquivo passa de 20 MB. Deixe no arquivo só os registros que você quer conferir e envie de novo.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('413 de um proxy, sem problem+json: a mesma explicação', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('grande.csv', 1024));
    (await uploads.nth(1)).respond(413, '<html>Request Entity Too Large</html>');

    expect(
      await screen.findByText(
        'O arquivo passa do tamanho máximo aceito (20 MB). Deixe no arquivo só os registros que você quer conferir e envie de novo.',
      ),
    ).toBeInTheDocument();
  });

  it('confere no navegador: só .csv, até 20 MB e um arquivo por vez, sem enviar', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    dropFiles(dropArea(), [fileOf('esperado.xlsx')]);
    expect(
      await screen.findByText('Só dá para enviar arquivos .csv. Salve a planilha como CSV (UTF-8, separado por vírgula) e envie de novo.'),
    ).toBeInTheDocument();

    await user.upload(fileInput(), fileOf('enorme.csv', 21 * 1024 * 1024));
    expect(
      await screen.findByText('O arquivo tem 21 MB e o limite é de 20 MB. Deixe no arquivo só os registros que você quer conferir e envie de novo.'),
    ).toBeInTheDocument();

    dropFiles(dropArea(), [fileOf('a.csv'), fileOf('b.csv')]);
    expect(await screen.findByText('Envie um arquivo por vez.')).toBeInTheDocument();
    expect(uploads.sent).toHaveLength(0);
  });

  it('409: sem fonte do lote e com 20 arquivos, a mensagem da API', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv'));
    (await uploads.nth(1)).respond(409, {
      ...problemBody(409, 'no_batch_source'),
      detail: 'Este workflow não tem fonte do lote. Escolha a fonte do lote para enviar um arquivo de referência.',
    });
    expect(
      await screen.findByText('Este workflow não tem fonte do lote. Escolha a fonte do lote para enviar um arquivo de referência.'),
    ).toBeInTheDocument();

    await user.upload(fileInput(), fileOf('esperado.csv'));
    (await uploads.nth(2)).respond(409, { ...problemBody(409, 'too_many_reference_files'), detail: 'Este workflow já tem 20 arquivos de referência.' });
    expect(
      await screen.findByText('Este workflow já tem 20 arquivos de referência. Remova um arquivo da lista antes de enviar outro.'),
    ).toBeInTheDocument();
  });

  it('sem resposta: oferece Tentar de novo, que envia o mesmo arquivo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv'));
    (await uploads.nth(1)).respond(500, problemBody(500, 'internal_error'));
    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    const again = await uploads.nth(2);
    expect(again.file?.name).toBe('esperado.csv');
  });

  it('Cancelar para o envio, volta ao começo e devolve o foco a Enviar arquivo', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, fileList([]));
    const uploads = simulateUploads();
    const { user } = renderTestCases();
    await screen.findByText('Nenhum arquivo de referência');

    await user.upload(fileInput(), fileOf('esperado.csv'));
    await uploads.nth(1);
    await user.click(within(dropArea()).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    expect(screen.queryByText(/Não foi possível enviar/)).not.toBeInTheDocument();
    expect(within(dropArea()).getByRole('button', { name: 'Enviar arquivo' })).toHaveFocus();
  });
});
