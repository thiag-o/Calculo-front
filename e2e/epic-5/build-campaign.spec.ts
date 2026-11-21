// Epic 5 · building the reference campaign: on a new workflow, the Admin chooses the batch source (the invoice items,
// with the key, the filter of the cancelled ones and the order), includes the linear Fonte blocks (invoice, store,
// product, parameters), the Filtro of the campaign's products, and the group "Pontuação" with the factor, the Decision
// Table and the two Calculations; the draft is saved like the campaign of docs/campanha-de-referencia.md, without
// problems, and "Calcular" gives the expected value of a record (simulated mode: the real mode builds nothing, it uses
// the workflow `prepare-local` creates, in preview-and-calculate.spec.ts).
import type { Locator, Page } from '@playwright/test';
import { callApi, suffix } from '../epic-2/support/screens';
import { draftSaved, formulaOf, layers, problemCounter, properties, signInForApi, writeFormula } from '../epic-4/support/screens';
import type { Schemas } from '../support/contract';
import { BASE_POINTS_FORMULA, BLOCKS, CAMPAIGN_DEFINITION, MULTIPLIER_RULES, POINTS_FORMULA } from './support/campaign';
import { FIRST_RECORD } from './support/expected';
import { expect, test } from './support/fixtures';
import { calculate, escape, openBottomTab, openWorkflowEditor, runPreview, sampleRecord, shownValue, unitRunForm } from './support/screens';

type Definition = Schemas['WorkflowDefinition'];
type WorkflowNode = Definition['root']['nodes'][number];

/** Picks the option of a select (Radix Select) whose name starts with `option` ("nota_id · Inteiro" by "nota_id"). */
async function choose(page: Page, select: Locator, option: string): Promise<void> {
  await select.click();
  await page.getByRole('option', { name: new RegExp(`^${escape(option)}( ·|$)`) }).click();
  await expect(select).toContainText(option);
}

/** The select of a properties field by its accessible name ("Variável (filtro 1)"). */
const select = (scope: Locator, name: string) => scope.getByRole('combobox', { name, exact: true });

