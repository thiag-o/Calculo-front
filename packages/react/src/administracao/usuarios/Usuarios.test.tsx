import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTIVO_LINK_EXTERNO, MOTIVO_LINK_INATIVO } from './Usuarios';
import { MENSAGEM_SEM_PERMISSAO } from './mensagens';
import {
  ANA,
  BRUNO,
  CARLA,
  DAVI,
  json,
  problema,
  renderizarUsuarios,
  respostaPendente,
  simularApi,
  type ApiSimulada,
} from './usuarios.test.apoio';

let api: ApiSimulada;

beforeEach(() => {
  api = simularApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tabela = () => screen.getByRole('table', { name: 'Usuários do tenant' });
const linhaDe = (nome: string) => screen.getByRole('row', { name: new RegExp(nome) });

describe('Usuários: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pendente = respostaPendente(() => json({ itens: [ANA], proximo_cursor: null }));
    api.responder('GET /v1/usuarios', pendente.promessa);
    renderizarUsuarios();

    expect(screen.getByRole('heading', { level: 2, name: 'Usuários' })).toBeInTheDocument();
    expect(tabela()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando usuários do tenant');

    pendente.liberar();
    expect(await screen.findByText('Ana Beatriz Souza')).toBeInTheDocument();
    expect(tabela()).not.toHaveAttribute('aria-busy');
  });

  it('mostra nome, e-mail, papéis e situação de cada usuário', async () => {
    api.responder('GET /v1/usuarios', json({ itens: [ANA, BRUNO, CARLA, DAVI], proximo_cursor: null }));
    renderizarUsuarios();

    await screen.findByText('Ana Beatriz Souza');
    expect(screen.getByText('4 usuários')).toBeInTheDocument();
    expect(within(tabela()).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Nome', 'Papéis', 'Situação', 'Ações']);

    const bruno = linhaDe('Bruno Figueiredo de Albuquerque');
    expect(within(bruno).getByText('bruno.figueiredo.de.albuquerque@exemplo.com')).toBeInTheDocument();
    const papeisBruno = within(bruno).getByRole('list', { name: 'Papéis de Bruno Figueiredo de Albuquerque' });
    expect(within(papeisBruno).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Configurador', 'Auditor']);
    expect(within(bruno).getByText('Ativo')).toBeInTheDocument();

    const carla = linhaDe('Carla Menezes');
    expect(within(carla).getByText('Inativo')).toBeInTheDocument();
    // Sem papéis: "—".
    expect(within(carla).getByText('—')).toBeInTheDocument();

    const davi = linhaDe('Davi Externo');
    expect(within(davi).getByText('Incorporação')).toBeInTheDocument();

    expect(api.chamadasDe('GET /v1/usuarios')).toHaveLength(1);
    expect(new URL(api.chamadasDe('GET /v1/usuarios')[0]!.url).search).toBe('');
  });

  it('mostra o estado vazio com a ação de criar', async () => {
    api.responder('GET /v1/usuarios', json({ itens: [], proximo_cursor: null }));
    api.responder('GET /v1/papeis', json({ itens: [] }));
    const { usuario } = renderizarUsuarios();

    expect(await screen.findByText('Nenhum usuário ainda')).toBeInTheDocument();
    expect(screen.getByText('Crie o primeiro usuário e gere o link para a pessoa definir a senha.')).toBeInTheDocument();
    expect(screen.getByText('0 usuários')).toBeInTheDocument();

    const celulaVazia = within(tabela()).getByText('Nenhum usuário ainda').closest('td')!;
    await usuario.click(within(celulaVazia).getByRole('button', { name: 'Novo usuário' }));
    expect(await screen.findByRole('dialog', { name: 'Novo usuário' })).toBeInTheDocument();
  });

  it('em erro, explica e tenta de novo', async () => {
    api.responder('GET /v1/usuarios', problema(503, 'indisponivel'), json({ itens: [ANA], proximo_cursor: null }));
    const { usuario } = renderizarUsuarios();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os usuários');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Ana Beatriz Souza')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.chamadasDe('GET /v1/usuarios')).toHaveLength(2);
  });

  it('sem conexão, mostra a mensagem do cliente', async () => {
    api.responder('GET /v1/usuarios', () => Promise.reject(new TypeError('Failed to fetch')));
    renderizarUsuarios();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor');
  });

  it('sem permissão, diz o que fazer e não oferece tentar de novo', async () => {
    api.responder('GET /v1/usuarios', problema(403, 'sem_permissao'));
    renderizarUsuarios();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('carrega a próxima página pelo cursor', async () => {
    api.responder(
      'GET /v1/usuarios',
      json({ itens: [ANA, BRUNO], proximo_cursor: 'cursor-2' }),
      json({ itens: [CARLA], proximo_cursor: null }),
    );
    const { usuario } = renderizarUsuarios();

    await screen.findByText('Ana Beatriz Souza');
    expect(screen.getByText('Mais de 2 usuários')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais usuários' }));

    expect(await screen.findByText('Carla Menezes')).toBeInTheDocument();
    expect(screen.getByText('3 usuários')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais usuários' })).not.toBeInTheDocument();
    const segunda = api.chamadasDe('GET /v1/usuarios')[1]!;
    expect(new URL(segunda.url).searchParams.get('cursor')).toBe('cursor-2');
  });

  it('se a próxima página falha, mantém a lista e tenta de novo', async () => {
    api.responder(
      'GET /v1/usuarios',
      json({ itens: [ANA], proximo_cursor: 'cursor-2' }),
      problema(422, 'cursor_invalido'),
      json({ itens: [CARLA], proximo_cursor: null }),
    );
    const { usuario } = renderizarUsuarios();

    await screen.findByText('Ana Beatriz Souza');
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais usuários' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar mais usuários');
    expect(screen.getByText('Ana Beatriz Souza')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Carla Menezes')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('o menu de cada linha oferece editar e gerar o link, com o motivo quando não dá', async () => {
    api.responder('GET /v1/usuarios', json({ itens: [ANA, CARLA, DAVI], proximo_cursor: null }));
    const { usuario } = renderizarUsuarios();
    await screen.findByText('Ana Beatriz Souza');

    await usuario.click(screen.getByRole('button', { name: 'Mais ações para Ana Beatriz Souza' }));
    let menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Editar usuário' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Gerar link de redefinição' })).not.toHaveAttribute('aria-disabled');
    await usuario.keyboard('{Escape}');

    await usuario.click(screen.getByRole('button', { name: 'Mais ações para Carla Menezes' }));
    menu = await screen.findByRole('menu');
    const linkInativo = within(menu).getByRole('menuitem', { name: 'Gerar link de redefinição' });
    expect(linkInativo).toHaveAttribute('aria-disabled', 'true');
    expect(linkInativo).toHaveAccessibleDescription(MOTIVO_LINK_INATIVO);
    await usuario.click(linkInativo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await usuario.keyboard('{Escape}');

    await usuario.click(screen.getByRole('button', { name: 'Mais ações para Davi Externo' }));
    menu = await screen.findByRole('menu');
    const linkExterno = within(menu).getByRole('menuitem', { name: 'Gerar link de redefinição' });
    expect(linkExterno).toHaveAttribute('aria-disabled', 'true');
    expect(linkExterno).toHaveAccessibleDescription(MOTIVO_LINK_EXTERNO);
  });
});
