import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Audit } from '..';
import {
  INVALID_CURSOR_MESSAGE,
  INVERTED_PERIOD_MESSAGE,
  REJECTED_PERIOD_MESSAGE,
  NO_PERMISSION_MESSAGE,
  INVALID_TYPE_MESSAGE,
} from './messages';
import { EVENT_TYPES } from './eventTypes';
import {
  BRUNO_LOCK,
  event,
  BRUNO_FAILURE,
  ANA_LOGIN,
  pageResponse,
  problem,
  renderAccessEvents,
  pendingResponse,
  ACCESS_EVENTS_ROUTE,
  simulateApi,
  type SimulatedApi,
} from './access-events.test-support';

let api: SimulatedApi;

beforeEach(() => {
  api = simulateApi();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fetches(): URLSearchParams[] {
  return api.fetchesOf(ACCESS_EVENTS_ROUTE);
}

function lastFetch(): URLSearchParams {
  return fetches().at(-1)!;
}

function rowOf(text: string): HTMLElement {
  return screen.getAllByText(text)[0]!.closest('tr')!;
}

function typeField(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Tipo de evento' });
}

function fromField(): HTMLInputElement {
  return screen.getByLabelText('De');
}

function toField(): HTMLInputElement {
  return screen.getByLabelText('Até');
}

async function chooseType(user: UserEvent, label: string) {
  await user.click(typeField());
  await user.click(await screen.findByRole('option', { name: label }));
}

/** The (decorative) status dot of the given word, inside a row. */
function statusColor(word: HTMLElement): string | undefined {
  const status = word.closest('.fc-status')!;
  return Array.from(status.classList).find((cssClass) => cssClass.startsWith('fc-status-') && cssClass !== 'fc-status-word');
}

describe('Auditoria › Acessos: lista', () => {
  it('mostra quando, evento (ponto + palavra), quem, IP e detalhe, do mais recente ao mais antigo', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN, BRUNO_LOCK, BRUNO_FAILURE]));
    renderAccessEvents();

    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Acessos' })).toBeInTheDocument();
    expect(screen.getByText('3 eventos')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Eventos de acesso do tenant' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Quando',
      'Evento',
      'Quem',
      'IP',
      'Detalhe',
    ]);

    const ana = within(rowOf('ana.souza@exemplo.com.br'));
    expect(ana.getByText('15/11/2026 às 09:05')).toBeInTheDocument();
    expect(ana.getByText('203.0.113.7')).toHaveClass('fc-mono-13');
    expect(statusColor(ana.getByText('Login'))).toBe('fc-status-green');

    const failure = within(rowOf('14/11/2026 às 18:30'));
    expect(statusColor(failure.getByText('Falha de login'))).toBe('fc-status-amber');
    expect(failure.getByText('2001:db8:85a3::8a2e:370:7334')).toBeInTheDocument();
    expect(failure.getByText('senha incorreta')).toBeInTheDocument();

    // Without IP and without detail: "—" (estilos.md §1.2).
    const lock = within(rowOf('14/11/2026 às 18:31'));
    expect(statusColor(lock.getByText('Login bloqueado'))).toBe('fc-status-red');
    expect(lock.getAllByText('—')).toHaveLength(2);

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual([
      '15/11/2026 às 09:05',
      '14/11/2026 às 18:31',
      '14/11/2026 às 18:30',
    ]);

    // The first page goes without filters and without cursor.
    expect(Array.from(fetches()[0]!.keys())).toEqual([]);
  });

  it('cada tipo tem a sua palavra; só login ok, falha e bloqueio têm cor, os demais são cinza', async () => {
    const events = EVENT_TYPES.map((type, index) => event({ tipo: type.type, email_informado: `pessoa${index}@exemplo.com.br` }));
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse(events));
    renderAccessEvents();
    await screen.findByText('pessoa0@exemplo.com.br');

    const expected: [string, string][] = [
      ['Login', 'fc-status-green'],
      ['Falha de login', 'fc-status-amber'],
      ['Login bloqueado', 'fc-status-red'],
      ['Saída', 'fc-status-gray'],
      ['Troca de tenant', 'fc-status-gray'],
      ['Link de redefinição gerado', 'fc-status-gray'],
      ['Senha redefinida', 'fc-status-gray'],
      ['Chave de API criada', 'fc-status-gray'],
      ['Chave de API revogada', 'fc-status-gray'],
      ['Token de incorporação emitido', 'fc-status-gray'],
      ['Papel alterado', 'fc-status-gray'],
      ['Usuário alterado', 'fc-status-gray'],
      ['Segurança alterada', 'fc-status-gray'],
    ];
    expected.forEach(([word, color], index) => {
      const row = within(rowOf(`pessoa${index}@exemplo.com.br`));
      expect(statusColor(row.getByText(word))).toBe(color);
    });
  });

  it('tipo que o front não conhece: o código cru, com ponto cinza', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([event({ tipo: 'sessao_revogada' })]));
    renderAccessEvents();
    expect(statusColor(await screen.findByText('sessao_revogada'))).toBe('fc-status-gray');
  });

  it('enquanto carrega, mostra o esqueleto e anuncia', async () => {
    const pending = pendingResponse(() => pageResponse([ANA_LOGIN]));
    api.respond(ACCESS_EVENTS_ROUTE, pending.promise);
    renderAccessEvents();

    expect(screen.getByRole('table', { name: 'Eventos de acesso do tenant' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Carregando eventos de acesso do tenant');
    expect(screen.getByText('Logins, falhas, bloqueios e mudanças de acesso neste tenant')).toBeInTheDocument();

    pending.release();
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
  });

  it('vazio sem filtros: diz o que falta, sem ação', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([]));
    renderAccessEvents();

    expect(await screen.findByText('Nenhum evento de acesso ainda')).toBeInTheDocument();
    expect(screen.getByText('Os logins e as mudanças de acesso deste tenant aparecem aqui.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
  });

  it('erro ao carregar: explica e deixa tentar de novo', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, problem(503, 'unavailable'), pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar os eventos de acesso');
    expect(alert).toHaveTextContent('Texto do servidor para unavailable.');

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
  });

  it('sem permissão: explica e não oferece tentar de novo', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, problem(403, 'sem_permissao'));
    renderAccessEvents();

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_PERMISSION_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('<Audit> mostra a seção Acessos', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    renderAccessEvents(<Audit />);
    expect(await screen.findByRole('region', { name: 'Acessos' })).toBeInTheDocument();
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
  });
});

