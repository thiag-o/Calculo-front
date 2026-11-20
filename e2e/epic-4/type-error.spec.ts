// Epic 4 · type error in a block: writing `valor_item + categoria` in the formula of "Pontos" shows the underline in the
// formula, the icon on the block and on the layers, the problem counter and "Calcular" disabled with the reason; fixing the
// formula makes the problem go away (both modes).
import { suffix } from '../epic-2/support/screens';
import { expect, test } from './support/fixtures';
import {
  POINTS_FORMULA,
  blockLayer,
  canvasBlock,
  createExampleWorkflow,
  draftSaved,
  formulaOf,
  nodeNamed,
  openUnitRun,
  openWorkflowEditor,
  problemCounter,
  signInForApi,
  writeFormula,
} from './support/screens';

const WRONG_FORMULA = 'valor_item + categoria';
/** The backend's message for text in a sum (contract, example `AnalysisTypeMismatch`). */
const TYPE_MISMATCH_MESSAGE = 'categoria é texto e não entra em conta.';

test('o erro de tipo aparece na fórmula, no bloco, nas camadas e no contador, e some ao corrigir', async ({ page, epic4 }) => {
  const name = `Pontuação com erro e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic4.account('admin'));
  await createExampleWorkflow(page, apiOrigin, name);
  await openWorkflowEditor(page, name);
  await expect(problemCounter(page)).toHaveCount(0);

  await blockLayer(page, 'Pontos', 'Cálculo').click();
  const formula = formulaOf(page, 'Pontos');
  const saved = draftSaved(page, (definition) => {
    const node = nodeNamed(definition, 'Pontos');
    return node?.type === 'calculation' && node.expression === WRONG_FORMULA;
  });
  await writeFormula(page, formula, WRONG_FORMULA);
  // The problem is saved with the draft (a problem does not stop the save).
  expect((await (await saved).json()) as { problems: unknown[] }).toMatchObject({
    problems: [{ code: 'type_mismatch', node_id: 'calc_pontos', message: TYPE_MISMATCH_MESSAGE }],
  });

  // In the formula: the field is invalid, with the message below and the underline (Monaco's error decoration).
  await expect(formula).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('complementary', { name: 'Propriedades' }).getByText(TYPE_MISMATCH_MESSAGE)).toBeVisible();
  await expect(page.locator('.fc-formula-monaco .squiggly-error'), 'o sublinhado sob categoria').toHaveCount(1);
  // On the block and on the layers, the icon "1 problema"; in the bar, the counter.
  await expect(canvasBlock(page, 'Pontos', 'Cálculo').getByRole('img', { name: '1 problema' })).toBeVisible();
  await expect(blockLayer(page, 'Pontos', 'Cálculo').getByRole('img', { name: '1 problema' })).toBeVisible();
  await expect(canvasBlock(page, 'Pontos já ganhos', 'Cálculo').getByRole('img', { name: /problema/ })).toHaveCount(0);
  await expect(problemCounter(page)).toHaveText('1 problema');
  // "Calcular" waits for the problem to be fixed, and says so.
  const form = await openUnitRun(page);
  await expect(form.getByRole('button', { name: 'Calcular', exact: true })).toBeDisabled();
  await expect(form).toContainText('Resolva 1 problema para calcular');

  // The counter opens the Problems tab, with the problem of the block.
  await problemCounter(page).click();
  await expect(page.getByRole('tabpanel', { name: /^Problemas/ })).toContainText(TYPE_MISMATCH_MESSAGE);

  // Fixing the formula: the problem goes away everywhere.
  const fixed = draftSaved(page, (definition) => {
    const node = nodeNamed(definition, 'Pontos');
    return node?.type === 'calculation' && node.expression === POINTS_FORMULA;
  });
  await writeFormula(page, formula, POINTS_FORMULA);
  expect((await (await fixed).json()) as { problems: unknown[] }).toMatchObject({ problems: [] });
  await expect(problemCounter(page)).toHaveCount(0);
  await expect(formula).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.fc-formula-monaco .squiggly-error')).toHaveCount(0);
  await expect(canvasBlock(page, 'Pontos', 'Cálculo').getByRole('img', { name: /problema/ })).toHaveCount(0);
  await expect(blockLayer(page, 'Pontos', 'Cálculo').getByRole('img', { name: /problema/ })).toHaveCount(0);
  await expect(page.getByRole('tabpanel', { name: /^Problemas/ })).toContainText('Nenhum problema');
  await expect((await openUnitRun(page)).getByRole('button', { name: 'Calcular', exact: true })).toBeEnabled();
});
