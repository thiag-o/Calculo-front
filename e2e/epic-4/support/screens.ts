// Actions and locators of the epic 4 screens (workflow list, Overview, editor, Decision Table and "Calcular"), by what the
// user sees. The sign-in ones are in e2e/support/screens.ts; the API call from inside the shell in e2e/epic-2.
import type { Locator, Page, Response } from '@playwright/test';
import { callApi, mainNavigation } from '../../epic-2/support/screens';
import { EXAMPLES, type Schemas } from '../../support/contract';
import type { LoginCredentials } from '../../support/fixtures';
import { apiResponse, signIn } from '../../support/screens';
import { expect } from './fixtures';

export type Workflow = Schemas['Workflow'];
type Definition = Schemas['WorkflowDefinition'];
type Draft = Schemas['Draft'];

/** The draft of the contract example (the "Pontuação de exemplo" of `prepare-local`): inputs, the Table and two Calculations. */
export const EXAMPLE_DEFINITION = EXAMPLES.Draft.definition as Definition;

/** The formulas of the example (backend plan, Contratos). */
export const POINTS_FORMULA = 'MÍN(ARRED(valor_item * fator, 2), 1000 - pontos_historico)';
export const HISTORY_FORMULA = 'SOMA(valor_compra[] * taxa[])';

/** Signs in and returns the API origin (the one the shell calls), for the preparations made straight through the API. */
export async function signInForApi(page: Page, credentials: LoginCredentials): Promise<string> {
  const [response] = await Promise.all([apiResponse(page, 'POST', '/v1/session'), signIn(page, credentials)]);
  return new URL(response.url()).origin;
}

/**
 * Creates a workflow with the example draft straight through the API (session cookie and CSRF token): the preparation of
 * the flows that start on an assembled workflow. Each test gets its own, so a change in one does not reach another nor
 * the shared "Pontuação de exemplo" (in real mode, the database keeps them). The screen flow of building it is in
 * build-example.spec.ts.
 */
export async function createExampleWorkflow(page: Page, apiOrigin: string, name: string): Promise<Workflow> {
  const created = await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name } satisfies Schemas['NewWorkflow']);
  expect(created.status, `criar o workflow pela API (${String(created.code)})`).toBe(201);
  const workflow = created.body as Workflow;
  const body: Schemas['DraftUpdate'] = { revision: workflow.draft.revision, definition: EXAMPLE_DEFINITION };
  const saved = await callApi(page, apiOrigin, 'PUT', `/v1/workflows/${workflow.id}/draft`, body);
  expect(saved.status, `gravar o rascunho do exemplo pela API (${String(saved.code)})`).toBe(200);
  expect((saved.body as Draft).problems, 'o rascunho do exemplo não tem problemas').toEqual([]);
  return workflow;
}

