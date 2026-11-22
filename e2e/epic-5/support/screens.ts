// Actions and locators of the epic 5 screens (batch source, Fonte blocks, groups, "Prévia", "Calcular" by record and the
// values on the canvas), by what the user sees. The ones of the epic 4 editor are in e2e/epic-4/support/screens.ts.
import type { Locator, Page, Response } from '@playwright/test';
import { callApi } from '../../epic-2/support/screens';
import { editorOf, layers, openOverview } from '../../epic-4/support/screens';
import type { Schemas } from '../../support/contract';
import { CAMPAIGN_WORKFLOW } from './campaign';
import { trackCreatedWorkflow } from './created-workflows';
import { expect } from './fixtures';

/** The block kinds as the canvas names them beside the block name. */
export type BlockKind = 'Cálculo' | 'Tabela de Decisão' | 'Fonte Linear' | 'Fonte Filtro' | 'Grupo';

/** "Abrir editor" on the Overview; waits for the editor with the draft loaded (the layers show the records' origin). */
export async function openEditor(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Abrir editor', exact: true }).click();
  const editor = editorOf(page, name);
  await expect(editor).toBeVisible();
  await expect(layers(page).getByRole('treeitem', { name: /^(Fonte do lote|Entradas)/ }).first()).toBeVisible();
  return editor;
}

/** From the list to the editor of the workflow. */
export async function openWorkflowEditor(page: Page, name: string): Promise<Locator> {
  await openOverview(page, name);
  return openEditor(page, name);
}

/** A block on the canvas, by name and kind: "Pontos, Cálculo" (with what comes after it, like the run status). */
export function canvasNode(page: Page, name: string, kind: BlockKind): Locator {
  return page.getByRole('region', { name: 'Canvas', exact: true }).getByRole('group', { name: new RegExp(`^${escape(name)}, ${kind}`) });
}

/** The tab of the bottom panel. */
export async function openBottomTab(page: Page, tab: 'Problemas' | 'Prévia' | 'Calcular'): Promise<Locator> {
  // "Problemas" carries the count ("Problemas 1").
  const name = new RegExp(`^${tab}( \\d+)?$`);
  await page.getByRole('tablist', { name: 'Painel inferior' }).getByRole('tab', { name }).click();
  return page.getByRole('tabpanel', { name });
}

// --- Prévia ----------------------------------------------------------------------------------------------------------

/** The "Prévia" section of the bottom panel. */
export const previewPanel = (page: Page) => page.getByRole('region', { name: 'Prévia', exact: true });

/** Clicks "Rodar prévia" and returns the `POST …/draft/previews` response. */
export async function runPreview(page: Page): Promise<Response> {
  const panel = previewPanel(page);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/draft\/previews$/.test(new URL(r.url()).pathname)),
    panel.getByRole('button', { name: 'Rodar prévia', exact: true }).click(),
  ]);
  return response;
}

/** The counts of a Fonte block in the preview ("58 encontrados", "6 sem correspondência"…). */
export const previewCounts = (page: Page, block: string) => previewPanel(page).getByRole('list', { name: `Contagens de ${block}`, exact: true });

// --- Calcular --------------------------------------------------------------------------------------------------------

/** The "Calcular" form of the bottom panel. */
export const unitRunForm = (page: Page) => page.getByRole('form', { name: 'Calcular', exact: true });

/** A record of "Amostra da última prévia": the button "Escolher nota_id 1 · item_seq 1 (ok na prévia)". */
export function sampleRecord(form: Locator, key: Readonly<Record<string, string>>): Locator {
  const text = Object.entries(key).map(([name, value]) => `${name} ${value}`).join(' · ');
  return form.getByRole('list', { name: 'Amostra da última prévia' }).getByRole('button', { name: new RegExp(`^Escolher ${escape(text)} \\(`) });
}

/** Types the key of the record in "Chave do registro". */
export async function typeRecordKey(form: Locator, key: Readonly<Record<string, string>>): Promise<void> {
  const fields = form.getByRole('group', { name: 'Chave do registro', exact: true });
  for (const [name, value] of Object.entries(key)) await fields.getByRole('textbox', { name, exact: true }).fill(value);
}

