// Epic 5 · "Mais de uma linha" in the product's Fonte block (a copy of the "Campanha de referência"): "Aceitar a primeira
// linha" asks for the confirmation that says it goes to the audit; "Cancelar" keeps "Gerar erro", and confirming saves the
// acceptance in the draft (E5-14: the backend records `workflow_multiple_rows_accepted` on that save) (both modes).
import type { Page } from '@playwright/test';
import { suffix } from '../epic-2/support/screens';
import { draftSaved, layers, properties, signInForApi } from '../epic-4/support/screens';
import type { Schemas } from '../support/contract';
import { BLOCKS } from './support/campaign';
import { expect, test } from './support/fixtures';
import { copyCampaign, escape, openWorkflowEditor } from './support/screens';

type Definition = Schemas['WorkflowDefinition'];

/** The "Mais de uma linha" policy of the product's Fonte block, in a saved definition. */
function productPolicy(definition: Definition): string | undefined {
  const node = definition.root.nodes.find((each) => each.name === BLOCKS.product);
  return node?.type === 'source' && node.mode === 'linear' ? node.multiple_rows : undefined;
}

async function pickPolicy(page: Page, option: string): Promise<void> {
  await properties(page).getByRole('combobox', { name: `Mais de uma linha (${BLOCKS.product})`, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('aceitar a primeira linha pede a confirmação da auditoria e só então vai para o rascunho', async ({ page, epic5 }) => {
  const name = `Campanha aceite e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic5.account('admin'));
  await copyCampaign(page, apiOrigin, name);
  await openWorkflowEditor(page, name);
  await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.product)} ,`) }).click();
  const policy = properties(page).getByRole('combobox', { name: `Mais de uma linha (${BLOCKS.product})`, exact: true });

  // The campaign accepts the first line; back to "Gerar erro" first (no confirmation to go back).
  const toError = draftSaved(page, (definition) => productPolicy(definition) === 'error');
  await pickPolicy(page, 'Gerar erro');
  await toError;
  await expect(policy).toContainText('Gerar erro');

  // "Cancelar" keeps the policy as it was.
  await pickPolicy(page, 'Aceitar a primeira linha');
  const dialog = page.getByRole('dialog', { name: 'Aceitar a primeira linha' });
  await expect(dialog).toContainText('Você assume que vale a primeira linha pela ordenação. Isso fica registrado na auditoria.');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(policy).toContainText('Gerar erro');

  // Confirmed: the acceptance is saved, with the order the first line is chosen by.
  const accepted = draftSaved(page, (definition) => productPolicy(definition) === 'accept_first');
  await pickPolicy(page, 'Aceitar a primeira linha');
  await dialog.getByRole('button', { name: 'Aceitar a primeira linha', exact: true }).click();
  await expect(policy).toContainText('Aceitar a primeira linha');
  const saved = ((await accepted).request().postDataJSON() as { definition: Definition }).definition;
  const product = saved.root.nodes.find((each) => each.name === BLOCKS.product);
  expect(product?.type === 'source' && product.mode === 'linear' ? product.order_by.map((order) => order.direction) : null).toEqual(['desc']);
});
