import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizedDomains, Integration } from '.';
import { DELETE_NOT_FOUND_REASON } from './DeleteAuthorizedDomainDialog';
import {
  AUTHORIZED_DOMAIN_ALREADY_EXISTS_MESSAGE,
  AUTHORIZED_DOMAIN_NOT_FOUND_MESSAGE,
  INVALID_ORIGIN_MESSAGE,
  NO_PERMISSION_MESSAGE,
} from './messages';
import { ORIGIN_WITH_PATH_MESSAGE, ORIGIN_WITHOUT_SCHEME_MESSAGE, EMPTY_ORIGIN_MESSAGE } from './origin';
import {
  PORTAL_API_KEY,
  APP_AUTHORIZED_DOMAIN,
  LOCAL_AUTHORIZED_DOMAIN,
  AUTHORIZED_DOMAINS,
  setCsrfCookie,
  localIso,
  json,
  problem,
  renderIntegration,
  pendingResponse,
  noContent,
  simulateApi,
  type SimulatedApi,
} from './integration.test-support';

let api: SimulatedApi;

const LIST_ROUTE = 'GET /v1/authorized-domains';
const CREATE_ROUTE = 'POST /v1/authorized-domains';
const DELETE_ROUTE = `DELETE /v1/authorized-domains/${APP_AUTHORIZED_DOMAIN.id}`;
const NEW = { id: '40000000-0000-0000-0000-000000000009', origin: 'https://portal.cliente.com.br:8443', created_at: localIso(2026, 11, 16) };

