import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Admin, Audit, Home } from '..';
import {
  API,
  json,
  ADMIN_PERMISSIONS,
  CONFIGURATOR_PERMISSIONS,
  problem,
  pendingResponse,
  sessionWith,
  simulateApi,
  simulateWidth,
} from '../module.test-support';

// The standalone screens (F38): each one mounts its own root, API and cache, with only `apiUrl` (cookie) or with `token`,
// and navigates in memory. Tested through the vertical's public interface, as the host app uses them.

const HOST_APP_URL = '/sistema-do-cliente/painel?aba=3#topo';

beforeEach(() => {
  window.history.replaceState(null, '', HOST_APP_URL);
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The API with the given session and empty lists on the epic 2 screens. */
function simulateApiWith(permissions: string[]) {
  return simulateApi({
    'GET /v1/sessao': json(sessionWith(permissions)),
    'GET /v1/usuarios': json({ itens: [], proximo_cursor: null }),
    'GET /v1/papeis': json({ itens: [] }),
    'GET /v1/chaves-api': json({ itens: [], proximo_cursor: null }),
    'GET /v1/dominios-autorizados': json([]),
    'GET /v1/auditoria/acessos': json({ itens: [], proximo_cursor: null }),
  });
}

const pageUrl = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const withoutModuleNavigation = () => {
  expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Telas do Fluxo de Cálculo' })).not.toBeInTheDocument();
};
/** The module root around an element. */
const rootOf = (element: HTMLElement) => element.closest('.fc-root');

describe('<Home> avulso', () => {
  it('só com apiUrl, usa o cookie, aplica o tema e mostra a tela sem menu nem abas do módulo', async () => {
    const api = simulateApiWith([]);
    render(<Home apiUrl={API} theme="dark" />);

    const title = await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(rootOf(title)).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('region', { name: 'Início' })).toContainElement(title);
    withoutModuleNavigation();

    expect(api.calls()).toEqual(['GET /v1/sessao']);
    expect(api.request(0).credentials).toBe('include');
    expect(api.request(0).headers.get('Authorization')).toBeNull();
    expect(pageUrl()).toBe(HOST_APP_URL);
  });

  it('com token, chama a API com Bearer e sem cookie', async () => {
    const api = simulateApiWith([]);
    render(<Home apiUrl={API} token="token-do-hospedeiro" theme="light" />);

    const title = await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(rootOf(title)).toHaveAttribute('data-theme', 'light');
    expect(api.request(0).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
    expect(api.request(0).credentials).toBe('omit');
  });

  it('enquanto a sessão chega, mostra o esqueleto com o nome da tela', async () => {
    const pending = pendingResponse();
    simulateApi({ 'GET /v1/sessao': pending.promise });
    render(<Home apiUrl={API} token="token" />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Início');
    await act(async () => pending.deliver(json(sessionWith([]))));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('se a sessão não abre, diz o que houve e tenta de novo', async () => {
    const api = simulateApi({ 'GET /v1/sessao': problem(403, 'origem_nao_autorizada') });
    const user = userEvent.setup();
    render(<Home apiUrl={API} token="token" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível abrir o Início');
    expect(alert).toHaveTextContent('Texto do servidor para origem_nao_autorizada.');

    api.set({ 'GET /v1/sessao': json(sessionWith([])) });
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('sem sessão (401 sem_sessao), avisa o onSessionExpired uma vez e mostra a sessão encerrada', async () => {
    simulateApi({ 'GET /v1/sessao': problem(401, 'sem_sessao') });
    const onSessionExpired = vi.fn();
    render(<Home apiUrl={API} token="token-vencido" onSessionExpired={onSessionExpired} />);

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Início' })).not.toBeInTheDocument();
  });
});

describe('<Audit> avulsa', () => {
  it('só com apiUrl, usa o cookie e abre os acessos; a lista de tipos abre no portal da raiz, com o tema', async () => {
    const api = simulateApiWith(['auditoria.ver']);
    const user = userEvent.setup();
    render(<Audit apiUrl={API} theme="dark" />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    withoutModuleNavigation();
    expect(api.calls()).toContain('GET /v1/auditoria/acessos');
    for (const index of api.calls().keys()) {
      expect(api.request(index).credentials).toBe('include');
      expect(api.request(index).headers.get('Authorization')).toBeNull();
    }

    await user.click(screen.getByRole('combobox', { name: 'Tipo de evento' }));
    const list = await screen.findByRole('listbox');
    expect(list.closest('.fc-portals')).not.toBeNull();
    expect(rootOf(list)).toHaveAttribute('data-theme', 'dark');
  });

  it('com token, chama a API com Bearer', async () => {
    const api = simulateApiWith(['auditoria.ver']);
    render(<Audit apiUrl={API} token="token-do-hospedeiro" />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(api.calls()).toContain('GET /v1/auditoria/acessos');
    for (const index of api.calls().keys()) {
      expect(api.request(index).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
    }
  });

  it('sem auditoria.ver, mostra o estado sem acesso e não busca os eventos', async () => {
    const api = simulateApiWith(CONFIGURATOR_PERMISSIONS);
    render(<Audit apiUrl={API} token="token" />);

    expect(await screen.findByText('Você não tem acesso à Auditoria')).toBeInTheDocument();
    expect(screen.getByText('Peça ao administrador do cliente as permissões de que precisa.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acessos' })).not.toBeInTheDocument();
    expect(api.calls()).toEqual(['GET /v1/sessao']);
  });
});

describe('<Admin> avulsa', () => {
  it('só com apiUrl, usa o cookie; as abas trocam a área sem mexer na URL da página', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const user = userEvent.setup();
    const historyBefore = window.history.length;
    render(<Admin apiUrl={API} />);

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Usuários',
      'Papéis',
      'Integração',
      'Segurança',
    ]);
    expect(within(tabs).getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    withoutModuleNavigation();

    await user.click(within(tabs).getByRole('tab', { name: 'Integração' }));
    expect(within(tabs).getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(pageUrl()).toBe(HOST_APP_URL);
    expect(window.history.length).toBe(historyBefore);

    for (const index of api.calls().keys()) {
      expect(api.request(index).credentials).toBe('include');
      expect(api.request(index).headers.get('Authorization')).toBeNull();
    }
  });

  it('com token e tema, o diálogo abre no portal da raiz do módulo, com o tema', async () => {
    const api = simulateApiWith(ADMIN_PERMISSIONS);
    const user = userEvent.setup();
    render(<Admin apiUrl={API} token="token-do-hospedeiro" theme="dark" />);

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    const [newUser] = await screen.findAllByRole('button', { name: 'Novo usuário' });
    await user.click(newUser as HTMLElement);

    const dialog = await screen.findByRole('dialog', { name: 'Novo usuário' });
    expect(dialog.closest('.fc-portals')).not.toBeNull();
    expect(rootOf(dialog)).toHaveAttribute('data-theme', 'dark');
    // The portal sits in this screen's root, not in the host app body.
    expect(rootOf(dialog)).toBe(rootOf(tabs));
    expect(within(dialog).getByRole('textbox', { name: 'E-mail' })).toBeInTheDocument();

    for (const index of api.calls().keys()) {
      expect(api.request(index).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
      expect(api.request(index).credentials).toBe('omit');
    }
  });

  it('mostra só as áreas permitidas', async () => {
    simulateApiWith(['papeis.gerenciar', 'seguranca.gerenciar']);
    render(<Admin apiUrl={API} token="token" />);

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Papéis', 'Segurança']);
  });

  it('sem nenhuma área permitida, mostra o estado sem acesso', async () => {
    const api = simulateApiWith(CONFIGURATOR_PERMISSIONS);
    render(<Admin apiUrl={API} token="token" />);

    expect(await screen.findByText('Você não tem acesso à Administração')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(api.calls()).toEqual(['GET /v1/sessao']);
  });

  it('dentro de um hospedeiro com react-router, monta e não mexe no roteador dele', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    const user = userEvent.setup();
    function HostAppLocation() {
      const local = useLocation();
      return <p>Hospedeiro em {local.pathname}</p>;
    }
    render(
      <MemoryRouter initialEntries={['/configuracoes/fluxo']}>
        <HostAppLocation />
        <Routes>
          <Route path="/configuracoes/*" element={<Admin apiUrl={API} token="token" />} />
        </Routes>
      </MemoryRouter>,
    );

    const tabs = await screen.findByRole('tablist', { name: 'Administração' });
    await user.click(within(tabs).getByRole('tab', { name: 'Papéis' }));
    expect(within(tabs).getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Hospedeiro em /configuracoes/fluxo')).toBeInTheDocument();
  });
});

describe('várias telas avulsas na mesma página', () => {
  it('cada uma tem a sua raiz, com o seu tema', async () => {
    simulateApiWith(ADMIN_PERMISSIONS);
    render(
      <>
        <Home apiUrl={API} token="token" theme="light" />
        <Audit apiUrl={API} token="token" theme="dark" />
      </>,
    );

    const homeHeading = await screen.findByRole('heading', { level: 1, name: 'Início' });
    const accessEvents = await screen.findByRole('heading', { level: 2, name: 'Acessos' });
    expect(rootOf(homeHeading)).toHaveAttribute('data-theme', 'light');
    expect(rootOf(accessEvents)).toHaveAttribute('data-theme', 'dark');
    expect(rootOf(homeHeading)).not.toBe(rootOf(accessEvents));
  });
});
