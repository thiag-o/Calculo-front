/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluxoRoot, type FluxoTheme } from '../root';

// Vitest does not process CSS; the design-system stylesheets are applied in jsdom from the files.
const designSystemFolder = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cssTokens, ...otherStylesheets] = ['tokens/tokens.css', 'typography/typography.css', 'root/root.css'].map(
  (file) => readFileSync(join(designSystemFolder, file), 'utf8'),
);
const stylesheets = [cssTokens!, ...otherStylesheets];

// estilos.md §2.1 a §2.4: [claro, escuro].
const tokens: Record<string, [string, string]> = {
  '--fc-background-100': ['#FFFFFF', '#0A0A0A'],
  '--fc-background-200': ['#FAFAFA', '#000000'],
  '--fc-gray-100': ['#F2F2F2', '#1A1A1A'],
  '--fc-gray-200': ['#EBEBEB', '#1F1F1F'],
  '--fc-gray-300': ['#E6E6E6', '#292929'],
  '--fc-gray-400': ['#EBEBEB', '#2E2E2E'],
  '--fc-gray-500': ['#C9C9C9', '#454545'],
  '--fc-gray-600': ['#A8A8A8', '#878787'],
  '--fc-gray-700': ['#8F8F8F', '#8F8F8F'],
  '--fc-gray-800': ['#7D7D7D', '#7D7D7D'],
  '--fc-gray-900': ['#4D4D4D', '#A1A1A1'],
  '--fc-gray-1000': ['#171717', '#EDEDED'],
  '--fc-blue-100': ['#EBF5FF', '#0A1A33'],
  '--fc-blue-700': ['#006BFF', '#0070F3'],
  '--fc-blue-900': ['#0059D6', '#52A8FF'],
  '--fc-red-100': ['#FFEBEB', '#2A1314'],
  '--fc-red-700': ['#E5484D', '#E5484D'],
  '--fc-red-900': ['#C62A2F', '#FF6166'],
  '--fc-amber-100': ['#FFF4D6', '#271A00'],
  '--fc-amber-700': ['#FFB224', '#FFB224'],
  '--fc-amber-900': ['#A35200', '#F1A10D'],
  '--fc-green-100': ['#EAFBEA', '#0F2614'],
  '--fc-green-700': ['#45A557', '#45A557'],
  '--fc-green-900': ['#297A3A', '#62C073'],
  '--fc-cat-source': ['#0072F5', '#52A8FF'],
  '--fc-cat-multi': ['#0B8A7A', '#3FC1B0'],
  '--fc-cat-calc': ['#C26A00', '#F1A10D'],
  '--fc-cat-decision': ['#7C3AED', '#A68CF2'],
  '--fc-cat-group': ['#D6336C', '#F06292'],
  '--fc-cat-state': ['#5C8A00', '#9BC53D'],
  '--fc-cat-output': ['#666666', '#A1A1A1'],
};

// estilos.md §2.5: alias -> base token.
const aliases: Record<string, string> = {
  '--fc-text': '--fc-gray-1000',
  '--fc-text-secondary': '--fc-gray-900',
  '--fc-text-tertiary': '--fc-gray-700',
  '--fc-border': '--fc-gray-400',
  '--fc-border-hover': '--fc-gray-500',
  '--fc-hover': '--fc-gray-100',
  '--fc-active': '--fc-gray-200',
  '--fc-primary': '--fc-gray-1000',
  '--fc-on-primary': '--fc-background-100',
  '--fc-link': '--fc-blue-900',
  '--fc-focus': '--fc-blue-700',
  '--fc-danger-bg': '--fc-red-100',
  '--fc-danger-text': '--fc-red-900',
};

// estilos.md §4 (4px grid) and layout widths: the same value in both themes.
const layout: Record<string, string> = {
  '--fc-space-2': '2px',
  '--fc-space-4': '4px',
  '--fc-space-6': '6px',
  '--fc-space-8': '8px',
  '--fc-space-12': '12px',
  '--fc-space-16': '16px',
  '--fc-space-20': '20px',
  '--fc-space-24': '24px',
  '--fc-space-32': '32px',
  '--fc-space-48': '48px',
  '--fc-space-56': '56px',
  '--fc-field-width-date': '168px',
  '--fc-field-width-select': '260px',
  '--fc-form-width': '360px',
};

const allVariables = [...Object.keys(tokens), ...Object.keys(aliases), ...Object.keys(layout), '--fc-font-sans', '--fc-font-mono'];

function value(element: Element, variable: string): string {
  return getComputedStyle(element).getPropertyValue(variable).trim().toLowerCase();
}

function fullStyle(element: Element): string[] {
  const style = getComputedStyle(element);
  return Array.from(style, (property) => `${property}: ${style.getPropertyValue(property)}`);
}

