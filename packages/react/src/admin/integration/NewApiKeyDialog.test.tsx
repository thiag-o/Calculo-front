import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeys } from '.';
import { KEY_SHOWN_ONCE_NOTICE, COPY_FAILED_MESSAGE } from './NewApiKeyDialog';
import { NO_PERMISSION_MESSAGE } from './messages';
import {
  PORTAL_API_KEY,
  cacheContent,
  setCsrfCookie,
  json,
  problem,
  renderIntegration,
  pendingResponse,
  simulateApi,
  type SimulatedApi,
} from './integration.test-support';

let api: SimulatedApi;

const LIST_ROUTE = 'GET /v1/chaves-api';
const CREATE_ROUTE = 'POST /v1/chaves-api';
const SECRET = 'fc_9xQ2segredo-inteiro-da-chave-de-api-0123456789';
const CREATED = { id: '30000000-0000-0000-0000-000000000009', nome: 'Portal novo', prefixo: 'fc_9xQ2', chave: SECRET };
const IN_LIST = {
  id: CREATED.id,
  nome: CREATED.nome,
  prefixo: CREATED.prefixo,
  criada_em: PORTAL_API_KEY.criada_em,
  ultimo_uso_em: null,
  revogada_em: null,
};

beforeEach(() => {
  api = simulateApi();
  api.respond(LIST_ROUTE, json({ itens: [PORTAL_API_KEY], proximo_cursor: null }));
  setCsrfCookie('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderScreen() {
  return renderIntegration(<ApiKeys />);
}

async function openNew(user: UserEvent) {
  await screen.findByText('Portal do cliente');
  await user.click(screen.getByRole('button', { name: 'Nova chave de API' }));
  return screen.findByRole('dialog', { name: 'Nova chave de API' });
}

async function create(user: UserEvent, panel: HTMLElement, name = 'Portal novo') {
  await user.type(within(panel).getByRole('textbox', { name: 'Nome' }), name);
  await user.click(within(panel).getByRole('button', { name: 'Salvar' }));
}

describe('Integração: nova chave de API', () => {
  it('pede o nome antes de criar', async () => {
    const { user } = renderScreen();
    const panel = await openNew(user);

    expect(panel).toHaveAccessibleDescription(
      'O backend do sistema hospedeiro usa a chave para pedir tokens de incorporação deste tenant.',
    );
    const name = within(panel).getByRole('textbox', { name: 'Nome' });
    expect(name).toHaveFocus();

    await user.type(name, '   ');
    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));

    expect(await within(panel).findByText('Informe o nome')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(0);
  });

  it('cria, mostra a chave uma vez com o aviso, copia e atualiza a lista', async () => {
    api.respond(CREATE_ROUTE, json(CREATED, 201));
    const { user } = renderScreen();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    const panel = await openNew(user);
    api.respond(LIST_ROUTE, json({ itens: [IN_LIST, PORTAL_API_KEY], proximo_cursor: null }));

    await create(user, panel, '  Portal novo  ');

    const field = await within(panel).findByRole('textbox', { name: 'Chave' });
    expect(field).toHaveValue(SECRET);
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription('Na lista, ela aparece só pelo começo: fc_9xQ2…');
    expect(within(panel).getByText(KEY_SHOWN_ONCE_NOTICE)).toBeInTheDocument();
    expect(panel).toHaveAccessibleDescription(
      'Configure a chave Portal novo no backend do sistema hospedeiro, no cabeçalho Authorization: Chave <chave>.',
    );
    expect(within(panel).queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();

    const [req] = api.callsTo(CREATE_ROUTE);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({ nome: 'Portal novo' });

    await user.click(within(panel).getByRole('button', { name: 'Copiar' }));
    expect(write).toHaveBeenCalledWith(SECRET);
    expect(await navigator.clipboard.readText()).toBe(SECRET);
    expect(await within(panel).findByText('Chave copiada')).toBeInTheDocument();

    // The list, behind the dialog, already has the new key, only by its prefix.
    await waitFor(() => expect(api.callsTo(LIST_ROUTE)).toHaveLength(2));
    expect(await screen.findByText('fc_9xQ2…')).toBeInTheDocument();
  });

  it('ao fechar, a chave não fica em lugar nenhum: nem na tela, nem no cache; reabrir pede um nome', async () => {
    api.respond(CREATE_ROUTE, json(CREATED, 201));
    const { user, queryClient } = renderScreen();
    let panel = await openNew(user);
    api.respond(LIST_ROUTE, json({ itens: [IN_LIST, PORTAL_API_KEY], proximo_cursor: null }));
    await create(user, panel);
    await within(panel).findByRole('textbox', { name: 'Chave' });
    expect(cacheContent(queryClient)).toContain(SECRET);

    // The footer "Fechar" (the other one is in the dialog corner).
    await user.click(within(panel).getAllByRole('button', { name: 'Fechar' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(SECRET);
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    await screen.findByText('fc_9xQ2…');
    expect(cacheContent(queryClient)).not.toContain(SECRET);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nova chave de API' })).toHaveFocus());

    panel = await openNew(user);
    expect(within(panel).queryByRole('textbox', { name: 'Chave' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Nome' })).toHaveValue('');
  });

  it('fechar com Esc também descarta a chave', async () => {
    api.respond(CREATE_ROUTE, json(CREATED, 201));
    const { user, queryClient } = renderScreen();
    const panel = await openNew(user);
    await create(user, panel);
    await within(panel).findByRole('textbox', { name: 'Chave' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(cacheContent(queryClient)).not.toContain(SECRET);
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it('fechar antes da resposta chegar: a chave que chega depois também não fica', async () => {
    const pending = pendingResponse(() => json(CREATED, 201));
    api.respond(CREATE_ROUTE, pending.promise);
    const { user, queryClient } = renderScreen();
    const panel = await openNew(user);
    await create(user, panel);
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Salvar' })).toHaveAttribute('aria-busy', 'true'));

    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    pending.release();

    // The list is fetched again (the key exists), but the secret is not kept.
    await waitFor(() => expect(api.callsTo(LIST_ROUTE)).toHaveLength(2));
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
    expect(cacheContent(queryClient)).not.toContain(SECRET);
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it('enquanto cria, o botão fica ocupado e o Enter não cria duas vezes', async () => {
    const pending = pendingResponse(() => json(CREATED, 201));
    api.respond(CREATE_ROUTE, pending.promise);
    const { user } = renderScreen();
    const panel = await openNew(user);
    await create(user, panel);

    const save = within(panel).getByRole('button', { name: 'Salvar' });
    await waitFor(() => expect(save).toHaveAttribute('aria-busy', 'true'));
    await user.click(save);
    // The submit button is in the footer, outside the <form>: Enter is simulated by the form submit.
    fireEvent.submit(panel.querySelector('form')!);
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(1);

    pending.release();
    expect(await within(panel).findByRole('textbox', { name: 'Chave' })).toHaveValue(SECRET);
  });

  it('se não der para copiar, explica como copiar à mão', async () => {
    api.respond(CREATE_ROUTE, json(CREATED, 201));
    const { user } = renderScreen();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('negado'));
    const panel = await openNew(user);
    await create(user, panel);
    await within(panel).findByRole('textbox', { name: 'Chave' });

    await user.click(within(panel).getByRole('button', { name: 'Copiar' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent(COPY_FAILED_MESSAGE);
    expect(within(panel).getByRole('textbox', { name: 'Chave' })).toHaveValue(SECRET);
  });

  it('dados_invalidos no nome: mostra o erro no campo', async () => {
    api.respond(CREATE_ROUTE, problem(422, 'dados_invalidos', { campos: { nome: 'O nome tem no máximo 100 caracteres.' } }));
    const { user } = renderScreen();
    const panel = await openNew(user);
    await create(user, panel);

    expect(await within(panel).findByText('O nome tem no máximo 100 caracteres.')).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Nome' })).toHaveAttribute('aria-invalid', 'true');
    expect(within(panel).getByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
  });

  it('sem permissão: explica', async () => {
    api.respond(CREATE_ROUTE, problem(403, 'sem_permissao'));
    const { user } = renderScreen();
    const panel = await openNew(user);
    await create(user, panel);

    expect(await within(panel).findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
  });

  it('erro passageiro: mostra a mensagem e deixa salvar de novo', async () => {
    api.respond(CREATE_ROUTE, problem(503, 'unavailable'), json(CREATED, 201));
    const { user } = renderScreen();
    const panel = await openNew(user);
    await create(user, panel);
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(within(panel).getByRole('button', { name: 'Salvar' }));
    expect(await within(panel).findByRole('textbox', { name: 'Chave' })).toHaveValue(SECRET);
  });
});
