/// <reference types="node" />
// F5 acceptance: colors and measures of the display components come from the --fc-* tokens and the estilos.md scale.
import '@testing-library/jest-dom/vitest';
import '../form/jsdom.test-support';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Button } from '../form';
import { FluxoRoot, type FluxoTheme } from '../root';
import { Notice, Card, Loading, Dialog, Tooltip, Menu, Badge, Status, Table, type BadgeTone, type StatusTone, type NoticeType } from '.';

const displayFolder = dirname(fileURLToPath(import.meta.url));
const designSystemFolder = join(displayFolder, '..');
const read = (path: string) => readFileSync(path, 'utf8');

const displayStylesheets = readdirSync(displayFolder)
  .filter((file) => file.endsWith('.css'))
  .map((file) => ({ file, css: read(join(displayFolder, file)) }));

const tokenStylesheets = ['tokens/tokens.css', 'typography/typography.css'].map((file) =>
  read(join(designSystemFolder, file)),
);

interface Declaration {
  selector: string;
  property: string;
  value: string;
}

/** Declarations of a stylesheet (including inside @media), through the jsdom parser. */
function declarationsOf(css: string): Declaration[] {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const declarations: Declaration[] = [];
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        for (const property of Array.from(rule.style)) {
          declarations.push({ selector: rule.selectorText, property, value: rule.style.getPropertyValue(property) });
        }
      } else if (rule instanceof CSSMediaRule) {
        visit(rule.cssRules);
      }
    }
  };
  visit(style.sheet?.cssRules ?? ({ length: 0 } as unknown as CSSRuleList));
  style.remove();
  return declarations;
}

const literalColor = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(white|black|red|blue|green|gray|grey|silver)\b/i;

// 4px grid and estilos.md §4 spacing (2…56); typography §3 (11 of the badge, 12, 13, 14, 16, 18 and 20 of line
// height); 10px dot (§7.3); 20 and 32px controls; notice with 10px 12px (screen "D · Guia de design");
// widths of the menu (160–320), the tooltip (240) and the dialog (480) and its offsets (64); 9999px pill.
const allowedMeasurements = new Set([0, 1, 2, 4, 6, 8, 10, 11, 12, 13, 14, 16, 18, 20, 24, 32, 64, 160, 240, 320, 480, 9999]);

describe('CSS dos componentes de exibição', () => {
  it('encontra as folhas', () => {
    expect(displayStylesheets.map((stylesheet) => stylesheet.file).sort()).toEqual([
      'card.css',
      'dialog.css',
      'empty-state.css',
      'loading.css',
      'markers.css',
      'menu.css',
      'notice.css',
      'table.css',
      'tooltip.css',
    ]);
  });

  it.each(displayStylesheets.map((stylesheet) => [stylesheet.file, stylesheet.css]))('%s: cores só por variáveis --fc-*', (_file, css) => {
    const literals = declarationsOf(css)
      .filter(({ property }) => !property.startsWith('--fc-'))
      .filter(({ value }) => literalColor.test(value.replace(/--[a-z0-9-]+/gi, '')))
      .map(({ selector, property, value }) => `${selector} { ${property}: ${value} }`);
    expect(literals).toEqual([]);
  });

  it.each(displayStylesheets.map((stylesheet) => [stylesheet.file, stylesheet.css]))('%s: medidas da escala do estilos.md', (_file, css) => {
    const offScale = declarationsOf(css)
      .filter(({ property }) => !property.startsWith('--fc-'))
      .flatMap(({ selector, property, value }) =>
        Array.from(value.matchAll(/(-?\d*\.?\d+)px/g))
          .map((measurement) => Math.abs(Number(measurement[1])))
          .filter((formatNumber) => !allowedMeasurements.has(formatNumber))
          .map((formatNumber) => `${selector} { ${property}: ${formatNumber}px }`),
      );
    expect(offScale).toEqual([]);
  });

  it('toda variável --fc-* usada existe nos tokens', () => {
    const declared = new Set(
      [...tokenStylesheets, ...displayStylesheets.map((stylesheet) => stylesheet.css)]
        .flatMap(declarationsOf)
        .map(({ property }) => property)
        .filter((property) => property.startsWith('--fc-')),
    );
    const used = displayStylesheets.flatMap((stylesheet) => Array.from(stylesheet.css.matchAll(/var\((--fc-[a-z0-9-]+)/g), (usage) => usage[1]));
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((variable) => variable && !declared.has(variable))).toEqual([]);
  });

  it('não redeclara tokens que já existem (a sombra de menus vem do formulario)', () => {
    const alreadyExisting = new Set(
      tokenStylesheets
        .flatMap(declarationsOf)
        .map(({ property }) => property)
        .filter((property) => property.startsWith('--fc-')),
    );
    const newOnes = displayStylesheets
      .flatMap((stylesheet) => declarationsOf(stylesheet.css))
      .map(({ property }) => property)
      .filter((property) => property.startsWith('--fc-'));
    expect(newOnes.filter((variable) => alreadyExisting.has(variable))).toEqual([]);
    const menu = displayStylesheets.find((stylesheet) => stylesheet.file === 'menu.css')?.css ?? '';
    expect(menu).toMatch(/\.fc-menu \{[^}]*box-shadow: var\(--fc-shadow-menu\);/);
  });

  it('respeita prefers-reduced-motion em toda folha com animação', () => {
    const nonCompliant = displayStylesheets
      .filter((stylesheet) => /animation:\s*fc-|transition:/.test(stylesheet.css))
      .filter((stylesheet) => !/@media \(prefers-reduced-motion: reduce\)/.test(stylesheet.css))
      .map((stylesheet) => stylesheet.file);
    expect(nonCompliant).toEqual([]);
  });
});

