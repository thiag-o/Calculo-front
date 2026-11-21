// Epic 5 · by role, on the "Campanha de referência": the Aprovador runs "Rodar prévia" and "Calcular" (by a record of the
// sample) and edits nothing; the Auditor sees the editor only for reading, without "Prévia" and "Calcular" (both modes;
// nothing is saved, so the shared workflow of `prepare-local` is used as it is).
import type { Page } from '@playwright/test';
import { layers, properties } from '../epic-4/support/screens';
import { signIn } from '../support/screens';
import { BLOCKS, CAMPAIGN_WORKFLOW } from './support/campaign';
import { FIRST_RECORD } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  calculate,
  canvasNode,
  canvasValues,
  escape,
  openBottomTab,
  openWorkflowEditor,
  runPreview,
  sampleRecord,
  shownValue,
  unitRunForm,
  watchWorkflowWrites,
} from './support/screens';

const bottomTabs = (page: Page) => page.getByRole('tablist', { name: 'Painel inferior' }).getByRole('tab');

/**
 * The properties of the group and of a block open with the fields disabled; with `catalog` (who sees the catalog,
 * `connections.view`), also the variables of the batch source.
 */
async function expectReadOnlyProperties(page: Page, catalog: boolean): Promise<void> {
  await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.group)} ,`) }).click();
  await expect(properties(page).getByRole('textbox', { name: /^Nome do grupo/ })).toBeDisabled();
  await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.points)} ,`) }).click();
  await expect(properties(page).getByRole('textbox', { name: /^Nome do bloco/ })).toBeDisabled();
  if (!catalog) return;
  await layers(page).getByRole('treeitem', { name: /^Fonte do lote/ }).click();
  const brought = properties(page).getByRole('group', { name: 'Variáveis trazidas', exact: true }).getByRole('checkbox');
  await expect(brought.first()).toBeVisible();
  for (const box of await brought.all()) await expect(box).toBeDisabled();
}

test('o Aprovador roda a prévia e o Calcular e não edita', async ({ page, epic5 }) => {
  const writes = watchWorkflowWrites(page);
  await signIn(page, epic5.account('approver'));
  await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);

  await expect(page.getByText('Só leitura', { exact: true })).toBeVisible();
  await expect(bottomTabs(page)).toHaveText(['Problemas', 'Prévia', 'Calcular']);
  await expect(page.getByRole('toolbar', { name: 'Incluir bloco' })).toHaveCount(0);

  await openBottomTab(page, 'Prévia');
  expect((await runPreview(page)).status(), 'rodar a prévia').toBe(200);
  await openBottomTab(page, 'Calcular');
  const form = unitRunForm(page);
  await sampleRecord(form, FIRST_RECORD.key).click();
  expect((await calculate(page, form)).status(), 'calcular').toBe(200);
  await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: ok');
  await expect(shownValue(form.getByRole('region', { name: 'Saídas', exact: true }), 'pontos')).toHaveText(FIRST_RECORD.outputs!.pontos);
  await expect(canvasValues(page, BLOCKS.points)).toContainText(FIRST_RECORD.outputs!.pontos);
  await expect(canvasNode(page, BLOCKS.points, 'Cálculo')).toHaveAccessibleName(`${BLOCKS.points}, Cálculo, ok no último cálculo`);

  // The Aprovador has no `connections.view`: the catalog (the batch source variables) is not his to read.
  await expectReadOnlyProperties(page, false);
  expect(writes, 'o Aprovador não muda o workflow').toEqual([]);
});

test('o Auditor vê o editor só para leitura, sem Prévia e sem Calcular', async ({ page, epic5 }) => {
  const writes = watchWorkflowWrites(page);
  await signIn(page, epic5.account('auditor'));
  await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);

  await expect(page.getByText('Só leitura', { exact: true })).toBeVisible();
  await expect(bottomTabs(page)).toHaveText(['Problemas']);
  await expect(page.getByRole('toolbar', { name: 'Incluir bloco' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Agrupar', exact: true })).toHaveCount(0);
  await expect(canvasNode(page, BLOCKS.group, 'Grupo')).toBeVisible();

  await expectReadOnlyProperties(page, true);
  expect(writes, 'o Auditor não muda o workflow').toEqual([]);
});