/** Clicks "Calcular" and returns the `POST …/draft/unit-runs` response. */
export async function calculate(page: Page, form: Locator): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/draft\/unit-runs$/.test(new URL(r.url()).pathname)),
    form.getByRole('button', { name: 'Calcular', exact: true }).click(),
  ]);
  return response;
}

/**
 * The result of a block in "Blocos" of the trace, by the block name. The blocks inside a group are items of the group's
 * own list, so the innermost item with the block's button is the block (the group's item also has it, inside).
 */
export function traceBlock(form: Locator, block: string): Locator {
  return form
    .getByRole('region', { name: 'Blocos', exact: true })
    .getByRole('listitem')
    .filter({ has: form.page().getByRole('button', { name: `${block}: selecionar no canvas`, exact: true }) })
    .last();
}

/** The value shown beside a name (a `term` and its `definition`) inside a part of the result. */
export function shownValue(scope: Locator, name: string): Locator {
  return scope.getByRole('term').filter({ hasText: new RegExp(`^${escape(name)}$`) }).locator('xpath=following-sibling::*[1]');
}

/** A value of the trace's "Entradas": the line of the variable (name, value and origin). */
export function traceInput(form: Locator, variable: string): Locator {
  return form
    .getByRole('region', { name: 'Entradas', exact: true })
    .getByRole('listitem')
    .filter({ has: form.page().getByRole('button', { name: `Copiar ${variable}`, exact: true }) });
}

// --- Values on the canvas --------------------------------------------------------------------------------------------

/** The banner "Os valores são do último cálculo", with "Limpar". */
export const runBanner = (page: Page) => page.getByRole('region', { name: 'Valores do último cálculo', exact: true });

/** The values of a block on the canvas after "Calcular" ("Valores de Pontos"). */
export const canvasValues = (page: Page, block: string) => page.getByRole('list', { name: `Valores de ${block}`, exact: true });

export function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Preparation ------------------------------------------------------------------------------------------------------

/**
 * A copy of the "Campanha de referência" (its saved draft, read through the API) in a new workflow `name`: the flows that
 * edit work on it, so the shared workflow of `prepare-local` stays as it is. In real mode, the epic 5 fixture deletes the copy
 * when the test ends (created-workflows.ts).
 */
export async function copyCampaign(page: Page, apiOrigin: string, name: string): Promise<void> {
  const list = await callApi(page, apiOrigin, 'GET', `/v1/workflows?name=${encodeURIComponent(CAMPAIGN_WORKFLOW)}`);
  const source = (list.body as Schemas['WorkflowList']).items.find((item) => item.name === CAMPAIGN_WORKFLOW);
  expect(source, `o workflow ${CAMPAIGN_WORKFLOW} do prepare-local`).toBeDefined();
  const draft = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${source!.id}/draft`);
  expect(draft.status, 'ler o rascunho da campanha').toBe(200);
  const created = await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name } satisfies Schemas['NewWorkflow']);
  expect(created.status, `criar o workflow pela API (${String(created.code)})`).toBe(201);
  const workflow = created.body as Schemas['Workflow'];
  trackCreatedWorkflow(page, apiOrigin, workflow.id);
  const body: Schemas['DraftUpdate'] = { revision: workflow.draft.revision, definition: (draft.body as Schemas['Draft']).definition };
  const saved = await callApi(page, apiOrigin, 'PUT', `/v1/workflows/${workflow.id}/draft`, body);
  expect(saved.status, `gravar o rascunho da campanha pela API (${String(saved.code)})`).toBe(200);
  expect((saved.body as Schemas['Draft']).problems, 'a cópia da campanha não tem problemas').toEqual([]);
}

/** Every change the page sends to a workflow (method and path), in both modes: who cannot edit sends none. */
export function watchWorkflowWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    const method = request.method();
    // The preview and "Calcular" are POSTs without effect (ADR 0025): they do not change the workflow.
    if (!path.startsWith('/v1/workflows') || method === 'GET' || method === 'OPTIONS' || /\/draft\/(previews|unit-runs|analysis)$/.test(path)) return;
    writes.push(`${method} ${path}`);
  });
  return writes;
}