describe('Auditoria › Acessos: filtro por tipo', () => {
  it('um tipo por vez, de "Todos os tipos" aos 13 tipos', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    expect(typeField()).toHaveTextContent('Todos os tipos');
    await user.click(typeField());
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Todos os tipos', ...EVENT_TYPES.map((type) => type.label)]);
  });

  it('escolher um tipo busca só ele, da primeira página; "Todos os tipos" tira o filtro', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN, BRUNO_FAILURE]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([BRUNO_FAILURE]));
    await chooseType(user, 'Falha de login');

    await waitFor(() => expect(screen.queryByText('ana.souza@exemplo.com.br')).not.toBeInTheDocument());
    expect(screen.getByText('1 evento com esses filtros')).toBeInTheDocument();
    expect(typeField()).toHaveTextContent('Falha de login');
    expect(lastFetch().getAll('tipo')).toEqual(['login_falhou']);
    expect(lastFetch().has('cursor')).toBe(false);

    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN, BRUNO_FAILURE]));
    await chooseType(user, 'Todos os tipos');
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('2 eventos')).toBeInTheDocument();
    expect(lastFetch().has('tipo')).toBe(false);
  });

  it('pelo teclado: Enter abre, as setas escolhem e o foco volta ao filtro', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    await user.tab();
    expect(typeField()).toHaveFocus();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(typeField()).toHaveFocus();
    await waitFor(() => expect(lastFetch().getAll('tipo')).toEqual(['login_ok']));
  });
});

