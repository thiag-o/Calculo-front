import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auditoria } from '..';
import {
  MENSAGEM_CURSOR_INVALIDO,
  MENSAGEM_PERIODO_INVERTIDO,
  MENSAGEM_PERIODO_RECUSADO,
  MENSAGEM_SEM_PERMISSAO,
  MENSAGEM_TIPO_INVALIDO,
} from './mensagens';
import { TIPOS_EVENTO } from './tiposEvento';
import {
  BLOQUEIO_BRUNO,
  evento,
  FALHA_BRUNO,
  LOGIN_ANA,
  pagina,
  problema,
  renderizarAcessos,
  respostaPendente,
  ROTA_ACESSOS,
  simularApi,
  type ApiSimulada,
} from './acessos.test.apoio';

let api: ApiSimulada;

beforeEach(() => {
  api = simularApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function buscas(): URLSearchParams[] {
  return api.buscasDe(ROTA_ACESSOS);
}

function ultimaBusca(): URLSearchParams {
  return buscas().at(-1)!;
}

function linhaDe(texto: string): HTMLElement {
  return screen.getAllByText(texto)[0]!.closest('tr')!;
}

function campoTipo(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Tipo de evento' });
}

function campoDe(): HTMLInputElement {
  return screen.getByLabelText('De');
}

function campoAte(): HTMLInputElement {
  return screen.getByLabelText('Até');
}

async function escolherTipo(usuario: UserEvent, rotulo: string) {
  await usuario.click(campoTipo());
  await usuario.click(await screen.findByRole('option', { name: rotulo }));
}

/** O ponto de status (decorativo) da palavra dada, dentro de uma linha. */
function corDoStatus(palavra: HTMLElement): string | undefined {
  const status = palavra.closest('.fc-status')!;
  return Array.from(status.classList).find((classe) => classe.startsWith('fc-status-') && classe !== 'fc-status-palavra');
}

describe('Auditoria › Acessos: lista', () => {
  it('mostra quando, evento (ponto + palavra), quem, IP e detalhe, do mais recente ao mais antigo', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA, BLOQUEIO_BRUNO, FALHA_BRUNO]));
    renderizarAcessos();

    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(screen.getByText('3 eventos')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Eventos de acesso do tenant' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((cabecalho) => cabecalho.textContent)).toEqual([
      'Quando',
      'Evento',
      'Quem',
      'IP',
      'Detalhe',
    ]);

    const ana = within(linhaDe('ana.souza@exemplo.com.br'));
    expect(ana.getByText('15/11/2026 às 09:05')).toBeInTheDocument();
    expect(ana.getByText('203.0.113.7')).toHaveClass('fc-mono-13');
    expect(corDoStatus(ana.getByText('Login'))).toBe('fc-status-verde');

    const falha = within(linhaDe('14/11/2026 às 18:30'));
    expect(corDoStatus(falha.getByText('Falha de login'))).toBe('fc-status-ambar');
    expect(falha.getByText('2001:db8:85a3::8a2e:370:7334')).toBeInTheDocument();
    expect(falha.getByText('senha incorreta')).toBeInTheDocument();

    // Sem IP e sem detalhe: "—" (estilos.md §1.2).
    const bloqueio = within(linhaDe('14/11/2026 às 18:31'));
    expect(corDoStatus(bloqueio.getByText('Login bloqueado'))).toBe('fc-status-vermelho');
    expect(bloqueio.getAllByText('—')).toHaveLength(2);

    const linhas = screen.getAllByRole('row').slice(1);
    expect(linhas.map((linha) => within(linha).getAllByRole('cell')[0]!.textContent)).toEqual([
      '15/11/2026 às 09:05',
      '14/11/2026 às 18:31',
      '14/11/2026 às 18:30',
    ]);

    // A primeira página vai sem filtros e sem cursor.
    expect(Array.from(buscas()[0]!.keys())).toEqual([]);
  });

  it('cada tipo tem a sua palavra; só login ok, falha e bloqueio têm cor, os demais são cinza', async () => {
    const eventos = TIPOS_EVENTO.map((tipo, indice) => evento({ tipo: tipo.tipo, email_informado: `pessoa${indice}@exemplo.com.br` }));
    api.responder(ROTA_ACESSOS, pagina(eventos));
    renderizarAcessos();
    await screen.findByText('pessoa0@exemplo.com.br');

    const esperado: [string, string][] = [
      ['Login', 'fc-status-verde'],
      ['Falha de login', 'fc-status-ambar'],
      ['Login bloqueado', 'fc-status-vermelho'],
      ['Saída', 'fc-status-cinza'],
      ['Troca de tenant', 'fc-status-cinza'],
      ['Link de redefinição gerado', 'fc-status-cinza'],
      ['Senha redefinida', 'fc-status-cinza'],
      ['Chave de API criada', 'fc-status-cinza'],
      ['Chave de API revogada', 'fc-status-cinza'],
      ['Token de incorporação emitido', 'fc-status-cinza'],
      ['Papel alterado', 'fc-status-cinza'],
      ['Usuário alterado', 'fc-status-cinza'],
      ['Segurança alterada', 'fc-status-cinza'],
    ];
    esperado.forEach(([palavra, cor], indice) => {
      const linha = within(linhaDe(`pessoa${indice}@exemplo.com.br`));
      expect(corDoStatus(linha.getByText(palavra))).toBe(cor);
    });
  });

  it('tipo que o front não conhece: o código cru, com ponto cinza', async () => {
    api.responder(ROTA_ACESSOS, pagina([evento({ tipo: 'sessao_revogada' })]));
    renderizarAcessos();
    expect(corDoStatus(await screen.findByText('sessao_revogada'))).toBe('fc-status-cinza');
  });

  it('enquanto carrega, mostra o esqueleto e anuncia', async () => {
    const pendente = respostaPendente(() => pagina([LOGIN_ANA]));
    api.responder(ROTA_ACESSOS, pendente.promessa);
    renderizarAcessos();

    expect(screen.getByRole('table', { name: 'Eventos de acesso do tenant' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando eventos de acesso do tenant');
    expect(screen.getByText('Logins, falhas, bloqueios e mudanças de acesso neste tenant')).toBeInTheDocument();

    pendente.liberar();
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
  });

  it('vazio sem filtros: diz o que falta, sem ação', async () => {
    api.responder(ROTA_ACESSOS, pagina([]));
    renderizarAcessos();

    expect(await screen.findByText('Nenhum evento de acesso ainda')).toBeInTheDocument();
    expect(screen.getByText('Os logins e as mudanças de acesso deste tenant aparecem aqui.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
  });

  it('erro ao carregar: explica e deixa tentar de novo', async () => {
    api.responder(ROTA_ACESSOS, problema(503, 'indisponivel'), pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar os eventos de acesso');
    expect(alerta).toHaveTextContent('Texto do servidor para indisponivel.');

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
  });

  it('sem permissão: explica e não oferece tentar de novo', async () => {
    api.responder(ROTA_ACESSOS, problema(403, 'sem_permissao'));
    renderizarAcessos();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_SEM_PERMISSAO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('<Auditoria> mostra a seção Acessos', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    renderizarAcessos(<Auditoria />);
    expect(await screen.findByRole('region', { name: 'Acessos' })).toBeInTheDocument();
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
  });
});

describe('Auditoria › Acessos: filtro por tipo', () => {
  it('um tipo por vez, de "Todos os tipos" aos 13 tipos', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    expect(campoTipo()).toHaveTextContent('Todos os tipos');
    await usuario.click(campoTipo());
    const opcoes = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Todos os tipos', ...TIPOS_EVENTO.map((tipo) => tipo.rotulo)]);
  });

  it('escolher um tipo busca só ele, da primeira página; "Todos os tipos" tira o filtro', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA, FALHA_BRUNO]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.responder(ROTA_ACESSOS, pagina([FALHA_BRUNO]));
    await escolherTipo(usuario, 'Falha de login');

    await waitFor(() => expect(screen.queryByText('ana.souza@exemplo.com.br')).not.toBeInTheDocument());
    expect(screen.getByText('1 evento com esses filtros')).toBeInTheDocument();
    expect(campoTipo()).toHaveTextContent('Falha de login');
    expect(ultimaBusca().getAll('tipo')).toEqual(['login_falhou']);
    expect(ultimaBusca().has('cursor')).toBe(false);

    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA, FALHA_BRUNO]));
    await escolherTipo(usuario, 'Todos os tipos');
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('2 eventos')).toBeInTheDocument();
    expect(ultimaBusca().has('tipo')).toBe(false);
  });

  it('pelo teclado: Enter abre, as setas escolhem e o foco volta ao filtro', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    await usuario.tab();
    expect(campoTipo()).toHaveFocus();
    await usuario.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await usuario.keyboard('{ArrowDown}');
    await usuario.keyboard('{Enter}');

    expect(campoTipo()).toHaveFocus();
    await waitFor(() => expect(ultimaBusca().getAll('tipo')).toEqual(['login_ok']));
  });
});

