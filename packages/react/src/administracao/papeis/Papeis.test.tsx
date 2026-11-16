import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTIVO_CATALOGO_CARREGANDO, MOTIVO_CATALOGO_COM_ERRO } from './DialogoPapel';
import { MOTIVO_REMOCAO_EM_USO } from './DialogoRemoverPapel';
import { MOTIVO_PAPEL_FIXO, motivoPapelEmUso } from './Papeis';
import {
  MENSAGEM_PAPEL_EM_USO,
  MENSAGEM_PAPEL_EXISTENTE,
  MENSAGEM_PAPEL_NAO_ENCONTRADO,
  MENSAGEM_SEM_PERMISSAO,
} from './mensagens';
import {
  CATALOGO,
  PAPEL_ADMIN,
  PAPEL_AUDITOR,
  PAPEL_CONFIGURADOR,
  PAPEL_VAZIO,
  definirCookieCsrf,
  json,
  problema,
  renderizarPapeis,
  respostaPendente,
  simularApi,
  type ApiSimulada,
  type TelaPapeis,
} from './papeis.test.apoio';

let api: ApiSimulada;

beforeEach(() => {
  api = simularApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tabela = () => screen.getByRole('table', { name: 'Papéis do tenant' });
const linhaDe = (nome: string) => screen.getByRole('row', { name: new RegExp(nome) });
const PAPEIS = [PAPEL_ADMIN, PAPEL_CONFIGURADOR, PAPEL_AUDITOR, PAPEL_VAZIO];

async function abrirMenuDe(usuario: TelaPapeis['usuario'], nome: string) {
  await usuario.click(screen.getByRole('button', { name: `Mais ações para ${nome}` }));
  return screen.findByRole('menu');
}

describe('Papéis: lista', () => {
  it('mostra o esqueleto enquanto carrega e anuncia o carregamento', async () => {
    const pendente = respostaPendente(() => json({ itens: PAPEIS }));
    api.responder('GET /v1/papeis', pendente.promessa);
    renderizarPapeis();

    expect(screen.getByRole('heading', { level: 2, name: 'Papéis' })).toBeInTheDocument();
    expect(tabela()).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando papéis do tenant');

    pendente.liberar();
    expect(await screen.findByText('Configurador')).toBeInTheDocument();
    expect(tabela()).not.toHaveAttribute('aria-busy');
  });

  it('mostra cada papel com o resumo das permissões e quantos usuários o têm', async () => {
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }));
    renderizarPapeis();

    await screen.findByText('Configurador');
    expect(screen.getByText('4 papéis')).toBeInTheDocument();
    expect(within(tabela()).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Papel', 'Usuários', 'Ações']);

    const configurador = linhaDe('Configurador');
    expect(within(configurador).getByText('3 permissões')).toBeInTheDocument();
    expect(within(configurador).getByText('3')).toBeInTheDocument();

    const auditor = linhaDe(PAPEL_AUDITOR.nome);
    expect(within(auditor).getByText('1 permissão')).toBeInTheDocument();
    expect(within(auditor).getByText('0')).toBeInTheDocument();

    expect(within(linhaDe('Sem acesso')).getByText('Nenhuma permissão')).toBeInTheDocument();
    expect(api.chamadasDe('GET /v1/papeis')).toHaveLength(1);
  });

  it('o Admin aparece travado, com o motivo, e não oferece editar nem remover', async () => {
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }));
    renderizarPapeis();
    await screen.findByText('Configurador');

    const admin = linhaDe('Admin');
    expect(within(admin).getByText('Fixo')).toBeInTheDocument();
    expect(within(admin).getByText(MOTIVO_PAPEL_FIXO)).toBeInTheDocument();
    expect(within(admin).getByRole('img', { name: 'Admin travado' })).toBeInTheDocument();
    // Nenhum botão na linha do Admin: nem menu, nem editar, nem remover.
    expect(within(admin).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Mais ações para Admin' })).not.toBeInTheDocument();
    // Os outros papéis têm o menu.
    expect(screen.getByRole('button', { name: 'Mais ações para Configurador' })).toBeInTheDocument();
  });

  it('mostra o estado vazio com a ação de criar', async () => {
    api.responder('GET /v1/papeis', json({ itens: [] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    const { usuario } = renderizarPapeis();

    expect(await screen.findByText('Nenhum papel ainda')).toBeInTheDocument();
    expect(screen.getByText('0 papéis')).toBeInTheDocument();
    const vazio = within(tabela());
    await usuario.click(vazio.getByRole('button', { name: 'Novo papel' }));
    expect(await screen.findByRole('dialog', { name: 'Novo papel' })).toBeInTheDocument();
  });

  it('mostra o erro com "Tentar de novo" e carrega de novo', async () => {
    api.responder('GET /v1/papeis', problema(503, 'indisponivel'), json({ itens: PAPEIS }));
    const { usuario } = renderizarPapeis();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os papéis');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Configurador')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('sem a permissão, explica e não oferece "Tentar de novo"', async () => {
    api.responder('GET /v1/papeis', problema(403, 'sem_permissao'));
    renderizarPapeis();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('o menu oferece editar e remover; remover fica desabilitado, com o motivo, se o papel tem usuários', async () => {
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }));
    const { usuario } = renderizarPapeis();
    await screen.findByText('Configurador');

    let menu = await abrirMenuDe(usuario, PAPEL_AUDITOR.nome);
    expect(within(menu).getByRole('menuitem', { name: 'Editar papel' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Remover papel' })).not.toHaveAttribute('aria-disabled');
    await usuario.keyboard('{Escape}');

    menu = await abrirMenuDe(usuario, 'Configurador');
    const remover = within(menu).getByRole('menuitem', { name: 'Remover papel' });
    expect(remover).toHaveAttribute('aria-disabled', 'true');
    expect(remover).toHaveAccessibleDescription(motivoPapelEmUso(3));
    expect(motivoPapelEmUso(3)).toBe('Em uso por 3 usuários: tire o papel deles em Usuários antes de remover');
    await usuario.click(remover);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await usuario.keyboard('{Escape}');

    menu = await abrirMenuDe(usuario, 'Sem acesso');
    expect(within(menu).getByRole('menuitem', { name: 'Remover papel' })).toHaveAccessibleDescription(
      'Em uso por 1 usuário: tire o papel deles em Usuários antes de remover',
    );
  });
});

describe('Papéis: criar', () => {
  it('mostra o catálogo agrupado, com as sensíveis destacadas, e cria o papel', async () => {
    definirCookieCsrf('csrf-123');
    api.responder('GET /v1/papeis', json({ itens: [PAPEL_ADMIN] }), json({ itens: [PAPEL_ADMIN, PAPEL_AUDITOR] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    api.responder('POST /v1/papeis', json(PAPEL_AUDITOR, 201));
    const { usuario } = renderizarPapeis();
    await screen.findByText('1 papel');

    await usuario.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Novo papel' });
    const catalogo = await within(dialogo).findByRole('group', { name: 'Permissões' });

    // Grupos na ordem do catálogo, cada um com as suas permissões.
    const grupos = within(catalogo).getAllByRole('group');
    expect(grupos.map((grupo) => grupo.querySelector('legend')?.textContent)).toEqual(['Administração', 'Dados', 'Workflows', 'Auditoria']);
    const dados = within(catalogo).getByRole('group', { name: 'Dados' });
    expect(within(dados).getAllByRole('checkbox')).toHaveLength(2);

    // As sensíveis levam o selo "Sensível" (também no nome acessível) e a ajuda explica.
    expect(within(dados).getByRole('checkbox', { name: 'Gerenciar credenciais Sensível' })).toBeInTheDocument();
    expect(within(dados).getByRole('checkbox', { name: 'Ver conexões' })).toBeInTheDocument();
    expect(within(catalogo).getAllByRole('checkbox', { name: /Sensível$/ })).toHaveLength(3);
    expect(catalogo).toHaveAccessibleDescription(/Dê uma a uma, só a quem precisa/);
    expect(within(catalogo).getByText('0 de 9 marcadas')).toBeInTheDocument();

    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Nome' }), '  Auditor de contratos  ');
    await usuario.click(within(catalogo).getByRole('checkbox', { name: 'Ver auditoria' }));
    await usuario.click(within(catalogo).getByRole('checkbox', { name: 'Aprovar versões Sensível' }));
    expect(within(catalogo).getByText('2 de 9 marcadas')).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [criacao] = api.chamadasDe('POST /v1/papeis');
    expect(criacao!.headers.get('X-CSRF-Token')).toBe('csrf-123');
    expect(await criacao!.json()).toEqual({ nome: 'Auditor de contratos', permissoes: ['auditoria.ver', 'versao.aprovar'] });
    expect(await screen.findByText(PAPEL_AUDITOR.nome)).toBeInTheDocument();
  });

  it('pede o nome antes de enviar', async () => {
    api.responder('GET /v1/papeis', json({ itens: [PAPEL_ADMIN] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    const { usuario } = renderizarPapeis();
    await screen.findByText('1 papel');

    await usuario.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Novo papel' });
    await within(dialogo).findByRole('group', { name: 'Administração' });
    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Nome' }), '   ');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('textbox', { name: 'Nome' })).toHaveAccessibleDescription('Informe o nome do papel');
    expect(api.chamadasDe('POST /v1/papeis')).toHaveLength(0);
  });

  it('não deixa salvar enquanto o catálogo carrega', async () => {
    const pendente = respostaPendente(() => json({ itens: CATALOGO }));
    api.responder('GET /v1/papeis', json({ itens: [PAPEL_ADMIN] }));
    api.responder('GET /v1/permissoes', pendente.promessa);
    const { usuario } = renderizarPapeis();
    await screen.findByText('1 papel');

    await usuario.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Novo papel' });
    expect(within(dialogo).getByText('Carregando o catálogo de permissões')).toBeInTheDocument();
    const salvar = within(dialogo).getByRole('button', { name: 'Salvar' });
    expect(salvar).toHaveAttribute('aria-disabled', 'true');
    expect(salvar).toHaveAccessibleDescription(MOTIVO_CATALOGO_CARREGANDO);

    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Leitura');
    await usuario.click(salvar);
    expect(api.chamadasDe('POST /v1/papeis')).toHaveLength(0);

    pendente.liberar();
    await within(dialogo).findByRole('group', { name: 'Dados' });
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
  });

  it('mostra o erro do catálogo, com "Tentar de novo", e não deixa salvar', async () => {
    api.responder('GET /v1/papeis', json({ itens: [PAPEL_ADMIN] }));
    api.responder('GET /v1/permissoes', problema(503, 'indisponivel'), json({ itens: CATALOGO }));
    const { usuario } = renderizarPapeis();
    await screen.findByText('1 papel');

    await usuario.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Novo papel' });
    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar o catálogo de permissões');
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toHaveAccessibleDescription(MOTIVO_CATALOGO_COM_ERRO);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    expect(await within(dialogo).findByRole('group', { name: 'Workflows' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('aria-disabled');
  });

  it('papel_existente: mostra o erro no nome e mantém o diálogo aberto', async () => {
    api.responder('GET /v1/papeis', json({ itens: [PAPEL_ADMIN, PAPEL_CONFIGURADOR] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    api.responder('POST /v1/papeis', problema(409, 'papel_existente'));
    const { usuario } = renderizarPapeis();
    await screen.findByText('Configurador');

    await usuario.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Novo papel' });
    await within(dialogo).findByRole('group', { name: 'Dados' });
    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Nome' }), 'configurador');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toHaveAccessibleDescription(MENSAGEM_PAPEL_EXISTENTE),
    );
    expect(within(dialogo).getByRole('textbox', { name: 'Nome' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog', { name: 'Novo papel' })).toBeInTheDocument();
  });

  it('dados_invalidos: mostra o erro de cada campo vindo da API', async () => {
    api.responder('GET /v1/papeis', json({ itens: [PAPEL_ADMIN] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    api.responder('POST /v1/papeis', problema(422, 'dados_invalidos', { campos: { 'permissoes.0': 'Permissão desconhecida.' } }));
    const { usuario } = renderizarPapeis();
    await screen.findByText('1 papel');

    await usuario.click(screen.getByRole('button', { name: 'Novo papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Novo papel' });
    const catalogo = await within(dialogo).findByRole('group', { name: 'Permissões' });
    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Nome' }), 'Leitura');
    await usuario.click(within(catalogo).getByRole('checkbox', { name: 'Ver workflows' }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(catalogo).toHaveAccessibleDescription(/Permissão desconhecida\./));
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('Confira os campos destacados e tente de novo.');
  });
});

describe('Papéis: editar', () => {
  it('abre com o nome e as permissões do papel e salva o que mudou', async () => {
    definirCookieCsrf('csrf-456');
    const alterado = { ...PAPEL_CONFIGURADOR, nome: 'Configurador sênior', permissoes: ['workflows.ver', 'conexoes.ver', 'versao.aprovar'] };
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }), json({ itens: [PAPEL_ADMIN, alterado, PAPEL_AUDITOR, PAPEL_VAZIO] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    api.responder(`PUT /v1/papeis/${PAPEL_CONFIGURADOR.id}`, json(alterado));
    const { usuario } = renderizarPapeis();
    await screen.findByText('Configurador');

    const menu = await abrirMenuDe(usuario, 'Configurador');
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Editar papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar papel' });
    const catalogo = await within(dialogo).findByRole('group', { name: 'Permissões' });

    const nome = within(dialogo).getByRole('textbox', { name: 'Nome' });
    expect(nome).toHaveValue('Configurador');
    expect(within(catalogo).getByRole('checkbox', { name: 'Ver workflows' })).toBeChecked();
    expect(within(catalogo).getByRole('checkbox', { name: 'Editar workflows' })).toBeChecked();
    expect(within(catalogo).getByRole('checkbox', { name: 'Ver conexões' })).toBeChecked();
    expect(within(catalogo).getByRole('checkbox', { name: 'Aprovar versões Sensível' })).not.toBeChecked();
    expect(within(catalogo).getByText('3 de 9 marcadas')).toBeInTheDocument();

    await usuario.clear(nome);
    await usuario.type(nome, 'Configurador sênior');
    await usuario.click(within(catalogo).getByRole('checkbox', { name: 'Editar workflows' }));
    await usuario.click(within(catalogo).getByRole('checkbox', { name: 'Aprovar versões Sensível' }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [alteracao] = api.chamadasDe(`PUT /v1/papeis/${PAPEL_CONFIGURADOR.id}`);
    expect(alteracao!.headers.get('X-CSRF-Token')).toBe('csrf-456');
    expect(await alteracao!.json()).toEqual({ nome: 'Configurador sênior', permissoes: ['workflows.ver', 'conexoes.ver', 'versao.aprovar'] });
    expect(await screen.findByText('Configurador sênior')).toBeInTheDocument();
  });

  it('nao_encontrado: avisa que o papel não existe mais e atualiza a lista', async () => {
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }), json({ itens: [PAPEL_ADMIN, PAPEL_CONFIGURADOR, PAPEL_VAZIO] }));
    api.responder('GET /v1/permissoes', json({ itens: CATALOGO }));
    api.responder(`PUT /v1/papeis/${PAPEL_AUDITOR.id}`, problema(404, 'nao_encontrado'));
    const { usuario } = renderizarPapeis();
    await screen.findByText(PAPEL_AUDITOR.nome);

    const menu = await abrirMenuDe(usuario, PAPEL_AUDITOR.nome);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Editar papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar papel' });
    await within(dialogo).findByRole('group', { name: 'Dados' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_PAPEL_NAO_ENCONTRADO);
    await waitFor(() => expect(api.chamadasDe('GET /v1/papeis')).toHaveLength(2));
  });
});

describe('Papéis: remover', () => {
  it('pede confirmação e remove o papel', async () => {
    definirCookieCsrf('csrf-789');
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }), json({ itens: [PAPEL_ADMIN, PAPEL_CONFIGURADOR, PAPEL_VAZIO] }));
    api.responder(`DELETE /v1/papeis/${PAPEL_AUDITOR.id}`, new Response(null, { status: 204 }));
    const { usuario } = renderizarPapeis();
    await screen.findByText(PAPEL_AUDITOR.nome);

    const menu = await abrirMenuDe(usuario, PAPEL_AUDITOR.nome);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Remover papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Remover papel' });
    expect(dialogo).toHaveAccessibleDescription(`O papel ${PAPEL_AUDITOR.nome} deixa de existir neste tenant. Não dá para desfazer.`);
    expect(api.chamadasDe(`DELETE /v1/papeis/${PAPEL_AUDITOR.id}`)).toHaveLength(0);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover papel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const [remocao] = api.chamadasDe(`DELETE /v1/papeis/${PAPEL_AUDITOR.id}`);
    expect(remocao!.headers.get('X-CSRF-Token')).toBe('csrf-789');
    await waitFor(() => expect(screen.queryByText(PAPEL_AUDITOR.nome)).not.toBeInTheDocument());
    expect(screen.getByText('3 papéis')).toBeInTheDocument();
  });

  it('"Cancelar" fecha sem remover', async () => {
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }));
    const { usuario } = renderizarPapeis();
    await screen.findByText(PAPEL_AUDITOR.nome);

    const menu = await abrirMenuDe(usuario, PAPEL_AUDITOR.nome);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Remover papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Remover papel' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chamadasDe(`DELETE /v1/papeis/${PAPEL_AUDITOR.id}`)).toHaveLength(0);
    expect(screen.getByText(PAPEL_AUDITOR.nome)).toBeInTheDocument();
  });

  it('papel_em_uso: explica, trava o botão com o motivo e atualiza a lista', async () => {
    const emUso = { ...PAPEL_AUDITOR, total_usuarios: 1 };
    api.responder('GET /v1/papeis', json({ itens: PAPEIS }), json({ itens: [PAPEL_ADMIN, PAPEL_CONFIGURADOR, emUso, PAPEL_VAZIO] }));
    api.responder(`DELETE /v1/papeis/${PAPEL_AUDITOR.id}`, problema(409, 'papel_em_uso'));
    const { usuario } = renderizarPapeis();
    await screen.findByText(PAPEL_AUDITOR.nome);

    const menu = await abrirMenuDe(usuario, PAPEL_AUDITOR.nome);
    await usuario.click(within(menu).getByRole('menuitem', { name: 'Remover papel' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Remover papel' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover papel' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(MENSAGEM_PAPEL_EM_USO);
    const remover = within(dialogo).getByRole('button', { name: 'Remover papel' });
    expect(remover).toHaveAttribute('aria-disabled', 'true');
    expect(remover).toHaveAccessibleDescription(MOTIVO_REMOCAO_EM_USO);
    await usuario.click(remover);
    expect(api.chamadasDe(`DELETE /v1/papeis/${PAPEL_AUDITOR.id}`)).toHaveLength(1);
    await waitFor(() => expect(api.chamadasDe('GET /v1/papeis')).toHaveLength(2));
  });
});
