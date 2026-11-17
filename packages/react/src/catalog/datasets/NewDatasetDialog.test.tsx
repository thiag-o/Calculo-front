import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasets } from '.';
import { CONNECTIONS_STALE_NOTE, NO_CONNECTIONS_PERMISSION_REASON, NO_CONNECTIONS_REASON } from './NewDatasetDialog';
import { DATASET_ALREADY_EXISTS_MESSAGE, NO_CONNECTIONS_PERMISSION_MESSAGE, UNKNOWN_OBJECT_MESSAGE } from './messages';
import {
  ITEM_COLUMNS,
  POSTGRES,
  SQL_DATASET,
  SQL_SERVER,
  TABLE_DATASET,
  json,
  object,
  pendingResponse,
  problem,
  renderScreen,
  setCsrfCookie,
  simulateApi,
  type SimulatedApi,
} from './datasets.test-support';

let api: SimulatedApi;

const OBJECTS = `GET /v1/connections/${POSTGRES.id}/objects`;
const OBJECT_COLUMNS = `GET /v1/connections/${POSTGRES.id}/objects/columns`;

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('token-csrf');
  api.respond('GET /v1/datasets', json({ items: [SQL_DATASET] }));
  api.respond('GET /v1/connections', json({ items: [POSTGRES, SQL_SERVER] }));
  api.respond(OBJECTS, json({ items: [object('itens_nf'), object('vw_itens_campanha', 'view')], next_cursor: null }));
  api.respond(OBJECT_COLUMNS, json({ items: ITEM_COLUMNS }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openDialog(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Novo dataset' }));
  return screen.findByRole('dialog', { name: 'Novo dataset' });
}

async function choose(user: UserEvent, field: string, option: string) {
  await user.click(await screen.findByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function bodyOf(request: Request): Promise<unknown> {
  return JSON.parse(await request.text());
}

describe('Novo dataset de tabela', () => {
  it('escolhe a conexão e navega pelas tabelas e views com Carregar mais', async () => {
    api.respond(
      OBJECTS,
      (request) =>
        new URL(request.url).searchParams.get('cursor') === 'pagina-2'
          ? json({ items: [object('produtos')], next_cursor: null })
          : new URL(request.url).searchParams.get('search') === 'itens'
            ? json({ items: [object('itens_nf'), object('vw_itens_campanha', 'view')], next_cursor: null })
            : json({ items: [object('itens_nf'), object('notas_fiscais')], next_cursor: 'pagina-2' }),
    );
    const { user } = renderScreen(<Datasets />);

    const dialog = await openDialog(user);
    // With free_sql.use, the origin starts at "Tabela ou view".
    expect(within(dialog).getByRole('combobox', { name: 'Origem' })).toHaveTextContent('Tabela ou view');
    await choose(user, 'Conexão', 'Postgres de exemplo');

    const objects = await within(dialog).findByRole('group', { name: 'Tabela ou view' });
    expect(await within(objects).findByRole('radio', { name: 'public.notas_fiscais Tabela' })).toBeInTheDocument();
    expect(new URL(api.callsTo(OBJECTS)[0]!.url).searchParams.get('limit')).toBe('50');

    await user.click(within(objects).getByRole('button', { name: 'Carregar mais' }));
    expect(await within(objects).findByRole('radio', { name: 'public.produtos Tabela' })).toBeInTheDocument();
    expect(new URL(api.callsTo(OBJECTS).at(-1)!.url).searchParams.get('cursor')).toBe('pagina-2');
    expect(within(objects).queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('filtra as tabelas e views pelo nome', async () => {
    api.respond(OBJECTS, (request) =>
      new URL(request.url).searchParams.get('search') === 'itens'
        ? json({ items: [object('itens_nf'), object('vw_itens_campanha', 'view')], next_cursor: null })
        : json({ items: [object('itens_nf'), object('produtos')], next_cursor: null }),
    );
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    const objects = await within(dialog).findByRole('group', { name: 'Tabela ou view' });
    expect(await within(objects).findByRole('radio', { name: 'public.produtos Tabela' })).toBeInTheDocument();

    await user.click(within(objects).getByRole('searchbox', { name: 'Filtrar por nome' }));
    await user.paste('itens');
    expect(await within(objects).findByRole('radio', { name: 'public.vw_itens_campanha View' })).toBeInTheDocument();
    expect(within(objects).queryByRole('radio', { name: 'public.produtos Tabela' })).not.toBeInTheDocument();
    expect(api.callsTo(OBJECTS).some((request) => new URL(request.url).searchParams.get('search') === 'itens')).toBe(true);
  });

  it('vê as colunas da tabela escolhida, dá o nome, salva e abre o dataset criado', async () => {
    api.respond('POST /v1/datasets', json({ ...TABLE_DATASET, name: 'Itens de NF' }, 201));
    const onOpenDataset = vi.fn();
    const { user } = renderScreen(<Datasets onOpenDataset={onOpenDataset} />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');

    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    const columns = await within(dialog).findByRole('table', { name: 'Colunas de public.itens_nf' });
    expect(await within(columns).findByText('vl_itm')).toBeInTheDocument();
    expect(within(columns).getByText('Decimal (2 casas)')).toBeInTheDocument();
    expect(within(columns).getByText('Sem suporte')).toBeInTheDocument();
    const columnsRequest = new URL(api.callsTo(OBJECT_COLUMNS)[0]!.url);
    expect(columnsRequest.searchParams.get('schema_name')).toBe('public');
    expect(columnsRequest.searchParams.get('name')).toBe('itens_nf');

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveValue('itens_nf');
    await user.clear(name);
    await user.paste('Itens de NF');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onOpenDataset).toHaveBeenCalledWith(TABLE_DATASET.id));
    const [request] = api.callsTo('POST /v1/datasets');
    expect(await bodyOf(request!)).toEqual({
      type: 'table',
      name: 'Itens de NF',
      connection_id: POSTGRES.id,
      schema_name: 'public',
      object_name: 'itens_nf',
    });
    expect(request!.headers.get('X-CSRF-Token')).toBe('token-csrf');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Enter no filtro filtra na hora e não envia o formulário', async () => {
    api.respond(OBJECTS, (request) =>
      new URL(request.url).searchParams.get('search') === 'itens'
        ? json({ items: [object('itens_nf')], next_cursor: null })
        : json({ items: [object('itens_nf'), object('produtos')], next_cursor: null }),
    );
    api.respond('POST /v1/datasets', json(TABLE_DATASET, 201));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    // Everything filled in: an implicit submit would create the dataset.
    await user.click(await within(dialog).findByRole('radio', { name: 'public.produtos Tabela' }));

    const filter = within(dialog).getByRole('searchbox', { name: 'Filtrar por nome' });
    await user.click(filter);
    await user.paste('itens');
    // The browser submits the form on Enter (implicit submission, which jsdom does not do with the "Salvar" outside
    // the form): the screen must cancel the key's default action.
    expect(fireEvent.keyDown(filter, { key: 'Enter' })).toBe(false);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(within(dialog).queryByRole('radio', { name: 'public.produtos Tabela' })).not.toBeInTheDocument());
    expect(api.callsTo('POST /v1/datasets')).toHaveLength(0);
    expect(screen.getByRole('dialog', { name: 'Novo dataset' })).toBeInTheDocument();
  });

  it('não troca o nome que a pessoa já escreveu ao escolher outra tabela', async () => {
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Meu dataset');
    await choose(user, 'Conexão', 'Postgres de exemplo');
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));

    expect(within(dialog).getByRole('textbox', { name: 'Nome' })).toHaveValue('Meu dataset');
  });

  it('confere os campos antes de enviar', async () => {
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await within(dialog).findByRole('combobox', { name: 'Conexão' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Escolha a conexão')).toBeInTheDocument();
    expect(within(dialog).getByText('Informe o nome do dataset')).toBeInTheDocument();

    await choose(user, 'Conexão', 'Postgres de exemplo');
    await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Itens');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Escolha uma tabela ou view')).toBeInTheDocument();
    expect(api.callsTo('POST /v1/datasets')).toHaveLength(0);
  });

  it('unknown_object: aponta a tabela, que sumiu, e busca a lista de novo', async () => {
    api.respond('POST /v1/datasets', problem(422, 'unknown_object', { fields: { object_name: 'Não existe.' } }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    const objectCalls = api.callsTo(OBJECTS).length;
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const group = within(dialog).getByRole('group', { name: 'Tabela ou view' });
    expect(await within(group).findByText(UNKNOWN_OBJECT_MESSAGE)).toBeInTheDocument();
    expect(group).toHaveAccessibleDescription(UNKNOWN_OBJECT_MESSAGE);
    await waitFor(() => expect(api.callsTo(OBJECTS).length).toBeGreaterThan(objectCalls));
    expect(screen.getByRole('dialog', { name: 'Novo dataset' })).toBeInTheDocument();
  });

  it('dataset_already_exists: aponta o nome', async () => {
    api.respond('POST /v1/datasets', problem(409, 'dataset_already_exists'));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await waitFor(() => expect(name).toHaveAccessibleDescription(DATASET_ALREADY_EXISTS_MESSAGE));
    expect(name).toHaveAttribute('aria-invalid', 'true');
  });

  it('connection_failed ao salvar: mostra a mensagem fixa da API', async () => {
    api.respond('POST /v1/datasets', problem(422, 'connection_failed', { detail: 'O banco não respondeu a tempo.' }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('O banco não respondeu a tempo.')).toBeInTheDocument();
  });

  it('mostra o carregamento, o vazio e o erro da lista de tabelas e views', async () => {
    const pending = pendingResponse(() => json({ items: [], next_cursor: null }));
    api.respond(OBJECTS, pending.promise, problem(422, 'connection_target_not_allowed', { detail: 'Este endereço de banco não é permitido.' }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');

    expect(await within(dialog).findByText('Carregando tabelas e views')).toBeInTheDocument();
    pending.release();
    expect(await within(dialog).findByText('Nenhuma tabela ou view visível para o usuário desta conexão.')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('searchbox', { name: 'Filtrar por nome' }), 'x');
    expect(await within(dialog).findByText('Este endereço de banco não é permitido.')).toBeInTheDocument();
    expect(within(dialog).getByText('Não foi possível listar as tabelas e views')).toBeInTheDocument();
  });

  it('mostra o erro das colunas da tabela escolhida', async () => {
    api.respond(OBJECT_COLUMNS, problem(422, 'connection_failed', { detail: 'O banco recusou a conexão.' }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));

    expect(await within(dialog).findByText('O banco recusou a conexão.')).toBeInTheDocument();
    expect(within(dialog).getByText('Não foi possível ler as colunas')).toBeInTheDocument();
  });

  it('sem conexões, explica e desabilita o Salvar com o motivo', async () => {
    api.respond('GET /v1/connections', json({ items: [] }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);

    expect(await within(dialog).findByText('Nenhuma conexão ainda')).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Salvar' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(NO_CONNECTIONS_REASON);
  });

  it('sem permissão para ver as conexões, diz o motivo certo', async () => {
    api.respond('GET /v1/connections', problem(403, 'no_permission'));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);

    expect(await within(dialog).findByText(NO_CONNECTIONS_PERMISSION_MESSAGE)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toHaveAccessibleDescription(NO_CONNECTIONS_PERMISSION_REASON);
  });

  it('falha ao recarregar as conexões em segundo plano: o seletor continua, com um aviso discreto, e o Salvar segue habilitado', async () => {
    api.respond('GET /v1/connections', json({ items: [POSTGRES, SQL_SERVER] }), problem(503, 'unavailable'));
    // The chosen connection is gone: the API refuses it, and the screen fetches the connections again (which fails).
    api.respond(
      'POST /v1/datasets',
      problem(422, 'invalid_data', { fields: { connection_id: 'Conexão inexistente.' } }),
      json(TABLE_DATASET, 201),
    );
    api.respond(`GET /v1/connections/${SQL_SERVER.id}/objects`, json({ items: [object('itens_nf')], next_cursor: null }));
    api.respond(`GET /v1/connections/${SQL_SERVER.id}/objects/columns`, json({ items: ITEM_COLUMNS }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Conexão', 'Postgres de exemplo');
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.callsTo('GET /v1/connections').length).toBeGreaterThanOrEqual(2));
    const picker = within(dialog).getByRole('combobox', { name: 'Conexão' });
    await waitFor(() => expect(picker).toHaveAccessibleDescription(new RegExp(CONNECTIONS_STALE_NOTE)));
    expect(within(dialog).queryByText('Não foi possível carregar as conexões')).not.toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Salvar' });
    expect(save).not.toHaveAttribute('aria-disabled');

    // The list already loaded still holds: another connection can be chosen and saved.
    await choose(user, 'Conexão', 'ERP SQL Server');
    expect(picker).toHaveAccessibleDescription(new RegExp(CONNECTIONS_STALE_NOTE));
    await user.click(await within(dialog).findByRole('radio', { name: 'public.itens_nf Tabela' }));
    await user.click(save);
    await waitFor(() => expect(api.callsTo('POST /v1/datasets')).toHaveLength(2));
  });

  it('Cancelar fecha sem salvar e devolve o foco ao Novo dataset', async () => {
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Novo dataset' })).toHaveFocus();
    expect(api.callsTo('POST /v1/datasets')).toHaveLength(0);
  });
});

describe('Novo dataset de SQL', () => {
  async function writeSql(user: UserEvent, dialog: HTMLElement, sql: string) {
    await choose(user, 'Origem', 'SQL livre');
    await choose(user, 'Conexão', 'ERP SQL Server');
    const field = within(dialog).getByRole('textbox', { name: 'SQL' });
    await user.click(field);
    await user.paste(sql);
    return field;
  }

  it('cria o dataset com o SQL escrito na área monoespaçada', async () => {
    api.respond('POST /v1/datasets', json(SQL_DATASET, 201));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    const field = await writeSql(user, dialog, 'SELECT id FROM campanhas');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveClass('fc-datasets-sql');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Campanhas');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo('POST /v1/datasets')[0]!)).toEqual({
      type: 'sql',
      name: 'Campanhas',
      connection_id: SQL_SERVER.id,
      sql: 'SELECT id FROM campanhas',
    });
  });

  it('pede o SQL antes de enviar', async () => {
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    await choose(user, 'Origem', 'SQL livre');
    await choose(user, 'Conexão', 'ERP SQL Server');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Campanhas');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Escreva o SQL')).toBeInTheDocument();
    expect(api.callsTo('POST /v1/datasets')).toHaveLength(0);
  });

  it('invalid_sql: mostra o motivo no campo', async () => {
    api.respond(
      'POST /v1/datasets',
      problem(422, 'invalid_sql', { fields: { sql: 'Só um comando SELECT é aceito; achei DELETE.' } }),
    );
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);
    const field = await writeSql(user, dialog, 'DELETE FROM campanhas');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Campanhas');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveAccessibleDescription(/Só um comando SELECT é aceito; achei DELETE\./);

    // Editing the SQL clears the API error.
    await user.type(field, ' ');
    expect(field).not.toHaveAttribute('aria-invalid');
  });

  it('sem free_sql.use, só oferece tabela ou view', async () => {
    api = simulateApi(['connections.view', 'datasets.manage']);
    api.respond('GET /v1/datasets', json({ items: [SQL_DATASET] }));
    api.respond('GET /v1/connections', json({ items: [POSTGRES] }));
    const { user } = renderScreen(<Datasets />);
    const dialog = await openDialog(user);

    await within(dialog).findByRole('combobox', { name: 'Conexão' });
    expect(within(dialog).queryByRole('combobox', { name: 'Origem' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: 'SQL' })).not.toBeInTheDocument();
  });
});
