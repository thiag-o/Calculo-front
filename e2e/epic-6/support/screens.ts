// Actions and locators of the epic 6 screens (the Parâmetros and Execução sections of the workflow, "Executar lote", the
// execution panel, the records with the trace drawer and the execution lists), by what the user sees. The ones of the
// editor are in e2e/epic-4 and e2e/epic-5.
import type { Download, Locator, Page, Response } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { callApi } from '../../epic-2/support/screens';
import { mainNavigation } from '../../epic-2/support/screens';
import { trackCreatedWorkflow } from '../../epic-5/support/created-workflows';
import { escape } from '../../epic-5/support/screens';
import type { Schemas } from '../../support/contract';
import { type Epic6, expect } from './fixtures';
import type { Period } from './campaign';

type Definition = Schemas['WorkflowDefinition'];

/** "Concluída", "Em andamento"…: how each phase state reads beside the phase (executions/detail/format.ts). */
export type PhaseState = 'concluída' | 'em andamento' | 'aguardando a fonte' | 'interrompida' | 'a fazer';

/** The panel status as the screen says it (dot + word, estilos.md §7.3). */
export type StatusLabel = 'Na fila' | 'Calculando' | 'Aguardando fonte' | 'Entregue' | 'Com erros' | 'Abortada' | 'Cancelada';

/** How long the real worker may take to reach a state (the simulated one is moved by the test, each step seen at the next 2 s refresh). */
const REAL_RUN_TIMEOUT = 120_000;

// --- Workflow panel: Parâmetros and Execução -------------------------------------------------------------------------

/** The workflow properties (the panel shown with no block selected). */
export const workflowPanel = (page: Page) => page.getByRole('complementary', { name: 'Propriedades' }).getByRole('region', { name: 'Workflow', exact: true });

/** The "Parâmetros" section of the workflow panel. */
export const parametersSection = (page: Page) => workflowPanel(page).getByRole('group', { name: 'Parâmetros', exact: true });

/** A declared parameter (its fieldset "Parâmetro <nome>"). */
export const declaredParameter = (page: Page, name: string) => parametersSection(page).getByRole('group', { name: `Parâmetro ${name}`, exact: true });

/** Picks the option of a select (Radix Select) by its name. */
export async function chooseOption(page: Page, select: Locator, option: string): Promise<void> {
  await select.click();
  await page.getByRole('option', { name: new RegExp(`^${escape(option)}( ·|$)`) }).click();
  await expect(select).toContainText(option);
}

// --- "Executar lote" -------------------------------------------------------------------------------------------------

/** The "Executar lote" dialog. */
export const triggerDialog = (page: Page) => page.getByRole('dialog', { name: 'Executar lote', exact: true });

/** Clicks "Executar lote" (of the Overview, the list or the editor bar) and waits for the dialog with the saved draft. */
export async function openTrigger(page: Page, from: Locator = page.getByRole('main')): Promise<Locator> {
  await from.getByRole('button', { name: 'Executar lote', exact: true }).first().click();
  const dialog = triggerDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/^Executa o rascunho salvo/)).toBeVisible();
  return dialog;
}

/** The period of a parameter in the dialog: "Trocar por um valor fixo" and the two dates. */
export async function fixPeriod(dialog: Locator, name: string, period: Period): Promise<void> {
  await dialog.getByRole('group', { name, exact: true }).getByRole('button', { name: 'Trocar por um valor fixo', exact: true }).click();
  const field = dialog.getByRole('group', { name, exact: true });
  await field.getByLabel('Início', { exact: true }).fill(period.start);
  await field.getByLabel('Fim', { exact: true }).fill(period.end);
}

/** Clicks "Executar lote" in the dialog and returns the `POST …/executions` response; the panel opens. */
export async function submitTrigger(page: Page): Promise<Response> {
  const dialog = triggerDialog(page);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/executions$/.test(new URL(r.url()).pathname)),
    dialog.getByRole('button', { name: 'Executar lote', exact: true }).click(),
  ]);
  return response;
}

// --- The execution panel ---------------------------------------------------------------------------------------------

/** The panel of an execution of the workflow `name` (its title is the workflow name). */
export const executionPanel = (page: Page, name: string) => page.getByRole('region', { name, exact: true });

/** The status beside the title ("Calculando", "Entregue"…). */
export const panelStatus = (panel: Locator) => panel.locator('.fc-execution-subtitle').getByText(/^(Na fila|Calculando|Aguardando fonte|Entregue|Com erros|Abortada|Cancelada)$/);

/** The phases Carga → Cálculo → Entrega. */
export const phases = (page: Page) => page.getByRole('region', { name: 'Fases', exact: true });

/** One phase and its state: "Carga concluída". */
export const phase = (page: Page, label: 'Carga' | 'Cálculo' | 'Entrega') => phases(page).getByRole('listitem').filter({ hasText: label });

/** The value beside a term (`dt`/`dd`) inside a part of the panel. */
export function pairValue(scope: Locator, term: string): Locator {
  return scope.getByRole('term').filter({ hasText: new RegExp(`^${escape(term)}$`) }).locator('xpath=following-sibling::*[1]');
}

/** The value of a resolved parameter in "Resumo". */
export const resolvedParameter = (page: Page, name: string) => pairValue(page.getByRole('region', { name: 'Resumo', exact: true }), name);