describe('Auditoria › Acessos: filtro por período', () => {
  it('"De" e "Até" no calendário do navegador; "Até" inclui o dia inteiro', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');
    expect(fromField()).toHaveAttribute('type', 'date');
    expect(toField()).toHaveAttribute('type', 'date');

    await user.type(fromField(), '2026-11-01');
    await waitFor(() => expect(lastFetch().get('desde')).toBe(new Date(2026, 10, 1).toISOString()));
    expect(lastFetch().has('ate')).toBe(false);
    // The "Até" calendar does not offer days before "De".
    expect(toField()).toHaveAttribute('min', '2026-11-01');

    await user.type(toField(), '2026-11-05');
    await waitFor(() => expect(lastFetch().get('ate')).toBe(new Date(2026, 10, 6).toISOString()));
    expect(lastFetch().get('desde')).toBe(new Date(2026, 10, 1).toISOString());
    expect(fromField()).toHaveAttribute('max', '2026-11-05');
    expect(await screen.findByText('1 evento com esses filtros')).toBeInTheDocument();
  });

  it('o mesmo dia em "De" e "Até" é um dia inteiro', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    await user.type(toField(), '2026-11-14');
    await user.type(fromField(), '2026-11-14');

    await waitFor(() => expect(lastFetch().get('desde')).toBe(new Date(2026, 10, 14).toISOString()));
    expect(lastFetch().get('ate')).toBe(new Date(2026, 10, 15).toISOString());
    expect(toField()).not.toHaveAttribute('aria-invalid');
  });

  it('"De" depois de "Até": erro no campo, sem buscar; corrigir aplica o período', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    await user.type(toField(), '2026-11-05');
    await waitFor(() => expect(fetches()).toHaveLength(2));
    await user.type(fromField(), '2026-11-10');

    expect(toField()).toHaveAttribute('aria-invalid', 'true');
    expect(toField()).toHaveAccessibleDescription(INVERTED_PERIOD_MESSAGE);
    expect(fetches()).toHaveLength(2);
    // The list keeps the last valid period.
    expect(screen.getByText('ana.souza@exemplo.com.br')).toBeInTheDocument();

    // The type still applies, with the last valid period.
    await chooseType(user, 'Saída');
    await waitFor(() => expect(lastFetch().getAll('tipo')).toEqual(['logout']));
    expect(lastFetch().has('desde')).toBe(false);
    expect(lastFetch().get('ate')).toBe(new Date(2026, 10, 6).toISOString());

    await user.clear(fromField());
    await user.type(fromField(), '2026-11-01');
    expect(toField()).not.toHaveAttribute('aria-invalid');
    await waitFor(() => expect(lastFetch().get('desde')).toBe(new Date(2026, 10, 1).toISOString()));
    expect(lastFetch().get('ate')).toBe(new Date(2026, 10, 6).toISOString());
  });

  it('tipo e período juntos', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    await chooseType(user, 'Login bloqueado');
    await user.type(fromField(), '2026-11-01');

    await waitFor(() => expect(lastFetch().get('desde')).toBe(new Date(2026, 10, 1).toISOString()));
    expect(lastFetch().getAll('tipo')).toEqual(['login_bloqueado']);
  });

  it('dados_invalidos da API: o erro vai ao campo e oferece limpar os filtros', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.respond(ACCESS_EVENTS_ROUTE, problem(422, 'dados_invalidos', { campos: { ate: 'Data inválida.' } }), pageResponse([ANA_LOGIN]));
    await user.type(toField(), '2026-11-05');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(REJECTED_PERIOD_MESSAGE);
    expect(toField()).toHaveAttribute('aria-invalid', 'true');
    expect(toField()).toHaveAccessibleDescription('Data inválida.');
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(toField()).toHaveValue('');
    expect(toField()).not.toHaveAttribute('aria-invalid');
  });

  it('tipo_evento_invalido: explica e oferece limpar os filtros, não tentar de novo', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.respond(ACCESS_EVENTS_ROUTE, problem(422, 'tipo_evento_invalido', { campos: { tipo: 'Tipo desconhecido.' } }));
    await chooseType(user, 'Senha redefinida');

    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_TYPE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});

