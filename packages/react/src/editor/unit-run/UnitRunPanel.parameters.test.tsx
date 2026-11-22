import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DRAFT,
  DRAFT_ROUTE,
  DRAFT_WITH_PARAMETERS,
  DRAFT_WITH_SOURCES,
  RUN_OK,
  RUN_ROUTE,
  TRACE_OK,
  json,
  problem,
  renderTab,
  simulateApi,
  type SimulatedApi,
} from './unit-run.test-support';

// Without inputs, "Calcular" is only the parameters and the formulas.
const WITH_PARAMETERS = {
  ...DRAFT_WITH_PARAMETERS,
  definition: { ...DRAFT_WITH_PARAMETERS.definition, root: { ...DRAFT_WITH_PARAMETERS.definition.root, inputs: [] } },
};
const WITH_SOURCES_AND_PARAMETERS = {
  ...DRAFT_WITH_SOURCES,
  definition: { ...DRAFT_WITH_SOURCES.definition, schema_version: 3 as const, parameters: DRAFT_WITH_PARAMETERS.definition.parameters },
};

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const calculate = () => screen.getByRole('button', { name: 'Calcular' });

describe('Calcular com parâmetros', () => {
  it('sem parâmetros declarados, não mostra o formulário e envia parameters vazio', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab({ draft: { ...DRAFT, definition: { ...DRAFT.definition, root: { ...DRAFT.definition.root, inputs: [] } } } });
    expect(screen.queryByRole('group', { name: 'Parâmetros' })).not.toBeInTheDocument();
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 3, inputs: {}, parameters: {} }]);
  });

  it('com parâmetros declarados, mostra o formulário e envia os valores em parameters', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab({ draft: WITH_PARAMETERS });
    expect(screen.getByRole('group', { name: 'Parâmetros' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('meta'));
    await user.paste('1.500');
    await user.click(screen.getByLabelText('regiao'));
    await user.paste('Norte');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 3, inputs: {}, parameters: { meta: '1500', regiao: 'Norte' } }]);
  });

  it('um valor que o formulário recusa não é enviado e fica no campo', async () => {
    const { user } = renderTab({ draft: WITH_PARAMETERS });
    await user.click(screen.getByLabelText('meta'));
    await user.paste('abc');
    await user.click(calculate());
    expect(screen.getByLabelText('meta')).toBeInvalid();
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([]);
  });

  it('o 422 de parâmetro aparece no campo, não na área do resultado', async () => {
    api.respond(RUN_ROUTE, problem(422, 'missing_parameter', { fields: { meta: 'Informe o valor de meta.' } }));
    const { user } = renderTab({ draft: WITH_PARAMETERS });
    await user.click(calculate());
    expect(await screen.findByText('Informe o valor de meta.')).toBeInTheDocument();
    expect(screen.getByLabelText('meta')).toBeInvalid();
    expect(screen.queryByText('Não foi possível calcular')).not.toBeInTheDocument();
    // Editing the field takes its error away.
    await user.click(screen.getByLabelText('meta'));
    await user.paste('1');
    expect(screen.queryByText('Informe o valor de meta.')).not.toBeInTheDocument();
  });

  it('lembra os valores ao trocar de aba (a aba abre de novo)', async () => {
    const { user, remount } = renderTab({ draft: WITH_PARAMETERS });
    await user.click(screen.getByLabelText('regiao'));
    await user.paste('Sul');
    remount();
    expect(screen.getByLabelText('regiao')).toHaveValue('Sul');
  });

  it('com fonte do lote, envia os parâmetros junto da chave do registro', async () => {
    api.respond(DRAFT_ROUTE, json(WITH_SOURCES_AND_PARAMETERS));
    api.respond(RUN_ROUTE, json(TRACE_OK));
    const { user } = renderTab({ draft: WITH_SOURCES_AND_PARAMETERS });
    await user.click(screen.getByRole('textbox', { name: 'nf_id' }));
    await user.paste('10');
    await user.click(screen.getByRole('textbox', { name: 'item_seq' }));
    await user.paste('1');
    await user.click(screen.getByLabelText('meta'));
    await user.paste('20');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    expect(api.bodiesTo(RUN_ROUTE)).toEqual([{ revision: 4, record_key: { nf_id: '10', item_seq: '1' }, parameters: { meta: '20' } }]);
  });

  it('com fonte do lote, o 422 de parâmetro cai no campo e os valores ficam lembrados', async () => {
    api.respond(RUN_ROUTE, problem(422, 'invalid_parameter', { fields: { regiao: 'Região desconhecida.' } }));
    const { user, remount } = renderTab({ draft: WITH_SOURCES_AND_PARAMETERS });
    await user.click(screen.getByRole('textbox', { name: 'nf_id' }));
    await user.paste('10');
    await user.click(screen.getByRole('textbox', { name: 'item_seq' }));
    await user.paste('1');
    await user.click(screen.getByLabelText('regiao'));
    await user.paste('Leste');
    await user.click(calculate());
    expect(await screen.findByText('Região desconhecida.')).toBeInTheDocument();
    remount();
    expect(screen.getByLabelText('regiao')).toHaveValue('Leste');
  });

  it('mudar só os parâmetros avisa que o resultado é de outros valores (D42)', async () => {
    api.respond(RUN_ROUTE, json(RUN_OK));
    const { user } = renderTab({ draft: WITH_PARAMETERS });
    await user.click(screen.getByLabelText('meta'));
    await user.paste('1.500');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    const note = 'Resultado de valores anteriores. Calcule de novo para ver o dos valores atuais.';
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('meta'));
    await user.paste('9');
    expect(screen.getByText(note)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('meta'));
    await user.paste('1.500');
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });

  it('com fonte do lote, mudar só os parâmetros avisa que o resultado é de outros parâmetros (D42)', async () => {
    api.respond(DRAFT_ROUTE, json(WITH_SOURCES_AND_PARAMETERS));
    api.respond(RUN_ROUTE, json(TRACE_OK));
    const { user } = renderTab({ draft: WITH_SOURCES_AND_PARAMETERS });
    await user.click(screen.getByRole('textbox', { name: 'nf_id' }));
    await user.paste('10');
    await user.click(screen.getByRole('textbox', { name: 'item_seq' }));
    await user.paste('1');
    await user.click(screen.getByLabelText('meta'));
    await user.paste('20');
    await user.click(calculate());
    await screen.findByRole('heading', { name: 'Resultado' });
    const note = 'Resultado de parâmetros anteriores. Calcule de novo para ver o dos parâmetros atuais.';
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('meta'));
    await user.paste('5');
    expect(screen.getByText(note)).toBeInTheDocument();
  });
});
