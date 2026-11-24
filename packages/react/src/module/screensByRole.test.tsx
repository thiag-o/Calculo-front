import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoCalculo, type FluxoCalculoProps } from '.';
import {
  API,
  json,
  ADMIN_PERMISSIONS,
  AUDITOR_PERMISSIONS,
  CONFIGURATOR_PERMISSIONS,
  sessionWith,
  simulateApi,
  simulateWidth,
} from './module.test-support';

// The real <FluxoCalculo> screens (SCREENS): Início, Catálogo, Workflows, Execuções, Auditoria and the Administração section (Usuários, Papéis, Integração and
// Segurança), each with its own permission. The section is a single item in the sidebar (shell) and a single tab (embedded
// mode). In both, it opens <Admin>, with the internal tabs bound to the routes.

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The API with the given session and empty lists on the epic 2 screens. */
function simulateApiWith(permissions: string[]) {
  return simulateApi({
    'GET /v1/session': json(sessionWith(permissions)),
    'GET /v1/workflows': json({ items: [], next_cursor: null }),
    'GET /v1/users': json({ items: [], next_cursor: null }),
    'GET /v1/roles': json([]),
    'GET /v1/api-keys': json({ items: [], next_cursor: null }),
    'GET /v1/authorized-domains': json([]),
    'GET /v1/audit/access-events': json({ items: [], next_cursor: null }),
  });
}

function renderScreen(props: Partial<FluxoCalculoProps> = {}) {
  const user = userEvent.setup({ delay: null });
  render(<FluxoCalculo apiUrl={API} {...props} />);
  return { user };
}

const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const adminItem = () => within(mainNavigation()).queryByRole('link', { name: 'Administração' });
const tabs = () => screen.getByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });
const names = (elements: HTMLElement[]) => elements.map((element) => element.textContent);
const adminTabs = () => screen.getByRole('tablist', { name: 'Administração' });
const adminTabNames = () => names(within(adminTabs()).getAllByRole('tab'));
const initiallyOpen = () => screen.findByRole('heading', { level: 1, name: 'Início' });