/** A total ("Lidos", "Ok", "Com avisos", "Com erro", "Ignorados", "Filtrados"). */
export const total = (page: Page, label: string) => pairValue(page.getByRole('region', { name: 'Totais', exact: true }), label);

/** The "Erros agrupados" section. */
export const errorGroups = (page: Page) => page.getByRole('region', { name: 'Erros agrupados', exact: true });

/** The "Registros" section of the panel (with `traces.view`). */
export const recordsSection = (page: Page) => page.getByRole('region', { name: 'Registros', exact: true });

/** The records table. */
export const recordsTable = (page: Page) => page.getByRole('table', { name: 'Registros da execução' });

/** The trace drawer of a record. */
export const traceDrawer = (page: Page) => page.getByRole('dialog', { name: 'Trace do registro', exact: true });

/** "nota_id 1 · item_seq 1", as the panel writes a key. */
export const keyText = (key: Readonly<Record<string, string | null>>) =>
  Object.entries(key).map(([name, value]) => `${name} ${value ?? '—'}`).join(' · ');

/**
 * Waits for the panel to show `status`. In simulated mode the test moved the worker already, and the panel sees it at
 * its next refresh; in real mode the backend's worker gets there by itself (a longer wait, never a fixed one).
 */
export async function expectStatus(page: Page, epic6: Epic6, panel: Locator, status: StatusLabel): Promise<void> {
  await expect(panelStatus(panel)).toHaveText(status, epic6.mode === 'real' ? { timeout: REAL_RUN_TIMEOUT } : undefined);
}

/** Moves the simulated worker to the end (in real mode, the backend's worker runs alone). */
export function finishRun(epic6: Epic6, id?: string): void {
  epic6.worker?.finish(id);
}

/** Moves the simulated worker one step. */
export function stepRun(epic6: Epic6, id?: string): void {
  epic6.worker?.step(id);
}

/** Clicks "Baixar CSV" and returns the download and its text. */
export async function downloadCsv(page: Page, panel: Locator): Promise<{ download: Download; text: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name: 'Baixar CSV', exact: true }).click()]);
  const path = await download.path();
  return { download, text: await readFile(path, 'utf8') };
}

/** The CSV lines (without the last empty one) split in fields (the campaign has no comma nor quote in its values). */
export function csvRows(text: string): string[][] {
  return text.split('\r\n').filter((line) => line !== '').map((line) => line.split(','));
}

// --- Lists -----------------------------------------------------------------------------------------------------------

/** Opens Execuções through the sidebar and waits for the tenant list. */
export async function openExecutions(page: Page): Promise<void> {
  await mainNavigation(page).getByRole('link', { name: 'Execuções', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Execuções', exact: true })).toBeVisible();
}

/** The executions table (of the tenant or of a workflow). */
export const executionsTable = (page: Page) => page.getByRole('table', { name: /^Execuções do (tenant|workflow)$/ });

// --- Preparation ------------------------------------------------------------------------------------------------------

/** The id of a workflow by its name, through the API. */
export async function workflowId(page: Page, apiOrigin: string, name: string): Promise<string> {
  const list = await callApi(page, apiOrigin, 'GET', `/v1/workflows?name=${encodeURIComponent(name)}`);
  const found = (list.body as Schemas['WorkflowList']).items.find((item) => item.name === name);
  expect(found, `o workflow ${name} do prepare-local`).toBeDefined();
  return found!.id;
}

/**
 * A copy of a workflow of `prepare-local` (its saved draft, read through the API) in a new workflow `name`, changed by
 * `change`: the flows that edit work on it, so the shared workflow stays as it is. In real mode the fixture deletes the
 * copy when the test ends.
 */
export async function copyWorkflow(
  page: Page,
  apiOrigin: string,
  from: string,
  name: string,
  change: (definition: Definition) => Definition = (definition) => definition,
): Promise<string> {
  const id = await workflowId(page, apiOrigin, from);
  const draft = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${id}/draft`);
  expect(draft.status, `ler o rascunho de ${from}`).toBe(200);
  const created = await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name } satisfies Schemas['NewWorkflow']);
  expect(created.status, `criar o workflow pela API (${String(created.code)})`).toBe(201);
  const workflow = created.body as Schemas['Workflow'];
  trackCreatedWorkflow(page, apiOrigin, workflow.id);
  const body: Schemas['DraftUpdate'] = { revision: workflow.draft.revision, definition: change((draft.body as Schemas['Draft']).definition) };
  const saved = await callApi(page, apiOrigin, 'PUT', `/v1/workflows/${workflow.id}/draft`, body);
  expect(saved.status, `gravar o rascunho pela API (${String(saved.code)})`).toBe(200);
  expect((saved.body as Schemas['Draft']).problems, 'a cópia não tem problemas').toEqual([]);
  return workflow.id;
}

/** Saves a change of a workflow's draft through the API (as another person editing it). */
export async function changeDraft(page: Page, apiOrigin: string, id: string, change: (definition: Definition) => Definition): Promise<void> {
  const draft = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${id}/draft`);
  const current = draft.body as Schemas['Draft'];
  const saved = await callApi(page, apiOrigin, 'PUT', `/v1/workflows/${id}/draft`, { revision: current.revision, definition: change(current.definition) });
  expect(saved.status, `gravar o rascunho pela API (${String(saved.code)})`).toBe(200);
}
