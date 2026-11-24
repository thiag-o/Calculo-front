// Epic 6 · declaring the run parameters (fluxo 1 of the global plan): on a copy of the "Campanha de referência" as it was
// in epic 5 (without parameters), the Admin declares `periodo` (Período, default "Mês anterior") in the Parâmetros section
// of the workflow, uses it in the filter of the invoice date of the batch source ("Usar parâmetro" in "De" fills "Até")
// and declares `teto` (Decimal, fixed 100,00) used in the formula of "Pontos". The draft saves without problems, and the
// preview and "Calcular" read the parameters: the default period counts the whole data month and the ceiling of a
// record goes from the table's 150,00 to the parameter's 100,00.
import type { Locator, Page } from '@playwright/test';
import { suffix } from '../epic-2/support/screens';
import { draftSaved, formulaOf, layers, problemCounter, properties, signInForApi, writeFormula } from '../epic-4/support/screens';
import { BLOCKS } from '../epic-5/support/campaign';
import { COUNTED_RECORDS } from '../epic-5/support/expected';
import { calculate, escape, openBottomTab, openWorkflowEditor, previewPanel, runPreview, shownValue, typeRecordKey, unitRunForm } from '../epic-5/support/screens';
import type { Schemas } from '../support/contract';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { expect, test } from './support/fixtures';
import { chooseOption, copyWorkflow, declaredParameter, parametersSection } from './support/screens';

type Definition = Schemas['WorkflowDefinition'];

/** The formula of "Pontos" with the ceiling from the parameter instead of the parameters table. */
const POINTS_WITH_PARAMETER = 'MÍN(ARRED(pontos_base * multiplicador, 2), @teto)';

/** The campaign as it was in epic 5: no parameter, and no filter that reads one. */
function withoutParameters(definition: Definition): Definition {
  const source = definition.root.batch_source;
  return {
    ...definition,
    parameters: [],
    root: {
      ...definition.root,
      batch_source: source ? { ...source, filters: source.filters.filter((filter) => !filter.values.some((value) => value.includes('@'))) } : source,
    },
  };
}

const combobox = (scope: Locator, name: string) => scope.getByRole('combobox', { name, exact: true });

/** "Adicionar parâmetro" and the name of the new one (it comes as `parametro_N`, Texto, without default). */
async function addParameter(page: Page, name: string): Promise<Locator> {
  const section = parametersSection(page);
  await section.getByRole('button', { name: 'Adicionar parâmetro', exact: true }).click();
  const created = section.getByRole('group', { name: /^Parâmetro parametro_\d+$/ }).last();
  await created.getByRole('textbox', { name: /^Nome \(parametro_\d+\)$/ }).fill(name);
  const item = declaredParameter(page, name);
  await expect(item).toBeVisible();
  return item;
}