describe('Auditoria › Acessos: vazio com filtros', () => {
  it('diz que nada casou e "Limpar filtros" volta a todos os eventos, com o foco no primeiro filtro', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([]));
    await chooseType(user, 'Troca de tenant');
    await user.type(fromField(), '2026-11-01');

    expect(await screen.findByText('Nenhum evento com esses filtros')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum evento de acesso ainda')).not.toBeInTheDocument();
    expect(screen.getByText('Logins, falhas, bloqueios e mudanças de acesso neste tenant')).toBeInTheDocument();

    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN]));
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(await screen.findByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(typeField()).toHaveFocus();
    expect(typeField()).toHaveTextContent('Todos os tipos');
    expect(fromField()).toHaveValue('');
    expect(Array.from(lastFetch().keys())).toEqual([]);
  });
});

describe('Auditoria › Acessos: paginação por cursor', () => {
  it('"Carregar mais eventos" pede a próxima página com o cursor e os mesmos filtros', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN, BRUNO_FAILURE], 'cursor-2'));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');
    expect(screen.getByText('Mais de 2 eventos')).toBeInTheDocument();

    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN], 'cursor-tipo-2'), pageResponse([event({ email_informado: 'carla@exemplo.com.br' })]));
    await chooseType(user, 'Login');
    await waitFor(() => expect(screen.getByText('Mais de 1 evento com esses filtros')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    expect(await screen.findByText('carla@exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('ana.souza@exemplo.com.br')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais eventos' })).not.toBeInTheDocument();
    expect(screen.getByText('2 eventos com esses filtros')).toBeInTheDocument();

    expect(lastFetch().get('cursor')).toBe('cursor-tipo-2');
    expect(lastFetch().getAll('tipo')).toEqual(['login_ok']);
  });

  it('mudar um filtro volta para a primeira página', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN], 'cursor-2'), pageResponse([BRUNO_FAILURE], 'cursor-3'));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');
    await user.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    await screen.findByText('senha incorreta');
    expect(lastFetch().get('cursor')).toBe('cursor-2');

    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([BRUNO_LOCK]));
    await user.type(fromField(), '2026-11-14');

    await waitFor(() => expect(screen.queryByText('ana.souza@exemplo.com.br')).not.toBeInTheDocument());
    expect(screen.queryByText('senha incorreta')).not.toBeInTheDocument();
    expect(screen.getByText('Login bloqueado')).toBeInTheDocument();
    expect(lastFetch().has('cursor')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Carregar mais eventos' })).not.toBeInTheDocument();
  });

  it('erro ao carregar a próxima página: a lista fica e dá para tentar de novo', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN], 'cursor-2'), problem(503, 'unavailable'), pageResponse([BRUNO_FAILURE]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    await user.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar mais eventos');
    expect(screen.getByText('ana.souza@exemplo.com.br')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('senha incorreta')).toBeInTheDocument();
    expect(lastFetch().get('cursor')).toBe('cursor-2');
  });

  it('cursor_invalido: explica e "Recarregar lista" volta à primeira página', async () => {
    api.respond(ACCESS_EVENTS_ROUTE, pageResponse([ANA_LOGIN], 'cursor-velho'), problem(422, 'cursor_invalido'), pageResponse([BRUNO_LOCK, ANA_LOGIN]));
    const { user } = renderAccessEvents();
    await screen.findByText('ana.souza@exemplo.com.br');

    await user.click(screen.getByRole('button', { name: 'Carregar mais eventos' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar mais eventos');
    expect(alert).toHaveTextContent(INVALID_CURSOR_MESSAGE);
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recarregar lista' }));
    expect(await screen.findByText('Login bloqueado')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(lastFetch().has('cursor')).toBe(false);
  });
});