describe('Auditoria › Acessos: filtro por período', () => {
  it('"De" e "Até" no calendário do navegador; "Até" inclui o dia inteiro', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');
    expect(campoDe()).toHaveAttribute('type', 'date');
    expect(campoAte()).toHaveAttribute('type', 'date');

    await usuario.type(campoDe(), '2026-11-01');
    await waitFor(() => expect(ultimaBusca().get('desde')).toBe(new Date(2026, 10, 1).toISOString()));
    expect(ultimaBusca().has('ate')).toBe(false);
    // O calendário de "Até" não oferece dias antes de "De".
    expect(campoAte()).toHaveAttribute('min', '2026-11-01');

    await usuario.type(campoAte(), '2026-11-05');
    await waitFor(() => expect(ultimaBusca().get('ate')).toBe(new Date(2026, 10, 6).toISOString()));
    expect(ultimaBusca().get('desde')).toBe(new Date(2026, 10, 1).toISOString());
    expect(campoDe()).toHaveAttribute('max', '2026-11-05');
    expect(await screen.findByText('1 evento com esses filtros')).toBeInTheDocument();
  });

  it('o mesmo dia em "De" e "Até" é um dia inteiro', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    await usuario.type(campoAte(), '2026-11-14');
    await usuario.type(campoDe(), '2026-11-14');

    await waitFor(() => expect(ultimaBusca().get('desde')).toBe(new Date(2026, 10, 14).toISOString()));
    expect(ultimaBusca().get('ate')).toBe(new Date(2026, 10, 15).toISOString());
    expect(campoAte()).not.toHaveAttribute('aria-invalid');
  });

  it('"De" depois de "Até": erro no campo, sem buscar; corrigir aplica o período', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    await usuario.type(campoAte(), '2026-11-05');
    await waitFor(() => expect(buscas()).toHaveLength(2));
    await usuario.type(campoDe(), '2026-11-10');

    expect(campoAte()).toHaveAttribute('aria-invalid', 'true');
    expect(campoAte()).toHaveAccessibleDescription(MENSAGEM_PERIODO_INVERTIDO);
    expect(buscas()).toHaveLength(2);
    // A lista continua com o último período válido.
    expect(screen.getByText('ana.souza@exemplo.com.br')).toBeInTheDocument();

    // O tipo ainda vale, com o último período válido.
    await escolherTipo(usuario, 'Saída');
    await waitFor(() => expect(ultimaBusca().getAll('tipo')).toEqual(['logout']));
    expect(ultimaBusca().has('desde')).toBe(false);
    expect(ultimaBusca().get('ate')).toBe(new Date(2026, 10, 6).toISOString());

    await usuario.clear(campoDe());
    await usuario.type(campoDe(), '2026-11-01');
    expect(campoAte()).not.toHaveAttribute('aria-invalid');
    await waitFor(() => expect(ultimaBusca().get('desde')).toBe(new Date(2026, 10, 1).toISOString()));
    expect(ultimaBusca().get('ate')).toBe(new Date(2026, 10, 6).toISOString());
  });

  it('tipo e período juntos', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    await escolherTipo(usuario, 'Login bloqueado');
    await usuario.type(campoDe(), '2026-11-01');

    await waitFor(() => expect(ultimaBusca().get('desde')).toBe(new Date(2026, 10, 1).toISOString()));
    expect(ultimaBusca().getAll('tipo')).toEqual(['login_bloqueado']);
  });

  it('dados_invalidos da API: o erro vai ao campo e oferece limpar os filtros', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.responder(ROTA_ACESSOS, problema(422, 'dados_invalidos', { campos: { ate: 'Data inválida.' } }), pagina([LOGIN_ANA]));
    await usuario.type(campoAte(), '2026-11-05');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MENSAGEM_PERIODO_RECUSADO);
    expect(campoAte()).toHaveAttribute('aria-invalid', 'true');
    expect(campoAte()).toHaveAccessibleDescription('Data inválida.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(campoAte()).toHaveValue('');
    expect(campoAte()).not.toHaveAttribute('aria-invalid');
  });

  it('tipo_evento_invalido: explica e oferece limpar os filtros, não tentar de novo', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.responder(ROTA_ACESSOS, problema(422, 'tipo_evento_invalido', { campos: { tipo: 'Tipo desconhecido.' } }));
    await escolherTipo(usuario, 'Senha redefinida');

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_TIPO_INVALIDO);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});

