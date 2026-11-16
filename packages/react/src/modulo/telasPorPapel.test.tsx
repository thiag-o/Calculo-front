import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoCalculo, type FluxoCalculoProps } from '.';
import {
  API,
  json,
  PERMISSOES_ADMIN,
  PERMISSOES_AUDITOR,
  PERMISSOES_CONFIGURADOR,
  sessaoCom,
  simularApi,
  simularLargura,
} from './modulo.test.apoio';

// As telas reais do <FluxoCalculo> (TELAS): Início, Auditoria e a seção Administração (Usuários, Papéis, Integração e
// Segurança), cada uma com a sua permissão. No casca, a seção tem um item por área no menu lateral; no modo
// incorporado, é uma aba só. Nos dois, cada área abre a <Administracao>, com as abas internas ligadas às rotas.

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  simularLargura(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A API com a sessão dada e listas vazias nas telas do épico 2. */
function simularApiCom(permissoes: string[]) {
  return simularApi({
    'GET /v1/sessao': json(sessaoCom(permissoes)),
    'GET /v1/usuarios': json({ itens: [], proximo_cursor: null }),
    'GET /v1/papeis': json([]),
    'GET /v1/chaves-api': json({ itens: [], proximo_cursor: null }),
    'GET /v1/dominios-autorizados': json([]),
    'GET /v1/auditoria/acessos': json({ itens: [], proximo_cursor: null }),
  });
}

function renderizar(props: Partial<FluxoCalculoProps> = {}) {
  const usuario = userEvent.setup();
  render(<FluxoCalculo apiUrl={API} {...props} />);
  return { usuario };
}

const navegacaoPrincipal = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const secaoAdministracao = () => within(navegacaoPrincipal()).queryByRole('group', { name: 'Administração' });
const abas = () => screen.getByRole('navigation', { name: 'Telas do Fluxo de Cálculo' });
const nomes = (elementos: HTMLElement[]) => elementos.map((elemento) => elemento.textContent);
const abasAdministracao = () => screen.getByRole('tablist', { name: 'Administração' });
const nomesDasAbasAdministracao = () => nomes(within(abasAdministracao()).getAllByRole('tab'));
const inicioAberto = () => screen.findByRole('heading', { level: 1, name: 'Início' });

describe('telas por papel no casca', () => {
  it('o Admin vê Início e Auditoria, e Usuários, Papéis, Integração e Segurança na seção Administração', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    renderizar({ navegacao: 'memoria' });

    await inicioAberto();
    expect(nomes(within(navegacaoPrincipal()).getAllByRole('link'))).toEqual([
      'Início',
      'Auditoria',
      'Usuários',
      'Papéis',
      'Integração',
      'Segurança',
    ]);
    const secao = secaoAdministracao() as HTMLElement;
    expect(secao).toBeInTheDocument();
    expect(nomes(within(secao).getAllByRole('link'))).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(within(secao).queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('o Configurador não vê Administração nem Auditoria, e as rotas delas não abrem', async () => {
    window.history.replaceState(null, '', '/administracao/usuarios');
    const api = simularApiCom(PERMISSOES_CONFIGURADOR);
    renderizar({ navegacao: 'url' });

    await inicioAberto();
    expect(nomes(within(navegacaoPrincipal()).getAllByRole('link'))).toEqual(['Início']);
    expect(secaoAdministracao()).not.toBeInTheDocument();
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/inicio'));
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(api.chamadas()).not.toContain('GET /v1/usuarios');
  });

  it('o Auditor vê Auditoria e abre os acessos; não vê Administração', async () => {
    simularApiCom(PERMISSOES_AUDITOR);
    const { usuario } = renderizar({ navegacao: 'memoria' });

    await inicioAberto();
    expect(nomes(within(navegacaoPrincipal()).getAllByRole('link'))).toEqual(['Início', 'Auditoria']);
    expect(secaoAdministracao()).not.toBeInTheDocument();

    await usuario.click(within(navegacaoPrincipal()).getByRole('link', { name: 'Auditoria' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
  });

  it('cada área da Administração depende só da sua permissão', async () => {
    simularApiCom(['integracao.gerenciar', 'seguranca.gerenciar']);
    renderizar({ navegacao: 'memoria' });

    await inicioAberto();
    expect(nomes(within(secaoAdministracao() as HTMLElement).getAllByRole('link'))).toEqual(['Integração', 'Segurança']);
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Papéis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('os itens da Administração abrem as telas delas, nas rotas /administracao/…', async () => {
    const api = simularApiCom(PERMISSOES_ADMIN);
    const { usuario } = renderizar({ navegacao: 'url' });
    await inicioAberto();
    const secao = secaoAdministracao() as HTMLElement;

    await usuario.click(within(secao).getByRole('link', { name: 'Usuários' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administracao/usuarios');
    expect(within(secao).getByRole('link', { name: 'Usuários' })).toHaveAttribute('aria-current', 'page');

    await usuario.click(within(secao).getByRole('link', { name: 'Papéis' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administracao/papeis');

    await usuario.click(within(secao).getByRole('link', { name: 'Integração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administracao/integracao');

    await usuario.click(within(secao).getByRole('link', { name: 'Segurança' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administracao/seguranca');

    await waitFor(() => expect(api.chamadas()).toContain('GET /v1/configuracoes/seguranca'));
  });

  it('no endereço de uma área da Administração, abre direto nela', async () => {
    window.history.replaceState(null, '', '/administracao/papeis');
    simularApiCom(PERMISSOES_ADMIN);
    renderizar();

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Papéis' })).toHaveAttribute('aria-current', 'page');
  });

  it('cada área abre a Administração com as abas internas, que andam junto com o menu e o endereço', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    const { usuario } = renderizar({ navegacao: 'url' });
    await inicioAberto();
    const secao = secaoAdministracao() as HTMLElement;

    await usuario.click(within(secao).getByRole('link', { name: 'Usuários' }));
    expect(await screen.findByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    expect(nomesDasAbasAdministracao()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);

    await usuario.click(screen.getByRole('tab', { name: 'Segurança' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administracao/seguranca');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
    expect(within(secao).getByRole('link', { name: 'Segurança' })).toHaveAttribute('aria-current', 'page');
    expect(within(secao).getByRole('link', { name: 'Usuários' })).not.toHaveAttribute('aria-current');
  });

  it('pelo teclado, as abas internas trocam a área e o foco continua nelas', async () => {
    window.history.replaceState(null, '', '/administracao/usuarios');
    simularApiCom(PERMISSOES_ADMIN);
    const { usuario } = renderizar();
    const usuarios = await screen.findByRole('tab', { name: 'Usuários' });

    usuarios.focus();
    await usuario.keyboard('{ArrowRight}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/administracao/papeis');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveFocus();

    await usuario.keyboard('{End}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();
  });

  it('o endereço da seção abre a primeira área permitida', async () => {
    window.history.replaceState(null, '', '/administracao');
    simularApiCom(['papeis.gerenciar', 'seguranca.gerenciar']);
    renderizar();

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/administracao/papeis'));
    expect(nomesDasAbasAdministracao()).toEqual(['Papéis', 'Segurança']);
  });

  it('com o menu só de ícones, o rótulo da seção sai da vista, mas o grupo continua com o nome', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    renderizar({ navegacao: 'memoria' });
    await inicioAberto();

    simularLargura(1024);
    await waitFor(() => expect(document.querySelector('.fc-casca')).toHaveClass('fc-casca-compacto'));
    // O CSS esconde `.fc-menu-lateral-secao-rotulo` no modo compacto; o jsdom não aplica o CSS.
    expect(secaoAdministracao()).toBeInTheDocument();
    expect(screen.getByText('Administração')).toHaveClass('fc-menu-lateral-secao-rotulo');
  });
});

describe('a propriedade tela', () => {
  it('abre direto na Segurança, para o Admin', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    renderizar({ navegacao: 'memoria', tela: 'seguranca' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(within(navegacaoPrincipal()).getByRole('link', { name: 'Segurança' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre direto numa área da Administração, no modo incorporado', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    renderizar({ token: 'token', tela: 'papeis' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(within(abas()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
  });

  it('administracao abre a primeira área permitida', async () => {
    simularApiCom(['integracao.gerenciar', 'seguranca.gerenciar']);
    renderizar({ token: 'token', tela: 'administracao' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Chaves de API' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
  });

  it('abre direto na Auditoria, para o Auditor', async () => {
    simularApiCom(PERMISSOES_AUDITOR);
    renderizar({ token: 'token', tela: 'auditoria' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(within(abas()).getByRole('link', { name: 'Auditoria' })).toHaveAttribute('aria-current', 'page');
  });

  it('numa área sem permissão, abre a primeira tela permitida', async () => {
    simularApiCom(PERMISSOES_CONFIGURADOR);
    renderizar({ token: 'token', tela: 'usuarios' });

    await inicioAberto();
    expect(screen.queryByRole('heading', { name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('na Administração sem nenhuma área permitida, abre a primeira tela permitida', async () => {
    simularApiCom(PERMISSOES_AUDITOR);
    renderizar({ token: 'token', tela: 'administracao' });

    await inicioAberto();
    expect(screen.queryByRole('tablist', { name: 'Administração' })).not.toBeInTheDocument();
  });
});

describe('abas do modo incorporado', () => {
  it('o Admin tem as abas Início, Auditoria e Administração, os mesmos itens do menu', async () => {
    const api = simularApiCom(PERMISSOES_ADMIN);
    const { usuario } = renderizar({ token: 'token' });

    await inicioAberto();
    expect(nomes(within(abas()).getAllByRole('link'))).toEqual(['Início', 'Auditoria', 'Administração']);

    await usuario.click(within(abas()).getByRole('link', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(within(abas()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');
    expect(nomesDasAbasAdministracao()).toEqual(['Usuários', 'Papéis', 'Integração', 'Segurança']);
    expect(screen.getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');

    await usuario.click(screen.getByRole('tab', { name: 'Integração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Domínios autorizados' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    // A aba do módulo continua ativa em qualquer área da Administração.
    expect(within(abas()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');

    await usuario.click(within(abas()).getByRole('link', { name: 'Auditoria' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Administração' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.chamadas()).toContain('GET /v1/auditoria/acessos'));
  });

  it('pelo teclado, as abas internas da Administração trocam a área e o foco continua nelas', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    const { usuario } = renderizar({ token: 'token', tela: 'administracao' });
    const usuarios = await screen.findByRole('tab', { name: 'Usuários' });

    usuarios.focus();
    await usuario.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Segurança' })).toHaveFocus();
    expect(within(abas()).getByRole('link', { name: 'Administração' })).toHaveAttribute('aria-current', 'page');
  });

  it('o Configurador só tem a aba Início, sem Administração', async () => {
    simularApiCom(PERMISSOES_CONFIGURADOR);
    renderizar({ token: 'token' });

    await inicioAberto();
    expect(nomes(within(abas()).getAllByRole('link'))).toEqual(['Início']);
    expect(screen.queryByText('Administração')).not.toBeInTheDocument();
  });

  it('o Auditor tem Início e Auditoria', async () => {
    simularApiCom(PERMISSOES_AUDITOR);
    renderizar({ token: 'token' });

    await inicioAberto();
    expect(nomes(within(abas()).getAllByRole('link'))).toEqual(['Início', 'Auditoria']);
  });

  it('as abas internas da Administração seguem a permissão de cada área', async () => {
    simularApiCom(['usuarios.gerenciar', 'papeis.gerenciar']);
    const { usuario } = renderizar({ token: 'token' });

    await inicioAberto();
    expect(nomes(within(abas()).getAllByRole('link'))).toEqual(['Início', 'Administração']);

    await usuario.click(within(abas()).getByRole('link', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(nomesDasAbasAdministracao()).toEqual(['Usuários', 'Papéis']);
  });

  it('com uma área só, a aba Administração abre nela', async () => {
    simularApiCom(['seguranca.gerenciar']);
    const { usuario } = renderizar({ token: 'token' });

    await inicioAberto();
    await usuario.click(within(abas()).getByRole('link', { name: 'Administração' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Segurança' })).toBeInTheDocument();
    expect(nomesDasAbasAdministracao()).toEqual(['Segurança']);
  });
});
