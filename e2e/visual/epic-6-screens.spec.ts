// Visual proof of the screens of epic 6 (project `visual`, simulated mode): the Parâmetros and Execução sections of the
// workflow panel, the "Executar lote" dialog, the execution panel while it runs and when it ends with errors, the records
// with the trace drawer and the tenant list of executions, in each theme and at the three widths (estilos.md §15), with
// the same checks as screens.spec.ts (scroll bar, text contrast and, in the list, the sidebar; the captures are read by eye
// against estilos.md §12 to §16).
import { editorOf, openOverview } from '../epic-4/support/screens';
import { BLOCKS } from '../epic-5/support/campaign';
import { openEditor } from '../epic-5/support/screens';
import { CAMPAIGN_WORKFLOW, DATA_MONTH } from '../epic-6/support/campaign';
import { expect, test } from '../epic-6/support/fixtures';
import {
  errorGroups,
  executionPanel,
  executionsTable,
  expectStatus,
  finishRun,
  fixPeriod,
  keyText,
  openTrigger,
  parametersSection,
  phases,
  recordsTable,
  stepRun,
  submitTrigger,
  traceDrawer,
} from '../epic-6/support/screens';
import { signIn } from '../support/screens';
import { THEMES, VIEWPORT_HEIGHT, WIDTHS, inspect } from './support';

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`épico 6, tema ${theme === 'light' ? 'claro' : 'escuro'}, ${width}px`, () => {
      test.use({ colorScheme: theme, viewport: { width, height: VIEWPORT_HEIGHT } });

      test('parâmetros, Executar lote, painel, trace e lista de execuções não rolam na horizontal e têm contraste', async ({ page, epic6 }) => {
        test.setTimeout(120_000);
        await signIn(page, epic6.account('admin'));

        // The "Executar lote" dialog, with the relative default of the period, from the Overview.
        await openOverview(page, CAMPAIGN_WORKFLOW);
        const dialog = await openTrigger(page);
        await expect(dialog.getByRole('group', { name: 'periodo', exact: true })).toContainText('Mês anterior');
        await inspect(page, 'epic6-trigger-dialog', theme, width);
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await expect(dialog).toHaveCount(0);

        // The workflow panel of the editor: the Parâmetros section (periodo) and the Execução one.
        await openEditor(page, CAMPAIGN_WORKFLOW);
        await parametersSection(page).scrollIntoViewIfNeeded();
        await expect(parametersSection(page)).toContainText('periodo');
        await inspect(page, 'epic6-parameters', theme, width);

        // "Executar lote" of the editor bar opens the panel of the new execution.
        // The data are of one month (B98): the default period (previous month) would read none of them.
        await fixPeriod(await openTrigger(page, editorOf(page, CAMPAIGN_WORKFLOW)), 'periodo', DATA_MONTH);

        // The panel while it calculates (phases and progress), and when it ends with errors.
        expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
        const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
        stepRun(epic6);
        stepRun(epic6);
        stepRun(epic6);
        await expect(phases(page).getByRole('progressbar', { name: 'Registros calculados' })).toHaveAttribute('aria-valuetext', '25 de 58 registros · 43%');
        await inspect(page, 'epic6-panel-running', theme, width);
        finishRun(epic6);
        await expectStatus(page, epic6, panel, 'Com erros');
        await expect(recordsTable(page).getByRole('row').nth(1)).toBeVisible();
        await inspect(page, 'epic6-panel', theme, width);

        // An error group filters the records, and the key opens the trace drawer.
        await errorGroups(page).getByRole('button', { name: `${BLOCKS.product}, no_match: 2 registros. Filtrar os registros`, exact: true }).click();
        await recordsTable(page).getByRole('button', { name: `Abrir o trace de ${keyText({ nota_id: '5', item_seq: '3' })}`, exact: true }).click();
        await expect(traceDrawer(page)).toContainText('no_match');
        await inspect(page, 'epic6-trace-drawer', theme, width);
        await traceDrawer(page).getByRole('button', { name: 'Fechar', exact: true }).click();
        await expect(traceDrawer(page)).toHaveCount(0);

        // The tenant list, with the sidebar (icons only below 1180 px).
        await page.getByRole('button', { name: 'Voltar para execuções', exact: true }).click();
        await expect(executionsTable(page).getByRole('row').nth(1)).toContainText('Com erros');
        await inspect(page, 'epic6-list', theme, width, { menu: true });
      });
    });
  }
}
