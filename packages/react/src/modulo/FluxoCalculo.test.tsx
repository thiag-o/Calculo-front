import '@testing-library/jest-dom/vitest';
import { focusManager } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoCalculo } from '.';
import { ModuloFluxo, type ModuloFluxoProps } from './FluxoCalculo';
import {
  API,
  json,
  problema,
  respostaPendente,
  sessaoFilial,
  sessaoMatriz,
  simularApi,
  simularLargura,
  telasDeTeste,
} from './modulo.test.apoio';

const ENDERECO_DO_HOSPEDEIRO = '/sistema-do-cliente/relatorios?aba=2#topo';

beforeEach(() => {
  window.history.replaceState(null, '', ENDERECO_DO_HOSPEDEIRO);
  simularLargura(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderizarModulo(props: Partial<ModuloFluxoProps> = {}) {
  const onSessaoExpirada = vi.fn();
  const usuario = userEvent.setup();
  const tela = render(<ModuloFluxo apiUrl={API} telas={telasDeTeste} onSessaoExpirada={onSessaoExpirada} {...props} />);
  return { usuario, onSessaoExpirada, ...tela };
}

const menuLateral = () => screen.queryByRole('complementary', { name: 'Menu lateral' });
const navegacaoPrincipal = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const abas = () => screen.queryByRole('navigation', { name: 'Telas do Fluxo de Cálculo' });

describe('<FluxoCalculo>', () => {
  it('no casca (sem token), monta a raiz com o tema, chama a API com o cookie e abre o Início com o menu lateral', async () => {
    const api = simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
    const { container } = render(<FluxoCalculo apiUrl={API} tema="escuro" navegacao="memoria" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
    expect(container.querySelector('.fc-raiz')).toHaveAttribute('data-theme', 'dark');
    expect(menuLateral()).toBeInTheDocument();
    expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Trocar cliente. Atual: Matriz' })).toBeInTheDocument();

    expect(api.chamadas()).toEqual(['GET /v1/sessao']);
    expect(api.requisicao(0).credentials).toBe('include');
    expect(api.requisicao(0).headers.get('Authorization')).toBeNull();
  });

  it('enquanto a sessão chega, mostra o esqueleto de carregamento', async () => {
    const pendente = respostaPendente();
    simularApi({ 'GET /v1/sessao': pendente.promessa });
    renderizarModulo({ navegacao: 'memoria' });

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Fluxo de Cálculo');
    expect(menuLateral()).not.toBeInTheDocument();

    await act(async () => pendente.entregar(json(sessaoMatriz)));
    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('se a sessão não carrega por falha passageira, diz o que houve e tenta de novo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = simularApi({ 'GET /v1/sessao': problema(503, 'indisponivel') });
    const { usuario, onSessaoExpirada } = renderizarModulo({ navegacao: 'memoria' });

    // 5xx é repetido pelo QueryClient do produto antes de virar erro (até 3 vezes, com espera crescente).
    await act(() => vi.advanceTimersByTimeAsync(10000));
    vi.useRealTimers();
    const alerta = await screen.findByRole('alert');
    expect(api.chamadas()).toEqual(Array(4).fill('GET /v1/sessao'));
    expect(alerta).toHaveTextContent('Não foi possível abrir o Fluxo de Cálculo');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');
    expect(onSessaoExpirada).not.toHaveBeenCalled();

    api.definir({ 'GET /v1/sessao': json(sessaoMatriz) });
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
  });

  it('sem sessão (401 sem_sessao), avisa o onSessaoExpirada uma vez e não mostra o módulo', async () => {
    const api = simularApi({ 'GET /v1/sessao': problema(401, 'sem_sessao') });
    const { onSessaoExpirada } = renderizarModulo({ navegacao: 'memoria' });

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(screen.getByText('Entre de novo para continuar.')).toBeInTheDocument();
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
    expect(menuLateral()).not.toBeInTheDocument();
    // 4xx não se repete, e nada volta a buscar a sessão depois de encerrada.
    expect(api.chamadas()).toEqual(['GET /v1/sessao']);
  });

  it('incorporado, com o token novo do hospedeiro, abre de novo depois da sessão encerrada', async () => {
    const api = simularApi({ 'GET /v1/sessao': problema(401, 'sem_sessao') });
    const { onSessaoExpirada, rerender } = renderizarModulo({ token: 'token-vencido' });
    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);

    api.definir({ 'GET /v1/sessao': json(sessaoMatriz) });
    rerender(<ModuloFluxo apiUrl={API} telas={telasDeTeste} onSessaoExpirada={onSessaoExpirada} token="token-novo" />);

    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    expect(api.requisicao(1).headers.get('Authorization')).toBe('Bearer token-novo');
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
  });

  it('quando a sessão expira com o módulo aberto, o cache é limpo: o token novo não vê os dados do anterior', async () => {
    const api = simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
    const { onSessaoExpirada, rerender } = renderizarModulo({ token: 'token-a' });
    await screen.findByRole('heading', { name: 'Tela Início' });

    // O token vence: a próxima busca (aqui, ao voltar o foco para a página) recebe 401 sem_sessao.
    api.definir({ 'GET /v1/sessao': problema(401, 'sem_sessao') });
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
    focusManager.setFocused(undefined);

    const pendente = respostaPendente();
    api.definir({ 'GET /v1/sessao': pendente.promessa });
    rerender(<ModuloFluxo apiUrl={API} telas={telasDeTeste} onSessaoExpirada={onSessaoExpirada} token="token-b" />);

    // Sem nada do token anterior no cache, o módulo espera a sessão nova em vez de mostrar a antiga.
    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Fluxo de Cálculo');
    expect(screen.queryByRole('heading', { name: 'Tela Início' })).not.toBeInTheDocument();
    await act(async () => pendente.entregar(json(sessaoFilial)));
    expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
  });

  describe('layout incorporado (com token)', () => {
    it('não renderiza o menu lateral: só as abas, com Bearer e sem cookie', async () => {
      const api = simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      render(<FluxoCalculo apiUrl={API} token="token-do-hospedeiro" />);

      expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
      expect(menuLateral()).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Trocar cliente/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /opções da conta/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('main')).not.toBeInTheDocument();

      const aba = within(abas() as HTMLElement).getByRole('link', { name: 'Início' });
      expect(aba).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('region', { name: 'Fluxo de Cálculo' })).toBeInTheDocument();

      expect(api.requisicao(0).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
      expect(api.requisicao(0).credentials).toBe('omit');
    });

    it('as abas seguem as permissões e navegam entre as telas', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const { usuario } = renderizarModulo({ token: 'token' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      const lista = abas() as HTMLElement;
      expect(within(lista).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Workflows']);
      expect(within(lista).queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();

      await usuario.click(within(lista).getByRole('link', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(lista).getByRole('link', { name: 'Workflows' })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('navegação', () => {
    it('no modo memoria, a URL da página não muda, nem ao abrir nem ao navegar', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const historicoAntes = window.history.length;
      const { usuario } = renderizarModulo({ navegacao: 'memoria' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      await usuario.click(within(navegacaoPrincipal()).getByRole('link', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();

      expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(ENDERECO_DO_HOSPEDEIRO);
      expect(window.history.length).toBe(historicoAntes);
    });

    it('com token e sem navegacao, o padrão é memoria: a URL do hospedeiro não muda', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const { usuario } = renderizarModulo({ token: 'token' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      await usuario.click(within(abas() as HTMLElement).getByRole('link', { name: 'Workflows' }));
      await screen.findByRole('heading', { name: 'Tela Workflows' });

      expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(ENDERECO_DO_HOSPEDEIRO);
    });

    it('no modo url, as rotas internas seguem a URL: a raiz abre a tela inicial e o menu muda o endereço', async () => {
      window.history.replaceState(null, '', '/');
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      const { usuario } = renderizarModulo({ navegacao: 'url' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      expect(window.location.pathname).toBe('/inicio');

      await usuario.click(within(navegacaoPrincipal()).getByRole('link', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(window.location.pathname).toBe('/workflows');
    });

    it('sem token e sem navegacao, o padrão é url: abre a tela do endereço atual', async () => {
      window.history.replaceState(null, '', '/workflows');
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      renderizarModulo();

      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Workflows' })).toHaveAttribute('aria-current', 'page');
    });

    it('a propriedade tela abre o módulo direto nela', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      renderizarModulo({ navegacao: 'memoria', tela: 'workflows' });

      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
    });

    it('dentro de um hospedeiro com react-router, o módulo monta e não mexe no roteador dele', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      function OndeEstaOHospedeiro() {
        const local = useLocation();
        return <p>Hospedeiro em {local.pathname}</p>;
      }
      const usuario = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/relatorios/calculo']}>
          <OndeEstaOHospedeiro />
          <Routes>
            <Route
              path="/relatorios/*"
              element={<ModuloFluxo apiUrl={API} telas={telasDeTeste} token="token" />}
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      await usuario.click(within(abas() as HTMLElement).getByRole('link', { name: 'Workflows' }));
      expect(await screen.findByRole('heading', { name: 'Tela Workflows' })).toBeInTheDocument();
      expect(within(abas() as HTMLElement).getByRole('link', { name: 'Workflows' })).toHaveAttribute('href', '/workflows');
      expect(screen.getByText('Hospedeiro em /relatorios/calculo')).toBeInTheDocument();
    });
  });

  describe('itens por permissão', () => {
    it('item sem permissão não aparece no menu lateral', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      renderizarModulo({ navegacao: 'memoria' });

      await screen.findByRole('heading', { name: 'Tela Início' });
      const links = within(navegacaoPrincipal()).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(['Início', 'Workflows']);
      expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
    });

    it('a rota de uma tela sem permissão não abre: volta para a tela inicial', async () => {
      window.history.replaceState(null, '', '/auditoria');
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      renderizarModulo({ navegacao: 'url' });

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tela Auditoria' })).not.toBeInTheDocument();
      await waitFor(() => expect(window.location.pathname).toBe('/inicio'));
    });

    it('a propriedade tela sem permissão abre a primeira tela permitida', async () => {
      simularApi({ 'GET /v1/sessao': json(sessaoMatriz) });
      renderizarModulo({ navegacao: 'memoria', tela: 'auditoria' });

      expect(await screen.findByRole('heading', { name: 'Tela Início' })).toBeInTheDocument();
    });
  });
});
