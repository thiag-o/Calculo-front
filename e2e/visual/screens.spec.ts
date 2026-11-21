// Visual proof of the screens of epics 1 to 4 (project `visual`, simulated mode): each theme (light and dark) at the
// three widths (1440, 1180 and 900 px) opens the screens, saves a capture of each in __screenshots__/ and checks
// - no horizontal scroll bar;
// - the minimum text contrast of estilos.md on the computed colors;
// - the sidebar: names beside the icons from 1180 px, icons only below it.
// The captures are overwritten on each run (no pixel comparison: the dates and ids vary); they are read by eye against
// estilos.md §12 to §16.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { mainNavigation } from '../epic-2/support/screens';
import { SAMPLE_WORKFLOW } from '../epic-4/support/simulation';
import { signIn } from '../support/screens';
import {
  FULL_MENU_WIDTH,
  MIN_TEXT_CONTRAST,
  THEMES,
  VIEWPORT_HEIGHT,
  WIDTHS,
  contrastFailures,
  expect,
  horizontalOverflow,
  menuState,
  test,
  type Theme,
} from './support';

const SCREENSHOTS = path.join(import.meta.dirname, '__screenshots__');

/** Saves the capture and runs the checks on what is on screen. */
async function inspect(page: Page, name: string, theme: Theme, width: number, options: { menu?: boolean } = {}): Promise<void> {
  const label = `${name} · ${theme} · ${width}px`;
  mkdirSync(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}-${theme}-${width}.png`) });

  expect.soft(await horizontalOverflow(page), `${label}: barra de rolagem horizontal`).toBe(0);
  const contrast = await contrastFailures(page, MIN_TEXT_CONTRAST);
  expect.soft(contrast.failures, `${label}: contraste de texto abaixo de ${MIN_TEXT_CONTRAST}:1`).toEqual([]);
  for (const item of contrast.tertiary) {
    test.info().annotations.push({ type: `terciário · ${label}`, description: `${item.where}: "${item.text}" (${item.ratio}:1)` });
  }
  if (options.menu) {
    const menu = await menuState(page);
    if (width < FULL_MENU_WIDTH) {
      expect.soft(menu.sidebarWidth, `${label}: menu só com ícones (64 px)`).toBeLessThanOrEqual(64);
      expect.soft(menu.visibleLabels, `${label}: nomes do menu visíveis abaixo de ${FULL_MENU_WIDTH}px`).toEqual([]);
    } else {
      expect.soft(menu.sidebarWidth, `${label}: menu com nomes (240 px)`).toBeGreaterThanOrEqual(240);
      expect.soft(menu.visibleLabels.length, `${label}: nomes do menu a partir de ${FULL_MENU_WIDTH}px`).toBeGreaterThan(0);
    }
  }
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`tema ${theme === 'light' ? 'claro' : 'escuro'}, ${width}px`, () => {
      test.use({ colorScheme: theme, viewport: { width, height: VIEWPORT_HEIGHT } });

      test('as telas dos épicos 1 a 4 não rolam na horizontal, têm contraste e o menu certo', async ({ page, api }) => {
        test.setTimeout(120_000);

        // Epic 1: sign-in and Home.
        await page.goto('/sign-in');
        await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
        await inspect(page, 'sign-in', theme, width);
        await signIn(page, api.account('admin'));
        await inspect(page, 'home', theme, width, { menu: true });

        // Epic 2: Administration.
        await mainNavigation(page).getByRole('link', { name: 'Administração', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Administração', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: 'Usuários', exact: true })).toBeVisible();
        await expect(page.getByRole('table', { name: 'Usuários do tenant' })).not.toHaveAttribute('aria-busy', 'true');
        await inspect(page, 'admin', theme, width, { menu: true });

        // Epic 3: Catalog (Connections, Datasets and Files).
        await mainNavigation(page).getByRole('link', { name: 'Catálogo', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Catálogo', exact: true })).toBeVisible();
        for (const tab of ['Conexões', 'Datasets', 'Arquivos']) {
          await page.getByRole('tablist', { name: 'Catálogo' }).getByRole('tab', { name: tab, exact: true }).click();
          await expect(page.getByRole('heading', { level: 2, name: tab, exact: true })).toBeVisible();
          await inspect(page, `catalog-${tab.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}`, theme, width, { menu: true });
        }

        // Epic 4: the list, the Overview and the editor.
        await mainNavigation(page).getByRole('link', { name: 'Workflows', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Workflows', exact: true })).toBeVisible();
        const list = page.getByRole('list', { name: 'Workflows' });
        await expect(list.getByRole('button', { name: SAMPLE_WORKFLOW, exact: true })).toBeVisible();
        await inspect(page, 'workflows', theme, width, { menu: true });

        await list.getByRole('button', { name: SAMPLE_WORKFLOW, exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: SAMPLE_WORKFLOW, exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Rascunho' })).toBeVisible();
        await inspect(page, 'overview', theme, width, { menu: true });

        await page.getByRole('button', { name: 'Abrir editor', exact: true }).click();
        const layers = page.getByRole('tree', { name: 'Camadas' });
        await expect(layers.getByRole('treeitem', { name: 'Entradas' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Canvas', exact: true })).toBeVisible();
        await inspect(page, 'editor-canvas', theme, width);

        // Properties of a Calculation.
        await layers.getByRole('treeitem', { name: /^Pontos , Cálculo/ }).click();
        const properties = page.getByRole('complementary', { name: 'Propriedades' });
        await expect(properties.getByRole('region', { name: 'Cálculo' })).toBeVisible();
        await inspect(page, 'editor-properties', theme, width);

        // The Decision Table grid.
        await layers.getByRole('treeitem', { name: /^Elegibilidade , Tabela de Decisão/ }).click();
        await properties.getByRole('button', { name: 'Abrir tabela', exact: true }).click();
        const gridRegion = page.getByRole('region', { name: 'Tabela de Decisão Elegibilidade' });
        await expect(gridRegion.getByRole('grid', { name: 'Regras de Elegibilidade' })).toBeVisible();
        await inspect(page, 'editor-grid', theme, width);
        await gridRegion.getByRole('button', { name: 'Voltar ao canvas', exact: true }).click();

        // "Calcular", with the result of the example.
        await page.getByRole('tablist', { name: 'Painel inferior' }).getByRole('tab', { name: 'Calcular', exact: true }).click();
        const form = page.getByRole('form', { name: 'Calcular' });
        await expect(form).toBeVisible();
        await form.getByRole('textbox', { name: 'valor_item', exact: true }).fill('1.500,00');
        await form.getByRole('textbox', { name: 'categoria', exact: true }).fill('A');
        await form.getByRole('combobox', { name: 'meta_atingida', exact: true }).click();
        await page.getByRole('option', { name: 'Verdadeiro', exact: true }).click();
        await form.getByRole('button', { name: 'Calcular', exact: true }).click();
        await expect(form.getByRole('status').filter({ hasText: 'Resultado do cálculo: ok' })).toBeVisible();
        await inspect(page, 'editor-calculate', theme, width);
      });
    });
  }
}
