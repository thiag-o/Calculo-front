// Visual proof of the screens of epic 7 (project `visual`, simulated mode), in each theme and at the three widths
// (estilos.md §15), with the same checks as screens.spec.ts (scroll bar, text contrast and, in the shell lists, the
// sidebar): the Testes screen with the reference files, the panel of a simulation with the comparison, the "Executar lote"
// dialog with the overlap note, the panel waiting for the decision of the pre-validation, the "Novo agendamento" dialog,
// the Agendamentos tab and the bell open over the content bar.
// Pixel comparison (F134, D45 option C): all the screens are compared with the baseline. The texts that come from the clock
// of the simulated server (dates and hours, "há N min", durations, the deadline of the decision, the next run of a
// schedule) and the id of an execution vary from run to run, so `clockAreas` paints them over. Everything else is fixed by
// the simulation (the campaign's data, the reference file, the counts and the names). No screen of this spec is save-only.
import type { Locator, Page } from '@playwright/test';
import { CAMPAIGN_WORKFLOW, DATA_MONTH, EMPTIES_WORKFLOW } from '../epic-7/support/campaign';
import { expect, test } from '../epic-7/support/fixtures';
import { changedFile, campaignReferenceFile } from '../epic-7/support/reference-file';
import {
  alertsPopover,
  bellButton,
  comparisonSection,
  executionPanel,
  expectStatus,
  finishRun,
  openSchedules,
  openWorkflow,
  openTriggerFor,
  openWorkflowItem,
  overlapNote,
  referenceFileRow,
  scheduleDialog,
  scheduleRow,
  simulate,
  submitTrigger,
  uploadReferenceFile,
} from '../epic-7/support/screens';
import { triggerDialog } from '../epic-6/support/screens';
import { signIn } from '../support/screens';
import { THEMES, VIEWPORT_HEIGHT, WIDTHS, inspect } from './support';

/** The texts that vary at each run: dates and hours of the simulated server, relative times, durations and ids. */
function clockAreas(page: Page): Locator[] {
  return [
    page.getByText(/\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/),
    page.getByText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/),
    page.getByText(/\d{2}\/\d{2} às \d{2}:\d{2}/),
    page.getByText(/^há /),
    page.locator('time'),
    page.getByText(/^\d+[hms]( \d+[ms])?$/),
    page.getByText(/^(Execução )?[0-9a-f]{8}$/),
  ];
}

const FILE = 'expected-alterado.csv';

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`épico 7, tema ${theme === 'light' ? 'claro' : 'escuro'}, ${width}px`, () => {
      test.use({ colorScheme: theme, viewport: { width, height: VIEWPORT_HEIGHT } });

      test('Testes, comparação, sobreposição, decisão, agendamentos e o sino não rolam na horizontal e têm contraste', async ({ page, epic7 }) => {
        test.setTimeout(180_000);
        await signIn(page, epic7.account('admin'));

        // Testes: the reference file with one value changed and one line less, and its simulation with the comparison.
        await openWorkflowItem(page, CAMPAIGN_WORKFLOW, 'Testes');
        expect((await uploadReferenceFile(page, FILE, changedFile(campaignReferenceFile('simulated')).text)).status()).toBe(201);
        await simulate(page, FILE);
        const campaign = executionPanel(page, CAMPAIGN_WORKFLOW);
        finishRun(epic7);
        await expectStatus(page, epic7, campaign, 'Com erros');
        await expect(comparisonSection(page)).toContainText('iguais');
        await expect(page.getByRole('table', { name: 'Registros comparados com o arquivo' }).getByRole('row').nth(2)).toBeVisible();
        await inspect(page, 'epic7-comparison', theme, width, { mask: clockAreas(page) });

        await openWorkflowItem(page, CAMPAIGN_WORKFLOW, 'Testes');
        await expect(referenceFileRow(page, FILE)).toContainText('iguais');
        await inspect(page, 'epic7-tests', theme, width, { menu: true, mask: clockAreas(page) });

        // "Executar lote" twice over February: the note of the scope already delivered.
        await openWorkflow(page, CAMPAIGN_WORKFLOW);
        await openTriggerFor(page, DATA_MONTH);
        expect((await submitTrigger(page)).status()).toBe(202);
        finishRun(epic7);
        await expectStatus(page, epic7, campaign, 'Com erros');
        await openWorkflow(page, CAMPAIGN_WORKFLOW);
        await openTriggerFor(page, DATA_MONTH);
        expect((await submitTrigger(page)).status()).toBe(409);
        await expect(overlapNote(page)).toBeVisible();
        await inspect(page, 'epic7-overlap-dialog', theme, width, { mask: clockAreas(page) });
        await triggerDialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
        await expect(triggerDialog(page)).toHaveCount(0);

        // The empties: the panel waits for the decision on the alert of the pre-validation.
        await openWorkflow(page, EMPTIES_WORKFLOW);
        await openTriggerFor(page, DATA_MONTH);
        expect((await submitTrigger(page)).status()).toBe(202);
        const empties = executionPanel(page, EMPTIES_WORKFLOW);
        finishRun(epic7);
        await expectStatus(page, epic7, empties, 'Aguardando decisão');
        await inspect(page, 'epic7-decision', theme, width, { mask: clockAreas(page) });

        // Agendamentos of the campaign: the dialog of a new schedule and the list after it fired.
        await openSchedules(page, CAMPAIGN_WORKFLOW);
        await page.getByRole('button', { name: 'Novo agendamento', exact: true }).first().click();
        const dialog = scheduleDialog(page);
        await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill('Fechamento mensal');
        await dialog.getByRole('textbox', { name: 'Horário', exact: true }).fill('02:00');
        await dialog.getByRole('radiogroup', { name: 'Valor de periodo', exact: true }).getByRole('radio', { name: 'Relativo', exact: true }).check();
        await inspect(page, 'epic7-schedule-dialog', theme, width);
        await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        epic7.scheduler?.fire('Fechamento mensal');
        await page.reload();
        await expect(scheduleRow(page, 'Fechamento mensal')).toContainText('Disparou');
        await inspect(page, 'epic7-schedules', theme, width, { menu: true, mask: clockAreas(page) });

        // The bell open over the content bar of the Início (a screen without dates, so only the times of the alerts are
        // masked: a mask is painted over everything, even behind the popover), with the alerts of the runs above.
        await page.goto('/home');
        await expect(page.getByRole('heading', { level: 1, name: 'Início', exact: true })).toBeVisible();
        await bellButton(page).click();
        await expect(alertsPopover(page).getByRole('listitem').first()).toBeVisible();
        await inspect(page, 'epic7-bell', theme, width, { menu: true, mask: [alertsPopover(page).locator('time')] });
      });
    });
  }
}
