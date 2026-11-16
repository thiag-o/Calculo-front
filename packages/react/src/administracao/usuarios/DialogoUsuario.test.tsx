import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MENSAGEM_PAPEL_INEXISTENTE,
  MENSAGEM_SEM_PERMISSAO,
  MENSAGEM_ULTIMO_ADMIN,
  MENSAGEM_USUARIO_EXISTENTE,
  MENSAGEM_USUARIO_NAO_ENCONTRADO,
} from './mensagens';
import {
  ANA,
  BRUNO,
  PAPEIS,
  PAPEL_ADMIN,
  PAPEL_AUDITOR,
  PAPEL_CONFIGURADOR,
  definirCookieCsrf,
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
  api.responder('GET /v1/papeis', json({ itens: PAPEIS }));
  definirCookieCsrf('csrf-123');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const dialogo = (nome: string) => screen.getByRole('dialog', { name: nome });

async function abrirNovo(usuario: UserEvent) {
  await screen.findByText('Ana Beatriz Souza');
  const topo = screen.getByRole('heading', { level: 2, name: 'Usuários' }).closest('header')!;
  await usuario.click(within(topo).getByRole('button', { name: 'Novo usuário' }));
  const painel = await screen.findByRole('dialog', { name: 'Novo usuário' });
  await within(painel).findByRole('checkbox', { name: 'Admin' });
  return painel;
}

async function abrirEdicao(usuario: UserEvent, nome: string) {
  await screen.findByText(nome);
  await usuario.click(screen.getByRole('button', { name: `Mais ações para ${nome}` }));
  await usuario.click(await screen.findByRole('menuitem', { name: 'Editar usuário' }));
  const painel = await screen.findByRole('dialog', { name: 'Editar usuário' });
  await within(painel).findByRole('checkbox', { name: 'Admin' });
  return painel;
}

describe('Usuários: criar', () => {
  beforeEach(() => {
    api.responder('GET /v1/usuarios', json({ itens: [ANA], proximo_cursor: null }), json({ itens: [ANA, BRUNO], proximo_cursor: null }));
  });

  it('cria com e-mail, nome e papéis, fecha o diálogo e atualiza a lista', async () => {
    api.responder('POST /v1/usuarios', json(BRUNO, 201));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    expect(within(painel).getByRole('textbox', { name: 'E-mail' })).toHaveFocus();
    expect(within(painel).queryByRole('checkbox', { name: 'Ativo neste tenant' })).not.toBeInTheDocument();
    const grupo = within(painel).getByRole('group', { name: 'Papéis' });
    expect(within(grupo).getAllByRole('checkbox').map((caixa) => caixa.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
    expect(within(grupo).getByRole('checkbox', { name: 'Admin' })).toHaveAccessibleDescription(/Todas as permissões/);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), '  bruno.figueiredo.de.albuquerque@exemplo.com ');
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Bruno Figueiredo de Albuquerque');
    await usuario.click(within(grupo).getByRole('checkbox', { name: 'Configurador' }));
    await usuario.click(within(grupo).getByRole('checkbox', { name: 'Auditor' }));
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.chamadasDe('POST /v1/usuarios');
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({
      email: 'bruno.figueiredo.de.albuquerque@exemplo.com',
      nome: 'Bruno Figueiredo de Albuquerque',
      papeis: [PAPEL_CONFIGURADOR.id, PAPEL_AUDITOR.id],
    });
    expect(await screen.findByText('Bruno Figueiredo de Albuquerque')).toBeInTheDocument();
    expect(api.chamadasDe('GET /v1/usuarios')).toHaveLength(2);
    // O foco volta para quem abriu o diálogo.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Novo usuário' })[0]).toHaveFocus());
  });

  it('valida os campos antes de enviar', async () => {
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));
    expect(await within(painel).findByText('Informe o e-mail')).toBeInTheDocument();
    expect(within(painel).getByText('Informe o nome')).toBeInTheDocument();
    expect(within(painel).getByRole('textbox', { name: 'E-mail' })).toHaveAttribute('aria-invalid', 'true');

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'bruno');
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));
    expect(await within(painel).findByText('Informe um e-mail válido, como ana@empresa.com.br')).toBeInTheDocument();
    expect(api.chamadasDe('POST /v1/usuarios')).toHaveLength(0);
  });

  it('envia pelo envio do formulário (Enter num campo, no navegador)', async () => {
    api.responder('POST /v1/usuarios', json(BRUNO, 201));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'bruno@exemplo.com');
    const nome = within(painel).getByRole('textbox', { name: 'Nome' });
    await usuario.type(nome, 'Bruno');
    // O botão de envio fica no rodapé do diálogo, ligado ao formulário pelo atributo `form`. O navegador o usa no
    // Enter (botão padrão do formulário); o user-event só procura botões dentro do <form>, então o envio é direto.
    fireEvent.submit((nome as HTMLInputElement).form!);

    await waitFor(() => expect(api.chamadasDe('POST /v1/usuarios')).toHaveLength(1));
    expect(await api.chamadasDe('POST /v1/usuarios')[0]!.json()).toEqual({ email: 'bruno@exemplo.com', nome: 'Bruno', papeis: [] });
  });

  it('enquanto salva, o botão fica ocupado e não envia de novo', async () => {
    const pendente = respostaPendente(() => json(BRUNO, 201));
    api.responder('POST /v1/usuarios', pendente.promessa);
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'bruno@exemplo.com');
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Bruno');
    const criar = within(painel).getByRole('button', { name: 'Salvar' });
    await usuario.click(criar);
    await waitFor(() => expect(criar).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(criar);
    expect(api.chamadasDe('POST /v1/usuarios')).toHaveLength(1);

    pendente.liberar();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('usuario_existente: marca o e-mail e mantém o diálogo aberto', async () => {
    api.responder('POST /v1/usuarios', problema(409, 'usuario_existente'));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'ana@exemplo.com');
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Ana');
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    const email = within(painel).getByRole('textbox', { name: 'E-mail' });
    await waitFor(() => expect(email).toHaveAccessibleDescription(MENSAGEM_USUARIO_EXISTENTE));
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(dialogo('Novo usuário')).toBeInTheDocument();
  });

  it('papel_inexistente: marca os papéis e busca a lista de papéis de novo', async () => {
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }), json({ itens: [PAPEL_ADMIN, PAPEL_CONFIGURADOR] }));
    api.responder('POST /v1/usuarios', problema(422, 'papel_inexistente'));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'bruno@exemplo.com');
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Bruno');
    await usuario.click(within(painel).getByRole('checkbox', { name: 'Auditor' }));
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    const grupo = within(painel).getByRole('group', { name: 'Papéis' });
    await waitFor(() => expect(grupo).toHaveAccessibleDescription(MENSAGEM_PAPEL_INEXISTENTE));
    await waitFor(() => expect(within(painel).queryByRole('checkbox', { name: 'Auditor' })).not.toBeInTheDocument());
    expect(api.chamadasDe('GET /v1/papeis')).toHaveLength(2);
  });

  it('dados_invalidos: mostra o erro de cada campo vindo da API', async () => {
    api.responder('POST /v1/usuarios', problema(422, 'dados_invalidos', { campos: { email: 'E-mail com formato inválido.', nome: 'Nome longo demais.' } }));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'bruno@exemplo.com');
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Bruno');
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await within(painel).findByText('E-mail com formato inválido.')).toBeInTheDocument();
    expect(within(painel).getByText('Nome longo demais.')).toBeInTheDocument();
    expect(within(painel).getByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
  });

  it('outros erros (ex.: csrf_invalido): mostra a mensagem do servidor', async () => {
    api.responder('POST /v1/usuarios', problema(403, 'csrf_invalido'));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);

    await usuario.type(within(painel).getByRole('textbox', { name: 'E-mail' }), 'bruno@exemplo.com');
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Bruno');
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await within(painel).findByRole('alert')).toHaveTextContent('Texto do servidor para csrf_invalido.');
  });

  it('Cancelar fecha sem enviar', async () => {
    const { usuario } = renderizarUsuarios();
    const painel = await abrirNovo(usuario);
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), 'Rascunho');
    await usuario.click(within(painel).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe('POST /v1/usuarios')).toHaveLength(0);

    // Reabrir começa do zero.
    const novo = await abrirNovo(usuario);
    expect(within(novo).getByRole('textbox', { name: 'Nome' })).toHaveValue('');
  });
});

