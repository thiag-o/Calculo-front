// Visual proof support (project `visual`): the three automatic checks, run inside the page, and the simulated fixture.
import type { Page } from '@playwright/test';
import { Epic2Simulation, type InitialAccount } from '../epic-2/support/simulation';
import { CatalogSimulation, type SampleDatabase } from '../epic-3/support/simulation';
import { WorkflowSimulation } from '../epic-4/support/simulation';
import { test as base, type E2EApi } from '../support/fixtures';

/** Minimum text contrast (estilos.md §14): WCAG 2.2 AA, 4.5:1 for text. */
export const MIN_TEXT_CONTRAST = 4.5;

/** The sidebar turns into icons only below this module width (estilos.md §15). */
export const FULL_MENU_WIDTH = 1180;

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const WIDTHS = [1440, 1180, 900] as const;
export const VIEWPORT_HEIGHT = 900;

// --- Check 1: no horizontal scroll bar ---------------------------------------------------------------------------------

/** How many pixels the page is wider than the window (0 = no horizontal scroll bar). */
export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth - root.clientWidth, document.body.scrollWidth - document.body.clientWidth, 0);
  });
}

// --- Check 2: text contrast --------------------------------------------------------------------------------------------

export interface ContrastFailure {
  text: string;
  color: string;
  background: string;
  ratio: number;
  where: string;
}

export interface ContrastReport {
  /** Text below the minimum, in any color but the tertiary one: breaks the check. */
  failures: ContrastFailure[];
  /**
   * Text in the tertiary color (`--fc-text-tertiary`, gray-700, 3.23:1 in the light theme). estilos.md §11 allows it only for
   * information that is not essential, which a machine cannot judge: it is listed (not failed) for the eye of the verifier.
   */
  tertiary: ContrastFailure[];
}

/**
 * Text elements whose computed color has less than `minimum`:1 against the computed background (the translucent layers of
 * the ancestors composed). Skipped: invisible or tiny elements (the screen reader only text), disabled controls (WCAG
 * exempts inactive components) and text over a background image (there is none by design; it cannot be measured).
 */
export function contrastFailures(page: Page, minimum: number): Promise<ContrastReport> {
  return page.evaluate((min) => {
    type Rgba = [number, number, number, number];
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    function parse(value: string): Rgba {
      const modern = value.match(/^color\(srgb ([^)]+)\)$/);
      if (modern?.[1]) {
        const p = modern[1].split(/[ /]+/).filter(Boolean).map(Number);
        return [(p[0] ?? 0) * 255, (p[1] ?? 0) * 255, (p[2] ?? 0) * 255, p[3] ?? 1];
      }
      const legacy = value.match(/^rgba?\(([^)]+)\)$/);
      if (legacy?.[1]) {
        const p = legacy[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
      }
      // Any other format (oklch, lab...): the canvas converts it to sRGB.
      if (!context) return [0, 0, 0, 1];
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const data = context.getImageData(0, 0, 1, 1).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, (data[3] ?? 0) / 255];
    }

    function over(top: Rgba, bottom: Rgba): Rgba {
      const alpha = top[3] + bottom[3] * (1 - top[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      const channel = (i: 0 | 1 | 2) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha;
      return [channel(0), channel(1), channel(2), alpha];
    }

    function luminance([r, g, b]: Rgba): number {
      const linear = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    }

    /** The background under the element, or `null` when it has an image (not measurable). */
    function backgroundOf(element: Element): Rgba | null {
      const layers: Rgba[] = [];
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== 'none') return null;
        const color = parse(style.backgroundColor);
        if (color[3] > 0) {
          layers.push(color);
          if (color[3] >= 1) break;
        }
      }
      // Without an opaque layer, the browser paints the canvas: white in the light theme, the scheme's in the dark one.
      let result: Rgba = getComputedStyle(document.documentElement).colorScheme.includes('dark') ? [0, 0, 0, 1] : [255, 255, 255, 1];
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    }

    function describe(element: Element): string {
      const classes = [...element.classList].slice(0, 2).map((name) => `.${name}`).join('');
      const parent = element.parentElement ? [...element.parentElement.classList].slice(0, 1).map((name) => `.${name}`).join('') : '';
      return `${parent ? `${parent} > ` : ''}${element.tagName.toLowerCase()}${classes}`;
    }

    // The computed color of the tertiary token, by a probe inside the module (where the --fc-* variables are defined).
    const scope = [...document.body.querySelectorAll('*')].find((node) => getComputedStyle(node).getPropertyValue('--fc-text-tertiary').trim());
    const probe = document.createElement('span');
    probe.style.color = 'var(--fc-text-tertiary)';
    (scope ?? document.body).appendChild(probe);
    const tertiaryColor = getComputedStyle(probe).color;
    probe.remove();

    const failures = new Map<string, ContrastFailure>();
    const tertiary = new Map<string, ContrastFailure>();
    const skippedTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'OPTION', 'TITLE', 'HEAD']);
    for (const element of document.body.querySelectorAll('*')) {
      if (skippedTags.has(element.tagName)) continue;
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      if (element.closest('[disabled], [aria-disabled="true"], [inert], [aria-hidden="true"]')) continue;

      const background = backgroundOf(element);
      if (!background) continue;
      const foreground = over(parse(style.color), background);
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      const ratio = (lighter + 0.05) / (darker + 0.05);
      if (ratio >= min) continue;
      const rgb = (c: Rgba) => `rgb(${c.slice(0, 3).map(Math.round).join(', ')})`;
      const key = `${describe(element)}|${rgb(foreground)}|${rgb(background)}`;
      const target = style.color === tertiaryColor ? tertiary : failures;
      if (!target.has(key)) {
        target.set(key, {
          text: text.slice(0, 40),
          color: rgb(foreground),
          background: rgb(background),
          ratio: Math.round(ratio * 100) / 100,
          where: describe(element),
        });
      }
    }
    return { failures: [...failures.values()], tertiary: [...tertiary.values()] };
  }, minimum);
}

