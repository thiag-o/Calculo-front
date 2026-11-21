// Epic 5 · on a copy of the "Campanha de referência": a variable made inside the group "Pontuação" and read by a block
// outside it is the problem "não é visível aqui", fixed by giving it out in the group's Output; and the values of the last
// "Calcular" leave the canvas as soon as anything is edited (both modes).
import { suffix } from '../epic-2/support/screens';
import { formulaOf, layers, problemCounter, properties, signInForApi, writeFormula } from '../epic-4/support/screens';
import { BLOCKS } from './support/campaign';
import { FIRST_RECORD } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  calculate,
  canvasNode,
  canvasValues,
  copyCampaign,
  escape,
  openBottomTab,
  openWorkflowEditor,
  runBanner,
  typeRecordKey,
  unitRunForm,
} from './support/screens';

const BONUS = 'Bônus';

test('uma variável de dentro do grupo usada fora dele não é visível, até entrar no Output do grupo', async ({ page, epic5 }) => {
  const name = `Campanha visibilidade e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic5.account('admin'));
  await copyCampaign(page, apiOrigin, name);
  await openWorkflowEditor(page, name);
  await expect(problemCounter(page)).toHaveCount(0);

  // A Calculation outside the group reads "pontos_base", made inside "Pontuação".
  await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Cálculo', exact: true }).click();
  const block = properties(page).getByRole('region', { name: 'Cálculo' });
  await block.getByRole('textbox', { name: /^Nome do bloco/ }).fill(BONUS);
  await writeFormula(page, formulaOf(page, BONUS), 'pontos_base * 2');
  await block.getByRole('textbox', { name: /^Nome da variável/ }).fill('bonus');

  await expect(problemCounter(page)).toHaveText('1 problema');
  await expect(canvasNode(page, BONUS, 'Cálculo')).toHaveAccessibleName(`${BONUS}, Cálculo, 1 problema`);
  const problems = await openBottomTab(page, 'Problemas');
  await expect(problems).toContainText(`pontos_base existe, mas não é visível aqui. Ela está dentro do grupo ${BLOCKS.group}.`);

  // The fix: the group gives "pontos_base" out in its Output.
  await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.group)} ,`) }).click();
  const group = properties(page).getByRole('region', { name: 'Grupo', exact: true });
  await group.getByRole('group', { name: 'Output', exact: true }).getByRole('checkbox', { name: 'pontos_base', exact: true }).check();
  await expect(problemCounter(page)).toHaveCount(0);
  await expect(canvasNode(page, BONUS, 'Cálculo')).toHaveAccessibleName(`${BONUS}, Cálculo`);
  await expect(problems).not.toContainText('não é visível aqui');
});

test('os valores do último cálculo somem do canvas ao editar o workflow', async ({ page, epic5 }) => {
  const name = `Campanha valores e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic5.account('admin'));
  await copyCampaign(page, apiOrigin, name);
  await openWorkflowEditor(page, name);

  await openBottomTab(page, 'Calcular');
  const form = unitRunForm(page);
  await typeRecordKey(form, FIRST_RECORD.key);
  expect((await calculate(page, form)).status(), 'calcular').toBe(200);
  await expect(runBanner(page)).toContainText('Registro ok');
  await expect(canvasValues(page, BLOCKS.points)).toContainText(FIRST_RECORD.outputs!.pontos);

  // Any change of the draft: here, the short description of "Pontos".
  await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.points)} ,`) }).click();
  await properties(page)
    .getByRole('region', { name: 'Cálculo' })
    .getByRole('textbox', { name: `Descrição curta (${BLOCKS.points})` })
    .fill('Pontos do item, com o teto');
  await expect(runBanner(page)).toHaveCount(0);
  await expect(canvasValues(page, BLOCKS.points)).toHaveCount(0);
  await expect(canvasNode(page, BLOCKS.points, 'Cálculo')).toHaveAccessibleName(`${BLOCKS.points}, Cálculo`);
});
