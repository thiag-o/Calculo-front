import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api';
import { DatasetDetail } from '.';
import { COLUMN_GONE_LABEL, NO_SUPPORTED_COLUMN_REASON } from './DatasetVariables';
import { DELETE_VARIABLE_NOT_FOUND_REASON } from './DeleteVariableDialog';
import { TYPE_NOT_ACCEPTED_MESSAGE, columnGoneReason } from './VariableDialog';
import {
  INCOMPATIBLE_TYPE_MESSAGE,
  INVALID_VARIABLE_NAME_MESSAGE,
  VARIABLE_ALREADY_EXISTS_MESSAGE,
  VARIABLE_NOT_FOUND_MESSAGE,
} from './messages';
import {
  EXCEL_FILE,
  ITEM_VALUE_VARIABLE,
  POSTGRES,
  READ_ONLY_PERMISSIONS,
  TABLE_DATASET,
  json,
  pendingResponse,
  problem,
  renderScreen,
  setCsrfCookie,
  simulateApi,
  type SimulatedApi,
} from './datasets.test-support';

let api: SimulatedApi;

/** A dataset with one column of each type, plus one without a supported type. */
const DATASET: Schemas['Dataset'] = {
  ...TABLE_DATASET,
  columns: [
    { name: 'nf_id', source_type: 'integer', type: 'integer', scale: null, nullable: false },
    { name: 'vl_itm', source_type: 'numeric(12,2)', type: 'decimal', scale: 2, nullable: true },
    { name: 'cliente', source_type: 'varchar(80)', type: 'text', scale: null, nullable: true },
    { name: 'emitida_em', source_type: 'date', type: 'date', scale: null, nullable: false },
    { name: 'criada_em', source_type: 'timestamp', type: 'datetime', scale: null, nullable: false },
    { name: 'ativo', source_type: 'boolean', type: 'boolean', scale: null, nullable: false },
    { name: 'busca', source_type: 'tsvector', type: null, scale: null, nullable: true },
  ],
};

