import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionList } from '.';
import {
  CONNECTIONS,
  CRM,
  ERP,
  INTEGRATOR,
  MANAGER_WITHOUT_CREDENTIALS,
  NEW,
  VIEWER,
  json,
  pendingResponse,
  problem,
  renderConnections,
  simulateApi,
  withoutCredentials,
} from './connections.test-support';
import { LIST_NO_PERMISSION_MESSAGE } from './messages';

const LIST_ROUTE = 'GET /v1/connections';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function row(name: string | RegExp): HTMLElement {
  return screen.getByRole('row', { name });
}

describe('Conexões: lista', () => {
  it('mostra nome, tipo e último teste de cada conexão, com ponto, palavra e data', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond(LIST_ROUTE, json({ items: CONNECTIONS }));
    renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(await screen.findByRole('button', { name: ERP.name })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Conexões' })).toBeInTheDocument();
    expect(screen.getByText('3 conexões')).toBeInTheDocument();

    const erp = row(/ERP de faturamento/);
    expect(within(erp).getByText('PostgreSQL')).toBeInTheDocument();
    expect(within(erp).getByText('ok')).toBeInTheDocument();
    expect(within(erp).getByText('15/11/2026 às 09:05')).toBeInTheDocument();

    const crm = row(/CRM corporativo/);
    expect(within(crm).getByText('SQL Server')).toBeInTheDocument();
    expect(within(crm).getByText('falhou')).toBeInTheDocument();
    expect(within(crm).getByText('14/11/2026 às 18:30')).toBeInTheDocument();

    const estoque = row(/Estoque/);
    expect(within(estoque).getByText('não testada')).toBeInTheDocument();
  });

  it('sem credentials.manage, o último teste mostra só o ponto, a palavra e a data', async () => {
    const api = simulateApi(VIEWER);
    api.respond(LIST_ROUTE, json({ items: CONNECTIONS.map(withoutCredentials) }));
    renderConnections(<ConnectionList onOpen={() => {}} />);

    const erp = await screen.findByRole('row', { name: /ERP de faturamento/ });
    expect(within(erp).getByText('ok')).toBeInTheDocument();
    expect(within(erp).getByText('15/11/2026 às 09:05')).toBeInTheDocument();
    expect(screen.queryByText(/PostgreSQL 16/)).not.toBeInTheDocument();
    expect(screen.queryByText('db.erp.exemplo.com.br')).not.toBeInTheDocument();
  });

  it('abre o detalhe pelo nome da conexão', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond(LIST_ROUTE, json({ items: CONNECTIONS }));
    const onOpen = vi.fn();
    const { user } = renderConnections(<ConnectionList onOpen={onOpen} />);

    await user.click(await screen.findByRole('button', { name: CRM.name }));
    expect(onOpen).toHaveBeenCalledWith(CRM.id);
  });

  it('mostra o esqueleto enquanto carrega', async () => {
    const api = simulateApi(INTEGRATOR);
    const pending = pendingResponse(() => json({ items: [NEW] }));
    api.respond(LIST_ROUTE, pending.promise);
    renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Carregando conexões do tenant');
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    pending.release();
    expect(await screen.findByRole('button', { name: NEW.name })).toBeInTheDocument();
    expect(screen.getByText('1 conexão')).toBeInTheDocument();
  });

  it('lista vazia: diz o que falta e oferece Nova conexão a quem pode cadastrar', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond(LIST_ROUTE, json({ items: [] }));
    const { user } = renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(await screen.findByText('Nenhuma conexão ainda')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Nova conexão' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);
    expect(await screen.findByRole('dialog', { name: 'Nova conexão' })).toBeInTheDocument();
  });

  it('lista vazia sem permissão de cadastrar: sem ação, com o que pedir', async () => {
    const api = simulateApi(VIEWER);
    api.respond(LIST_ROUTE, json({ items: [] }));
    renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(await screen.findByText('Nenhuma conexão ainda')).toBeInTheDocument();
    expect(screen.getByText(/Peça a quem gerencia as conexões e as credenciais/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova conexão' })).not.toBeInTheDocument();
  });

  it('Nova conexão aparece só com connections.manage e credentials.manage', async () => {
    const api = simulateApi(MANAGER_WITHOUT_CREDENTIALS);
    api.respond(LIST_ROUTE, json({ items: CONNECTIONS.map(withoutCredentials) }));
    renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(await screen.findByRole('button', { name: ERP.name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova conexão' })).not.toBeInTheDocument();
  });

  it('erro ao carregar: diz o que houve e tenta de novo', async () => {
    const api = simulateApi(INTEGRATOR);
    api.respond(LIST_ROUTE, problem(503, 'service_unavailable'), json({ items: [ERP] }));
    const { user } = renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(await screen.findByText('Não foi possível carregar as conexões')).toBeInTheDocument();
    expect(screen.getByText('Texto do servidor para service_unavailable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: ERP.name })).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo(LIST_ROUTE)).toHaveLength(2));
  });

  it('sem permissão de ver: explica e não oferece tentar de novo', async () => {
    const api = simulateApi([]);
    api.respond(LIST_ROUTE, problem(403, 'no_permission'));
    renderConnections(<ConnectionList onOpen={() => {}} />);

    expect(await screen.findByText(LIST_NO_PERMISSION_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });
});
