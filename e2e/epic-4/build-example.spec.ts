// Epic 4 · building the example: on a new workflow, the Admin declares the inputs (valor_item, categoria, meta_atingida
// and the list pontuacoes), builds the Decision Table "Primeira" that gives elegivel and fator, and the two Calculations
// of the example; the draft is saved without problems and "Calcular" gives the example's result (both modes).
import type { Locator, Page } from '@playwright/test';
import { callApi, suffix } from '../epic-2/support/screens';
import { expect, test } from './support/fixtures';
import {
  EXAMPLE_DEFINITION,
  HISTORY_FORMULA,
  POINTS_FORMULA,
  blockResult,
  calculate,
  canvasBlock,
  choose,
  draftSaved,
  fillExampleValues,
  formulaOf,
  layers,
  openUnitRun,
  openWorkflowEditor,
  problemCounter,
  properties,
  shownValue,
  signInForApi,
  writeFormula,
} from './support/screens';

type Definition = typeof EXAMPLE_DEFINITION;

/** "Incluir entrada" and the name; the new input (the last one) is a linear decimal with the workflow's 2 places. Returns its group. */
async function includeInput(page: Page, name: string): Promise<Locator> {
  await properties(page).getByRole('button', { name: 'Incluir entrada', exact: true }).click();
  const input = properties(page).getByRole('list', { name: 'Entradas declaradas' }).getByRole('listitem').last();
  await input.getByRole('textbox', { name: /^Nome \(/ }).fill(name);
  const declared = properties(page).getByRole('group', { name: `Entrada ${name}`, exact: true });
  await expect(declared).toBeVisible();
  return declared;
}

/** Types a Decision Table cell: a double click edits it, Tab leaves it. */
async function fillCell(grid: Locator, rule: number, column: number, text: string): Promise<void> {
  const row = grid.getByRole('row').filter({ has: grid.page().getByRole('rowheader', { name: `Regra ${rule}`, exact: true }) });
  await row.getByRole('gridcell').nth(column).dblclick();
  const input = grid.getByRole('textbox', { name: new RegExp(`^Regra ${rule}, `) });
  await input.fill(text);
  await input.press('Tab');
}

/** The nodes without what the screen chooses by itself (the id and the place on the canvas). */
function withoutPlace(definition: Definition) {
  return definition.root.nodes.map((node) => ({ ...node, id: undefined, position: undefined }));
}

test('o Admin declara as entradas e monta a Tabela de Decisão e os Cálculos do exemplo', async ({ page, epic4 }) => {
  test.slow();
  const name = `Pontuação montada e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic4.account('admin'));
  // The empty workflow is the preparation; its screen flow is in create-and-open-editor.spec.ts.
  const created = await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name });
  expect(created.status, 'criar o workflow pela API').toBe(201);
  await openWorkflowEditor(page, name);

  // Inputs: three linear ones and the list pontuacoes, with valor_compra (2 places) and taxa (4 places).
  await layers(page).getByRole('treeitem', { name: 'Entradas', exact: true }).click();
  await includeInput(page, 'valor_item');
  const category = await includeInput(page, 'categoria');
  await choose(page, category.getByRole('combobox', { name: 'Tipo (categoria)' }), 'Texto');
  const goal = await includeInput(page, 'meta_atingida');
  await choose(page, goal.getByRole('combobox', { name: 'Tipo (meta_atingida)' }), 'Booleano');
  const list = await includeInput(page, 'pontuacoes');
  await list.getByRole('radiogroup', { name: 'Cardinalidade (pontuacoes)' }).getByRole('radio', { name: 'Múltiplo' }).click();
  const fields = list.getByRole('group', { name: 'Campos de pontuacoes' });
  await fields.getByRole('listitem').first().getByRole('textbox', { name: /^Nome do campo/ }).fill('valor_compra');
  await list.getByRole('button', { name: 'Incluir campo (pontuacoes)' }).click();
  const rate = fields.getByRole('listitem').last();
  await rate.getByRole('textbox', { name: /^Nome do campo/ }).fill('taxa');
  await rate.getByRole('textbox', { name: 'Casas decimais (taxa)' }).fill('4');
  await expect(layers(page).getByRole('treeitem', { name: 'pontuacoes[]' })).toBeVisible();

  // The Decision Table "Elegibilidade": three conditions, the results elegivel and fator, and the three rules.
  await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Tabela de Decisão', exact: true }).click();
  const table = properties(page).getByRole('group', { name: /^Propriedades de / });
  await table.getByRole('textbox', { name: 'Nome', exact: true }).fill('Elegibilidade');
  await expect(properties(page).getByRole('group', { name: 'Propriedades de Elegibilidade' })).toBeVisible();
  await expect(table.getByRole('combobox', { name: 'Política de acerto' })).toHaveText('Primeira');
  const conditions = table.getByRole('region', { name: 'Condições' });
  for (const [index, expression] of ['categoria', 'EXISTE(pontuacoes[])', 'meta_atingida'].entries()) {
    await conditions.getByRole('button', { name: 'Incluir condição', exact: true }).click();
    await conditions.getByRole('textbox', { name: `Condição ${index + 1}`, exact: true }).fill(expression);
  }
  const results = table.getByRole('region', { name: 'Resultados' });
  const eligible = results.getByRole('group', { name: 'Resultado 1', exact: true });
  await eligible.getByRole('textbox', { name: 'Nome da variável' }).fill('elegivel');
  await choose(page, eligible.getByRole('combobox', { name: 'Tipo' }), 'Booleano');
  await results.getByRole('button', { name: 'Incluir resultado', exact: true }).click();
  const factor = results.getByRole('group', { name: 'Resultado 2', exact: true });
  await factor.getByRole('textbox', { name: 'Nome da variável' }).fill('fator');
  await choose(page, factor.getByRole('combobox', { name: 'Tipo' }), 'Decimal');
  await choose(page, factor.getByRole('combobox', { name: 'Casas' }), '4');

  await table.getByRole('button', { name: 'Abrir tabela', exact: true }).click();
  const gridRegion = page.getByRole('region', { name: 'Tabela de Decisão Elegibilidade' });
  const grid = gridRegion.getByRole('grid', { name: 'Regras de Elegibilidade' });
  const tools = gridRegion.getByRole('toolbar', { name: 'Regras e colunas' });
  const exampleTable = EXAMPLE_DEFINITION.root.nodes.find((node) => node.type === 'decision_table');
  for (const [index, rule] of (exampleTable?.type === 'decision_table' ? exampleTable.rules : []).entries()) {
    await tools.getByRole('button', { name: 'Incluir regra', exact: true }).click();
    for (const [column, cell] of [...rule.when, ...rule.then].entries()) await fillCell(grid, index + 1, column, cell);
  }
  await expect(grid.getByRole('row', { name: 'Regra 2 "A" falso verdadeiro verdadeiro 0.15' })).toBeVisible();
  await gridRegion.getByRole('button', { name: 'Voltar ao canvas', exact: true }).click();

  // The two Calculations: "Pontos já ganhos" (pontos_historico) and "Pontos" (pontos), both decimal with 2 places.
  const saved = draftSaved(page, (definition) => definition.root.nodes.some((node) => node.type === 'calculation' && node.output.name === 'pontos'));
  for (const calculation of [
    { name: 'Pontos já ganhos', formula: HISTORY_FORMULA, output: 'pontos_historico' },
    { name: 'Pontos', formula: POINTS_FORMULA, output: 'pontos' },
  ]) {
    await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Cálculo', exact: true }).click();
    const block = properties(page).getByRole('region', { name: 'Cálculo' });
    await block.getByRole('textbox', { name: /^Nome do bloco/ }).fill(calculation.name);
    await writeFormula(page, formulaOf(page, calculation.name), calculation.formula);
    await block.getByRole('textbox', { name: /^Nome da variável/ }).fill(calculation.output);
  }

  // Saved by itself and without problems: the inputs, the Table and the Calculations are the example's.
  const definition = ((await saved).request().postDataJSON() as { definition: Definition }).definition;
  expect(definition.root.inputs).toEqual(EXAMPLE_DEFINITION.root.inputs);
  expect(withoutPlace(definition)).toEqual(withoutPlace(EXAMPLE_DEFINITION));
  await expect(problemCounter(page)).toHaveCount(0);
  await expect(canvasBlock(page, 'Pontos', 'Cálculo').getByRole('list', { name: 'Lê' })).toContainText('pontos_historico');

  // The assembled workflow calculates like the example: Regra 2 and 225,00 points.
  const form = await openUnitRun(page);
  await fillExampleValues(page, form, { valorItem: '1.500,00', categoria: 'A', metaAtingida: 'Verdadeiro' });
  expect((await calculate(page, form)).status(), 'calcular').toBe(200);
  await expect(blockResult(form, 'Elegibilidade')).toContainText('Regra 2');
  await expect(shownValue(blockResult(form, 'Pontos'), 'pontos')).toHaveText('225,00');
});
