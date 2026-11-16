import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Administracao, Auditoria, Inicio } from '..';
import {
  API,
  json,
  PERMISSOES_ADMIN,
  PERMISSOES_CONFIGURADOR,
  problema,
  respostaPendente,
  sessaoCom,
  simularApi,
  simularLargura,
} from '../modulo.test.apoio';

// As telas avulsas (F38): cada uma monta sozinha a raiz, a API e o cache, só com `apiUrl` (cookie) ou com `token`,
// e navega em memória. Testadas pela interface pública da vertical, como o hospedeiro as usa.

const ENDERECO_DO_HOSPEDEIRO = '/sistema-do-cliente/painel?aba=3#topo';

beforeEach(() => {
  window.history.replaceState(null, '', ENDERECO_DO_HOSPEDEIRO);
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
    'GET /v1/papeis': json({ itens: [] }),
    'GET /v1/chaves-api': json({ itens: [], proximo_cursor: null }),
    'GET /v1/dominios-autorizados': json([]),
    'GET /v1/auditoria/acessos': json({ itens: [], proximo_cursor: null }),
  });
}

const enderecoDaPagina = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
const semNavegacaoDoModulo = () => {
  expect(screen.queryByRole('complementary', { name: 'Menu lateral' })).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Telas do Fluxo de Cálculo' })).not.toBeInTheDocument();
};
/** A raiz do módulo em volta de um elemento. */
const raizDe = (elemento: HTMLElement) => elemento.closest('.fc-raiz');

