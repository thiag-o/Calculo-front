// Epic 6 · the preview and "Calcular" with the parameter (fluxo 2 and roteiro 2 and 3), on the "Campanha de referência"
// of `prepare-local`: the workflow panel shows `periodo` and the filter of the batch source with `@periodo`; the preview
// with the data month (fixed, February 2026) counts the whole campaign and, with a fixed period, only its first days; "Calcular"
// shares the values with the preview, so a record out of the period comes back filtered, and with the data month it is
// calculated (both modes; nothing is saved, so the shared workflow is used as it is).
import { layers, properties } from '../epic-4/support/screens';
import { COUNTED_RECORDS } from '../epic-5/support/expected';
import { calculate, openBottomTab, openWorkflowEditor, previewPanel, runPreview, shownValue, typeRecordKey, unitRunForm } from '../epic-5/support/screens';
import { signIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW, DATA_MONTH } from './support/campaign';
import { FIRST_DAYS, FIRST_DAYS_TOTALS } from './support/expected';
import { expect, test } from './support/fixtures';
import { declaredParameter, fixPeriod, parametersSection, setPeriodDates } from './support/screens';

test('a prévia e o Calcular usam o periodo: o mês dos dados lê a campanha inteira e um período fixo só os primeiros dias', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);

  await test.step('o painel do workflow mostra o periodo e o filtro da fonte do lote com @periodo', async () => {
    await expect(declaredParameter(page, 'periodo')).toBeVisible();
    await expect(declaredParameter(page, 'periodo').getByRole('combobox', { name: 'Tipo (periodo)', exact: true })).toContainText('Período');
    await expect(declaredParameter(page, 'periodo').getByRole('combobox', { name: 'Valor relativo (periodo)', exact: true })).toContainText('Mês anterior');
    await expect(parametersSection(page)).toBeVisible();
    await layers(page).getByRole('treeitem', { name: /^Fonte do lote/ }).click();
    const filters = properties(page).getByRole('region', { name: 'Fonte do lote', exact: true }).getByRole('group', { name: 'Filtros', exact: true }).last();
    // The period is two filters on `emissao`: `>=` the start and `<=` the end.
    await expect(filters.getByRole('textbox', { name: 'Valor (filtro 2)', exact: true })).toHaveValue('@periodo.inicio');
    await expect(filters.getByRole('textbox', { name: 'Valor (filtro 3)', exact: true })).toHaveValue('@periodo.fim');
  });

  const panel = previewPanel(page);
  await test.step('a prévia com o mês dos dados conta a campanha inteira', async () => {
    await openBottomTab(page, 'Prévia');
    await expect(panel.getByRole('group', { name: 'periodo', exact: true })).toContainText('Mês anterior');
    await fixPeriod(panel, 'periodo', DATA_MONTH);
    const response = await runPreview(page);
    expect(response.status(), 'rodar a prévia').toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ parameters: { periodo: DATA_MONTH } });
    await expect(panel.getByRole('status')).toHaveText(`Prévia pronta: ${COUNTED_RECORDS} registros contados`);
  });

  await test.step('a prévia com um período fixo conta menos registros', async () => {
    await setPeriodDates(panel, 'periodo', FIRST_DAYS);
    const response = await runPreview(page);
    expect(response.status(), 'rodar a prévia').toBe(200);
    expect(response.request().postDataJSON()).toMatchObject({ parameters: { periodo: FIRST_DAYS } });
    await expect(panel.getByRole('status')).toHaveText(`Prévia pronta: ${FIRST_DAYS_TOTALS.read} registros contados`);
  });

  await test.step('o Calcular usa os mesmos valores: 20/3 fica fora do período, e com o mês dos dados é calculado', async () => {
    await openBottomTab(page, 'Calcular');
    const form = unitRunForm(page);
    const period = form.getByRole('group', { name: 'periodo', exact: true });
    await expect(period.getByLabel('Início', { exact: true })).toHaveValue(FIRST_DAYS.start);
    await typeRecordKey(form, { nota_id: '20', item_seq: '3' });
    const outside = await calculate(page, form);
    expect(outside.status(), 'calcular').toBe(200);
    expect(outside.request().postDataJSON()).toMatchObject({ parameters: { periodo: FIRST_DAYS } });
    await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: filtrado');

    await setPeriodDates(form, 'periodo', DATA_MONTH);
    const inside = await calculate(page, form);
    expect(inside.status(), 'calcular').toBe(200);
    await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: ok');
    await expect(shownValue(form.getByRole('region', { name: 'Saídas', exact: true }), 'pontos')).toHaveText('150,00');
  });
});
