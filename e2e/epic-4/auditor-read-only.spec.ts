// Epic 4 · the Auditor (only the `.view` permissions) sees the list, the Overview and the editor of the "Pontuação de
// exemplo" for reading only: no "Novo workflow", no block to include, the fields disabled, the formula unchanged and no
// "Calcular" (both modes).
import { signIn } from '../support/screens';
import { SAMPLE_WORKFLOW } from './support/simulation';
import { expect, test } from './support/fixtures';
import {
  blockLayer,
  editorOf,
  expectFormula,
  formulaOf,
  openEditor,
  openOverview,
  openWorkflows,
  POINTS_FORMULA,
  properties,
} from './support/screens';

test('o Auditor vê a lista, a Visão geral e o editor só para leitura, sem Calcular', async ({ page, epic4 }) => {
  await signIn(page, epic4.account('auditor'));

  await openWorkflows(page);
  await expect(page.getByRole('list', { name: 'Workflows' }).getByRole('button', { name: SAMPLE_WORKFLOW, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo workflow' })).toHaveCount(0);

  await openOverview(page, SAMPLE_WORKFLOW);
  await expect(page.getByRole('region', { name: 'Rascunho' })).toContainText('3 blocos');
  await expect(page.getByRole('button', { name: `Mais ações para ${SAMPLE_WORKFLOW}` })).toHaveCount(0);

  const editor = await openEditor(page, SAMPLE_WORKFLOW);
  await expect(editor.getByText('Só leitura', { exact: true })).toBeVisible();
  await expect(editor).toContainText('Você não tem permissão para editar este workflow');
  // The canvas shows the blocks, without the toolbar to include one.
  await expect(page.getByRole('toolbar', { name: 'Incluir bloco' })).toHaveCount(0);
  // The properties can be read, not changed.
  await blockLayer(page, 'Pontos', 'Cálculo').click();
  await expect(properties(page).getByRole('textbox', { name: 'Nome do bloco (Pontos)' })).toBeDisabled();
  await expect(properties(page).getByRole('combobox', { name: 'Tipo (Pontos)' })).toBeDisabled();
  const formula = formulaOf(page, 'Pontos');
  await expectFormula(formula, POINTS_FORMULA);
  await page.keyboard.insertText(' + 1');
  await expectFormula(formula, POINTS_FORMULA);
  // The bottom panel has only Problemas: no "Calcular".
  const tabs = page.getByRole('tablist', { name: 'Painel inferior' });
  await expect(tabs.getByRole('tab', { name: /^Problemas/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Calcular' })).toHaveCount(0);
  await expect(editorOf(page, SAMPLE_WORKFLOW).getByRole('button', { name: 'Calcular' })).toHaveCount(0);

  // Nothing was sent to be written (simulated mode keeps what the shell sent; in real mode the backend refuses anyway).
  expect(epic4.mutations() ?? []).toEqual([]);
});
