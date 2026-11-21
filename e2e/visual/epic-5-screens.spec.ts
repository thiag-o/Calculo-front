// Visual proof of the screens of epic 5 (project `visual`, simulated mode): the "Campanha de referência" editor with the
// batch source, the Fonte blocks, the group, the "Prévia" tab and the values of the last "Calcular" on the canvas, in each
// theme and at the three widths, with the same three checks as screens.spec.ts (scroll bar, text contrast; the captures are
// read by eye against estilos.md §12 to §16).
import { signIn } from '../support/screens';
import { BLOCKS, CAMPAIGN_WORKFLOW } from '../epic-5/support/campaign';
import { FIRST_RECORD } from '../epic-5/support/expected';
import { expect, test } from '../epic-5/support/fixtures';
import {
  calculate,
  canvasValues,
  escape,
  openBottomTab,
  openWorkflowEditor,
  previewPanel,
  runPreview,
  sampleRecord,
  unitRunForm,
} from '../epic-5/support/screens';
import { layers, properties } from '../epic-4/support/screens';
import { THEMES, VIEWPORT_HEIGHT, WIDTHS, inspect } from './support';

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`épico 5, tema ${theme === 'light' ? 'claro' : 'escuro'}, ${width}px`, () => {
      test.use({ colorScheme: theme, viewport: { width, height: VIEWPORT_HEIGHT } });

      test('fonte do lote, blocos Fonte, grupo, Prévia e valores no canvas não rolam na horizontal e têm contraste', async ({ page, epic5 }) => {
        test.setTimeout(120_000);
        await signIn(page, epic5.account('admin'));
        await openWorkflowEditor(page, CAMPAIGN_WORKFLOW);
        await expect(page.getByRole('region', { name: 'Canvas', exact: true })).toBeVisible();
        await inspect(page, 'epic5-canvas', theme, width);

        // The batch source (the first layer) and its properties.
        await layers(page).getByRole('treeitem', { name: /^Fonte do lote/ }).click();
        await expect(properties(page)).toBeVisible();
        await inspect(page, 'epic5-batch-source', theme, width);

        // A Fonte block (Linear), with links, filters and policies.
        await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.product)} ,`) }).click();
        await expect(properties(page)).toContainText(`Mais de uma linha (${BLOCKS.product})`);
        await inspect(page, 'epic5-source-block', theme, width);

        // The group, with its Input and Output.
        await layers(page).getByRole('treeitem', { name: new RegExp(`^${escape(BLOCKS.group)} ,`) }).click();
        await expect(properties(page).getByRole('region', { name: 'Grupo', exact: true })).toBeVisible();
        await inspect(page, 'epic5-group', theme, width);

        // The "Prévia" tab, with the counts and the sample.
        await openBottomTab(page, 'Prévia');
        expect((await runPreview(page)).status(), 'rodar a prévia').toBe(200);
        await expect(previewPanel(page).getByRole('status')).toContainText('Prévia pronta');
        await inspect(page, 'epic5-preview', theme, width);

        // "Calcular" by record: the trace, and the values of that run on the canvas.
        await openBottomTab(page, 'Calcular');
        const form = unitRunForm(page);
        await sampleRecord(form, FIRST_RECORD.key).click();
        expect((await calculate(page, form)).status(), 'calcular').toBe(200);
        await expect(form.getByRole('status')).toContainText('Resultado do cálculo');
        await expect(canvasValues(page, BLOCKS.points)).toBeVisible();
        await inspect(page, 'epic5-run-values', theme, width);
      });
    });
  }
}
