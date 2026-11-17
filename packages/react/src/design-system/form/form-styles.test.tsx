/// <reference types="node" />
// F4 acceptance: all colors and measures of the controls come from the tokens and from estilos.md.
import '@testing-library/jest-dom/vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FluxoRoot, type FluxoTheme } from '../root';
import { Button, Checkbox, TextField } from '.';

const formFolder = dirname(fileURLToPath(import.meta.url));
const designSystemFolder = join(formFolder, '..');
const read = (path: string) => readFileSync(path, 'utf8');

const formStylesheets = readdirSync(formFolder)
  .filter((file) => file.endsWith('.css'))
  .map((file) => ({ file, css: read(join(formFolder, file)) }));

const tokenStylesheets = ['tokens/tokens.css', 'typography/typography.css'].map((file) => read(join(designSystemFolder, file)));

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

// estilos.md §4 (4px grid and spacing 2…56), §3 (12, 13, 14, 16, 20), §7.1 and §7.2 (heights 16, 28, 32 and 40;
// 10px button padding) and §15 (240px, max tooltip width).
const allowedMeasurements = new Set([0, 1, 2, 4, 6, 8, 10, 12, 13, 14, 16, 20, 24, 28, 32, 40, 240]);

describe('CSS dos controles de formulário', () => {
  it('encontra as folhas', () => {
    expect(formStylesheets.map((stylesheet) => stylesheet.file).sort()).toEqual([
      'button.css',
      'checkbox.css',
      'field.css',
      'select.css',
    ]);
  });

  it.each(formStylesheets.map((stylesheet) => [stylesheet.file, stylesheet.css]))('%s: cores só por variáveis --fc-*', (_file, css) => {
    const literals = declarationsOf(css)
      .filter(({ property }) => !property.startsWith('--fc-'))
      // The variable names (--fc-red-700) do not count; only what is left outside them.
      .filter(({ value }) => literalColor.test(value.replace(/--[a-z0-9-]+/gi, '')))
      .map(({ selector, property, value }) => `${selector} { ${property}: ${value} }`);
    expect(literals).toEqual([]);
  });

  it.each(formStylesheets.map((stylesheet) => [stylesheet.file, stylesheet.css]))('%s: medidas da escala do estilos.md', (_file, css) => {
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
      [...tokenStylesheets, ...formStylesheets.map((stylesheet) => stylesheet.css)]
        .flatMap(declarationsOf)
        .map(({ property }) => property)
        .filter((property) => property.startsWith('--fc-')),
    );
    const used = formStylesheets.flatMap((stylesheet) => Array.from(stylesheet.css.matchAll(/var\((--fc-[a-z0-9-]+)/g), (usage) => usage[1]));
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((variable) => variable && !declared.has(variable))).toEqual([]);
  });
});

// Vitest does not process CSS: the stylesheets are applied in jsdom from the files, as in the F3 tests.
const appliedStylesheets = [
  ...tokenStylesheets,
  read(join(designSystemFolder, 'root/root.css')),
  ...formStylesheets.map((stylesheet) => stylesheet.css),
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
    // [variante, tema, fundo, texto]
    ['primary', 'light', '#171717', '#ffffff'],
    ['primary', 'dark', '#ededed', '#0a0a0a'],
    ['secondary', 'light', '#ffffff', '#171717'],
    ['secondary', 'dark', '#0a0a0a', '#ededed'],
    ['danger', 'light', '#e5484d', '#ffffff'],
    ['danger', 'dark', '#e5484d', '#ffffff'],
  ] as const)('botão %s no tema %s', (variant, theme, background, text) => {
    render(inTheme(theme, <Button variant={variant}>Executar lote</Button>));
    const style = getComputedStyle(screen.getByRole('button'));
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.color).toBe(rgb(text));
  });

  it.each([
    ['light', '#f2f2f2', '#8f8f8f'],
    ['dark', '#1a1a1a', '#8f8f8f'],
  ] as const)('botão desabilitado com motivo no tema %s', (theme, background, text) => {
    render(
      inTheme(
        theme,
        <Button variant="primary" disabledReason="Resolva 1 problema para enviar">
          Enviar para revisão
        </Button>,
      ),
    );
    const style = getComputedStyle(screen.getByRole('button'));
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.color).toBe(rgb(text));
  });

  it.each([
    ['light', '#ffffff', '#171717'],
    ['dark', '#0a0a0a', '#ededed'],
  ] as const)('campo de texto no tema %s', (theme, background, text) => {
    render(inTheme(theme, <TextField label="E-mail" />));
    const style = getComputedStyle(screen.getByRole('textbox'));
    expect(style.backgroundColor).toBe(rgb(background));
    expect(style.color).toBe(rgb(text));
  });

  it('o erro do campo usa red-900 (danger-text) em cada tema', () => {
    const { rerender } = render(inTheme('light', <TextField label="E-mail" error="Informe um e-mail válido" />));
    const message = screen.getByText('Informe um e-mail válido').closest('p') as HTMLElement;
    expect(getComputedStyle(message).color).toBe(rgb('#c62a2f'));
    rerender(inTheme('dark', <TextField label="E-mail" error="Informe um e-mail válido" />));
    expect(getComputedStyle(message).color).toBe(rgb('#ff6166'));
  });

  it('o hospedeiro sobrescreve um token dos controles na raiz', () => {
    const override = document.createElement('style');
    override.textContent = '.fc-root { --fc-on-danger: #fafafa; }';
    document.head.appendChild(override);
    try {
      render(inTheme('dark', <Button variant="danger">Excluir conexão</Button>));
      expect(getComputedStyle(screen.getByRole('button')).color).toBe(rgb('#fafafa'));
    } finally {
      override.remove();
    }
  });
});

describe('medidas do estilos.md', () => {
  it.each([
    ['small', '28px', '13px'],
    ['default', '32px', '14px'],
    ['large', '40px', '14px'],
  ] as const)('botão %s: altura %s, texto %s, raio 6px', (size, height, text) => {
    render(inTheme('light', <Button size={size}>Simular</Button>));
    const style = getComputedStyle(screen.getByRole('button'));
    expect(style.height).toBe(height);
    expect(style.fontSize).toBe(text);
    expect(style.fontWeight).toBe('500');
    expect(style.borderRadius).toBe('6px');
  });

  it('botão só ícone é quadrado', () => {
    render(inTheme('light', <Button iconOnly label="Mais ações" icon={<svg aria-hidden="true" />} />));
    const style = getComputedStyle(screen.getByRole('button', { name: 'Mais ações' }));
    expect(style.width).toBe('32px');
    expect(style.height).toBe('32px');
  });

  it('campo: 32px, raio 6px, texto 14px', () => {
    render(inTheme('light', <TextField label="E-mail" />));
    const style = getComputedStyle(screen.getByRole('textbox'));
    expect(style.height).toBe('32px');
    expect(style.borderRadius).toBe('6px');
    expect(style.fontSize).toBe('14px');
  });

  it('caixa de seleção: 16px, raio 4px', () => {
    render(inTheme('light', <Checkbox label="Lembrar este dispositivo" />));
    const style = getComputedStyle(screen.getByRole('checkbox'));
    expect(style.width).toBe('16px');
    expect(style.height).toBe('16px');
    expect(style.borderRadius).toBe('4px');
  });
});