/** Includes a Fonte block by the dataset (toolbar "Fonte") and names it; returns its properties. */
async function includeSource(page: Page, dataset: string, name: string): Promise<Locator> {
  await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Fonte', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Incluir bloco Fonte' });
  await dialog.getByRole('button', { name: new RegExp(`^${escape(dataset)} (Tabela|SQL|Excel)`) }).click();
  await dialog.getByRole('button', { name: 'Incluir Fonte', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const block = properties(page).getByRole('region', { name: 'Fonte', exact: true });
  await block.getByRole('textbox', { name: /^Nome do bloco/ }).fill(name);
  await expect(block.getByRole('textbox', { name: `Nome do bloco (${name})` })).toHaveValue(name);
  return block;
}

/** Links a variable of the workflow to a variable of the block's dataset ("Incluir ligação"). */
async function link(page: Page, block: Locator, variable: string, column: string): Promise<void> {
  await block.getByRole('button', { name: 'Incluir ligação', exact: true }).click();
  await choose(page, select(block, 'Variável do workflow (ligação 1)'), variable);
  await choose(page, select(block, 'Variável do dataset (ligação 1)'), column);
}

/** Keeps in the block's output only `kept`: the other variables of the dataset are unchecked. */
async function keepOutputs(block: Locator, all: readonly string[], kept: readonly string[]): Promise<void> {
  for (const name of all.filter((each) => !kept.includes(each))) {
    const box = block.getByRole('group', { name: `Variável ${name}`, exact: true }).getByRole('checkbox');
    await box.uncheck();
    await expect(box).not.toBeChecked();
  }
}

/** A filter "variable = value" in the last "Filtros" list of `scope` (the batch source wraps its list in another one). */
async function filter(page: Page, scope: Locator, variable: string, value: { choose: string } | { type: string }): Promise<void> {
  const filters = scope.getByRole('group', { name: 'Filtros', exact: true }).last();
  await filters.getByRole('button', { name: 'Incluir filtro', exact: true }).click();
  await choose(page, select(filters, 'Variável (filtro 1)'), variable);
  await expect(select(filters, 'Operador (filtro 1)')).toContainText('=');
  if ('choose' in value) await choose(page, select(filters, 'Valor (filtro 1)'), value.choose);
  else await filters.getByRole('textbox', { name: 'Valor (filtro 1)', exact: true }).fill(value.type);
}

/** Types a Decision Table cell: a double click edits it, Tab leaves it. */
async function fillCell(grid: Locator, rule: number, column: number, text: string): Promise<void> {
  const row = grid.getByRole('row').filter({ has: grid.page().getByRole('rowheader', { name: `Regra ${rule}`, exact: true }) });
  await row.getByRole('gridcell').nth(column).dblclick();
  const input = grid.getByRole('textbox', { name: new RegExp(`^Regra ${rule}, `) });
  await input.fill(text);
  await input.press('Tab');
}

/** The nodes without what the screen chooses by itself (the id and the place on the canvas), at any depth. */
function withoutPlace(nodes: readonly WorkflowNode[]): unknown[] {
  return nodes.map((node) => ({
    ...node,
    id: undefined,
    position: undefined,
    ...(node.type === 'group' ? { nodes: withoutPlace(node.nodes) } : {}),
  }));
}

test('o Admin monta a campanha de referência com fonte do lote, fontes lineares, filtro e grupo', async ({ page, epic5 }) => {
  test.skip(epic5.mode === 'real', 'O modo real usa a "Campanha de referência" do prepare-local, sem montar nada.');
  test.setTimeout(240_000);
  const name = `Campanha montada e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic5.account('admin'));
  const created = await callApi(page, apiOrigin, 'POST', '/v1/workflows', { name });
  expect(created.status, 'criar o workflow pela API').toBe(201);
  await openWorkflowEditor(page, name);

  await test.step('fonte do lote: itens, chave, filtro dos cancelados e ordenação', async () => {
    const workflow = properties(page).getByRole('region', { name: 'Workflow', exact: true });
    await workflow.getByRole('radiogroup', { name: 'Origem dos valores' }).getByRole('radio', { name: 'Fonte do lote' }).click();
    await workflow.getByRole('list', { name: 'Datasets do catálogo' }).getByRole('button', { name: /^Itens de nota fiscal/ }).click();
    const brought = workflow.getByRole('group', { name: 'Variáveis trazidas', exact: true });
    for (const variable of ['nota_id', 'item_seq', 'cod_produto', 'quantidade', 'valor_item', 'cancelado']) {
      await brought.getByRole('checkbox', { name: new RegExp(`^${variable} `) }).check();
    }
    const key = workflow.getByRole('group', { name: 'Chave do registro', exact: true });
    await key.getByRole('checkbox', { name: 'nota_id', exact: true }).check();
    await key.getByRole('checkbox', { name: 'item_seq', exact: true }).check();
    await filter(page, workflow, 'cancelado', { choose: 'Falso' });
    const order = workflow.getByRole('group', { name: 'Ordenação', exact: true });
    await order.getByRole('button', { name: 'Incluir critério', exact: true }).click();
    await order.getByRole('button', { name: 'Incluir critério', exact: true }).click();
    await expect(select(order, 'Variável (critério 2)')).toContainText('item_seq');
    // The canvas shows the batch source in place of the inputs.
    await expect(layers(page).getByRole('treeitem', { name: /^Fonte do lote/ })).toBeVisible();
  });

  await test.step('fontes lineares: nota, loja (só as que participam) e a tabela de parâmetros', async () => {
    const invoice = await includeSource(page, 'Notas fiscais', BLOCKS.invoice);
    await link(page, invoice, 'nota_id', 'id');
    await keepOutputs(invoice, ['id', 'numero', 'loja_id', 'cliente_id', 'emissao'], ['loja_id', 'cliente_id']);

    const store = await includeSource(page, 'Lojas', BLOCKS.store);
    await link(page, store, 'loja_id', 'id');
    await filter(page, store, 'participa', { choose: 'Verdadeiro' });
    await choose(page, select(store, `Sem correspondência (${BLOCKS.store})`), 'Descartar o registro');
    await keepOutputs(store, ['id', 'nome', 'cidade', 'uf', 'participa'], ['uf']);
  });

  await test.step('filtro: só os produtos da campanha (EXISTE)', async () => {
    const inCampaign = await includeSource(page, 'Produtos da campanha', BLOCKS.inCampaign);
    await link(page, inCampaign, 'cod_produto', 'cod_produto');
    await inCampaign.getByRole('radiogroup', { name: `Modo (${BLOCKS.inCampaign})` }).getByRole('radio', { name: 'Filtro' }).click();
    await expect(inCampaign.getByRole('radiogroup', { name: `Condição (${BLOCKS.inCampaign})` }).getByRole('radio', { name: 'EXISTE', exact: true })).toBeChecked();
  });

  await test.step('produto ativo mais novo, aceitando a primeira linha, e os parâmetros', async () => {
    const product = await includeSource(page, 'Produtos', BLOCKS.product);
    await link(page, product, 'cod_produto', 'codigo');
    await filter(page, product, 'situacao', { type: 'A' });
    const order = product.getByRole('group', { name: 'Critério 1', exact: true });
    await choose(page, select(order, 'Variável (critério 1)'), 'vigencia_inicio');
    await choose(page, select(order, 'Direção (critério 1)'), 'Decrescente');
    // "Aceitar a primeira linha" asks for the confirmation before it goes to the draft (E5-14).
    await select(product, `Mais de uma linha (${BLOCKS.product})`).click();
    await page.getByRole('option', { name: 'Aceitar a primeira linha', exact: true }).click();
    const accept = page.getByRole('dialog', { name: 'Aceitar a primeira linha' });
    await expect(accept).toContainText('Você assume que vale a primeira linha pela ordenação. Isso fica registrado na auditoria.');
    await accept.getByRole('button', { name: 'Aceitar a primeira linha', exact: true }).click();
    await expect(select(product, `Mais de uma linha (${BLOCKS.product})`)).toContainText('Aceitar a primeira linha');
    await keepOutputs(product, ['id', 'codigo', 'descricao', 'categoria', 'situacao', 'vigencia_inicio'], ['categoria']);

    const parameters = await includeSource(page, 'Parâmetros da campanha', BLOCKS.parameters);
    await expect(parameters.getByRole('note', { name: 'Tabela de parâmetros' })).toBeVisible();
    await keepOutputs(parameters, ['id', 'teto_pontos_item'], ['teto_pontos_item']);
  });

  await test.step('os blocos da pontuação: fator, Multiplicador, Pontos base e Pontos', async () => {
    const factor = await includeSource(page, 'Fatores por categoria', BLOCKS.factor);
    await link(page, factor, 'categoria', 'categoria');
    await choose(page, select(factor, `Sem correspondência (${BLOCKS.factor})`), 'Manter vazio');
    await keepOutputs(factor, ['categoria', 'descricao', 'fator'], ['fator']);

    await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Tabela de Decisão', exact: true }).click();
    const table = properties(page).getByRole('group', { name: /^Propriedades de / });
    await table.getByRole('textbox', { name: 'Nome', exact: true }).fill(BLOCKS.multiplier);
    await expect(properties(page).getByRole('group', { name: `Propriedades de ${BLOCKS.multiplier}` })).toBeVisible();
    const conditions = table.getByRole('region', { name: 'Condições' });
    for (const [index, expression] of ['valor_item', 'quantidade', 'uf'].entries()) {
      await conditions.getByRole('button', { name: 'Incluir condição', exact: true }).click();
      await conditions.getByRole('textbox', { name: `Condição ${index + 1}`, exact: true }).fill(expression);
    }
    const results = table.getByRole('region', { name: 'Resultados' });
    const eligible = results.getByRole('group', { name: 'Resultado 1', exact: true });
    await eligible.getByRole('textbox', { name: 'Nome da variável' }).fill('elegivel');
    await choose(page, eligible.getByRole('combobox', { name: 'Tipo' }), 'Booleano');
    await results.getByRole('button', { name: 'Incluir resultado', exact: true }).click();
    const multiplier = results.getByRole('group', { name: 'Resultado 2', exact: true });
    await multiplier.getByRole('textbox', { name: 'Nome da variável' }).fill('multiplicador');
    await choose(page, multiplier.getByRole('combobox', { name: 'Tipo' }), 'Decimal');
    await choose(page, multiplier.getByRole('combobox', { name: 'Casas' }), '2');
    await table.getByRole('button', { name: 'Abrir tabela', exact: true }).click();
    const gridRegion = page.getByRole('region', { name: `Tabela de Decisão ${BLOCKS.multiplier}` });
    const grid = gridRegion.getByRole('grid', { name: `Regras de ${BLOCKS.multiplier}` });
    for (const [index, rule] of MULTIPLIER_RULES.entries()) {
      await gridRegion.getByRole('toolbar', { name: 'Regras e colunas' }).getByRole('button', { name: 'Incluir regra', exact: true }).click();
      for (const [column, cell] of [...rule.when, ...rule.then].entries()) await fillCell(grid, index + 1, column, cell);
    }
    await expect(grid.getByRole('row', { name: 'Regra 4 - - "PE" verdadeiro 1.10' })).toBeVisible();
    await gridRegion.getByRole('button', { name: 'Voltar ao canvas', exact: true }).click();

    for (const calculation of [
      { name: BLOCKS.basePoints, formula: BASE_POINTS_FORMULA, output: 'pontos_base' },
      { name: BLOCKS.points, formula: POINTS_FORMULA, output: 'pontos' },
    ]) {
      await page.getByRole('toolbar', { name: 'Incluir bloco' }).getByRole('button', { name: 'Cálculo', exact: true }).click();
      const block = properties(page).getByRole('region', { name: 'Cálculo' });
      await block.getByRole('textbox', { name: /^Nome do bloco/ }).fill(calculation.name);
      await writeFormula(page, formulaOf(page, calculation.name), calculation.formula);
      await block.getByRole('textbox', { name: /^Nome da variável/ }).fill(calculation.output);
    }
    // "Pontos base" with the category without factor: the default 0 (docs/campanha-de-referencia.md, 7.3).
    await layers(page).getByRole('treeitem', { name: new RegExp(`^${BLOCKS.basePoints} ,`) }).click();
    const base = properties(page).getByRole('region', { name: 'Cálculo' });
    await choose(page, select(base, `Política de erro (${BLOCKS.basePoints})`), 'Usar valor padrão');
    await base.getByRole('textbox', { name: `Valor padrão (${BLOCKS.basePoints})` }).fill('0');
  });

  await test.step('Agrupar os quatro blocos no grupo "Pontuação", com o Output elegivel e pontos', async () => {
    const canvas = page.getByRole('region', { name: 'Canvas', exact: true });
    // The block selected is picked with the first Shift + Espaço; the other three join it.
    await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.factor)} ,`) }).click();
    for (const [block, kind] of [
      [BLOCKS.multiplier, 'Tabela de Decisão'],
      [BLOCKS.basePoints, 'Cálculo'],
      [BLOCKS.points, 'Cálculo'],
    ] as const) {
      const node = canvas.getByRole('group', { name: new RegExp(`^${escape(block)}, ${kind}`) });
      await node.focus();
      await page.keyboard.press('Shift+Space');
    }
    await expect(page.getByRole('status').filter({ hasText: '4 blocos selecionados para agrupar' })).toBeAttached();
    await page.getByRole('button', { name: 'Agrupar', exact: true }).click();
    const group = properties(page).getByRole('region', { name: 'Grupo', exact: true });
    await group.getByRole('textbox', { name: /^Nome do grupo/ }).fill(BLOCKS.group);
    await expect(group.getByRole('list', { name: 'Input do grupo' })).toContainText('teto_pontos_item');
    const output = group.getByRole('group', { name: 'Output', exact: true });
    for (const name of ['fator', 'pontos_base', 'multiplicador']) await output.getByRole('checkbox', { name, exact: true }).uncheck();
    for (const name of ['elegivel', 'pontos']) await output.getByRole('checkbox', { name, exact: true }).check();
  });

  await test.step('os campos de saída pontos e elegivel', async () => {
    const saved = draftSaved(page, (definition) => definition.root.output.fields.map((field) => `${field.name}=${field.variable}`).join() === 'pontos=pontos,elegivel=elegivel');
    await layers(page).getByRole('treeitem', { name: /^Saída/ }).click();
    const output = properties(page).getByRole('region', { name: 'Saída', exact: true });
    for (const [index, name] of ['pontos', 'elegivel'].entries()) {
      await output.getByRole('button', { name: 'Incluir campo', exact: true }).click();
      const field = output.getByRole('list', { name: 'Campos de saída' }).getByRole('listitem').nth(index);
      const current = (await field.getByRole('textbox', { name: /^Nome/ }).inputValue()).trim();
      await choose(page, select(field, `Variável (${current})`), name);
      await field.getByRole('textbox', { name: /^Nome/ }).fill(name);
    }

    // Saved by itself and without problems: the definition is the campaign's (ids and places are the screen's).
    const definition = ((await saved).request().postDataJSON() as { definition: Definition }).definition;
    expect(definition.root.batch_source).toEqual(CAMPAIGN_DEFINITION.root.batch_source);
    expect(withoutPlace(definition.root.nodes)).toEqual(withoutPlace(CAMPAIGN_DEFINITION.root.nodes));
    expect(definition.root.output).toEqual(CAMPAIGN_DEFINITION.root.output);
    await expect(problemCounter(page)).toHaveCount(0);
  });

  await test.step('a campanha montada calcula o primeiro registro da amostra como a de referência', async () => {
    await openBottomTab(page, 'Prévia');
    expect((await runPreview(page)).status(), 'rodar a prévia').toBe(200);
    await openBottomTab(page, 'Calcular');
    const form = unitRunForm(page);
    await sampleRecord(form, FIRST_RECORD.key).click();
    expect((await calculate(page, form)).status(), 'calcular').toBe(200);
    await expect(form.getByRole('status')).toHaveText('Resultado do cálculo: ok');
    await expect(shownValue(form.getByRole('region', { name: 'Saídas', exact: true }), 'pontos')).toHaveText(FIRST_RECORD.outputs!.pontos);
  });
});