/** Opens Workflows through the sidebar and waits for the list. */
export async function openWorkflows(page: Page): Promise<void> {
  await mainNavigation(page).getByRole('link', { name: 'Workflows', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Workflows', exact: true })).toBeVisible();
}

/**
 * Opens a workflow's Overview from the list, filtering by its name (in real mode the list keeps the previous runs), and
 * waits for its title.
 */
export async function openOverview(page: Page, name: string): Promise<void> {
  await openWorkflows(page);
  await page.getByRole('searchbox', { name: 'Filtrar por nome' }).fill(name);
  await page.getByRole('list', { name: 'Workflows' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}

/** The editor region of the workflow. */
export const editorOf = (page: Page, name: string) => page.getByRole('region', { name: `Editor de ${name}`, exact: true });

/** "Abrir editor" on the Overview; waits for the editor with the draft loaded (the layers show "Entradas"). */
export async function openEditor(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Abrir editor', exact: true }).click();
  const editor = editorOf(page, name);
  await expect(editor).toBeVisible();
  await expect(layers(page).getByRole('treeitem', { name: 'Entradas' })).toBeVisible();
  return editor;
}

/** From the list to the editor of the workflow. */
export async function openWorkflowEditor(page: Page, name: string): Promise<Locator> {
  await openOverview(page, name);
  return openEditor(page, name);
}

export const layers = (page: Page) => page.getByRole('tree', { name: 'Camadas' });
export const properties = (page: Page) => page.getByRole('complementary', { name: 'Propriedades' });
export const canvas = (page: Page) => page.getByRole('region', { name: 'Canvas', exact: true });

/** The layer of a block: "Pontos , Cálculo" (with "1 problema" after it when it has problems). */
export function blockLayer(page: Page, name: string, kind: 'Cálculo' | 'Tabela de Decisão'): Locator {
  return layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(name)} , ${kind}`) });
}

/** The block on the canvas: the group "Pontos, Cálculo" (with ", 1 problema" when it has problems). */
export function canvasBlock(page: Page, name: string, kind: 'Cálculo' | 'Tabela de Decisão'): Locator {
  return canvas(page).getByRole('group', { name: new RegExp(`^${escape(name)}, ${kind}`) });
}

/** "● N problemas" of the editor bar (absent with no problem). */
export const problemCounter = (page: Page) => page.getByRole('button', { name: /^\d+ problemas?$/ });

/** Picks an option of a select (Radix Select: the trigger is a combobox, the options are in a list). */
export async function choose(page: Page, select: Locator, option: string): Promise<void> {
  await select.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(select).toContainText(option);
}

/**
 * Replaces the text of a formula field (Monaco). The text is inserted at once, like a paste: typed key by key, Monaco
 * would close the parentheses by itself.
 */
export async function writeFormula(page: Page, field: Locator, text: string): Promise<void> {
  await field.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(text);
  await expect(field).toHaveValue(text);
}

/**
 * Checks the text of a formula field (Monaco). Monaco only puts the text in its field (a textarea) while it has the focus,
 * for the screen readers: the check focuses it first.
 */
export async function expectFormula(field: Locator, text: string): Promise<void> {
  await field.focus();
  await expect(field).toHaveValue(text);
}

/** The formula field of a Calculation, by the block name. */
export const formulaOf = (page: Page, block: string) => properties(page).getByRole('textbox', { name: `Fórmula de ${block}`, exact: true });

/**
 * Waits for the draft to be saved (`PUT …/draft` with `200`) with a definition that passes `check`. Start waiting before
 * the change: the editor saves a moment after the last edit.
 */
export function draftSaved(page: Page, check: (definition: Definition) => boolean): Promise<Response> {
  return page.waitForResponse((response) => {
    const request = response.request();
    if (request.method() !== 'PUT' || !/^\/v1\/workflows\/[^/]+\/draft$/.test(new URL(response.url()).pathname)) return false;
    const body = request.postDataJSON() as Schemas['DraftUpdate'];
    return response.status() === 200 && check(body.definition);
  });
}

/** The node of the definition by name. */
export function nodeNamed(definition: Definition, name: string) {
  return definition.root.nodes.find((node) => node.name === name);
}

// --- Calcular --------------------------------------------------------------------------------------------------------

/** Opens the "Calcular" tab of the bottom panel and returns its form. */
export async function openUnitRun(page: Page): Promise<Locator> {
  await page.getByRole('tablist', { name: 'Painel inferior' }).getByRole('tab', { name: 'Calcular', exact: true }).click();
  const form = page.getByRole('form', { name: 'Calcular' });
  await expect(form).toBeVisible();
  return form;
}

/** Types the values of the example: `valor_item`, `categoria` and `meta_atingida`, in the Brazilian format (E4-24). */
export async function fillExampleValues(page: Page, form: Locator, values: { valorItem: string; categoria: string; metaAtingida: 'Verdadeiro' | 'Falso' }) {
  await form.getByRole('textbox', { name: 'valor_item', exact: true }).fill(values.valorItem);
  await form.getByRole('textbox', { name: 'categoria', exact: true }).fill(values.categoria);
  await choose(page, form.getByRole('combobox', { name: 'meta_atingida', exact: true }), values.metaAtingida);
}

/** Clicks "Calcular" and returns the `POST …/draft/unit-runs` response. */
export async function calculate(page: Page, form: Locator): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === 'POST' && /^\/v1\/workflows\/[^/]+\/draft\/unit-runs$/.test(new URL(r.url()).pathname),
    ),
    form.getByRole('button', { name: 'Calcular', exact: true }).click(),
  ]);
  return response;
}

/** The value shown beside a name (a `term` and its `definition`) inside a region of the result. */
export function shownValue(scope: Locator, name: string): Locator {
  return scope.getByRole('term').filter({ hasText: new RegExp(`^${escape(name)}$`) }).locator('xpath=following-sibling::*[1]');
}

/** The result of a block in "Blocos" of the result, by the block name. */
export function blockResult(form: Locator, block: string): Locator {
  return form
    .getByRole('region', { name: 'Blocos' })
    .getByRole('listitem')
    .filter({ has: form.page().getByRole('button', { name: `${block}: selecionar no canvas`, exact: true }) });
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