function applyStylesheets(...contents: string[]): HTMLStyleElement[] {
  return contents.map((content) => {
    const style = document.createElement('style');
    style.textContent = content;
    document.head.appendChild(style);
    return style;
  });
}

function declarations(rule: CSSStyleRule): Record<string, string> {
  return Object.fromEntries(Array.from(rule.style, (p) => [p, rule.style.getPropertyValue(p).trim()]));
}

function renderWithTheme(theme: FluxoTheme) {
  render(
    <>
      <p data-testid="outside">fora do módulo</p>
      <FluxoRoot theme={theme}>
        <p data-testid="inside">dentro do módulo</p>
      </FluxoRoot>
    </>,
  );
  return { inside: screen.getByTestId('inside'), outside: screen.getByTestId('outside') };
}

let appliedStyles: HTMLStyleElement[] = [];

beforeEach(() => {
  appliedStyles = applyStylesheets(...stylesheets);
});

afterEach(() => {
  cleanup();
  appliedStyles.forEach((style) => style.remove());
});

describe.each([
  ['light', 0],
  ['dark', 1],
] as const)('dentro da raiz, tema %s', (theme, index) => {
  it('resolve todos os tokens de base com os valores do estilos.md', () => {
    const { inside } = renderWithTheme(theme);
    for (const [variable, values] of Object.entries(tokens)) {
      expect(value(inside, variable), variable).toBe(values[index].toLowerCase());
    }
  });

  it('resolve os espaços da grade de 4px e as larguras de layout', () => {
    const { inside } = renderWithTheme(theme);
    for (const [variable, expected] of Object.entries(layout)) {
      expect(value(inside, variable), variable).toBe(expected);
    }
  });

  it('resolve os aliases semânticos para o token do mesmo tema', () => {
    const { inside } = renderWithTheme(theme);
    for (const [alias, base] of Object.entries(aliases)) {
      expect(value(inside, alias), alias).toBe(tokens[base]![index].toLowerCase());
    }
  });
});

describe('tema sistema', () => {
  it('não fixa data-theme e, sem preferência escura, usa o claro', () => {
    const { inside } = renderWithTheme('system');
    expect(inside.closest('.fc-root')?.hasAttribute('data-theme')).toBe(false);
    expect(value(inside, '--fc-background-100')).toBe('#ffffff');
  });

  it('com prefers-color-scheme escuro, declara os mesmos valores do tema escuro explícito', () => {
    const [stylesheet] = applyStylesheets(cssTokens!);
    const rules = Array.from(stylesheet!.sheet!.cssRules);
    stylesheet!.remove();

    const dark = rules.find((r) => r instanceof CSSStyleRule && /data-theme=['"]dark['"]/.test(r.selectorText));
    const media = rules.find((r) => r instanceof CSSMediaRule);
    expect(dark).toBeInstanceOf(CSSStyleRule);
    expect(media).toBeInstanceOf(CSSMediaRule);

    const mediaRule = (media as CSSMediaRule).cssRules[0] as CSSStyleRule;
    expect((media as CSSMediaRule).conditionText).toContain('prefers-color-scheme: dark');
    expect(mediaRule.selectorText).toContain('.fc-root:not([data-theme])');
    expect(declarations(mediaRule)).toEqual(declarations(dark as CSSStyleRule));
  });
});

describe('fora da raiz', () => {
  it('nenhuma variável --fc-* existe fora do módulo, nem no html e no body', () => {
    const { outside } = renderWithTheme('dark');
    for (const element of [outside, document.body, document.documentElement]) {
      for (const variable of allVariables) {
        expect(value(element, variable), `${variable} em <${element.tagName.toLowerCase()}>`).toBe('');
      }
    }
  });

  it('o estilo do html, do body e dos elementos do hospedeiro não muda', () => {
    appliedStyles.forEach((style) => style.remove());
    const withoutTheme = renderWithTheme('dark');
    const styleWithoutModule = [document.documentElement, document.body, withoutTheme.outside].map(fullStyle);
    cleanup();

    appliedStyles = applyStylesheets(...stylesheets);
    const withTheme = renderWithTheme('dark');
    const styleWithModule = [document.documentElement, document.body, withTheme.outside].map(fullStyle);

    expect(styleWithModule).toEqual(styleWithoutModule);
    // Proof that the stylesheets are active: inside the root the style changes.
    expect(value(withTheme.inside, '--fc-text')).toBe('#ededed');
  });
});

describe('sobrescrita pelo hospedeiro', () => {
  it.each(['light', 'dark'] as const)('um seletor simples na raiz vence os tokens no tema %s', (theme) => {
    const [hostAppStylesheet] = applyStylesheets('.fc-root { --fc-gray-1000: #123456; }');
    const { inside } = renderWithTheme(theme);
    expect(value(inside, '--fc-gray-1000')).toBe('#123456');
    expect(value(inside, '--fc-text')).toBe('#123456');
    hostAppStylesheet!.remove();
  });
});
