// Epic 4 · the draft saves by itself: after building a Calculation and reloading the page, the editor brings the draft as
// it was; editing the same draft in two tabs warns about the conflict, and "Recarregar rascunho" brings the other tab's
// version (both modes).
import { callApi, suffix } from '../epic-2/support/screens';
import { expect, test } from './support/fixtures';
import {
  blockLayer,
  createExampleWorkflow,
  draftSaved,
  editorOf,
  expectFormula,
  formulaOf,
  layers,
  nodeNamed,
  openWorkflowEditor,
  properties,
  signInForApi,
  writeFormula,
} from './support/screens';

test('recarregar a página traz o rascunho como estava', async ({ page, epic4 }) => {
  const name = `Rascunho salvo e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic4.account('admin'));
  // The empty workflow is the preparation; its screen flow is in create-and-open-editor.spec.ts.
  expect((await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name })).status, 'criar o workflow pela API').toBe(201);
  await openWorkflowEditor(page, name);

  // An input and a Calculation built from scratch.
  await layers(page).getByRole('treeitem', { name: 'Entradas', exact: true }).click();
  await properties(page).getByRole('button', { name: 'Incluir entrada', exact: true }).click();
  await properties(page).getByRole('textbox', { name: /^Nome \(/ }).fill('valor_item');
  await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Cálculo', exact: true }).click();
  const block = properties(page).getByRole('region', { name: 'Cálculo' });
  await block.getByRole('textbox', { name: /^Nome do bloco/ }).fill('Bônus');
  const saved = draftSaved(page, (definition) => {
    const node = nodeNamed(definition, 'Bônus');
    return node?.type === 'calculation' && node.output.name === 'bonus' && node.expression === 'valor_item * 2';
  });
  await writeFormula(page, formulaOf(page, 'Bônus'), 'valor_item * 2');
  await block.getByRole('textbox', { name: /^Nome da variável/ }).fill('bonus');
  // Saved by itself, with nothing to click.
  await saved;
  await expect(editorOf(page, name).getByText(/^Salvo há/)).toBeVisible();

  await page.reload();
  await expect(editorOf(page, name)).toBeVisible();
  await expect(layers(page).getByRole('treeitem', { name: 'valor_item', exact: true })).toBeVisible();
  await blockLayer(page, 'Bônus', 'Cálculo').click();
  await expectFormula(formulaOf(page, 'Bônus'), 'valor_item * 2');
  await expect(properties(page).getByRole('textbox', { name: 'Nome da variável (Bônus)' })).toHaveValue('bonus');
  await expect(properties(page).getByRole('textbox', { name: 'Nome do bloco (Bônus)' })).toHaveValue('Bônus');
});

test('editar o mesmo rascunho em duas abas avisa o conflito, e Recarregar rascunho traz a versão da outra aba', async ({ page, epic4 }) => {
  const name = `Duas abas e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic4.account('admin'));
  await createExampleWorkflow(page, apiOrigin, name);
  await openWorkflowEditor(page, name);
  // The second tab of the same browser (same session) opens the same draft.
  const other = await epic4.newTab();
  await other.goto(page.url());
  await expect(editorOf(other, name)).toBeVisible();

  // The first tab saves a change.
  await blockLayer(page, 'Pontos', 'Cálculo').click();
  const first = draftSaved(page, (definition) => {
    const node = nodeNamed(definition, 'Pontos');
    return node?.type === 'calculation' && node.expression === 'valor_item * fator';
  });
  await writeFormula(page, formulaOf(page, 'Pontos'), 'valor_item * fator');
  await first;

  // The second one, still on the previous revision, changes the same block: the save is refused and the editor warns.
  await blockLayer(other, 'Pontos', 'Cálculo').click();
  const [conflict] = await Promise.all([
    other.waitForResponse((r) => r.request().method() === 'PUT' && /\/draft$/.test(new URL(r.url()).pathname)),
    writeFormula(other, formulaOf(other, 'Pontos'), 'valor_item * 3'),
  ]);
  expect(conflict.status(), 'a gravação da outra aba').toBe(409);
  expect(await conflict.json()).toMatchObject({ code: 'draft_conflict' });
  const editor = editorOf(other, name);
  await expect(editor.getByText('Este rascunho mudou em outra aba ou por outra pessoa', { exact: true })).toBeVisible();
  await expect(editor.getByText('Não salvo', { exact: true })).toBeVisible();

  // "Recarregar rascunho" brings the version the first tab saved; nothing is merged.
  await editor.getByRole('button', { name: 'Recarregar rascunho', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Recarregar rascunho' })).toHaveCount(0);
  await expectFormula(formulaOf(other, 'Pontos'), 'valor_item * fator');
  await expect(editor.getByText(/^Salvo há/)).toBeVisible();
});
