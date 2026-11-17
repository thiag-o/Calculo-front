/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FluxoRoot } from '../root';
import { Text, textClasses, textStyles, type TextStyle } from '.';

// Vitest does not process CSS; the design-system stylesheets are applied in jsdom from the files.
const designSystemFolder = join(dirname(fileURLToPath(import.meta.url)), '..');
const stylesheets = ['tokens/tokens.css', 'typography/typography.css', 'root/root.css'].map((file) => {
  const style = document.createElement('style');
  style.textContent = readFileSync(join(designSystemFolder, file), 'utf8');
  return style;
});

beforeAll(() => stylesheets.forEach((style) => document.head.appendChild(style)));
afterAll(() => stylesheets.forEach((style) => style.remove()));
afterEach(cleanup);

const geist = 'Geist Variable, Geist, system-ui, sans-serif';
const geistMono = 'Geist Mono Variable, Geist Mono, ui-monospace, monospace';

// estilos.md §3: [size, line height, weight, letter spacing, font].
const scale: Record<TextStyle, [string, string, string, string, string]> = {
  'heading-48': ['48px', '56px', '600', '-2.4px', geist],
  'heading-32': ['32px', '40px', '600', '-1.28px', geist],
  'heading-24': ['24px', '32px', '600', '-0.96px', geist],
  'heading-16': ['16px', '24px', '600', '-0.32px', geist],
  'heading-14': ['14px', '20px', '600', '-0.28px', geist],
  'copy-14': ['14px', '20px', '400', 'normal', geist],
  'label-14': ['14px', '20px', '400', 'normal', geist],
  'label-13': ['13px', '16px', '400', 'normal', geist],
  'label-12': ['12px', '16px', '400', 'normal', geist],
  'button-14': ['14px', '20px', '500', 'normal', geist],
  'mono-13': ['13px', '20px', '400', 'normal', geistMono],
  'mono-12': ['12px', '16px', '400', 'normal', geistMono],
};

/** Compares the font stack without depending on the quotes the browser keeps or drops. */
function normalize(value: string): string {
  return value.trim().replace(/["']/g, '');
}

describe('escala tipográfica', () => {
  it('cobre todos os estilos do estilos.md', () => {
    expect([...textStyles].sort()).toEqual(Object.keys(scale).sort());
  });

  it.each(Object.entries(scale))('%s tem tamanho, altura, peso, espaçamento e fonte do estilos.md', (style, expected) => {
    render(
      <FluxoRoot theme="light">
        <Text variant={style as TextStyle}>Pontuação por item de NF</Text>
      </FluxoRoot>,
    );
    const computed = getComputedStyle(screen.getByText('Pontuação por item de NF'));
    const [size, height, weight, spacing, font] = expected;
    expect(computed.fontSize).toBe(size);
    expect(computed.lineHeight).toBe(height);
    expect(computed.fontWeight).toBe(weight);
    expect(computed.letterSpacing).toBe(spacing);
    expect(normalize(computed.fontFamily)).toBe(font);
  });

  it('o texto padrão da raiz é copy-14 em Geist, com números tabulares', () => {
    render(
      <FluxoRoot theme="light">
        <p>1.500,00</p>
      </FluxoRoot>,
    );
    const computed = getComputedStyle(screen.getByText('1.500,00'));
    expect(computed.fontSize).toBe('14px');
    expect(computed.lineHeight).toBe('20px');
    expect(normalize(computed.fontFamily)).toBe(geist);
    expect(computed.getPropertyValue('font-variant-numeric')).toBe('tabular-nums');
  });
});

describe('Texto', () => {
  it('renderiza o elemento pedido, com a semântica dele', () => {
    render(
      <FluxoRoot>
        <Text variant="heading-32" as="h1">
          Pontuação por item de NF
        </Text>
      </FluxoRoot>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Pontuação por item de NF' })).toBeDefined();
  });

  it('usa span por padrão e repassa atributos', () => {
    render(
      <FluxoRoot>
        <Text variant="mono-13" id="version" title="Versão em produção">
          v3
        </Text>
      </FluxoRoot>,
    );
    const version = screen.getByText('v3');
    expect(version.tagName).toBe('SPAN');
    expect(version.id).toBe('version');
    expect(version.title).toBe('Versão em produção');
  });

  it.each([
    ['primary', '#171717', '#ededed'],
    ['secondary', '#4d4d4d', '#a1a1a1'],
    ['tertiary', '#8f8f8f', '#8f8f8f'],
  ] as const)('tom %s segue o tema', (tone, light, dark) => {
    const { rerender } = render(
      <FluxoRoot theme="light">
        <Text variant="label-13" emphasis={tone}>
          há 2 h
        </Text>
      </FluxoRoot>,
    );
    const text = screen.getByText('há 2 h');
    expect(getComputedStyle(text).color).toBe(hexToRgb(light));
    rerender(
      <FluxoRoot theme="dark">
        <Text variant="label-13" emphasis={tone}>
          há 2 h
        </Text>
      </FluxoRoot>,
    );
    expect(getComputedStyle(text).color).toBe(hexToRgb(dark));
  });

  it('medio aplica o peso 500', () => {
    render(
      <FluxoRoot>
        <Text variant="label-14" medium>
          Execuções
        </Text>
      </FluxoRoot>,
    );
    expect(getComputedStyle(screen.getByText('Execuções')).fontWeight).toBe('500');
  });

  it('tira a margem padrão de títulos e parágrafos', () => {
    render(
      <FluxoRoot>
        <Text variant="heading-16" as="h2">
          Versão em produção
        </Text>
      </FluxoRoot>,
    );
    expect(getComputedStyle(screen.getByRole('heading', { level: 2 })).marginTop).toBe('0px');
  });
});

describe('textClasses', () => {
  it('monta as classes fc- para outros elementos', () => {
    expect(textClasses({ variant: 'mono-12' })).toBe('fc-mono-12');
    expect(textClasses({ variant: 'label-12', emphasis: 'tertiary', medium: true })).toBe(
      'fc-label-12 fc-text-tertiary fc-text-medium',
    );
  });
});

function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