describe('<Inicio> avulso', () => {
  it('só com apiUrl, usa o cookie, aplica o tema e mostra a tela sem menu nem abas do módulo', async () => {
    const api = simularApiCom([]);
    render(<Inicio apiUrl={API} tema="escuro" />);

    const titulo = await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(raizDe(titulo)).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('region', { name: 'Início' })).toContainElement(titulo);
    semNavegacaoDoModulo();

    expect(api.chamadas()).toEqual(['GET /v1/sessao']);
    expect(api.requisicao(0).credentials).toBe('include');
    expect(api.requisicao(0).headers.get('Authorization')).toBeNull();
    expect(enderecoDaPagina()).toBe(ENDERECO_DO_HOSPEDEIRO);
  });

  it('com token, chama a API com Bearer e sem cookie', async () => {
    const api = simularApiCom([]);
    render(<Inicio apiUrl={API} token="token-do-hospedeiro" tema="claro" />);

    const titulo = await screen.findByRole('heading', { level: 1, name: 'Início' });
    expect(raizDe(titulo)).toHaveAttribute('data-theme', 'light');
    expect(api.requisicao(0).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
    expect(api.requisicao(0).credentials).toBe('omit');
  });

  it('enquanto a sessão chega, mostra o esqueleto com o nome da tela', async () => {
    const pendente = respostaPendente();
    simularApi({ 'GET /v1/sessao': pendente.promessa });
    render(<Inicio apiUrl={API} token="token" />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando o Início');
    await act(async () => pendente.entregar(json(sessaoCom([]))));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('se a sessão não abre, diz o que houve e tenta de novo', async () => {
    const api = simularApi({ 'GET /v1/sessao': problema(403, 'origem_nao_autorizada') });
    const usuario = userEvent.setup();
    render(<Inicio apiUrl={API} token="token" />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível abrir o Início');
    expect(alerta).toHaveTextContent('Texto do servidor para origem_nao_autorizada.');

    api.definir({ 'GET /v1/sessao': json(sessaoCom([])) });
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Início' })).toBeInTheDocument();
  });

  it('sem sessão (401 sem_sessao), avisa o onSessaoExpirada uma vez e mostra a sessão encerrada', async () => {
    simularApi({ 'GET /v1/sessao': problema(401, 'sem_sessao') });
    const onSessaoExpirada = vi.fn();
    render(<Inicio apiUrl={API} token="token-vencido" onSessaoExpirada={onSessaoExpirada} />);

    expect(await screen.findByText('A sessão terminou')).toBeInTheDocument();
    expect(onSessaoExpirada).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 1, name: 'Início' })).not.toBeInTheDocument();
  });
});

describe('<Auditoria> avulsa', () => {
  it('só com apiUrl, usa o cookie e abre os acessos; a lista de tipos abre no portal da raiz, com o tema', async () => {
    const api = simularApiCom(['auditoria.ver']);
    const usuario = userEvent.setup();
    render(<Auditoria apiUrl={API} tema="escuro" />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    semNavegacaoDoModulo();
    expect(api.chamadas()).toContain('GET /v1/auditoria/acessos');
    for (const indice of api.chamadas().keys()) {
      expect(api.requisicao(indice).credentials).toBe('include');
      expect(api.requisicao(indice).headers.get('Authorization')).toBeNull();
    }

    await usuario.click(screen.getByRole('combobox', { name: 'Tipo de evento' }));
    const lista = await screen.findByRole('listbox');
    expect(lista.closest('.fc-portais')).not.toBeNull();
    expect(raizDe(lista)).toHaveAttribute('data-theme', 'dark');
  });

  it('com token, chama a API com Bearer', async () => {
    const api = simularApiCom(['auditoria.ver']);
    render(<Auditoria apiUrl={API} token="token-do-hospedeiro" />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(api.chamadas()).toContain('GET /v1/auditoria/acessos');
    for (const indice of api.chamadas().keys()) {
      expect(api.requisicao(indice).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
    }
  });

  it('sem auditoria.ver, mostra o estado sem acesso e não busca os eventos', async () => {
    const api = simularApiCom(PERMISSOES_CONFIGURADOR);
    render(<Auditoria apiUrl={API} token="token" />);

    expect(await screen.findByText('Você não tem acesso à Auditoria')).toBeInTheDocument();
    expect(screen.getByText('Peça ao administrador do cliente as permissões de que precisa.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acessos' })).not.toBeInTheDocument();
    expect(api.chamadas()).toEqual(['GET /v1/sessao']);
  });
});

describe('<Administracao> avulsa', () => {
  it('só com apiUrl, usa o cookie; as abas trocam a área sem mexer na URL da página', async () => {
    const api = simularApiCom(PERMISSOES_ADMIN);
    const usuario = userEvent.setup();
    const historicoAntes = window.history.length;
    render(<Administracao apiUrl={API} />);

    const abas = await screen.findByRole('tablist', { name: 'Administração' });
    expect(within(abas).getAllByRole('tab').map((aba) => aba.textContent)).toEqual([
      'Usuários',
      'Papéis',
      'Integração',
      'Segurança',
    ]);
    expect(within(abas).getByRole('tab', { name: 'Usuários' })).toHaveAttribute('aria-selected', 'true');
    semNavegacaoDoModulo();

    await usuario.click(within(abas).getByRole('tab', { name: 'Integração' }));
    expect(within(abas).getByRole('tab', { name: 'Integração' })).toHaveAttribute('aria-selected', 'true');
    expect(enderecoDaPagina()).toBe(ENDERECO_DO_HOSPEDEIRO);
    expect(window.history.length).toBe(historicoAntes);

    for (const indice of api.chamadas().keys()) {
      expect(api.requisicao(indice).credentials).toBe('include');
      expect(api.requisicao(indice).headers.get('Authorization')).toBeNull();
    }
  });

  it('com token e tema, o diálogo abre no portal da raiz do módulo, com o tema', async () => {
    const api = simularApiCom(PERMISSOES_ADMIN);
    const usuario = userEvent.setup();
    render(<Administracao apiUrl={API} token="token-do-hospedeiro" tema="escuro" />);

    const abas = await screen.findByRole('tablist', { name: 'Administração' });
    const [novoUsuario] = await screen.findAllByRole('button', { name: 'Novo usuário' });
    await usuario.click(novoUsuario as HTMLElement);

    const dialogo = await screen.findByRole('dialog', { name: 'Novo usuário' });
    expect(dialogo.closest('.fc-portais')).not.toBeNull();
    expect(raizDe(dialogo)).toHaveAttribute('data-theme', 'dark');
    // O portal fica na raiz desta tela, não no body do hospedeiro.
    expect(raizDe(dialogo)).toBe(raizDe(abas));
    expect(within(dialogo).getByRole('textbox', { name: 'E-mail' })).toBeInTheDocument();

    for (const indice of api.chamadas().keys()) {
      expect(api.requisicao(indice).headers.get('Authorization')).toBe('Bearer token-do-hospedeiro');
      expect(api.requisicao(indice).credentials).toBe('omit');
    }
  });

  it('mostra só as áreas permitidas', async () => {
    simularApiCom(['papeis.gerenciar', 'seguranca.gerenciar']);
    render(<Administracao apiUrl={API} token="token" />);

    const abas = await screen.findByRole('tablist', { name: 'Administração' });
    expect(within(abas).getAllByRole('tab').map((aba) => aba.textContent)).toEqual(['Papéis', 'Segurança']);
  });

  it('sem nenhuma área permitida, mostra o estado sem acesso', async () => {
    const api = simularApiCom(PERMISSOES_CONFIGURADOR);
    render(<Administracao apiUrl={API} token="token" />);

    expect(await screen.findByText('Você não tem acesso à Administração')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(api.chamadas()).toEqual(['GET /v1/sessao']);
  });

  it('dentro de um hospedeiro com react-router, monta e não mexe no roteador dele', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    const usuario = userEvent.setup();
    function OndeEstaOHospedeiro() {
      const local = useLocation();
      return <p>Hospedeiro em {local.pathname}</p>;
    }
    render(
      <MemoryRouter initialEntries={['/configuracoes/fluxo']}>
        <OndeEstaOHospedeiro />
        <Routes>
          <Route path="/configuracoes/*" element={<Administracao apiUrl={API} token="token" />} />
        </Routes>
      </MemoryRouter>,
    );

    const abas = await screen.findByRole('tablist', { name: 'Administração' });
    await usuario.click(within(abas).getByRole('tab', { name: 'Papéis' }));
    expect(within(abas).getByRole('tab', { name: 'Papéis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Hospedeiro em /configuracoes/fluxo')).toBeInTheDocument();
  });
});

describe('várias telas avulsas na mesma página', () => {
  it('cada uma tem a sua raiz, com o seu tema', async () => {
    simularApiCom(PERMISSOES_ADMIN);
    render(
      <>
        <Inicio apiUrl={API} token="token" tema="claro" />
        <Auditoria apiUrl={API} token="token" tema="escuro" />
      </>,
    );

    const inicio = await screen.findByRole('heading', { level: 1, name: 'Início' });
    const acessos = await screen.findByRole('heading', { level: 2, name: 'Acessos' });
    expect(raizDe(inicio)).toHaveAttribute('data-theme', 'light');
    expect(raizDe(acessos)).toHaveAttribute('data-theme', 'dark');
    expect(raizDe(inicio)).not.toBe(raizDe(acessos));
  });
});
