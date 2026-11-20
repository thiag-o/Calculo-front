import '@testing-library/jest-dom/vitest';
import { focusManager } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoCalculo } from '.';
import { FluxoModule, type FluxoModuleProps } from './FluxoCalculo';
import {
  API,
  json,
  problem,
  pendingResponse,
  branchSession,
  headquartersSession,
  simulateApi,
  simulateWidth,
  testScreens,
} from './module.test-support';

const HOST_APP_URL = '/sistema-do-cliente/relatorios?aba=2#topo';

beforeEach(() => {
  window.history.replaceState(null, '', HOST_APP_URL);
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderModule(props: Partial<FluxoModuleProps> = {}) {
  const onSessionExpired = vi.fn();
  const user = userEvent.setup({ delay: null });
  const view = render(<FluxoModule apiUrl={API} screens={testScreens} onSessionExpired={onSessionExpired} {...props} />);
  return { user, onSessionExpired, ...view };
}

const sidebar = () => screen.queryByRole('complementary', { name: 'Menu lateral' });
const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const tabs = () => screen.queryByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });

describe('<FluxoCalculo>', () => {
  it('no casca (sem token), monta a raiz com o tema, chama a API com o cookie e abre o Início com o menu lateral', async () => {
    const api = simulateApi({ 'GET /v1/session': json(headquartersSession) });
    const { container } = render(<FluxoCalculo apiUrl={API} theme="dark" navigation="memory" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(container.querySelector('.fc-root')).toHaveAttribute('data-theme', 'dark');
    expect(sidebar()).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' })).toBeInTheDocument();

    expect(api.calls()).toEqual(['GET /v1/session']);
    expect(api.request(0).credentials).toBe('include');
    expect(api.request(0).headers.get('Authorization')).toBeNull();
  });

  it('enquanto a sessão chega, mostra o esqueleto de carregamento', async () => {
    const pending = pendingResponse();
    simulateApi({ 'GET /v1/session': pending.promise });
    renderModule({ navigation: 'memory' });

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Fluxo de Cálculo');
    expect(sidebar()).not.toBeInTheDocument();

    await act(async () => pending.deliver(json(headquartersSession)));
    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se a sessão não carrega por falha passageira, diz o que houve e tenta de novo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = simulateApi({ 'GET /v1/session': problem(503, 'unavailable') });
    const { user, onSessionExpired } = renderModule({ navigation: 'memory' });

    // 5xx is retried by the product QueryClient before becoming an error (up to 3 times, with growing wait).
    await act(() => vi.advanceTimersByTimeAsync(10000));
    vi.useRealTimers();
    const alert = await screen.findByRole('alert');
    expect(api.calls()).toEqual(Array(4).fill('GET /v1/session'));
    expect(alert).toHaveTextContent('Não foi possível abrir o Fluxo de Cálculo');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');
    expect(onSessionExpired).not.toHaveBeenCalled();

    api.set({ 'GET /v1/session': json(headquartersSession) });
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
  });

  it('sem sessão (401 no_session), avisa o onSessionExpired uma vez e não mostra o módulo', async () => {
    const api = simulateApi({ 'GET /v1/session': problem(401, 'no_session') });
    const { onSessionExpired } = renderModule({ navigation: 'memory' });

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(screen.getByText('Entre de novo para continuar.')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(sidebar()).not.toBeInTheDocument();
    // 4xx is not retried, and nothing fetches the session again after it ended.
    expect(api.calls()).toEqual(['GET /v1/session']);
  });

  it('incorporado, com o token novo do hospedeiro, abre de novo depois da sessão encerrada', async () => {
    const api = simulateApi({ 'GET /v1/session': problem(401, 'no_session') });
    const { onSessionExpired, rerender } = renderModule({ token: 'token-vencido' });
    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);

    api.set({ 'GET /v1/session': json(headquartersSession) });
    rerender(<FluxoModule apiUrl={API} screens={testScreens} onSessionExpired={onSessionExpired} token="token-novo" />);

    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    expect(api.request(1).headers.get('Authorization')).toBe('Bearer token-novo');
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('quando a sessão expira com o módulo aberto, o cache é limpo: o token novo não vê os dados do anterior', async () => {
    const api = simulateApi({ 'GET /v1/session': json(headquartersSession) });
    const { onSessionExpired, rerender } = renderModule({ token: 'token-a' });
    await screen.findByRole('heading', { name: 'Tela Início' });

    // The token expires: the next fetch (here, when focus comes back to the page) gets 401 no_session.
    api.set({ 'GET /v1/session': problem(401, 'no_session') });
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    focusManager.setFocused(undefined);

    const pending = pendingResponse();
    api.set({ 'GET /v1/session': pending.promise });
    rerender(<FluxoModule apiUrl={API} screens={testScreens} onSessionExpired={onSessionExpired} token="token-b" />);

    // With nothing from the previous token in the cache, the module waits for the new session instead of showing the old one.
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Fluxo de Cálculo');
    expect(screen.queryByRole('heading', { name: 'Tela Início' })).not.toBeInTheDocument();
    await act(async () => pending.deliver(json(branchSession)));
    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
  });

  describe('layout incorporado (com token)', () => {
    it('não renderiza o menu lateral: só as abas, com Bearer e sem cookie', async () => {
      const api = simulateApi({ 'GET /v1/session': json(headquartersSession) });
      render(<FluxoCalculo apiUrl={API} token="token-do-hospedeiro" />);

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
      expect(sidebar()).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Trocar cliente/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /opções da conta/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('main')).not.toBeInTheDocument();

      const tab = within(tabs() as HTMLElement).getByRole('tab', { name: 'Início' });
      expect(tab).toHaveAttribute('aria-selected', 'true');
      const region = screen.getByRole('region', { name: 'Fluxo de Cálculo' });
      expect(region).toContainElement(tabs());
      // The open screen is the panel of its tab.
      expect(within(region).getByRole('tabpanel', { name: 'Início' })).toContainElement(
        screen.getByRole('heading', { level: 1, name: 'Início' }),
      );

      expect(api.request(0).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
      expect(api.request(0).credentials).toBe('omit');
    });

    it('as abas seguem as permissões e navegam entre as telas', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      const { user } = renderModule({ token: 'token' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      const list = tabs() as HTMLElement;
      expect(within(list).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Início', 'Workflows']);
      expect(within(list).queryByRole('tab', { name: 'Auditoria' })).not.toBeInTheDocument();

      await user.click(within(list).getByRole('tab', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(list).getByRole('tab', { name: 'Workflows' })).toHaveAttribute('aria-selected', 'true');
      expect(within(list).getByRole('tab', { name: 'Início' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tabpanel', { name: 'Workflows' })).toContainElement(
        screen.getByRole('heading', { name: 'Tela Workflows' }),
      );
    });

    it('pelo teclado, as setas trocam de tela e o foco continua nas abas', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      const { user } = renderModule({ token: 'token' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      await user.tab();
      const start = within(tabs() as HTMLElement).getByRole('tab', { name: 'Início' });
      expect(start).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(tabs() as HTMLElement).getByRole('tab', { name: 'Workflows' })).toHaveFocus();

      await user.keyboard('{Home}');
      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      expect(start).toHaveFocus();
    });
  });

  describe('navegação', () => {
    it('no modo memory, a URL da página não muda, nem ao abrir nem ao navegar', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      const historyBefore = window.history.length;
      const { user } = renderModule({ navigation: 'memory' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      await user.click(within(mainNavigation()).getByRole('link', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();

      expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(HOST_APP_URL);
      expect(window.history.length).toBe(historyBefore);
    });

    it('com token e sem navigation, o padrão é memory: a URL do hospedeiro não muda', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      const { user } = renderModule({ token: 'token' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      await user.click(within(tabs() as HTMLElement).getByRole('tab', { name: 'Workflows' }));
      await screen.findByRole('heading', { name: 'Tela Workflows' });

      expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(HOST_APP_URL);
    });

    it('no modo url, as rotas internas seguem a URL: a raiz abre a tela inicial e o menu muda o endereço', async () => {
      window.history.replaceState(null, '', '/');
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      const { user } = renderModule({ navigation: 'url' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      expect(window.location.pathname).toBe('/home');

      await user.click(within(mainNavigation()).getByRole('link', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/workflows');
    });

    it('sem token e sem navigation, o padrão é url: abre a tela do endereço atual', async () => {
      window.history.replaceState(null, '', '/workflows');
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      renderModule();

      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(mainNavigation()).getByRole('link', { name: 'Workflows' })).toHaveAttribute('aria-current', 'page');
    });

    it('a propriedade tela abre o módulo direto nela', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      renderModule({ navigation: 'memory', screen: 'workflows' });

      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
    });

    it('dentro de um hospedeiro com react-router, o módulo monta e não mexe no roteador dele', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      function HostAppLocation() {
        const local = useLocation();
        return <p>Hospedeiro em {local.pathname}</p>;
      }
      const user = userEvent.setup({ delay: null });
      render(
        <MemoryRouter initialEntries={['/relatorios/calculo']}>
          <HostAppLocation />
          <Routes>
            <Route
              path="/relatorios/*"
              element={<FluxoModule apiUrl={API} screens={testScreens} token="token" />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      await user.click(within(tabs() as HTMLElement).getByRole('tab', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(tabs() as HTMLElement).getByRole('tab', { name: 'Workflows' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Hospedeiro em /relatorios/calculo')).toBeInTheDocument();
    });
  });

  describe('itens por permissão', () => {
    it('item sem permissão não aparece no menu lateral', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      renderModule({ navigation: 'memory' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      const links = within(mainNavigation()).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(['Início', 'Workflows']);
      expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
    });

    it('a rota de uma tela sem permissão não abre: volta para a tela inicial', async () => {
      window.history.replaceState(null, '', '/audit');
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      renderModule({ navigation: 'url' });

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tela Auditoria' })).not.toBeInTheDocument();
      await waitFor(() => expect(window.location.pathname).toBe('/home'));
    });

    it('a propriedade tela sem permissão abre a primeira tela permitida', async () => {
      simulateApi({ 'GET /v1/session': json(headquartersSession) });
      renderModule({ navigation: 'memory', screen: 'audit' });

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    });
  });
});
