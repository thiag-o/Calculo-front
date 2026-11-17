import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Connections } from '.';
import {
  CONNECTIONS,
  CRM,
  ERP,
  FAILED_TEST,
  INTEGRATOR,
  MANAGER_WITHOUT_CREDENTIALS,
  OK_TEST,
  REDUCED_OK_TEST,
  VIEWER,
  bodyOf,
  json,
  noContent,
  pendingResponse,
  problem,
  renderConnections,
  simulateApi,
  withoutCredentials,
  write,
} from './connections.test-support';
import { IN_USE_REASON } from './DeleteConnectionDialog';
import { ALREADY_EXISTS_MESSAGE, IN_USE_MESSAGE, NOT_FOUND_MESSAGE } from './messages';
import type { Connection } from './queries';

const LIST_ROUTE = 'GET /v1/connections';
const detailRoute = (connection: Connection) => `GET /v1/connections/${connection.id}`;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renders the whole screen on the list and opens the connection's detail by its name. */
async function openDetail(connection: Connection, permissions: readonly string[] = INTEGRATOR, seen: Connection = connection) {
  const api = simulateApi(permissions);
  api.respond(LIST_ROUTE, json({ items: CONNECTIONS }));
  api.respond(detailRoute(connection), json(seen));
  const parts = renderConnections(<Connections />);
  await parts.user.click(await screen.findByRole('button', { name: connection.name }));
  await screen.findByRole('heading', { level: 2, name: connection.name });
  return { ...parts, api };
}

async function openMenuItem(user: Awaited<ReturnType<typeof openDetail>>['user'], connection: Connection, item: string) {
  await user.click(screen.getByRole('button', { name: `Mais ações para ${connection.name}` }));
  await user.click(await screen.findByRole('menuitem', { name: item }));
}

/** The value shown below a label of the detail. */
function valueOf(label: string): string | null {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? null;
}