// Vitest does not process CSS: the stylesheets are applied in jsdom from the files, as in the F3 and F4 tests.
const appliedStylesheets = [
  ...tokenStylesheets,
  read(join(designSystemFolder, 'root/root.css')),
  read(join(designSystemFolder, 'form/button.css')),
  ...displayStylesheets.map((stylesheet) => stylesheet.css),
].map((css) => {
  const style = document.createElement('style');
  style.textContent = css;
  return style;
});

beforeAll(() => appliedStylesheets.forEach((style) => document.head.appendChild(style)));
afterAll(() => appliedStylesheets.forEach((style) => style.remove()));
afterEach(cleanup);

function inTheme(theme: FluxoTheme, child: ReactNode) {
  return <FluxoRoot theme={theme}>{child}</FluxoRoot>;
}

const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

describe('cores resolvidas pelos tokens nos dois temas', () => {
  it.each([
    ['light', '#ffffff', '#ebebeb'],
    ['dark', '#0a0a0a', '#2e2e2e'],
  ] as const)('caixa no tema %s: background-100, borda 1px, raio 12px, sem sombra', (theme, background, border) => {
    render(inTheme(theme, <Card data-testid="card">Versão em produção</Card>));
    const style = getComputedStyle(screen.getByTestId('card'));
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.borderTopColor).toBe(rgb(border));
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderRadius).toBe('12px');
    expect(style.padding).toBe('16px');
  });

  it.each([
    ['gray', 'light', '#c9c9c9'],
    ['gray', 'dark', '#454545'],
    ['amber', 'light', '#ffb224'],
    ['green', 'light', '#45a557'],
    ['red', 'dark', '#e5484d'],
    ['decision', 'light', '#7c3aed'],
    ['multi', 'dark', '#3fc1b0'],
  ] as [StatusTone, FluxoTheme, string][])('ponto %s no tema %s', (color, theme, hex) => {
    const { container } = render(inTheme(theme, <Status tone={color}>Entregue</Status>));
    const dot = container.querySelector('.fc-status-dot') as HTMLElement;
    const style = getComputedStyle(dot);
    expect(style.backgroundColor).toBe(rgb(hex));
    expect(style.width).toBe('10px');
    expect(style.height).toBe('10px');
    expect(style.borderRadius).toBe('50%');
  });

  it.each([
    ['gray', 'light', '#ebebeb', '#171717'],
    ['blue', 'light', '#ebf5ff', '#0059d6'],
    ['blue', 'dark', '#0a1a33', '#52a8ff'],
    ['green', 'light', '#eafbea', '#297a3a'],
    ['amber', 'dark', '#271a00', '#f1a10d'],
    ['red', 'light', '#ffebeb', '#c62a2f'],
  ] as [BadgeTone, FluxoTheme, string, string][])('selo %s no tema %s', (color, theme, background, text) => {
    render(inTheme(theme, <Badge tone={color}>Em revisão</Badge>));
    const style = getComputedStyle(screen.getByText('Em revisão'));
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.color).toBe(rgb(text));
  });

  it.each([
    ['error', 'light', '#ffebeb', '#c62a2f'],
    ['error', 'dark', '#2a1314', '#ff6166'],
    ['warning', 'light', '#fff4d6', '#a35200'],
    ['success', 'dark', '#0f2614', '#62c073'],
  ] as [NoticeType, FluxoTheme, string, string][])('aviso %s no tema %s: fundo -100 e texto -900', (type, theme, background, text) => {
    const { container } = render(inTheme(theme, <Notice type={type}>Versão publicada</Notice>));
    const style = getComputedStyle(container.querySelector('.fc-notice') as HTMLElement);
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.color).toBe(rgb(text));
    expect(style.borderRadius).toBe('6px');
    expect(style.borderLeftWidth).toMatch(/^0(px)?$/);
  });

  it.each([
    ['light', '#171717', '#ffffff'],
    ['dark', '#ededed', '#0a0a0a'],
  ] as const)('dica no tema %s: gray-1000 com texto background-100, 12px, raio 6px', async (theme, background, text) => {
    render(
      inTheme(
        theme,
        <Tooltip content="Abrir editor">
          <button type="button">alvo</button>
        </Tooltip>,
      ),
    );
    screen.getByRole('button', { name: 'alvo' }).focus();
    await screen.findByRole('tooltip');
    const style = getComputedStyle(document.querySelector('.fc-tooltip') as HTMLElement);
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.color).toBe(rgb(text));
    expect(style.fontSize).toBe('12px');
    expect(style.borderRadius).toBe('6px');
  });

  it.each([
    ['light', '#ebebeb', true],
    ['dark', '#2e2e2e', false],
  ] as const)('diálogo no tema %s: raio 12px; sombra de modal só com a borda no escuro', async (theme, border, withShadow) => {
    render(
      inTheme(
        theme,
        <Dialog title="Ajustar valor" initialOpen>
          <p>conteúdo</p>
        </Dialog>,
      ),
    );
    const dialog = await screen.findByRole('dialog');
    expect(getComputedStyle(dialog).borderRadius).toBe('12px');
    expect(getComputedStyle(dialog).backgroundColor).toBe(rgb(theme === 'light' ? '#ffffff' : '#0a0a0a'));
    const shadow = getComputedStyle(dialog.closest('.fc-root') as HTMLElement).getPropertyValue('--fc-shadow-modal');
    expect(shadow).toContain(`0 0 0 1px ${border}`);
    expect(shadow.includes('40px')).toBe(withShadow);
  });

  it('o hospedeiro sobrescreve os tokens do diálogo na raiz', async () => {
    const override = document.createElement('style');
    override.textContent = '.fc-root { --fc-overlay: rgba(0, 0, 0, 0.5); }';
    document.head.appendChild(override);
    try {
      render(
        inTheme(
          'dark',
          <Dialog title="Ajustar valor" initialOpen>
            <p>conteúdo</p>
          </Dialog>,
        ),
      );
      await screen.findByRole('dialog');
      const background = document.querySelector('.fc-dialog-backdrop') as HTMLElement;
      expect(getComputedStyle(background).backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
    } finally {
      override.remove();
    }
  });
});

