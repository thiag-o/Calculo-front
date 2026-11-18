import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../api';
import { FluxoCalculo, type FluxoCalculoProps } from '.';
import {
  API,
  AUDITOR_PERMISSIONS,
  CONFIGURATOR_PERMISSIONS,
  INTEGRATOR_PERMISSIONS,
  json,
  sessionWith,
  simulateApi,
  simulateWidth,
} from './module.test-support';

// The Catálogo screen inside <FluxoCalculo>, by role: the Integrador sees and edits everything; the Configurador and the
// Auditor see the catalog read only, and without the connection credentials (the API sends `target: null`).

const CONNECTION_ID = '40000000-0000-0000-0000-000000000001';
const DATASET_ID = '60000000-0000-0000-0000-000000000001';
const FILE_ID = '50000000-0000-0000-0000-000000000001';

const target = { host: 'erp.interno', port: 5432, database: 'erp', username: 'fluxo' };
const connection = (withTarget: boolean): Schemas['Connection'] => ({
  id: CONNECTION_ID,
  name: 'Postgres de exemplo',
  type: 'postgres',
  created_at: '2026-11-10T12:00:00Z',
  updated_at: '2026-11-10T12:00:00Z',
  last_test: null,
  target: withTarget ? target : null,
});
const DATASET: Schemas['Dataset'] = {
  id: DATASET_ID,
  name: 'Itens de nota fiscal',
  type: 'table',
  connection_id: CONNECTION_ID,
  schema_name: 'public',
  object_name: 'itens_nf',
  sql: null,
  excel_file_id: null,
  sheet: null,
  columns: [{ name: 'vl_itm', source_type: 'numeric(12,2)', type: 'decimal', scale: 2, nullable: true }],
  columns_refreshed_at: '2026-11-14T12:05:00Z',
};
const FILE: Schemas['ExcelFile'] = {
  id: FILE_ID,
  file_name: 'metas-2026.xlsx',
  size_bytes: 20480,
  sha256: 'a'.repeat(64),
  uploaded_at: '2026-11-12T10:00:00Z',
  sheets: [{ name: 'Vendas', sampled_rows: 10, columns: [{ name: 'meta', source_type: 'number', type: 'decimal', scale: null, nullable: false }] }],
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  simulateWidth(1440);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function simulateCatalog(permissions: string[]) {
  const withTarget = permissions.includes('credentials.manage');
  return simulateApi({
    'GET /v1/session': json(sessionWith(permissions)),
    'GET /v1/connections': json({ items: [connection(withTarget)] }),
    [`GET /v1/connections/${CONNECTION_ID}`]: json(connection(withTarget)),
    'GET /v1/datasets': json({ items: [DATASET] }),
    [`GET /v1/datasets/${DATASET_ID}`]: json(DATASET),
    [`GET /v1/datasets/${DATASET_ID}/variables`]: json({ items: [] }),
    'GET /v1/excel-files': json({ items: [FILE] }),
    [`GET /v1/excel-files/${FILE_ID}`]: json(FILE),
  });
}

function renderScreen(props: Partial<FluxoCalculoProps> = {}) {
  const user = userEvent.setup({ delay: null });
  render(<FluxoCalculo apiUrl={API} {...props} />);
  return { user };
}

// Waits get 4 s instead of the 1 s default: under load (e2e browsers running at the same time) these full-module renders took 2 to 3 s
// and the finds failed with "Unable to find" (measured in F43); alone they finish in about 1 s.
const SLOW = { timeout: 4000 };

type User = ReturnType<typeof userEvent.setup>;

const sidebar = () => screen.getByRole('navigation', { name: 'Navegação principal' });
const catalogItem = () => within(sidebar()).getByRole('link', { name: 'Catálogo' });
const catalogTabs = () => screen.getByRole('tablist', { name: 'Catálogo' });
const tabNames = () => within(catalogTabs()).getAllByRole('tab').map((tab) => tab.textContent);

async function openCatalog(user: User) {
  await screen.findByRole('heading', { level: 1, name: 'Início' }, SLOW);
  await user.click(catalogItem());
  return screen.findByRole('heading', { level: 1, name: 'Catálogo' }, SLOW);
}

describe('Catálogo no casca: Integrador', () => {
  it('abre o Catálogo pelo menu, com as abas e as rotas /catalog…, e edita tudo', async () => {
    const api = simulateCatalog(INTEGRATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });
    await openCatalog(user);

    await waitFor(() => expect(window.location.pathname).toBe('/catalog'));
    expect(catalogItem()).toHaveAttribute('aria-current', 'page');
    expect(tabNames()).toEqual(['Conexões', 'Datasets', 'Arquivos']);
    expect(await screen.findByRole('button', { name: 'Nova conexão' }, SLOW)).toBeInTheDocument();

    // Connection detail, with the destination and the connection test.
    await user.click(await screen.findByRole('button', { name: 'Postgres de exemplo' }, SLOW));
    expect(await screen.findByText('erp.interno', undefined, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/catalog/connections/${CONNECTION_ID}`);
    expect(catalogItem()).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Testar' })).toBeInTheDocument();

    // Datasets tab, list and detail with the variables editor.
    await user.click(within(catalogTabs()).getByRole('tab', { name: 'Datasets' }));
    expect(await screen.findByRole('button', { name: 'Novo dataset' }, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/catalog/datasets');
    await user.click(await screen.findByRole('button', { name: 'Itens de nota fiscal' }, SLOW));
    expect(await screen.findByRole('button', { name: 'Atualizar colunas' }, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/catalog/datasets/${DATASET_ID}`);
    expect(screen.getAllByRole('button', { name: 'Nova variável' }).length).toBeGreaterThan(0);

    // Files tab.
    await user.click(within(catalogTabs()).getByRole('tab', { name: 'Arquivos' }));
    expect(await screen.findByRole('button', { name: 'Enviar arquivo' }, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/catalog/files');
    await user.click(await screen.findByRole('button', { name: 'metas-2026.xlsx' }, SLOW));
    expect(await screen.findByRole('button', { name: 'Remover arquivo' }, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/catalog/files/${FILE_ID}`);

    expect(api.calls()).toContain(`GET /v1/excel-files/${FILE_ID}`);
  });

  it('o link direto /catalog/datasets/:id abre o detalhe do dataset na aba Datasets', async () => {
    window.history.replaceState(null, '', `/catalog/datasets/${DATASET_ID}`);
    simulateCatalog(INTEGRATOR_PERMISSIONS);
    renderScreen({ navigation: 'url' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Itens de nota fiscal' }, SLOW)).toBeInTheDocument();
    // One h1 only: the Catálogo title; the dataset title is an h2 and its sections h3.
    expect(screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual(['Catálogo']);
    expect(screen.getByRole('heading', { level: 3, name: 'Colunas' })).toBeInTheDocument();
    expect(within(catalogTabs()).getByRole('tab', { name: 'Datasets' })).toHaveAttribute('aria-selected', 'true');
  });

  it('o botão Voltar do detalhe leva de volta à lista da aba', async () => {
    window.history.replaceState(null, '', `/catalog/datasets/${DATASET_ID}`);
    simulateCatalog(INTEGRATOR_PERMISSIONS);
    const { user } = renderScreen({ navigation: 'url' });

    await screen.findByRole('button', { name: 'Atualizar colunas' }, SLOW);
    await user.click(screen.getByRole('button', { name: 'Voltar para datasets' }));
    expect(await screen.findByRole('button', { name: 'Itens de nota fiscal' }, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/catalog/datasets');
  });
});

describe.each([
  ['Configurador', CONFIGURATOR_PERMISSIONS],
  ['Auditor', AUDITOR_PERMISSIONS],
])('Catálogo no casca: %s (só leitura)', (_role, permissions) => {
  it('vê o catálogo sem botões de escrita e sem as credenciais', async () => {
    simulateCatalog(permissions);
    const { user } = renderScreen({ navigation: 'memory' });
    await openCatalog(user);

    expect(tabNames()).toEqual(['Conexões', 'Datasets', 'Arquivos']);
    await user.click(await screen.findByRole('button', { name: 'Postgres de exemplo' }, SLOW));
    expect(await screen.findByRole('heading', { name: 'Postgres de exemplo' }, SLOW)).toBeInTheDocument();
    expect(screen.queryByText('erp.interno')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Testar' })).not.toBeInTheDocument();

    await user.click(within(catalogTabs()).getByRole('tab', { name: 'Datasets' }));
    expect(await screen.findByRole('button', { name: 'Itens de nota fiscal' }, SLOW)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo dataset' })).not.toBeInTheDocument();

    await user.click(within(catalogTabs()).getByRole('tab', { name: 'Arquivos' }));
    expect(await screen.findByRole('button', { name: 'metas-2026.xlsx' }, SLOW)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
  });
});

describe('Catálogo sem permissão', () => {
  it('quem não tem connections.view não vê o item e a rota /catalog não abre', async () => {
    window.history.replaceState(null, '', '/catalog');
    simulateApi({ 'GET /v1/session': json(sessionWith(['workflows.view'])) });
    renderScreen({ navigation: 'url' });

    await screen.findByRole('heading', { level: 1, name: 'Início' }, SLOW);
    expect(within(sidebar()).queryByRole('link', { name: 'Catálogo' })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/home'));
  });
});

describe('Catálogo no modo incorporado', () => {
  it('é uma aba do módulo, com as abas internas, e a prop screen="catalog" abre nele', async () => {
    simulateCatalog(INTEGRATOR_PERMISSIONS);
    renderScreen({ token: 'token', screen: 'catalog' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Catálogo' }, SLOW)).toBeInTheDocument();
    const moduleTabs = screen.getByRole('tablist', { name: 'Telas do Fluxo de Cálculo' });
    expect(within(moduleTabs).getByRole('tab', { name: 'Catálogo' })).toHaveAttribute('aria-selected', 'true');
    expect(tabNames()).toEqual(['Conexões', 'Datasets', 'Arquivos']);
    expect(await screen.findByRole('button', { name: 'Postgres de exemplo' }, SLOW)).toBeInTheDocument();
  });
});