describe('Conexões: detalhe', () => {
  it('abre pela lista com o foco no título e mostra tipo, último teste e o destino', async () => {
    await openDetail(ERP);

    expect(screen.getByRole('heading', { level: 2, name: ERP.name })).toHaveFocus();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(valueOf('Último teste')).toContain('ok');
    expect(valueOf('Último teste')).toContain('15/11/2026 às 09:05');
    expect(valueOf('Host')).toBe('db.erp.exemplo.com.br');
    expect(valueOf('Porta')).toBe('5432');
    expect(valueOf('Banco')).toBe('faturamento');
    expect(valueOf('Usuário')).toBe('leitura_fluxo');
    expect(screen.queryByText('Senha')).not.toBeInTheDocument();
    // The details of the last test show only in the result of "Testar".
    expect(screen.queryByText('PostgreSQL 16.4')).not.toBeInTheDocument();
  });

  it('último teste que falhou: "falhou", a data e a mensagem da API', async () => {
    await openDetail(CRM);

    expect(valueOf('Último teste')).toContain('falhou');
    expect(valueOf('Último teste')).toContain('14/11/2026 às 18:30');
    expect(valueOf('Último teste')).toContain('O banco não respondeu a tempo.');
  });

  it('volta para a lista com o foco no nome da conexão', async () => {
    const { user } = await openDetail(CRM);
    await user.click(screen.getByRole('button', { name: 'Voltar para Conexões' }));

    await waitFor(() => expect(screen.getByRole('button', { name: CRM.name })).toHaveFocus());
  });

  it('controlada pela rota: avisa a conexão escolhida e mostra a que recebe', async () => {
    const api = simulateApi();
    api.respond(LIST_ROUTE, json({ items: CONNECTIONS }));
    api.respond(detailRoute(CRM), json(CRM));
    const onConnectionChange = vi.fn();
    const { user } = renderConnections(<Connections connectionId={null} onConnectionChange={onConnectionChange} />);

    await user.click(await screen.findByRole('button', { name: CRM.name }));
    expect(onConnectionChange).toHaveBeenCalledWith(CRM.id);
    // Who controls decides: without a new `connectionId`, the list stays.
    expect(screen.getByRole('heading', { level: 2, name: 'Conexões' })).toBeInTheDocument();
  });

  it('sem credentials.manage: não aparecem o destino nem as ações de credencial', async () => {
    const { user } = await openDetail(ERP, MANAGER_WITHOUT_CREDENTIALS, withoutCredentials(ERP));

    expect(screen.queryByText('Host')).not.toBeInTheDocument();
    expect(screen.queryByText('db.erp.exemplo.com.br')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Testar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Mais ações para ${ERP.name}` }));
    const items = (await screen.findAllByRole('menuitem')).map((item) => item.textContent);
    expect(items).toEqual(['Renomear conexão', 'Remover conexão']);
  });

  it('só com connections.view: sem Testar e sem o menu de ações', async () => {
    await openDetail(ERP, VIEWER, withoutCredentials(ERP));

    expect(screen.queryByRole('button', { name: 'Testar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Mais ações para ${ERP.name}` })).not.toBeInTheDocument();
  });

  it('mostra o esqueleto enquanto carrega', async () => {
    const api = simulateApi();
    const pending = pendingResponse(() => json(ERP));
    api.respond(detailRoute(ERP), pending.promise);
    renderConnections(<Connections connectionId={ERP.id} />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando a conexão');
    pending.release();
    expect(await screen.findByRole('heading', { level: 2, name: ERP.name })).toBeInTheDocument();
    // Opened straight on the detail (route), the title does not steal the focus.
    expect(screen.getByRole('heading', { level: 2, name: ERP.name })).not.toHaveFocus();
  });

  it('erro ao carregar: diz o que houve e tenta de novo', async () => {
    const api = simulateApi();
    api.respond(detailRoute(ERP), problem(503, 'service_unavailable'), json(ERP));
    const { user } = renderConnections(<Connections connectionId={ERP.id} />);

    expect(await screen.findByText('Não foi possível abrir a conexão')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { level: 2, name: ERP.name })).toBeInTheDocument();
  });

  it('conexão que não existe mais: avisa e volta para a lista', async () => {
    const api = simulateApi();
    api.respond(detailRoute(ERP), problem(404, 'not_found'));
    const onConnectionChange = vi.fn();
    const { user } = renderConnections(<Connections connectionId={ERP.id} onConnectionChange={onConnectionChange} />);

    expect(await screen.findByText(NOT_FOUND_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('alert').parentElement!).getByRole('button', { name: 'Voltar para Conexões' }));
    expect(onConnectionChange).toHaveBeenCalledWith(null);
  });
});

