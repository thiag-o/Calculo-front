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

// The real <FluxoCalculo> screens (SCREENS): Início, Auditoria and the Administração section (Usuários, Papéis, Integração and
// Segurança), each with its own permission. In the shell, the section has one item per area in the sidebar; in embedded
// mode, it is a single tab. In both, each area opens <Admin>, with the internal tabs bound to the routes.

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
    'GET /v1/users': json({ items: [], next_cursor: null }),
    'GET /v1/roles': json([]),
    'GET /v1/api-keys': json({ items: [], next_cursor: null }),
    'GET /v1/authorized-domains': json([]),
    'GET /v1/audit/access-events': json({ items: [], next_cursor: null }),
  });
}

function renderScreen(props: Partial<FluxoCalculoProps> = {}) {
  const user = userEvent.setup();
  render(<FluxoCalculo apiUrl={API} {...props} />);
  return { user };
}

const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const adminSection = () => within(mainNavigation()).queryByRole('group', { name: 'Administração' });
const tabs = () => screen.getByRole('navigation', { name: 'Telas do Fluxo de Cálculo' });
const names = (elements: HTMLElement[]) => elements.map((element) => element.textContent);
const adminTabs = () => screen.getByRole('tablist', { name: 'Administração' });
const adminTabNames = () => names(within(adminTabs()).getAllByRole('tab'));
const initiallyOpen = () => screen.findByRole('heading', { level: 1, name: 'Início' });

describe('telas por papel no casca', () => {
  it('o Admin vê Início e Auditoria, e Usuários, Papéis, Integração e Segurança na seção Administração', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ navigation: 'memory' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual([
      'Início',
      'Auditoria',
      'Usuários',
      'Papéis',
      'Integração',
      'Segurança',
    ]);
    const section = adminSection() as HTMLElement;
    expect(section).toBeInTheDocument();
    expect(names(within(section).getAllByRole('link'))).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(within(section).queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('o Configurador não vê Administração nem Auditoria, e as rotas delas não abrem', async () => {
    window.history.replaceState(null, '', '/admin/users');
    const api = simulateApiWith(CONFIGURATOR_PERMISSIONS);
    renderScreen({ navigation: 'url' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual(['Início']);
    expect(adminSection()).not.toBeInTheDocument();
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/home'));
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(api.calls()).not.toContain('GET /v1/users');
  });

  it('o Auditor vê Auditoria e abre os acessos; não vê Administração', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'memory' });

    await initiallyOpen();
    expect(names(within(mainNavigation()).getAllByRole('link'))).toEqual(['Início', 'Auditoria']);
    expect(adminSection()).not.toBeInTheDocument();

    await user.click(within(mainNavigation()).getByRole('link', { name: 'Auditoria' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
  });

  it('cada área da Administração depende só da sua permissão', async () => {
    simulateApiWith(['integration.manage', 'security.manage']);
    renderScreen({ navigation: 'memory' });

    await initiallyOpen();
    expect(names(within(adminSection() as HTMLElement).getAllByRole('link'))).toEqual(['Integração', 'Segurança']);
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Papéis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('os itens da Administração abrem as telas delas, nas rotas /admin/…', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await initiallyOpen();
    const section = adminSection() as HTMLElement;

    await user.click(within(section).getByRole('link', { name: 'Usuários' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/users');
    expect(within(section).getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(section).getByRole('link', { name: 'Papéis' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/roles');

    await user.click(within(section).getByRole('link', { name: 'Integração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/integration');

    await user.click(within(section).getByRole('link', { name: 'Segurança' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/security');

    await waitFor(() => expect(api.calls()).toContain('GET /v1/settings/security'));
  });

  it('no endereço de uma área da Administração, abre direto nela', async () => {
    window.history.replaceState(null, '', '/admin/roles');
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen();

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Papéis' })).toHaveAttribute('aria-current', 'page');
  });

  it('cada área abre a Administração com as abas internas, que andam junto com o menu e o endereço', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await initiallyOpen();
    const section = adminSection() as HTMLElement;

    await user.click(within(section).getByRole('link', { name: 'Usuários' }));
    expect(await screen.findByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    expect(adminTabNames()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);

    await user.click(screen.getByRole('tab', { name: 'Segurança' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/admin/security');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
    expect(within(section).getByRole('link', { name: 'Segurança' })).toHaveAttribute('aria-current', 'page');
    expect(within(section).getByRole('link', { name: 'Usuários' })).not.toHaveAttribute('aria-current');
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

  it('com o menu só de ícones, o rótulo da seção sai da vista, mas o grupo continua com o nome', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ navigation: 'memory' });
    await initiallyOpen();

    simulateWidth(1024);
    await waitFor(() => expect(document.querySelector('.fc-shell')).toHaveClass('fc-shell-compact'));
    // The CSS hides `.fc-sidebar-section-label` in compact mode; jsdom does not apply the CSS.
    expect(adminSection()).toBeInTheDocument();
    expect(screen.getByText('Administração')).toHaveClass('fc-sidebar-section-label');
  });
});

describe('a propriedade tela', () => {
  it('abre direto na Segurança, para o Admin', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ navigation: 'memory', screen: 'security' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Segurança' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre direto numa área da Administração, no modo incorporado', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'roles' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(within(tabs()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');
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
    expect(within(tabs()).getByRole('link', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
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
  it('o Admin tem as abas Início, Auditoria e Administração, os mesmos itens do menu', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const { user } = renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('link'))).toEqual(['Início', 'Auditoria', 'Administração']);

    await user.click(within(tabs()).getByRole('link', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(within(tabs()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');
    expect(adminTabNames()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Integração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Domínios autorizados' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    // The module tab stays active on any Admin area.
    expect(within(tabs()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');

    await user.click(within(tabs()).getByRole('link', { name: 'Auditoria' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
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
    expect(within(tabs()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');
  });

  it('o Configurador só tem a aba Início, sem Administração', async () => {
    simulateApiWith(CONFIGURATOR_PERMISSIONS);
    renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('link'))).toEqual(['Início']);
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
  });

  it('o Auditor tem Início e Auditoria', async () => {
    simulateApiWith(AUDITOR_PERMISSIONS);
    renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('link'))).toEqual(['Início', 'Auditoria']);
  });

  it('as abas internas da Administração seguem a permissão de cada área', async () => {
    simulateApiWith(['users.manage', 'roles.manage']);
    const { user } = renderScreen({ token: 'token' });

    await initiallyOpen();
    expect(names(within(tabs()).getAllByRole('link'))).toEqual(['Início', 'Administração']);

    await user.click(within(tabs()).getByRole('link', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(adminTabNames()).toEqual(['Usuários', 'Papéis']);
  });

  it('com uma área só, a aba Administração abre nela', async () => {
    simulateApiWith(['security.manage']);
    const { user } = renderScreen({ token: 'token' });

    await initiallyOpen();
    await user.click(within(tabs()).getByRole('link', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(adminTabNames()).toEqual(['Segurança']);
  });
});