test('o Admin declara o periodo, usa no filtro da data de emissão e um parâmetro numa fórmula; a prévia e o Calcular os leem', async ({ page, epic6 }) => {
  test.setTimeout(90_000);
  const name = `Campanha com parâmetros e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic6.account('admin'));
  await copyWorkflow(page, apiOrigin, CAMPAIGN_WORKFLOW, name, withoutParameters);
  await openWorkflowEditor(page, name);

  await test.step('periodo: Período, obrigatório, padrão relativo Mês anterior', async () => {
    await expect(parametersSection(page)).toContainText('Nenhum parâmetro.');
    const periodo = await addParameter(page, 'periodo');
    await chooseOption(page, combobox(periodo, 'Tipo (periodo)'), 'Período');
    await periodo.getByRole('checkbox', { name: 'Obrigatório (periodo)', exact: true }).check();
    await periodo.getByRole('radiogroup', { name: 'Padrão (periodo)' }).getByRole('radio', { name: 'Relativo', exact: true }).click();
    await chooseOption(page, combobox(periodo, 'Valor relativo (periodo)'), 'Mês anterior');
    await periodo.getByRole('textbox', { name: 'Descrição (periodo)', exact: true }).fill('Mês de emissão das notas');
  });

  await test.step('teto: Decimal com 2 casas, padrão fixo 100,00', async () => {
    const teto = await addParameter(page, 'teto');
    await chooseOption(page, combobox(teto, 'Tipo (teto)'), 'Decimal');
    await teto.getByRole('radiogroup', { name: 'Padrão (teto)' }).getByRole('radio', { name: 'Fixo', exact: true }).click();
    await teto.getByRole('textbox', { name: 'Valor padrão (teto)', exact: true }).fill('100,00');
  });

  await test.step('o filtro da data de emissão na fonte do lote usa @periodo', async () => {
    await layers(page).getByRole('treeitem', { name: /^Fonte do lote/ }).click();
    const source = properties(page).getByRole('region', { name: 'Fonte do lote', exact: true });
    await source.getByRole('group', { name: 'Variáveis trazidas', exact: true }).getByRole('checkbox', { name: /^emissao / }).check();
    const filters = source.getByRole('group', { name: 'Filtros', exact: true }).last();
    await filters.getByRole('button', { name: 'Incluir filtro', exact: true }).click();
    // The batch source already filters the cancelled items: the new filter is the second one.
    await chooseOption(page, combobox(filters, 'Variável (filtro 2)'), 'emissao');
    await chooseOption(page, combobox(filters, 'Operador (filtro 2)'), 'ENTRE');
    await filters.getByRole('button', { name: 'Usar parâmetro (De, filtro 2)', exact: true }).click();
    await page.getByRole('menuitem', { name: '@periodo.inicio', exact: true }).click();
    await expect(filters.getByRole('textbox', { name: 'De (filtro 2)', exact: true })).toHaveValue('@periodo.inicio');
    await expect(filters.getByRole('textbox', { name: 'Até (filtro 2)', exact: true })).toHaveValue('@periodo.fim');
  });

  await test.step('a fórmula de Pontos usa @teto, e o rascunho salva sem problemas', async () => {
    const saved = draftSaved(page, (definition) => {
      const group = definition.root.nodes.find((node) => node.type === 'group');
      const points = group?.type === 'group' ? group.nodes.find((node) => node.name === BLOCKS.points) : undefined;
      return points?.type === 'calculation' && points.expression === POINTS_WITH_PARAMETER;
    });
    await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.points)} ,`) }).click();
    const formula = formulaOf(page, BLOCKS.points);
    await expect(formula).toBeVisible();
    await writeFormula(page, formula, POINTS_WITH_PARAMETER);
    const definition = ((await saved).request().postDataJSON() as Schemas['DraftUpdate']).definition;
    expect(definition.parameters).toEqual([
      { name: 'periodo', type: 'period', required: true, list: false, scale: null, default: { kind: 'relative', value: 'previous_month' }, allowed_values: null, description: 'Mês de emissão das notas' },
      { name: 'teto', type: 'decimal', required: false, list: false, scale: 2, default: { kind: 'fixed', value: '100.00' }, allowed_values: null, description: null },
    ]);
    expect(definition.root.batch_source?.filters).toContainEqual({ variable: 'emissao', operator: 'between', values: ['@periodo.inicio', '@periodo.fim'] });
    await expect(problemCounter(page)).toHaveCount(0);
  });

  await test.step('a prévia com o padrão conta o mês inteiro dos dados', async () => {
    await openBottomTab(page, 'Prévia');
    await expect(previewPanel(page).getByRole('group', { name: 'periodo', exact: true })).toContainText('Mês anterior');
    const response = await runPreview(page);
    expect(response.status(), 'rodar a prévia').toBe(200);
    await expect(previewPanel(page).getByRole('status')).toHaveText(`Prévia pronta: ${COUNTED_RECORDS} registros contados`);
  });

  await test.step('o Calcular usa o teto do parâmetro: 20/3 passa de 150,00 a 100,00', async () => {
    await openBottomTab(page, 'Calcular');
    const form = unitRunForm(page);
    await typeRecordKey(form, { nota_id: '20', item_seq: '3' });
    const response = await calculate(page, form);
    expect(response.status(), 'calcular').toBe(200);
    await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: ok');
    await expect(shownValue(form.getByRole('region', { name: 'Saídas', exact: true }), 'pontos')).toHaveText('100,00');
  });
});