describe('Conexões: Testar a conexão salva', () => {
  it('testa e mostra versão, TLS, somente leitura e tempo; o último teste passa a ser este', async () => {
    const { user, api } = await openDetail(CRM);
    api.respond(`POST /v1/connections/${CRM.id}/test`, json(OK_TEST));
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    expect(await screen.findByText('Resultado do teste')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL 16.4')).toBeInTheDocument();
    expect(screen.getByText('182 ms')).toBeInTheDocument();
    expect(valueOf('Último teste')).toContain('ok');
    expect(valueOf('Último teste')).toContain('15/11/2026 às 09:05');
    expect(api.callsTo(`POST /v1/connections/${CRM.id}/test`)).toHaveLength(1);
  });

  it('sem credentials.manage, o resultado mostra só o ponto, a palavra e a data', async () => {
    const { user, api } = await openDetail(CRM, MANAGER_WITHOUT_CREDENTIALS, withoutCredentials(CRM));
    api.respond(`POST /v1/connections/${CRM.id}/test`, json(REDUCED_OK_TEST));
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    expect(await screen.findByText('Resultado do teste')).toBeInTheDocument();
    for (const label of ['Versão', 'TLS', 'Somente leitura', 'Tempo']) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('teste que não passa (inclusive destino bloqueado): "falhou" e a mensagem da API', async () => {
    const { user, api } = await openDetail(ERP);
    api.respond(
      `POST /v1/connections/${ERP.id}/test`,
      json({ ...FAILED_TEST, error: { code: 'connection_target_not_allowed', message: 'Este endereço de banco não é permitido.' } }),
    );
    await user.click(screen.getByRole('button', { name: 'Testar' }));

    expect(await screen.findAllByText('Este endereço de banco não é permitido.')).not.toHaveLength(0);
    expect(valueOf('Último teste')).toContain('falhou');
  });
});

describe('Conexões: renomear', () => {
  it('troca o nome e o título acompanha', async () => {
    const { user, api } = await openDetail(ERP);
    const renamed = { ...ERP, name: 'ERP de faturamento (réplica)' };
    api.respond(`PUT /v1/connections/${ERP.id}`, json(renamed));
    await openMenuItem(user, ERP, 'Renomear conexão');

    const dialog = await screen.findByRole('dialog', { name: 'Renomear conexão' });
    const name = within(dialog).getByLabelText('Nome');
    expect(name).toHaveValue(ERP.name);
    await user.clear(name);
    await write(user, name, renamed.name);
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { level: 2, name: renamed.name })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await bodyOf(api.callsTo(`PUT /v1/connections/${ERP.id}`)[0])).toEqual({ name: renamed.name });
  });

  it('nome repetido (connection_already_exists): erro no campo', async () => {
    const { user, api } = await openDetail(ERP);
    api.respond(`PUT /v1/connections/${ERP.id}`, problem(409, 'connection_already_exists'));
    await openMenuItem(user, ERP, 'Renomear conexão');
    const dialog = await screen.findByRole('dialog', { name: 'Renomear conexão' });
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText(ALREADY_EXISTS_MESSAGE)).toBeInTheDocument();
  });

  it('nome vazio não chama a API', async () => {
    const { user, api } = await openDetail(ERP);
    await openMenuItem(user, ERP, 'Renomear conexão');
    const dialog = await screen.findByRole('dialog', { name: 'Renomear conexão' });
    await user.clear(within(dialog).getByLabelText('Nome'));
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Informe o nome da conexão')).toBeInTheDocument();
    expect(api.callsTo(`PUT /v1/connections/${ERP.id}`)).toHaveLength(0);
  });
});

describe('Conexões: remover', () => {
  it('pede confirmação, remove e volta para a lista atualizada', async () => {
    const { user, api } = await openDetail(CRM);
    api.respond(`DELETE /v1/connections/${CRM.id}`, noContent());
    api.respond(LIST_ROUTE, json({ items: [ERP] }));
    await openMenuItem(user, CRM, 'Remover conexão');

    const dialog = await screen.findByRole('dialog', { name: 'Remover conexão' });
    expect(dialog).toHaveTextContent(`${CRM.name} e a credencial guardada saem do catálogo.`);
    await user.click(within(dialog).getByRole('button', { name: 'Remover conexão' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Conexões' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: ERP.name })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CRM.name })).not.toBeInTheDocument();
    expect(api.callsTo(`DELETE /v1/connections/${CRM.id}`)).toHaveLength(1);
  });

  it('conexão em uso (connection_in_use): diz o que fazer e bloqueia o botão com o motivo', async () => {
    const { user, api } = await openDetail(CRM);
    api.respond(`DELETE /v1/connections/${CRM.id}`, problem(409, 'connection_in_use'));
    await openMenuItem(user, CRM, 'Remover conexão');
    const dialog = await screen.findByRole('dialog', { name: 'Remover conexão' });
    await user.click(within(dialog).getByRole('button', { name: 'Remover conexão' }));

    expect(await within(dialog).findByText(IN_USE_MESSAGE)).toBeInTheDocument();
    const button = within(dialog).getByRole('button', { name: 'Remover conexão' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription(IN_USE_REASON);
    await user.click(button);
    expect(api.callsTo(`DELETE /v1/connections/${CRM.id}`)).toHaveLength(1);
  });

  it('cancelar não remove', async () => {
    const { user, api } = await openDetail(CRM);
    await openMenuItem(user, CRM, 'Remover conexão');
    const dialog = await screen.findByRole('dialog', { name: 'Remover conexão' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 2, name: CRM.name })).toBeInTheDocument();
    expect(api.callsTo(`DELETE /v1/connections/${CRM.id}`)).toHaveLength(0);
    expect(screen.getByRole('button', { name: `Mais ações para ${CRM.name}` })).toHaveFocus();
  });
});