describe('medidas do estilos.md', () => {
  it('selo: 20px, pílula, texto 11px/500', () => {
    render(inTheme('light', <Badge>Rascunho</Badge>));
    const style = getComputedStyle(screen.getByText('Rascunho'));
    expect(style.height).toBe('20px');
    expect(style.borderRadius).toBe('9999px');
    expect(style.fontSize).toBe('11px');
    expect(style.fontWeight).toBe('500');
    expect(style.padding).toBe('0px 6px');
  });

  it('esqueleto: barras de 12px com raio 4px', () => {
    const { container } = render(inTheme('light', <Loading />));
    const style = getComputedStyle(container.querySelector('.fc-skeleton') as HTMLElement);
    expect(style.height).toBe('12px');
    expect(style.borderRadius).toBe('4px');
  });

  it('tabela: cabeçalho de 32px em label-12 terciário, dentro de uma caixa de raio 12px', () => {
    const { container } = render(
      inTheme(
        'light',
        <Table
          caption="Execuções"
          columns={[{ key: 'id', title: 'Execução', cell: (row: { id: string }) => row.id }]}
          rows={[{ id: 'r_1114_002' }]}
          rowKey={(row) => row.id}
          empty="—"
        />,
      ),
    );
    const header = getComputedStyle(screen.getByRole('columnheader', { name: 'Execução' }));
    expect(header.height).toBe('32px');
    expect(header.fontSize).toBe('12px');
    expect(header.color).toBe(rgb('#8f8f8f'));
    expect(getComputedStyle(container.querySelector('.fc-table') as HTMLElement).borderRadius).toBe('12px');
  });

  it('menu: raio 12px e itens de 32px com raio 6px', async () => {
    render(
      inTheme(
        'light',
        <Menu open trigger={<Button>Abrir menu</Button>} items={[{ label: 'Baixar CSV', onSelect: () => {} }]} />,
      ),
    );
    const menu = await screen.findByRole('menu');
    expect(getComputedStyle(menu).borderRadius).toBe('12px');
    const item = getComputedStyle(screen.getByRole('menuitem', { name: 'Baixar CSV' }));
    expect(item.minHeight).toBe('32px');
    expect(item.borderRadius).toBe('6px');
  });
});
