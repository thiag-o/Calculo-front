import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoModule } from '../FluxoCalculo';
import {
  API,
  json,
  problem,
  pendingResponse,
  noContent,
  branchSession,
  headquartersSession,
  oneTenantSession,
  simulateApi,
  simulateWidth,
  testScreens,
  BRANCH_TENANT,
} from '../module.test-support';
import { NO_TENANT_ACCESS_MESSAGE } from './messages';

beforeEach(() => {
  simulateWidth(1440);
  document.cookie = 'fc_csrf=csrf-de-teste; path=/';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

function renderScreen() {
  const onSessionExpired = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <FluxoModule apiUrl={API} navigation="memory" screens={testScreens} onSessionExpired={onSessionExpired} />,
  );
  return { user, onSessionExpired, ...view };
}

const mainNavigation = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const menuLinks = () => within(mainNavigation()).getAllByRole('link').map((link) => link.textContent);
const selector = () => screen.getByRole('button', { name: /^Trocar cliente\. Atual:/ });
const layout = (container: HTMLElement) => container.querySelector('.fc-shell') as HTMLElement;

describe('layout do casca', () => {
  it('mostra o seletor de cliente no topo, os itens do menu e quem está logado no rodapé', async () => {
    simulateApi({ 'GET /v1/sessao': json(headquartersSession) });
    renderScreen();

    await screen.findByRole('heading', { name: 'Tela Início' });
    const menu = screen.getByRole('complementary', { name: 'Menu lateral' });
    expect(within(menu).getByRole('button', { name: 'Trocar cliente. Atual: Matriz' })).toHaveTextContent('Matriz');
    expect(menuLinks()).toEqual(['Início', 'Workflows']);
    const account = within(menu).getByRole('button', { name: 'Ana Beatriz Souza: opções da conta' });
    expect(account).toHaveTextContent('Ana Beatriz Souza');
    expect(account).toHaveTextContent('ana@exemplo.com');
    expect(account).toHaveTextContent('AS');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Tela Início' }));
  });

  it('navega pelo menu e marca o item da tela aberta', async () => {
    simulateApi({ 'GET /v1/sessao': json(headquartersSession) });
    const { user } = renderScreen();

    await screen.findByRole('heading', { name: 'Tela Início' });
    await user.click(within(mainNavigation()).getByRole('link', { name: 'Workflows' }));

    expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
    expect(within(mainNavigation()).getByRole('link', { name: 'Workflows' })).toHaveAttribute('aria-current', 'page');
    expect(within(mainNavigation()).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  describe('seletor de cliente', () => {
    it('lista os clientes do usuário, com o atual marcado e sem ação', async () => {
      simulateApi({ 'GET /v1/sessao': json(headquartersSession) });
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      const list = await screen.findByRole('menu');
      expect(list.closest('.fc-portals')).not.toBeNull();
      const items = within(list).getAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual(['MatrizCliente atual', BRANCH_TENANT.nome]);
      expect(items[0]).toHaveAttribute('aria-disabled', 'true');
      expect(items[0]).toHaveAccessibleDescription('Cliente atual');
    });

    it('troca de cliente pelo useSwitchTenant: o seletor e os itens do menu passam a ser os do cliente novo', async () => {
      const api = simulateApi({ 'GET /v1/sessao': json(headquartersSession), 'PUT /v1/sessao/tenant': json(branchSession) });
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.nome }));

      expect(await screen.findByRole('button', { name: `Trocar cliente. Atual: ${BRANCH_TENANT.nome}` })).toBeInTheDocument();
      // Filial grants auditoria.ver and does not grant workflows.ver.
      expect(menuLinks()).toEqual(['Início', 'Auditoria']);

      const switchRequest = api.request(api.calls().indexOf('PUT /v1/sessao/tenant'));
      expect(await switchRequest.json()).toEqual({ tenant_id: BRANCH_TENANT.id });
      expect(switchRequest.headers.get('X-CSRF-Token')).toBe('csrf-de-teste');
    });

    it('a tela aberta que o cliente novo não permite volta para a tela inicial', async () => {
      simulateApi({ 'GET /v1/sessao': json(headquartersSession), 'PUT /v1/sessao/tenant': json(branchSession) });
      const { user } = renderScreen();

      await user.click(await screen.findByRole('link', { name: 'Workflows' }));
      await screen.findByRole('heading', { name: 'Tela Workflows' });
      await user.click(selector());
      await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.nome }));

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tela Workflows' })).not.toBeInTheDocument();
    });

    it('enquanto troca, o seletor fica ocupado', async () => {
      const pending = pendingResponse();
      simulateApi({ 'GET /v1/sessao': json(headquartersSession), 'PUT /v1/sessao/tenant': pending.promise });
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.nome }));
      await waitFor(() => expect(selector()).toHaveAttribute('aria-busy', 'true'));

      pending.deliver(json(branchSession));
      await waitFor(() => expect(selector()).not.toHaveAttribute('aria-busy'));
      expect(selector()).toHaveAccessibleName(`Trocar cliente. Atual: ${BRANCH_TENANT.nome}`);
    });

    it('sem acesso ao cliente (403), avisa e busca a lista de clientes de novo; "Fechar aviso" tira a nota', async () => {
      const api = simulateApi({
        'GET /v1/sessao': json(headquartersSession),
        'PUT /v1/sessao/tenant': problem(403, 'sem_acesso_ao_tenant'),
      });
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.nome }));

      expect(await screen.findByRole('alert')).toHaveTextContent(NO_TENANT_ACCESS_MESSAGE);
      await waitFor(() => expect(api.calls().filter((call) => call === 'GET /v1/sessao')).toHaveLength(2));
      expect(selector()).toHaveAccessibleName('Trocar cliente. Atual: Matriz');

      await user.click(screen.getByRole('button', { name: 'Fechar aviso' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('em outro erro, mostra a mensagem da API; a troca seguinte que dá certo tira a nota', async () => {
      const api = simulateApi({ 'GET /v1/sessao': json(headquartersSession), 'PUT /v1/sessao/tenant': problem(403, 'csrf_invalido') });
      const { user } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.nome }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível trocar de cliente. Texto do servidor para csrf_invalido.',
      );

      api.set({ 'PUT /v1/sessao/tenant': json(branchSession) });
      await user.click(selector());
      await user.click(await screen.findByRole('menuitem', { name: BRANCH_TENANT.nome }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(selector()).toHaveAccessibleName(`Trocar cliente. Atual: ${BRANCH_TENANT.nome}`);
    });

    it('com um cliente só, mostra o nome sem botão de troca', async () => {
      simulateApi({ 'GET /v1/sessao': json(oneTenantSession) });
      renderScreen();

      await screen.findByRole('heading', { name: 'Tela Início' });
      expect(screen.queryByRole('button', { name: /Trocar cliente/ })).not.toBeInTheDocument();
      expect(within(screen.getByRole('complementary', { name: 'Menu lateral' })).getByText('Matriz')).toBeInTheDocument();
    });
  });

  describe('sair', () => {
    it('"Sair" encerra a sessão na API e avisa o onSessionExpired', async () => {
      const api = simulateApi({ 'GET /v1/sessao': json(headquartersSession), 'DELETE /v1/sessao': noContent() });
      const { user, onSessionExpired } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Ana Beatriz Souza: opções da conta' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));

      expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
      const output = api.request(api.calls().indexOf('DELETE /v1/sessao'));
      expect(output.headers.get('X-CSRF-Token')).toBe('csrf-de-teste');
    });

    it('se a saída falha, a sessão continua e a nota diz o que houve', async () => {
      simulateApi({ 'GET /v1/sessao': json(headquartersSession), 'DELETE /v1/sessao': problem(403, 'csrf_invalido') });
      const { user, onSessionExpired } = renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Ana Beatriz Souza: opções da conta' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair. Texto do servidor para csrf_invalido.');
      expect(onSessionExpired).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    });
  });

  describe('menu recolhível e larguras', () => {
    it('a partir de 1180px, o menu é completo e "Recolher menu" deixa só os ícones, com o nome na dica', async () => {
      simulateApi({ 'GET /v1/sessao': json(headquartersSession) });
      const { user, container } = renderScreen();

      await screen.findByRole('heading', { name: 'Tela Início' });
      const toggle = screen.getByRole('button', { name: 'Recolher menu' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAttribute('aria-controls', mainNavigation().id);
      expect(layout(container)).not.toHaveClass('fc-shell-compact');

      await user.click(toggle);
      expect(layout(container)).toHaveClass('fc-shell-compact');
      const expand = screen.getByRole('button', { name: 'Expandir menu' });
      expect(expand).toHaveAttribute('aria-expanded', 'false');
      // The label stays on the link for the screen reader; the tooltip shows the name on hover.
      const workflows = within(mainNavigation()).getByRole('link', { name: 'Workflows' });
      await user.hover(workflows);
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Workflows');

      await user.click(expand);
      expect(layout(container)).not.toHaveClass('fc-shell-compact');
    });

    it('abaixo de 1180px de largura do módulo, o menu fica só com ícones e não há o que expandir', async () => {
      simulateApi({ 'GET /v1/sessao': json(headquartersSession) });
      const { container } = renderScreen();

      await screen.findByRole('heading', { name: 'Tela Início' });
      simulateWidth(1100);
      await waitFor(() => expect(layout(container)).toHaveClass('fc-shell-compact'));
      expect(screen.queryByRole('button', { name: /Recolher menu|Expandir menu/ })).not.toBeInTheDocument();
      expect(menuLinks()).toEqual(['Início', 'Workflows']);
      expect(selector()).toBeInTheDocument();

      simulateWidth(1180);
      await waitFor(() => expect(layout(container)).not.toHaveClass('fc-shell-compact'));
      expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument();
    });
  });
});