describe('Usuários: papéis no formulário', () => {
  beforeEach(() => {
    api.responder('GET /v1/usuarios', json({ itens: [ANA], proximo_cursor: null }));
  });

  it('enquanto os papéis carregam, salvar fica desabilitado com o motivo', async () => {
    const pendente = respostaPendente(() => json({ itens: PAPEIS }));
    api.responder('GET /v1/papeis', pendente.promessa);
    const { usuario } = renderizarUsuarios();
    await screen.findByText('Ana Beatriz Souza');
    await usuario.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const painel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(within(painel).getByRole('status')).toHaveTextContent('Carregando papéis');
    const criar = within(painel).getByRole('button', { name: 'Salvar' });
    expect(criar).toHaveAttribute('aria-disabled', 'true');
    expect(criar).toHaveAccessibleDescription('Aguarde a lista de papéis');

    pendente.liberar();
    expect(await within(painel).findByRole('checkbox', { name: 'Configurador' })).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
  });

  it('lista os papéis por GET /v1/papeis ao criar e ao editar, com salvar liberado', async () => {
    api.responder('GET /v1/usuarios', json({ itens: [ANA, BRUNO], proximo_cursor: null }));
    const { usuario } = renderizarUsuarios();

    const novo = await abrirNovo(usuario);
    expect(within(within(novo).getByRole('group', { name: 'Papéis' })).getAllByRole('checkbox')).toHaveLength(PAPEIS.length);
    expect(within(novo).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(novo).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
    await usuario.click(within(novo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const edicao = await abrirEdicao(usuario, 'Bruno Figueiredo de Albuquerque');
    expect(within(within(edicao).getByRole('group', { name: 'Papéis' })).getAllByRole('checkbox')).toHaveLength(PAPEIS.length);
    expect(within(edicao).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(edicao).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
    expect(api.chamadasDe('GET /v1/papeis').length).toBeGreaterThanOrEqual(1);
  });

  it('sem_permissao ao listar os papéis: é a falta de gerenciar usuários', async () => {
    api.responder('GET /v1/papeis', problema(403, 'sem_permissao'));
    const { usuario } = renderizarUsuarios();
    await screen.findByText('Ana Beatriz Souza');
    await usuario.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const painel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
  });

  it('erro ao carregar os papéis: tenta de novo', async () => {
    api.responder('GET /v1/papeis', problema(503, 'indisponivel'), json({ itens: PAPEIS }));
    const { usuario } = renderizarUsuarios();
    await screen.findByText('Ana Beatriz Souza');
    await usuario.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const painel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(await within(painel).findByRole('alert')).toHaveTextContent('Texto do servidor para indisponivel.');
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(painel).findByRole('checkbox', { name: 'Admin' })).toBeInTheDocument();
  });

  it('tenant sem papéis: diz o que falta', async () => {
    api.responder('GET /v1/papeis', json({ itens: [] }));
    const { usuario } = renderizarUsuarios();
    await screen.findByText('Ana Beatriz Souza');
    await usuario.click(screen.getAllByRole('button', { name: 'Novo usuário' })[0]!);
    const painel = await screen.findByRole('dialog', { name: 'Novo usuário' });

    expect(await within(painel).findByText('Nenhum papel no tenant. Crie um papel para dar acesso.')).toBeInTheDocument();
  });
});

describe('Usuários: editar', () => {
  beforeEach(() => {
    api.responder('GET /v1/usuarios', json({ itens: [ANA, BRUNO], proximo_cursor: null }));
  });

  it('abre com os dados atuais e salva nome, papéis e situação', async () => {
    const alterado = { ...BRUNO, nome: 'Bruno F. Albuquerque', papeis: [{ id: PAPEL_AUDITOR.id, nome: 'Auditor' }], ativo: false };
    api.responder('PUT /v1/usuarios/' + BRUNO.id, json(alterado));
    api.responder('GET /v1/usuarios', json({ itens: [ANA, BRUNO], proximo_cursor: null }), json({ itens: [ANA, alterado], proximo_cursor: null }));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirEdicao(usuario, 'Bruno Figueiredo de Albuquerque');

    expect(within(painel).getByText('bruno.figueiredo.de.albuquerque@exemplo.com')).toBeInTheDocument();
    expect(within(painel).queryByRole('textbox', { name: 'E-mail' })).not.toBeInTheDocument();
    const nome = within(painel).getByRole('textbox', { name: 'Nome' });
    expect(nome).toHaveValue('Bruno Figueiredo de Albuquerque');
    expect(nome).toHaveAccessibleDescription('O nome vale em todos os tenants do usuário.');
    expect(within(painel).getByRole('checkbox', { name: 'Configurador' })).toBeChecked();
    expect(within(painel).getByRole('checkbox', { name: 'Auditor' })).toBeChecked();
    expect(within(painel).getByRole('checkbox', { name: 'Admin' })).not.toBeChecked();
    const ativo = within(painel).getByRole('checkbox', { name: 'Ativo neste tenant' });
    expect(ativo).toBeChecked();
    expect(ativo).toHaveAccessibleDescription('Desativar encerra as sessões do usuário neste tenant.');

    await usuario.clear(nome);
    await usuario.type(nome, 'Bruno F. Albuquerque');
    await usuario.click(within(painel).getByRole('checkbox', { name: 'Configurador' }));
    await usuario.click(ativo);
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [req] = api.chamadasDe('PUT /v1/usuarios/' + BRUNO.id);
    expect(req!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await req!.json()).toEqual({ nome: 'Bruno F. Albuquerque', papeis: [PAPEL_AUDITOR.id], ativo: false });
    expect(await screen.findByText('Bruno F. Albuquerque')).toBeInTheDocument();
    // O foco volta para o menu da linha.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mais ações para Bruno F. Albuquerque' })).toHaveFocus());
  });

  it('ultimo_admin: explica e mantém o diálogo aberto', async () => {
    api.responder('PUT /v1/usuarios/' + ANA.id, problema(409, 'ultimo_admin'));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirEdicao(usuario, 'Ana Beatriz Souza');

    await usuario.click(within(painel).getByRole('checkbox', { name: 'Admin' }));
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_ULTIMO_ADMIN);
    expect(dialogo('Editar usuário')).toBeInTheDocument();
    expect(await api.chamadasDe('PUT /v1/usuarios/' + ANA.id)[0]!.json()).toEqual({ nome: 'Ana Beatriz Souza', papeis: [], ativo: true });
  });

  it('nao_encontrado: avisa e atualiza a lista', async () => {
    api.responder('PUT /v1/usuarios/' + BRUNO.id, problema(404, 'nao_encontrado'));
    api.responder('GET /v1/usuarios', json({ itens: [ANA, BRUNO], proximo_cursor: null }), json({ itens: [ANA], proximo_cursor: null }));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirEdicao(usuario, 'Bruno Figueiredo de Albuquerque');

    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await within(painel).findByRole('alert')).toHaveTextContent(MENSAGEM_USUARIO_NAO_ENCONTRADO);
    await waitFor(() => expect(api.chamadasDe('GET /v1/usuarios')).toHaveLength(2));
  });

  it('papel_inexistente: marca os papéis', async () => {
    api.responder('PUT /v1/usuarios/' + BRUNO.id, problema(422, 'papel_inexistente'));
    const { usuario } = renderizarUsuarios();
    const painel = await abrirEdicao(usuario, 'Bruno Figueiredo de Albuquerque');

    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    const grupo = within(painel).getByRole('group', { name: 'Papéis' });
    await waitFor(() => expect(grupo).toHaveAccessibleDescription(MENSAGEM_PAPEL_INEXISTENTE));
  });

  it('valida o nome vazio', async () => {
    const { usuario } = renderizarUsuarios();
    const painel = await abrirEdicao(usuario, 'Bruno Figueiredo de Albuquerque');

    await usuario.clear(within(painel).getByRole('textbox', { name: 'Nome' }));
    await usuario.type(within(painel).getByRole('textbox', { name: 'Nome' }), '   ');
    await usuario.click(within(painel).getByRole('button', { name: 'Salvar' }));

    expect(await within(painel).findByText('Informe o nome')).toBeInTheDocument();
    expect(api.chamadasDe('PUT /v1/usuarios/' + BRUNO.id)).toHaveLength(0);
  });
});