const DETAIL = `GET /v1/datasets/${DATASET.id}`;
const VARIABLES = `GET /v1/datasets/${DATASET.id}/variables`;
const CREATE = `POST /v1/datasets/${DATASET.id}/variables`;
const VARIABLE = `/v1/variables/${ITEM_VALUE_VARIABLE.id}`;

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('token-csrf');
  api.respond('GET /v1/connections', json({ items: [POSTGRES] }));
  api.respond('GET /v1/excel-files', json({ items: [EXCEL_FILE] }));
  api.respond(DETAIL, json(DATASET));
  api.respond(VARIABLES, json({ items: [ITEM_VALUE_VARIABLE] }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const variablesTable = () => screen.getByRole('table', { name: `Variáveis do dataset ${DATASET.name}` });
/** The variables table, once the dataset has arrived. */
const findVariablesTable = () => screen.findByRole('table', { name: `Variáveis do dataset ${DATASET.name}` });
const columnsTable = () => screen.getByRole('table', { name: `Colunas do dataset ${DATASET.name}` });

async function openNew(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Nova variável' }));
  return screen.findByRole('dialog', { name: 'Nova variável' });
}

async function choose(user: UserEvent, dialog: HTMLElement, field: string, option: string) {
  await user.click(within(dialog).getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function optionsOf(user: UserEvent, dialog: HTMLElement, field: string): Promise<string[]> {
  await user.click(within(dialog).getByRole('combobox', { name: field }));
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent ?? '');
  await user.keyboard('{Escape}');
  return options;
}

async function openRowMenu(user: UserEvent, name: string) {
  await within(await findVariablesTable()).findByText(name);
  await user.click(await screen.findByRole('button', { name: `Mais ações para ${name}` }));
  return screen.findByRole('menu');
}

async function bodyOf(request: Request): Promise<unknown> {
  return JSON.parse(await request.text());
}

describe('Variáveis do dataset: lista', () => {
  it('mostra o carregamento e depois cada variável com nome, coluna e tipo, também na tabela de colunas', async () => {
    const pending = pendingResponse(() => json({ items: [ITEM_VALUE_VARIABLE] }));
    api.respond(VARIABLES, pending.promise);
    renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    expect(await screen.findByRole('heading', { level: 3, name: 'Variáveis' })).toBeInTheDocument();
    expect(variablesTable()).toHaveAttribute('aria-busy', 'true');
    pending.release();

    const row = await within(variablesTable()).findByRole('row', { name: /valor_item/ });
    expect(within(row).getByText('vl_itm')).toBeInTheDocument();
    expect(within(row).getByText('Decimal (2 casas)')).toBeInTheDocument();
    expect(screen.getByText('1 variável')).toBeInTheDocument();

    const headers = within(columnsTable()).getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Nome', 'Tipo de origem', 'Tipo', 'Anulável', 'Variáveis']);
    const column = within(columnsTable()).getByRole('row', { name: /vl_itm/ });
    expect(within(column).getByText('valor_item')).toBeInTheDocument();
  });

  it('sem variáveis, mostra o vazio com a ação', async () => {
    api.respond(VARIABLES, json({ items: [] }));
    renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    expect(await within(await findVariablesTable()).findByText('Nenhuma variável ainda')).toBeInTheDocument();
    expect(screen.getByText('0 variáveis')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova variável' })).toHaveLength(2);
  });

  it('erro ao carregar: explica e Tentar de novo busca de novo', async () => {
    api.respond(VARIABLES, problem(503, 'unavailable'), json({ items: [ITEM_VALUE_VARIABLE] }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    expect(await screen.findByText('Não foi possível carregar as variáveis')).toBeInTheDocument();
    await user.click(within(variablesTable()).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(variablesTable()).findByText('valor_item')).toBeInTheDocument();
  });

  it('id mal formado (422 invalid_data): diz que o dataset não existe, sem Tentar de novo', async () => {
    api.respond(VARIABLES, problem(422, 'invalid_data'));
    renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    expect(await screen.findByText('Não foi possível carregar as variáveis')).toBeInTheDocument();
    expect(screen.getByText('Este dataset não existe mais neste tenant.')).toBeInTheDocument();
    expect(within(variablesTable()).queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('sem variables.manage, as variáveis aparecem só para leitura', async () => {
    api = simulateApi([...READ_ONLY_PERMISSIONS, 'datasets.manage']);
    api.respond('GET /v1/connections', json({ items: [POSTGRES] }));
    api.respond(DETAIL, json(DATASET));
    api.respond(VARIABLES, json({ items: [ITEM_VALUE_VARIABLE] }));
    renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    expect(await within(await findVariablesTable()).findByText('valor_item')).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo('GET /v1/session')).toHaveLength(1));
    // datasets.manage alone keeps the dataset actions, but not the variable ones.
    expect(await screen.findByRole('button', { name: 'Renomear dataset' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova variável' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais ações para valor_item' })).not.toBeInTheDocument();
    expect(within(variablesTable()).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Nome',
      'Coluna',
      'Tipo',
    ]);
  });

  it('dataset sem colunas com tipo suportado: Nova variável fica desabilitada com o motivo', async () => {
    api.respond(DETAIL, json({ ...DATASET, columns: [DATASET.columns[6]] }));
    api.respond(VARIABLES, json({ items: [] }));
    renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    await within(await findVariablesTable()).findByText('Nenhuma variável ainda');
    const [button] = screen.getAllByRole('button', { name: 'Nova variável' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(NO_SUPPORTED_COLUMN_REASON);
  });
});

describe('Variáveis do dataset: coluna Variáveis das colunas', () => {
  it('quando a lista falha, a coluna diz que não carregou e o Tentar de novo fica só na seção das variáveis', async () => {
    api.respond(VARIABLES, problem(503, 'unavailable'), json({ items: [ITEM_VALUE_VARIABLE] }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const columns = await screen.findByRole('table', { name: `Colunas do dataset ${DATASET.name}` });
    await within(columns).findAllByText('Não carregou');
    expect(within(columns).getAllByText('Não carregou')).toHaveLength(DATASET.columns.length);
    expect(within(columns).queryByRole('button', { name: /Tentar de novo/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Tentar de novo/ })).toHaveLength(1);
    await user.click(within(variablesTable()).getByRole('button', { name: 'Tentar de novo' }));

    expect(await within(columnsTable()).findByText('valor_item')).toBeInTheDocument();
    expect(within(columnsTable()).queryByText('Não carregou')).not.toBeInTheDocument();
  });
});

describe('Variáveis do dataset: criar', () => {
  it('dá nome e tipo a uma coluna, com as casas do decimal, e mostra a variável nova', async () => {
    const created: Schemas['Variable'] = {
      ...ITEM_VALUE_VARIABLE,
      id: '70000000-0000-0000-0000-000000000002',
      column: 'nf_id',
      name: 'numero_nf',
      type: 'decimal',
      scale: 3,
    };
    api.respond(CREATE, json(created, 201));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    await within(await findVariablesTable()).findByText('valor_item');

    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'nf_id · Inteiro');
    expect(within(dialog).getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Inteiro');
    expect(within(dialog).queryByRole('textbox', { name: 'Casas decimais' })).not.toBeInTheDocument();
    await choose(user, dialog, 'Tipo', 'Decimal');
    await user.click(within(dialog).getByRole('textbox', { name: 'Casas decimais' }));
    await user.paste('3');
    await user.click(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.paste('numero_nf');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [request] = api.callsTo(CREATE);
    expect(await bodyOf(request!)).toEqual({ column: 'nf_id', name: 'numero_nf', type: 'decimal', scale: 3 });
    expect(request!.headers.get('X-CSRF-Token')).toBe('token-csrf');
    const row = within(variablesTable()).getByRole('row', { name: /numero_nf/ });
    expect(within(row).getByText('Decimal (3 casas)')).toBeInTheDocument();
    expect(screen.getByText('2 variáveis')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nova variável' })[0]).toHaveFocus();
  });

  it('o diálogo fecha assim que a API confirma, sem esperar o recarregamento do catálogo', async () => {
    const slowRefresh = pendingResponse(() => json({ items: [POSTGRES] }));
    api.respond('GET /v1/connections', json({ items: [POSTGRES] }), slowRefresh.promise);
    api.respond(CREATE, json({ ...ITEM_VALUE_VARIABLE, id: '70000000-0000-0000-0000-000000000009', column: 'cliente', name: 'nome_cliente', type: 'text', scale: null }, 201));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    await within(await findVariablesTable()).findByText('valor_item');

    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'cliente · Texto');
    await user.click(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.paste('nome_cliente');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The reload is still waiting, in the background.
    await waitFor(() => expect(api.callsTo('GET /v1/connections')).toHaveLength(2));
    slowRefresh.release();
  });

  it('fora do decimal, envia scale nula', async () => {
    api.respond(CREATE, json({ ...ITEM_VALUE_VARIABLE, id: '70000000-0000-0000-0000-000000000003', column: 'cliente', name: 'cliente', type: 'text', scale: null }, 201));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'cliente · Texto');
    await user.click(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.paste('cliente');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.callsTo(CREATE)).toHaveLength(1));
    expect(await bodyOf(api.callsTo(CREATE)[0]!)).toEqual({ column: 'cliente', name: 'cliente', type: 'text', scale: null });
  });

  it('só oferece as colunas com tipo suportado', async () => {
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);

    expect(await optionsOf(user, dialog, 'Coluna')).toEqual([
      'nf_id · Inteiro',
      'vl_itm · Decimal (2 casas)',
      'cliente · Texto',
      'emitida_em · Data',
      'criada_em · Data e hora',
      'ativo · Booleano',
    ]);
  });

  it.each([
    ['nf_id · Inteiro', ['Inteiro', 'Decimal', 'Texto']],
    ['vl_itm · Decimal (2 casas)', ['Decimal', 'Texto']],
    ['cliente · Texto', ['Texto']],
    ['emitida_em · Data', ['Data', 'Data e hora', 'Texto']],
    ['criada_em · Data e hora', ['Data e hora', 'Texto']],
    ['ativo · Booleano', ['Booleano', 'Texto']],
  ])('o tipo de %s oferece só as conversões aceitas', async (column, types) => {
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', column);

    expect(await optionsOf(user, dialog, 'Tipo')).toEqual(types);
  });

  it('pede a coluna e o nome antes de enviar', async () => {
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Escolha a coluna')).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Nome' })).toHaveAccessibleDescription(/Informe o nome da variável/);
    expect(api.callsTo(CREATE)).toHaveLength(0);
  });

  it.each(['Valor_item', '1valor', 'valor item', 'valor-item', 'ação', ' valor', `a${'b'.repeat(63)}`])(
    'confere a regra do nome no cliente, sem enviar: "%s"',
    async (invalid) => {
      const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
      const dialog = await openNew(user);
      await choose(user, dialog, 'Coluna', 'cliente · Texto');
      const name = within(dialog).getByRole('textbox', { name: 'Nome' });
      await user.click(name);
      await user.paste(invalid);
      await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(name).toHaveAccessibleDescription(new RegExp(`^${INVALID_VARIABLE_NAME_MESSAGE}`)));
      expect(api.callsTo(CREATE)).toHaveLength(0);
    },
  );

  it('as casas decimais começam com as da coluna', async () => {
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'vl_itm · Decimal (2 casas)');

    const scale = within(dialog).getByRole('textbox', { name: 'Casas decimais' });
    expect(scale).toHaveValue('2');
    expect(scale).toHaveAccessibleDescription(/De 2 a 38/);
  });

  it.each([
    ['', /Informe as casas decimais/],
    ['39', /As casas decimais vão de 0 a 38/],
    ['1,5', /As casas decimais vão de 0 a 38/],
    ['1', /Use ao menos 2 casas decimais, as da coluna, para não arredondar/],
  ])('confere as casas decimais no cliente: "%s"', async (value, message) => {
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'vl_itm · Decimal (2 casas)');
    await user.click(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.paste('valor_total');
    const scale = within(dialog).getByRole('textbox', { name: 'Casas decimais' });
    await user.clear(scale);
    if (value) {
      await user.click(scale);
      await user.paste(value);
    }
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(scale).toHaveAccessibleDescription(message));
    expect(api.callsTo(CREATE)).toHaveLength(0);
  });

  it('variable_already_exists: aponta o nome', async () => {
    api.respond(CREATE, problem(409, 'variable_already_exists'));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'cliente · Texto');
    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await user.click(name);
    await user.paste('valor_item');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(name).toHaveAccessibleDescription(new RegExp(`^${VARIABLE_ALREADY_EXISTS_MESSAGE}`)));
    expect(screen.getByRole('dialog', { name: 'Nova variável' })).toBeInTheDocument();
  });

  it('invalid_variable_name: aponta o nome', async () => {
    api.respond(CREATE, problem(422, 'invalid_variable_name', { fields: { name: 'Texto do servidor.' } }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'cliente · Texto');
    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await user.click(name);
    await user.paste('cliente');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(name).toHaveAccessibleDescription(new RegExp(`^${INVALID_VARIABLE_NAME_MESSAGE}`)));
  });

  it('incompatible_type: aponta o tipo e busca as colunas do dataset de novo', async () => {
    api.respond(CREATE, problem(422, 'incompatible_type', { fields: { type: 'A coluna não pode virar uma variável desse tipo.' } }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);
    const dialog = await openNew(user);
    await choose(user, dialog, 'Coluna', 'emitida_em · Data');
    await choose(user, dialog, 'Tipo', 'Data e hora');
    await user.click(within(dialog).getByRole('textbox', { name: 'Nome' }));
    await user.paste('emitida_em');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const type = within(dialog).getByRole('combobox', { name: 'Tipo' });
    await waitFor(() => expect(type).toHaveAccessibleDescription(new RegExp(`^${INCOMPATIBLE_TYPE_MESSAGE}`)));
    await waitFor(() => expect(api.callsTo(DETAIL)).toHaveLength(2));
  });
});

describe('Variáveis do dataset: editar', () => {
  it('troca o nome e o tipo, mantém a coluna e devolve o foco ao menu da linha', async () => {
    api.respond(`PUT ${VARIABLE}`, json({ ...ITEM_VALUE_VARIABLE, name: 'valor_texto', type: 'text', scale: null }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    expect(within(dialog).queryByRole('combobox', { name: 'Coluna' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('vl_itm')).toBeInTheDocument();
    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveValue('valor_item');
    expect(within(dialog).getByRole('textbox', { name: 'Casas decimais' })).toHaveValue('2');

    await user.clear(name);
    await user.click(name);
    await user.paste('valor_texto');
    await choose(user, dialog, 'Tipo', 'Texto');
    expect(within(dialog).queryByRole('textbox', { name: 'Casas decimais' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(`PUT ${VARIABLE}`)[0]!)).toEqual({ name: 'valor_texto', type: 'text', scale: null });
    const row = within(variablesTable()).getByRole('row', { name: /valor_texto/ });
    expect(within(row).getByText('Texto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mais ações para valor_texto' })).toHaveFocus();
  });

  it('variable_already_exists ao editar: aponta o nome', async () => {
    api.respond(`PUT ${VARIABLE}`, problem(409, 'variable_already_exists'));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await waitFor(() => expect(name).toHaveAccessibleDescription(new RegExp(`^${VARIABLE_ALREADY_EXISTS_MESSAGE}`)));
  });

  it('incompatible_type ao editar: aponta o tipo', async () => {
    api.respond(`PUT ${VARIABLE}`, problem(422, 'incompatible_type', { fields: { type: 'A coluna não pode virar uma variável desse tipo.' } }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: 'Tipo' })).toHaveAccessibleDescription(new RegExp(`^${INCOMPATIBLE_TYPE_MESSAGE}`)),
    );
  });

  it('invalid_variable_name ao editar: aponta o nome', async () => {
    api.respond(`PUT ${VARIABLE}`, problem(422, 'invalid_variable_name', { fields: { name: 'Texto do servidor.' } }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    const name = within(dialog).getByRole('textbox', { name: 'Nome' });
    await waitFor(() => expect(name).toHaveAccessibleDescription(new RegExp(`^${INVALID_VARIABLE_NAME_MESSAGE}`)));
  });

  it('tipo que a coluna não aceita mais: aparece marcado e salvar exige escolher um tipo válido', async () => {
    // The column vl_itm became text after "Atualizar colunas": a decimal variable is not accepted over it anymore.
    const changed: Schemas['Dataset'] = {
      ...DATASET,
      columns: DATASET.columns.map((column) =>
        column.name === 'vl_itm' ? { ...column, source_type: 'varchar(20)', type: 'text', scale: null } : column,
      ),
    };
    api.respond(DETAIL, json(changed));
    api.respond(`PUT ${VARIABLE}`, json({ ...ITEM_VALUE_VARIABLE, type: 'text', scale: null }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    expect(within(dialog).getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Decimal (não aceito mais)');

    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('combobox', { name: 'Tipo' })).toHaveAccessibleDescription(new RegExp(`^${TYPE_NOT_ACCEPTED_MESSAGE}`)),
    );
    expect(api.callsTo(`PUT ${VARIABLE}`)).toHaveLength(0);

    expect(await optionsOf(user, dialog, 'Tipo')).toEqual(['Texto', 'Decimal (não aceito mais)']);
    await choose(user, dialog, 'Tipo', 'Texto');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await bodyOf(api.callsTo(`PUT ${VARIABLE}`)[0]!)).toEqual({ name: 'valor_item', type: 'text', scale: null });
  });

  it('variável cuja coluna saiu do dataset: marca a linha e desabilita o Salvar com o motivo', async () => {
    const orphan = { ...ITEM_VALUE_VARIABLE, column: 'vl_antigo' };
    api.respond(VARIABLES, json({ items: [orphan] }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const row = await within(await findVariablesTable()).findByRole('row', { name: /valor_item/ });
    expect(within(row).getByText(COLUMN_GONE_LABEL)).toBeInTheDocument();

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Editar variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar variável' });
    expect(within(dialog).getByText('A coluna não está mais no dataset')).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Salvar' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(columnGoneReason('vl_antigo'));
    await user.click(save);
    expect(api.callsTo(`PUT ${VARIABLE}`)).toHaveLength(0);
  });
});

describe('Variáveis do dataset: remover', () => {
  it('confirma, remove e tira a linha; a coluna continua', async () => {
    api.respond(`DELETE ${VARIABLE}`, new Response(null, { status: 204 }));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Remover variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover variável' });
    expect(dialog).toHaveAccessibleDescription(/a coluna vl_itm continua/);
    await user.click(within(dialog).getByRole('button', { name: 'Remover variável' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(`DELETE ${VARIABLE}`)[0]!.headers.get('X-CSRF-Token')).toBe('token-csrf');
    expect(await screen.findByText('Nenhuma variável ainda')).toBeInTheDocument();
    expect(within(columnsTable()).getByText('vl_itm')).toBeInTheDocument();
    // The row is gone: the focus goes to "Nova variável".
    expect(screen.getAllByRole('button', { name: 'Nova variável' })[0]).toHaveFocus();
  });

  it('Cancelar não remove', async () => {
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Remover variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover variável' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(`DELETE ${VARIABLE}`)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Mais ações para valor_item' })).toHaveFocus();
  });

  it('not_found: explica e desabilita a remoção com o motivo', async () => {
    api.respond(`DELETE ${VARIABLE}`, problem(404, 'not_found'));
    const { user } = renderScreen(<DatasetDetail datasetId={DATASET.id} />);

    const menu = await openRowMenu(user, 'valor_item');
    await user.click(within(menu).getByRole('menuitem', { name: 'Remover variável' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remover variável' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover variável' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(VARIABLE_NOT_FOUND_MESSAGE);
    expect(within(dialog).getByRole('button', { name: 'Remover variável' })).toHaveAccessibleDescription(
      DELETE_VARIABLE_NOT_FOUND_REASON,
    );
  });
});