describe('Auditoria › Acessos: vazio com filtros', () => {
  it('diz que nada casou e "Limpar filtros" volta a todos os eventos, com o foco no primeiro filtro', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.responder(ROTA_ACESSOS, pagina([]));
    await escolherTipo(usuario, 'Troca de tenant');
    await usuario.type(campoDe(), '2026-11-01');

    expect(await screen.findByText('Nenhum evento com esses filtros')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum evento de acesso ainda')).not.toBeInTheDocument();
    expect(screen.getByText('Logins, falhas, bloqueios e mudanças de acesso neste tenant')).toBeInTheDocument();

    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA]));
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(campoTipo()).toHaveFocus();
    expect(campoTipo()).toHaveTextContent('Todos os tipos');
    expect(campoDe()).toHaveValue('');
    expect(Array.from(ultimaBusca().keys())).toEqual([]);
  });
});

describe('Auditoria › Acessos: paginação por cursor', () => {
  it('"Carregar mais eventos" pede a próxima página com o cursor e os mesmos filtros', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA, FALHA_BRUNO], 'cursor-2'));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');
    expect(screen.getByText('Mais de 2 eventos')).toBeInTheDocument();

    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA], 'cursor-tipo-2'), pagina([evento({ email_informado: 'carla@exemplo.com.br' })]));
    await escolherTipo(usuario, 'Login');
    await waitFor(() => expect(screen.getByText('Mais de 1 evento com esses filtros')).toBeInTheDocument());

    await usuario.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    expect(await screen.findByText('carla@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais eventos' })).not.toBeInTheDocument();
    expect(screen.getByText('2 eventos com esses filtros')).toBeInTheDocument();

    expect(ultimaBusca().get('cursor')).toBe('cursor-tipo-2');
    expect(ultimaBusca().getAll('tipo')).toEqual(['login_ok']);
  });

  it('mudar um filtro volta para a primeira página', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA], 'cursor-2'), pagina([FALHA_BRUNO], 'cursor-3'));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');
    await usuario.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    await screen.findByText('senha incorreta');
    expect(ultimaBusca().get('cursor')).toBe('cursor-2');

    api.responder(ROTA_ACESSOS, pagina([BLOQUEIO_BRUNO]));
    await usuario.type(campoDe(), '2026-11-14');

    await waitFor(() => expect(screen.queryByText('ana.souza@exemplo.com.br')).not.toBeInTheDocument());
    expect(screen.queryByText('senha incorreta')).not.toBeInTheDocument();
    expect(screen.getByText('Login bloqueado')).toBeInTheDocument();
    expect(ultimaBusca().has('cursor')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Carregar mais eventos' })).not.toBeInTheDocument();
  });

  it('erro ao carregar a próxima página: a lista fica e dá para tentar de novo', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA], 'cursor-2'), problema(503, 'indisponivel'), pagina([FALHA_BRUNO]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    await usuario.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais eventos');
    expect(screen.getByText('ana.souza@exemplo.com.br')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('senha incorreta')).toBeInTheDocument();
    expect(ultimaBusca().get('cursor')).toBe('cursor-2');
  });

  it('cursor_invalido: explica e "Recarregar lista" volta à primeira página', async () => {
    api.responder(ROTA_ACESSOS, pagina([LOGIN_ANA], 'cursor-velho'), problema(422, 'cursor_invalido'), pagina([BLOQUEIO_BRUNO, LOGIN_ANA]));
    const { usuario } = renderizarAcessos();
    await screen.findByText('ana.souza@exemplo.com.br');

    await usuario.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível carregar mais eventos');
    expect(alerta).toHaveTextContent(MENSAGEM_CURSOR_INVALIDO);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Recarregar lista' }));
    expect(await screen.findByText('Login bloqueado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(ultimaBusca().has('cursor')).toBe(false);
  });
});