describe('telas por papel no casca', () => {
  it('o Admin vê Início, Catálogo, Workflows, Execuções, Auditoria e um item Administração; as áreas ficam só nas abas internas', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ navigation: 'memory' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual(['Início', 'Catálogo', 'Workflows', 'Execuções', 'Auditoria', 'Administração']);
    for (const area of ['Usuários', 'Papéis', 'Integração', 'Segurança']) {
      expect(within(mainNavigation()).queryByRole('link', { name: area })).not.toBeInTheDocument();
    }
    expect(within(mainNavigation()).queryByRole('group')).not.toBeInTheDocument();
  });

  it('o Configurador não vê Administração nem Auditoria, e as rotas delas não abrem', async () => {
    window.history.replaceState(null, '', '/admin/users');
    const api = simulateApiWith(CONFIGURATOR_PERMISSIONS);
    renderScreen({ navigation: 'url' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual(['Início', 'Catálogo', 'Workflows', 'Execuções']);
    expect(adminItem()).not.toBeInTheDocument();
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(api.calls()).not.toContain('GET /v1/users');
  });

  it('o Auditor vê Auditoria e abre os acessos, com o título da tela; não vê Administração', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'memory' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual(['Início', 'Catálogo', 'Workflows', 'Execuções', 'Auditoria']);
    expect(adminItem()).not.toBeInTheDocument();

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Auditoria' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
  });

  it('cada área da Administração depende só da sua permissão', async () => {
    simulateApiWith(['integration.manage', 'security.manage']);
    const { user } = renderScreen({ navigation: 'memory' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual(['Início', 'Administração']);

    await user.click(adminItem() as HTMLElement);
    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(adminTabNames()).toEqual(['Integração', 'Segurança']);
    expect(screen.queryByRole('tab', { name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('o item Administração abre a primeira área, com o título da tela, e as abas internas levam às rotas /admin/…', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await initiallyOpen();

    await user.click(adminItem() as HTMLElement);
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Administração' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/admin/users'));
    expect(adminItem()).toHaveAttribute('aria-current', 'page');
    expect(adminTabNames()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/roles');

    await user.click(screen.getByRole('tab', { name: 'Integração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/integration');

    await user.click(screen.getByRole('tab', { name: 'Segurança' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/security');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
    // The sidebar item stays active on any Admin area.
    expect(adminItem()).toHaveAttribute('aria-current', 'page');

    await waitFor(() => expect(api.calls()).toContain('GET /v1/settings/security'));
  });

  it('cada troca de aba entra uma vez só no histórico, e o voltar do navegador volta à área anterior', async () => {
    window.history.replaceState(null, '', '/admin/users');
    simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen();
    await screen.findByRole('heading', { level: 2, name: 'Usuários' });
    const before = window.history.length;

    await user.click(screen.getByRole('tab', { name: 'Papéis' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(window.history.length).toBe(before + 1);

    window.history.back();
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
  });

  it('no endereço de uma área da Administração, abre direto nela', async () => {
    window.history.replaceState(null, '', '/admin/roles');
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen();

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(adminItem()).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
  });

  it('pelo teclado, as abas internas trocam a área e o foco continua nelas', async () => {
    window.history.replaceState(null, '', '/admin/users');
    simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen();
    const users = await screen.findByRole('tab', { name: 'Usuários' });

    users.focus();
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/roles');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveFocus();

    await user.keyboard('{End}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();
  });

  it('o endereço da seção abre a primeira área permitida', async () => {
    window.history.replaceState(null, '', '/admin');
    simulateApiWith(['roles.manage', 'security.manage']);
    renderScreen();

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/admin/roles'));
    expect(adminTabNames()).toEqual(['Papéis', 'Segurança']);
  });

  it('com o menu só de ícones, o item Administração mostra o nome na dica e o mantém no link', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'memory' });
    await initiallyOpen();

    simulateWidth(1024);
    await waitFor(() => expect(document.querySelector('.fc-shell')).toHaveClass('fc-shell-compact'));
    const item = adminItem() as HTMLElement;
    expect(item).toBeInTheDocument();
    await user.hover(item);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Administração');
  });
});

describe('a propriedade tela', () => {
  it('abre direto na Segurança, para o Admin', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ navigation: 'memory', screen: 'security' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(adminItem()).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre direto numa área da Administração, no modo incorporado', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'roles' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(within(tabs()).getByRole('tab', { name: 'Administração' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
  });

  it('administracao abre a primeira área permitida', async () => {
    simulateApiWith(['integration.manage', 'security.manage']);
    renderScreen({ token: 'token', screen: 'admin' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre direto na Auditoria, para o Auditor', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'audit' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(within(tabs()).getByRole('tab', { name: 'Auditoria' })).toHaveAttribute('aria-selected', 'true');
  });

  it('numa área sem permissão, abre a primeira tela permitida', async () => {
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'users' });

    await initiallyOpen();
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('na Administração sem nenhuma área permitida, abre a primeira tela permitida', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'admin' });

    await initiallyOpen();
    expect(screen.queryByRole('tablist', { name: 'Administração' })).not.toBeInTheDocument();
  });
});

describe('abas do modo incorporado', () => {
  it('o Admin tem as abas Início, Catálogo, Workflows, Execuções, Auditoria e Administração, os mesmos itens do menu', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('tab'))).toEqual(['Início', 'Catálogo', 'Workflows', 'Execuções', 'Auditoria', 'Administração']);

    await user.click(within(tabs()).getByRole('tab', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Administração' })).toBeInTheDocument();
    expect(within(tabs()).getByRole('tab', { name: 'Administração' })).toHaveAttribute('aria-selected', 'true');
    expect(adminTabNames()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Integração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Domínios autorizados' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    // The module tab stays open on any Admin area.
    expect(within(tabs()).getByRole('tab', { name: 'Administração' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tabs()).getByRole('tab', { name: 'Auditoria' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Administração' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.calls()).toContain('GET /v1/audit/access-events'));
  });

  it('pelo teclado, as abas internas da Administração trocam a área e o foco continua nelas', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ token: 'token', screen: 'admin' });
    const users = await screen.findByRole('tab', { name: 'Usuários' });

    users.focus();
    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();
    expect(within(tabs()).getByRole('tab', { name: 'Administração' })).toHaveAttribute('aria-selected', 'true');
  });

  it('o Configurador só tem a aba Início, sem Administração', async () => {
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('tab'))).toEqual(['Início', 'Catálogo', 'Workflows', 'Execuções']);
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
  });

  it('o Auditor tem Início e Auditoria', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('tab'))).toEqual(['Início', 'Catálogo', 'Workflows', 'Execuções', 'Auditoria']);
  });

  it('as abas internas da Administração seguem a permissão de cada área', async () => {
    simulateApiWith(['users.manage', 'roles.manage']);
    const { user } = renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('tab'))).toEqual(['Início', 'Administração']);

    await user.click(within(tabs()).getByRole('tab', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(adminTabNames()).toEqual(['Usuários', 'Papéis']);
  });

  it('com uma área só, a aba Administração abre nela', async () => {
    simulateApiWith(['security.manage']);
    const { user } = renderScreen({ token: 'token' });

    await initiallyOpen();
    await user.click(within(tabs()).getByRole('tab', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(adminTabNames()).toEqual(['Segurança']);
  });
});