beforeEach(() => {
  api = simulateApi();
  setCsrfCookie('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderScreen() {
  return renderIntegration(<AuthorizedDomains />);
}

function rowOf(text: string): HTMLElement {
  return screen.getByText(text).closest('tr')!;
}

describe('Integração: tela inteira', () => {
  it('mostra as chaves de API e os domínios autorizados, cada seção com a sua ação', async () => {
    api.respond('GET /v1/api-keys', json({ items: [PORTAL_API_KEY], next_cursor: null }));
    api.respond(LIST_ROUTE, json({ items: AUTHORIZED_DOMAINS }));
    renderIntegration(<Integration />);

    expect(await screen.findByText('Portal do cliente')).toBeInTheDocument();
    expect(await screen.findByText('https://app.exemplo.com.br')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((title) => title.textContent)).toEqual([
      'Chaves de API',
      'Domínios autorizados',
    ]);
    expect(screen.getByRole('region', { name: 'Chaves de API' })).toContainElement(
      screen.getByRole('button', { name: 'Nova chave de API' }),
    );
    expect(screen.getByRole('region', { name: 'Domínios autorizados' })).toContainElement(
      screen.getByRole('button', { name: 'Novo domínio' }),
    );
  });
});

describe('Integração: lista de domínios autorizados', () => {
  it('mostra a origem e quando foi cadastrada', async () => {
    api.respond(LIST_ROUTE, json({ items: AUTHORIZED_DOMAINS }));
    renderScreen();

    expect(await screen.findByText('https://app.exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('2 domínios')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Origem',
      'Cadastrado',
      'Ações',
    ]);
    expect(within(rowOf('https://app.exemplo.com.br')).getByText('03/11/2026')).toBeInTheDocument();
    expect(within(rowOf('http://localhost:5274')).getByText('14/11/2026')).toBeInTheDocument();
  });

  it('enquanto carrega, mostra o esqueleto e anuncia', async () => {
    const pending = pendingResponse(() => json({ items: [APP_AUTHORIZED_DOMAIN] }));
    api.respond(LIST_ROUTE, pending.promise);
    renderScreen();

    expect(screen.getByRole('table', { name: 'Domínios autorizados do tenant' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando domínios autorizados do tenant');

    pending.release();
    expect(await screen.findByText('1 domínio')).toBeInTheDocument();
  });

  it('vazio: diz o que falta e oferece cadastrar', async () => {
    api.respond(LIST_ROUTE, json({ items: [] }));
    const { user } = renderScreen();

    expect(await screen.findByText('Nenhum domínio autorizado ainda')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Novo domínio' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);
    expect(await screen.findByRole('dialog', { name: 'Novo domínio' })).toBeInTheDocument();
  });

  it('erro ao carregar: explica e deixa tentar de novo', async () => {
    api.respond(LIST_ROUTE, problem(503, 'unavailable'), json({ items: [APP_AUTHORIZED_DOMAIN] }));
    const { user } = renderScreen();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os domínios autorizados');
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('https://app.exemplo.com.br')).toBeInTheDocument();
  });

  it('sem permissão: explica e não oferece tentar de novo', async () => {
    api.respond(LIST_ROUTE, problem(403, 'no_permission'));
    renderScreen();

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});

async function openNew(user: UserEvent) {
  await screen.findByText('https://app.exemplo.com.br');
  await user.click(screen.getByRole('button', { name: 'Novo domínio' }));
  return screen.findByRole('dialog', { name: 'Novo domínio' });
}

async function saveOrigin(user: UserEvent, panel: HTMLElement, origin: string) {
  const field = within(panel).getByRole('textbox', { name: 'Origem' });
  await user.clear(field);
  if (origin) await user.type(field, origin);
  await user.click(within(panel).getByRole('button', { name: 'Salvar' }));
  return field;
}

describe('Integração: novo domínio', () => {
  beforeEach(() => {
    api.respond(LIST_ROUTE, json({ items: AUTHORIZED_DOMAINS }));
  });

  it.each([
    ['', EMPTY_ORIGIN_MESSAGE],
    ['app.exemplo.com.br', ORIGIN_WITHOUT_SCHEME_MESSAGE],
    ['ftp://app.exemplo.com.br', ORIGIN_WITHOUT_SCHEME_MESSAGE],
    ['https://app.exemplo.com.br/painel', ORIGIN_WITH_PATH_MESSAGE],
    ['https://app.exemplo.com.br?a=1', ORIGIN_WITH_PATH_MESSAGE],
  ])('valida a origem no cliente: "%s"', async (origin, message) => {
    const { user } = renderScreen();
    const panel = await openNew(user);

    const field = await saveOrigin(user, panel, origin);

    expect(await within(panel).findByText(message)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(0);
  });

  it('cadastra a origem, fecha, atualiza a lista e devolve o foco ao "Novo domínio"', async () => {
    api.respond(CREATE_ROUTE, json(NEW, 201));
    const { user } = renderScreen();
    const panel = await openNew(user);
    expect(within(panel).getByRole('textbox', { name: 'Origem' })).toHaveFocus();
    expect(within(panel).getByRole('textbox', { name: 'Origem' })).toHaveAccessibleDescription(
      'Esquema, host e, se precisar, a porta. Sem caminho no fim.',
    );
    api.respond(LIST_ROUTE, json({ items: [...AUTHORIZED_DOMAINS, NEW] }));

    await saveOrigin(user, panel, '  HTTPS://Portal.Cliente.com.br:8443/  ');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.callsTo(CREATE_ROUTE);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({ origin: 'HTTPS://Portal.Cliente.com.br:8443/' });
    // A lista mostra a origem como a API a guardou (normalizada).
    expect(await screen.findByText('https://portal.cliente.com.br:8443')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo domínio' })).toHaveFocus());
  });

  it('invalid_origin da API: mostra o erro no campo', async () => {
    api.respond(CREATE_ROUTE, problem(422, 'invalid_origin', { fields: { origin: 'Texto do servidor.' } }));
    const { user } = renderScreen();
    const panel = await openNew(user);

    const field = await saveOrigin(user, panel, 'https://app..exemplo');

    expect(await within(panel).findByText(INVALID_ORIGIN_MESSAGE)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog', { name: 'Novo domínio' })).toBeInTheDocument();
  });

  it('authorized_domain_already_exists: mostra o erro no campo e atualiza a lista', async () => {
    api.respond(CREATE_ROUTE, problem(409, 'authorized_domain_already_exists'));
    const { user } = renderScreen();
    const panel = await openNew(user);

    await saveOrigin(user, panel, 'https://APP.exemplo.com.br');

    expect(await within(panel).findByText(AUTHORIZED_DOMAIN_ALREADY_EXISTS_MESSAGE)).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo(LIST_ROUTE)).toHaveLength(2));
  });

  it('enquanto salva, o botão fica ocupado e não cadastra duas vezes', async () => {
    const pending = pendingResponse(() => json(NEW, 201));
    api.respond(CREATE_ROUTE, pending.promise);
    const { user } = renderScreen();
    const panel = await openNew(user);

    await saveOrigin(user, panel, NEW.origin);
    const save = within(panel).getByRole('button', { name: 'Salvar' });
    await waitFor(() => expect(save).toHaveAttribute('aria-busy', 'true'));
    await user.click(save);
    expect(api.callsTo(CREATE_ROUTE)).toHaveLength(1);

    pending.release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sem permissão: explica numa nota', async () => {
    api.respond(CREATE_ROUTE, problem(403, 'no_permission'));
    const { user } = renderScreen();
    const panel = await openNew(user);

    await saveOrigin(user, panel, NEW.origin);
    expect(await within(panel).findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
  });
});

async function openDelete(user: UserEvent, origin = 'https://app.exemplo.com.br') {
  await screen.findByText(origin);
  await user.click(screen.getByRole('button', { name: `Mais ações para ${origin}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Remover domínio' }));
  return screen.findByRole('dialog', { name: 'Remover domínio' });
}

describe('Integração: remover domínio', () => {
  beforeEach(() => {
    api.respond(LIST_ROUTE, json({ items: AUTHORIZED_DOMAINS }));
  });

  it('pede confirmação e cancelar não remove; o foco volta ao "…" da linha', async () => {
    const { user } = renderScreen();
    const panel = await openDelete(user);

    expect(panel).toHaveAccessibleDescription(
      'https://app.exemplo.com.br deixa de poder chamar a API com o token deste tenant: o módulo incorporado nessa origem para de funcionar.',
    );
    expect(within(panel).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(DELETE_ROUTE)).toHaveLength(0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para https://app.exemplo.com.br' })).toHaveFocus());
  });

  it('remove com CSRF, fecha, atualiza a lista e, sem a linha, devolve o foco ao "Novo domínio"', async () => {
    api.respond(DELETE_ROUTE, noContent());
    const { user } = renderScreen();
    const panel = await openDelete(user);
    api.respond(LIST_ROUTE, json({ items: [LOCAL_AUTHORIZED_DOMAIN] }));

    await user.click(within(panel).getByRole('button', { name: 'Remover domínio' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.callsTo(DELETE_ROUTE)[0]!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    await waitFor(() => expect(screen.queryByText('https://app.exemplo.com.br')).not.toBeInTheDocument());
    expect(screen.getByText('1 domínio')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo domínio' })).toHaveFocus());
  });

  it('not_found: explica, não oferece remover de novo e atualiza a lista', async () => {
    api.respond(DELETE_ROUTE, problem(404, 'not_found'));
    const { user } = renderScreen();
    const panel = await openDelete(user);

    await user.click(within(panel).getByRole('button', { name: 'Remover domínio' }));

    expect(await within(panel).findByRole('alert')).toHaveTextContent(AUTHORIZED_DOMAIN_NOT_FOUND_MESSAGE);
    const deleteButton = within(panel).getByRole('button', { name: 'Remover domínio' });
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    expect(deleteButton).toHaveAccessibleDescription(DELETE_NOT_FOUND_REASON);
    await waitFor(() => expect(api.callsTo(LIST_ROUTE)).toHaveLength(2));
  });

  it('erro passageiro: mostra a mensagem e deixa remover de novo', async () => {
    api.respond(DELETE_ROUTE, problem(503, 'unavailable'), noContent());
    const { user } = renderScreen();
    const panel = await openDelete(user);

    await user.click(within(panel).getByRole('button', { name: 'Remover domínio' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Texto do servidor para unavailable.');
    await user.click(within(panel).getByRole('button', { name: 'Remover domínio' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
