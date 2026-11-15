import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuloFluxo } from '../FluxoCalculo';
import {
  API,
  json,
  problema,
  respostaPendente,
  semConteudo,
  sessaoFilial,
  sessaoMatriz,
  sessaoUmCliente,
  simularApi,
  simularLargura,
  telasDeTeste,
  TENANT_FILIAL,
} from '../modulo.test.apoio';
import { MENSAGEM_SEM_ACESSO_AO_CLIENTE } from './mensagens';

beforeEach(() => {
  simularLargura(1440);
  document.cookie = 'fc_csrf=csrf-de-teste; path=/';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

function renderizar() {
  const onSessaoExpirada = vi.fn();
  const usuario = userEvent.setup();
  const tela = render(
    <ModuloFluxo apiUrl={API} navegacao="memoria" telas={telasDeTeste} onSessaoExpirada={onSessaoExpirada} />,
  );
  return { usuario, onSessaoExpirada, ...tela };
}

const navegacaoPrincipal = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const linksDoMenu = () => within(navegacaoPrincipal()).getAllByRole('link').map((link) => link.textContent);
const seletor = () => screen.getByRole('button', { name: /^Trocar cliente\. Atual:/ });
const layout = (container: HTMLElement) => container.querySelector('.fc-casca') as HTMLElement;

describe('layout do casca', () => {
  it('mostra o seletor de cliente no topo, os itens do menu e quem está logado no rodapé', async () => {
    simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
    renderizar();

    await screen.findByRole('heading', { name: 'Tela Início' });
    const menu = screen.getByRole('complementary', { name: 'Menu lateral' });
    expect(within(menu).getByRole('button', { name: 'Trocar cliente. Atual: Matriz' })).toHaveTextContent('Matriz');
    expect(linksDoMenu()).toEqual(['Início', 'Workflows']);
    const conta = within(menu).getByRole('button', { name: 'Ana Beatriz Souza: opções da conta' });
    expect(conta).toHaveTextContent('Ana Beatriz Souza');
    expect(conta).toHaveTextContent('ana@exemplo.com');
    expect(conta).toHaveTextContent('AS');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Tela Início' }));
  });

  it('navega pelo menu e marca o item da tela aberta', async () => {
    simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
    const { usuario } = renderizar();

    await screen.findByRole('heading', { name: 'Tela Início' });
    await usuario.click(within(navegacaoPrincipal()).getByRole('link', { name: 'Workflows' }));

    expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
    expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Workflows' })).toHaveAttribute('aria-current', 'page');
    expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  describe('seletor de cliente', () => {
    it('lista os clientes do usuário, com o atual marcado e sem ação', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const { usuario } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      const lista = await screen.findByRole('menu');
      expect(lista.closest('.fc-portais')).not.toBeNull();
      const itens = within(lista).getAllByRole('menuitem');
      expect(itens.map((item) => item.textContent)).toEqual(['MatrizCliente atual', TENANT_FILIAL.nome]);
      expect(itens[0]).toHaveAttribute('aria-disabled', 'true');
      expect(itens[0]).toHaveAccessibleDescription('Cliente atual');
    });

    it('troca de cliente pelo useTrocarTenant: o seletor e os itens do menu passam a ser os do cliente novo', async () => {
      const api = simularApi({ 'GET /v1/sessao': json(sessaoMatriz), 'PUT /v1/sessao/tenant': json(sessaoFilial) });
      const { usuario } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await usuario.click(await screen.findByRole('menuitem', { name: TENANT_FILIAL.nome }));

      expect(await screen.findByRole('button', { name: `Trocar cliente. Atual: ${TENANT_FILIAL.nome}` })).toBeInTheDocument();
      // A Filial dá auditoria.ver e não dá workflows.ver.
      expect(linksDoMenu()).toEqual(['Início', 'Auditoria']);

      const troca = api.requisicao(api.chamadas().indexOf('PUT /v1/sessao/tenant'));
      expect(await troca.json()).toEqual({ tenant_id: TENANT_FILIAL.id });
      expect(troca.headers.get('X-CSRF-Token')).toBe('csrf-de-teste');
    });

    it('a tela aberta que o cliente novo não permite volta para a tela inicial', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz), 'PUT /v1/sessao/tenant': json(sessaoFilial) });
      const { usuario } = renderizar();

      await usuario.click(await screen.findByRole('link', { name: 'Workflows' }));
      await screen.findByRole('heading', { name: 'Tela Workflows' });
      await usuario.click(seletor());
      await usuario.click(await screen.findByRole('menuitem', { name: TENANT_FILIAL.nome }));

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tela Workflows' })).not.toBeInTheDocument();
    });

    it('enquanto troca, o seletor fica ocupado', async () => {
      const pendente = respostaPendente();
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz), 'PUT /v1/sessao/tenant': pendente.promessa });
      const { usuario } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await usuario.click(await screen.findByRole('menuitem', { name: TENANT_FILIAL.nome }));
      await waitFor(() => expect(seletor()).toHaveAttribute('aria-busy', 'true'));

      pendente.entregar(json(sessaoFilial));
      await waitFor(() => expect(seletor()).not.toHaveAttribute('aria-busy'));
      expect(seletor()).toHaveAccessibleName(`Trocar cliente. Atual: ${TENANT_FILIAL.nome}`);
    });

    it('sem acesso ao cliente (403), avisa e busca a lista de clientes de novo; "Fechar aviso" tira a nota', async () => {
      const api = simularApi({
        'GET /v1/sessao': json(sessaoMatriz),
        'PUT /v1/sessao/tenant': problema(403, 'sem_acesso_ao_tenant'),
      });
      const { usuario } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await usuario.click(await screen.findByRole('menuitem', { name: TENANT_FILIAL.nome }));

      expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_ACESSO_AO_CLIENTE);
      await waitFor(() => expect(api.chamadas().filter((chamada) => chamada === 'GET /v1/sessao')).toHaveLength(2));
      expect(seletor()).toHaveAccessibleName('Trocar cliente. Atual: Matriz');

      await usuario.click(screen.getByRole('button', { name: 'Fechar aviso' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('em outro erro, mostra a mensagem da API; a troca seguinte que dá certo tira a nota', async () => {
      const api = simularApi({ 'GET /v1/sessao': json(sessaoMatriz), 'PUT /v1/sessao/tenant': problema(403, 'csrf_invalido') });
      const { usuario } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Trocar cliente. Atual: Matriz' }));
      await usuario.click(await screen.findByRole('menuitem', { name: TENANT_FILIAL.nome }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível trocar de cliente. Texto do servidor para csrf_invalido.',
      );

      api.definir({ 'PUT /v1/sessao/tenant': json(sessaoFilial) });
      await usuario.click(seletor());
      await usuario.click(await screen.findByRole('menuitem', { name: TENANT_FILIAL.nome }));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      expect(seletor()).toHaveAccessibleName(`Trocar cliente. Atual: ${TENANT_FILIAL.nome}`);
    });

    it('com um cliente só, mostra o nome sem botão de troca', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoUmCliente) });
      renderizar();

      await screen.findByRole('heading', { name: 'Tela Início' });
      expect(screen.queryByRole('button', { name: /Trocar cliente/ })).not.toBeInTheDocument();
      expect(within(screen.getByRole('complementary', { name: 'Menu lateral' })).getByText('Matriz')).toBeInTheDocument();
    });
  });

  describe('sair', () => {
    it('"Sair" encerra a sessão na API e avisa o onSessaoExpirada', async () => {
      const api = simularApi({ 'GET /v1/sessao': json(sessaoMatriz), 'DELETE /v1/sessao': semConteudo() });
      const { usuario, onSessaoExpirada } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Ana Beatriz Souza: opções da conta' }));
      await usuario.click(await screen.findByRole('menuitem', { name: 'Sair' }));

      expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
      expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
      const saida = api.requisicao(api.chamadas().indexOf('DELETE /v1/sessao'));
      expect(saida.headers.get('X-CSRF-Token')).toBe('csrf-de-teste');
    });

    it('se a saída falha, a sessão continua e a nota diz o que houve', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz), 'DELETE /v1/sessao': problema(403, 'csrf_invalido') });
      const { usuario, onSessaoExpirada } = renderizar();

      await usuario.click(await screen.findByRole('button', { name: 'Ana Beatriz Souza: opções da conta' }));
      await usuario.click(await screen.findByRole('menuitem', { name: 'Sair' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair. Texto do servidor para csrf_invalido.');
      expect(onSessaoExpirada).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    });
  });

  describe('menu recolhível e larguras', () => {
    it('a partir de 1180px, o menu é completo e "Recolher menu" deixa só os ícones, com o nome na dica', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const { usuario, container } = renderizar();

      await screen.findByRole('heading', { name: 'Tela Início' });
      const alternar = screen.getByRole('button', { name: 'Recolher menu' });
      expect(alternar).toHaveAttribute('aria-expanded', 'true');
      expect(alternar).toHaveAttribute('aria-controls', navegacaoPrincipal().id);
      expect(layout(container)).not.toHaveClass('fc-casca-compacto');

      await usuario.click(alternar);
      expect(layout(container)).toHaveClass('fc-casca-compacto');
      const expandir = screen.getByRole('button', { name: 'Expandir menu' });
      expect(expandir).toHaveAttribute('aria-expanded', 'false');
      // O rótulo continua no link para o leitor de tela; a dica mostra o nome no hover.
      const workflows = within(navegacaoPrincipal()).getByRole('link', { name: 'Workflows' });
      await usuario.hover(workflows);
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Workflows');

      await usuario.click(expandir);
      expect(layout(container)).not.toHaveClass('fc-casca-compacto');
    });

    it('abaixo de 1180px de largura do módulo, o menu fica só com ícones e não há o que expandir', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const { container } = renderizar();

      await screen.findByRole('heading', { name: 'Tela Início' });
      simularLargura(1100);
      await waitFor(() => expect(layout(container)).toHaveClass('fc-casca-compacto'));
      expect(screen.queryByRole('button', { name: /Recolher menu|Expandir menu/ })).not.toBeInTheDocument();
      expect(linksDoMenu()).toEqual(['Início', 'Workflows']);
      expect(seletor()).toBeInTheDocument();

      simularLargura(1180);
      await waitFor(() => expect(layout(container)).not.toHaveClass('fc-casca-compacto'));
      expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeInTheDocument();
    });
  });
});
