/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RaizFluxo, type TemaFluxo } from '../raiz';

// O Vitest não processa CSS; as folhas do design-system são aplicadas no jsdom a partir dos arquivos.
const pastaDesignSystem = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cssTokens, ...outrasFolhas] = ['tokens/tokens.css', 'tipografia/tipografia.css', 'raiz/raiz.css'].map(
  (arquivo) => readFileSync(join(pastaDesignSystem, arquivo), 'utf8'),
);
const folhas = [cssTokens!, ...outrasFolhas];

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

// estilos.md §2.5: alias -> token de base.
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

const todasAsVariaveis = [...Object.keys(tokens), ...Object.keys(aliases), '--fc-font-sans', '--fc-font-mono'];

function valor(elemento: Element, variavel: string): string {
  return getComputedStyle(elemento).getPropertyValue(variavel).trim().toLowerCase();
}

function estiloCompleto(elemento: Element): string[] {
  const estilo = getComputedStyle(elemento);
  return Array.from(estilo, (propriedade) => `${propriedade}: ${estilo.getPropertyValue(propriedade)}`);
}

function aplicarFolhas(...conteudos: string[]): HTMLStyleElement[] {
  return conteudos.map((conteudo) => {
    const estilo = document.createElement('style');
    estilo.textContent = conteudo;
    document.head.appendChild(estilo);
    return estilo;
  });
}

function declaracoes(regra: CSSStyleRule): Record<string, string> {
  return Object.fromEntries(Array.from(regra.style, (p) => [p, regra.style.getPropertyValue(p).trim()]));
}

function renderizarComTema(tema: TemaFluxo) {
  render(
    <>
      <p data-testid="fora">fora do módulo</p>
      <RaizFluxo tema={tema}>
        <p data-testid="dentro">dentro do módulo</p>
      </RaizFluxo>
    </>,
  );
  return { dentro: screen.getByTestId('dentro'), fora: screen.getByTestId('fora') };
}

let estilosAplicados: HTMLStyleElement[] = [];

beforeEach(() => {
  estilosAplicados = aplicarFolhas(...folhas);
});

afterEach(() => {
  cleanup();
  estilosAplicados.forEach((estilo) => estilo.remove());
});

describe.each([
  ['claro', 0],
  ['escuro', 1],
] as const)('dentro da raiz, tema %s', (tema, indice) => {
  it('resolve todos os tokens de base com os valores do estilos.md', () => {
    const { dentro } = renderizarComTema(tema);
    for (const [variavel, valores] of Object.entries(tokens)) {
      expect(valor(dentro, variavel), variavel).toBe(valores[indice].toLowerCase());
    }
  });

  it('resolve os aliases semânticos para o token do mesmo tema', () => {
    const { dentro } = renderizarComTema(tema);
    for (const [alias, base] of Object.entries(aliases)) {
      expect(valor(dentro, alias), alias).toBe(tokens[base]![indice].toLowerCase());
    }
  });
});

describe('tema sistema', () => {
  it('não fixa data-theme e, sem preferência escura, usa o claro', () => {
    const { dentro } = renderizarComTema('sistema');
    expect(dentro.closest('.fc-raiz')?.hasAttribute('data-theme')).toBe(false);
    expect(valor(dentro, '--fc-background-100')).toBe('#ffffff');
  });

  it('com prefers-color-scheme escuro, declara os mesmos valores do tema escuro explícito', () => {
    const [folha] = aplicarFolhas(cssTokens!);
    const regras = Array.from(folha!.sheet!.cssRules);
    folha!.remove();

    const escuro = regras.find((r) => r instanceof CSSStyleRule && /data-theme=['"]dark['"]/.test(r.selectorText));
    const midia = regras.find((r) => r instanceof CSSMediaRule);
    expect(escuro).toBeInstanceOf(CSSStyleRule);
    expect(midia).toBeInstanceOf(CSSMediaRule);

    const regraDaMidia = (midia as CSSMediaRule).cssRules[0] as CSSStyleRule;
    expect((midia as CSSMediaRule).conditionText).toContain('prefers-color-scheme: dark');
    expect(regraDaMidia.selectorText).toContain('.fc-raiz:not([data-theme])');
    expect(declaracoes(regraDaMidia)).toEqual(declaracoes(escuro as CSSStyleRule));
  });
});

describe('fora da raiz', () => {
  it('nenhuma variável --fc-* existe fora do módulo, nem no html e no body', () => {
    const { fora } = renderizarComTema('escuro');
    for (const elemento of [fora, document.body, document.documentElement]) {
      for (const variavel of todasAsVariaveis) {
        expect(valor(elemento, variavel), `${variavel} em <${elemento.tagName.toLowerCase()}>`).toBe('');
      }
    }
  });

  it('o estilo do html, do body e dos elementos do hospedeiro não muda', () => {
    estilosAplicados.forEach((estilo) => estilo.remove());
    const sem = renderizarComTema('escuro');
    const estiloSemModulo = [document.documentElement, document.body, sem.fora].map(estiloCompleto);
    cleanup();

    estilosAplicados = aplicarFolhas(...folhas);
    const com = renderizarComTema('escuro');
    const estiloComModulo = [document.documentElement, document.body, com.fora].map(estiloCompleto);

    expect(estiloComModulo).toEqual(estiloSemModulo);
    // Prova de que as folhas estão ativas: dentro da raiz o estilo muda.
    expect(valor(com.dentro, '--fc-text')).toBe('#ededed');
  });
});

describe('sobrescrita pelo hospedeiro', () => {
  it.each(['claro', 'escuro'] as const)('um seletor simples na raiz vence os tokens no tema %s', (tema) => {
    const [folhaHospedeiro] = aplicarFolhas('.fc-raiz { --fc-gray-1000: #123456; }');
    const { dentro } = renderizarComTema(tema);
    expect(valor(dentro, '--fc-gray-1000')).toBe('#123456');
    expect(valor(dentro, '--fc-text')).toBe('#123456');
    folhaHospedeiro!.remove();
  });
});