// --- Check 3: the menu is icons only below 1180px ----------------------------------------------------------------------

export interface MenuState {
  /** Width of the sidebar (240 with names, 64 with icons only). */
  sidebarWidth: number;
  /** The names of the items that are drawn on screen (the screen reader only text is 1px wide and does not count). */
  visibleLabels: string[];
}

export function menuState(page: Page): Promise<MenuState> {
  return page.evaluate(() => {
    const sidebar = document.querySelector('aside[aria-label="Menu lateral"]');
    const labels = [...document.querySelectorAll('nav[aria-label="Navegação principal"] .fc-sidebar-item-label')];
    return {
      sidebarWidth: Math.round(sidebar?.getBoundingClientRect().width ?? 0),
      visibleLabels: labels.filter((label) => label.getBoundingClientRect().width > 2).map((label) => label.textContent ?? ''),
    };
  });
}

// --- Simulated fixture -------------------------------------------------------------------------------------------------

const SIMULATED_SAMPLE: SampleDatabase = {
  host: '127.0.0.1',
  port: 5434,
  database: 'exemplo',
  readUser: { username: 'exemplo_leitura', password: 'senha-simulada-leitura' },
  writeUser: { username: 'exemplo_escrita', password: 'senha-simulada-escrita' },
};

function accounts(api: E2EApi): InitialAccount[] {
  return [{ ...api.account('admin'), name: 'Administradora Demonstração', roles: { Demonstração: 'Admin' } }];
}

/**
 * The demonstration Admin (every permission) on the three simulations the screens need: session and Admin (epic 2),
 * catalog (epic 3) and workflows with the "Pontuação de exemplo" (epic 4). Always simulated: the captures need stable data.
 */
export const test = base.extend<{ simulations: void }>({
  // Without the entrance animations (the design system turns them off with prefers-reduced-motion): stable captures.
  reducedMotion: 'reduce',
  simulations: [
    // Depends on `api`: these routes are added after the epic 1 one and therefore answer before it.
    async ({ page, api, baseURL }, use) => {
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const session = new Epic2Simulation(accounts(api), shellOrigin);
      const catalog = new CatalogSimulation(SIMULATED_SAMPLE, shellOrigin);
      const workflows = new WorkflowSimulation(shellOrigin);
      // The last one installed answers first; each one hands the routes it does not know to the previous one.
      await session.install(page);
      await catalog.install(page);
      await workflows.install(page);
      await use();
      const unexpected = [...session.unexpected, ...catalog.unexpected, ...workflows.unexpected];
      if (unexpected.length > 0) throw new Error(`O módulo chamou rotas fora da API simulada: ${unexpected.join(', ')}.`);
    },
    { auto: true },
  ],
});

export { expect } from '../support/fixtures';
