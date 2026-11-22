import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_WITH_PARAMETERS, PREVIEW, PREVIEW_ROUTE, json, problem, renderTab, simulateApi, type SimulatedApi } from './preview.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const runButton = () => screen.getByRole('button', { name: 'Rodar prévia' });

describe('Prévia com parâmetros', () => {
  it('sem parâmetros declarados, não mostra o formulário', () => {
    renderTab();
    expect(screen.queryByRole('group', { name: 'Parâmetros' })).not.toBeInTheDocument();
  });

  it('com parâmetros declarados, mostra o formulário e envia os valores em parameters', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab({ draft: DRAFT_WITH_PARAMETERS });
    expect(screen.getByRole('group', { name: 'Parâmetros' })).toBeInTheDocument();
    await user.click(screen.getByLabelText('meta'));
    await user.paste('1.500');
    await user.click(runButton());
    await screen.findByText('Contagens sobre os primeiros 500 registros.');
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([{ revision: 3, sample_size: 20, parameters: { meta: '1500' } }]);
  });

  it('um valor que o formulário recusa não roda a prévia e fica no campo', async () => {
    const { user } = renderTab({ draft: DRAFT_WITH_PARAMETERS });
    await user.click(screen.getByLabelText('meta'));
    await user.paste('abc');
    await user.click(runButton());
    expect(screen.getByLabelText('meta')).toBeInvalid();
    expect(api.bodiesTo(PREVIEW_ROUTE)).toEqual([]);
  });

  it('o 422 de parâmetro aparece no campo, não na área do resultado', async () => {
    api.respond(PREVIEW_ROUTE, problem(422, 'missing_parameter', { fields: { meta: 'Informe o valor de meta.' } }));
    const { user } = renderTab({ draft: DRAFT_WITH_PARAMETERS });
    await user.click(runButton());
    expect(await screen.findByText('Informe o valor de meta.')).toBeInTheDocument();
    expect(screen.getByLabelText('meta')).toBeInvalid();
    expect(screen.queryByText('Não foi possível rodar a prévia')).not.toBeInTheDocument();
  });

  it('lembra os valores ao trocar de aba (a aba abre de novo)', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user, remount } = renderTab({ draft: DRAFT_WITH_PARAMETERS });
    await user.click(screen.getByLabelText('regiao'));
    await user.paste('Sul');
    remount();
    expect(screen.getByLabelText('regiao')).toHaveValue('Sul');
  });

  it('mudar só os parâmetros avisa que a prévia é de outros valores (D42)', async () => {
    api.respond(PREVIEW_ROUTE, json(PREVIEW));
    const { user } = renderTab({ draft: DRAFT_WITH_PARAMETERS });
    await user.click(screen.getByLabelText('meta'));
    await user.paste('1.500');
    await user.click(runButton());
    await screen.findByText('Contagens sobre os primeiros 500 registros.');
    const note = 'Prévia de parâmetros anteriores. Rode a prévia de novo para ver a dos parâmetros atuais.';
    expect(screen.queryByText(note)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('meta'));
    await user.paste('9');
    expect(screen.getByText(note)).toBeInTheDocument();
    // Back to the values used: the result is current again.
    await user.clear(screen.getByLabelText('meta'));
    await user.paste('1.500');
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });
});
