/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RaizFluxo } from '../raiz';
import { Texto, classesTexto, estilosTexto, type EstiloTexto } from '.';

// O Vitest não processa CSS; as folhas do design-system são aplicadas no jsdom a partir dos arquivos.
const pastaDesignSystem = join(dirname(fileURLToPath(import.meta.url)), '..');
const folhas = ['tokens/tokens.css', 'tipografia/tipografia.css', 'raiz/raiz.css'].map((arquivo) => {
  const estilo = document.createElement('style');
  estilo.textContent = readFileSync(join(pastaDesignSystem, arquivo), 'utf8');
  return estilo;
});

beforeAll(() => folhas.forEach((estilo) => document.head.appendChild(estilo)));
afterAll(() => folhas.forEach((estilo) => estilo.remove()));
afterEach(cleanup);

const geist = 'Geist Variable, Geist, system-ui, sans-serif';
const geistMono = 'Geist Mono Variable, Geist Mono, ui-monospace, monospace';

// estilos.md §3: [tamanho, altura, peso, espaçamento, fonte].
const escala: Record<EstiloTexto, [string, string, string, string, string]> = {
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

/** Compara a pilha de fontes sem depender das aspas que o navegador mantém ou tira. */
function normalizar(valor: string): string {
  return valor.trim().replace(/["']/g, '');
}

describe('escala tipográfica', () => {
  it('cobre todos os estilos do estilos.md', () => {
    expect([...estilosTexto].sort()).toEqual(Object.keys(escala).sort());
  });

  it.each(Object.entries(escala))('%s tem tamanho, altura, peso, espaçamento e fonte do estilos.md', (estilo, esperado) => {
    render(
      <RaizFluxo tema="claro">
        <Texto estilo={estilo as EstiloTexto}>Pontuação por item de NF</Texto>
      </RaizFluxo>,
    );
    const calculado = getComputedStyle(screen.getByText('Pontuação por item de NF'));
    const [tamanho, altura, peso, espacamento, fonte] = esperado;
    expect(calculado.fontSize).toBe(tamanho);
    expect(calculado.lineHeight).toBe(altura);
    expect(calculado.fontWeight).toBe(peso);
    expect(calculado.letterSpacing).toBe(espacamento);
    expect(normalizar(calculado.fontFamily)).toBe(fonte);
  });

  it('o texto padrão da raiz é copy-14 em Geist, com números tabulares', () => {
    render(
      <RaizFluxo tema="claro">
        <p>1.500,00</p>
      </RaizFluxo>,
    );
    const calculado = getComputedStyle(screen.getByText('1.500,00'));
    expect(calculado.fontSize).toBe('14px');
    expect(calculado.lineHeight).toBe('20px');
    expect(normalizar(calculado.fontFamily)).toBe(geist);
    expect(calculado.getPropertyValue('font-variant-numeric')).toBe('tabular-nums');
  });
});

describe('Texto', () => {
  it('renderiza o elemento pedido, com a semântica dele', () => {
    render(
      <RaizFluxo>
        <Texto estilo="heading-32" como="h1">
          Pontuação por item de NF
        </Texto>
      </RaizFluxo>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Pontuação por item de NF' })).toBeDefined();
  });

  it('usa span por padrão e repassa atributos', () => {
    render(
      <RaizFluxo>
        <Texto estilo="mono-13" id="versao" title="Versão em produção">
          v3
        </Texto>
      </RaizFluxo>,
    );
    const versao = screen.getByText('v3');
    expect(versao.tagName).toBe('SPAN');
    expect(versao.id).toBe('versao');
    expect(versao.title).toBe('Versão em produção');
  });

  it.each([
    ['principal', '#171717', '#ededed'],
    ['secundario', '#4d4d4d', '#a1a1a1'],
    ['terciario', '#8f8f8f', '#8f8f8f'],
  ] as const)('tom %s segue o tema', (tom, claro, escuro) => {
    const { rerender } = render(
      <RaizFluxo tema="claro">
        <Texto estilo="label-13" tom={tom}>
          há 2 h
        </Texto>
      </RaizFluxo>,
    );
    const texto = screen.getByText('há 2 h');
    expect(getComputedStyle(texto).color).toBe(hexParaRgb(claro));
    rerender(
      <RaizFluxo tema="escuro">
        <Texto estilo="label-13" tom={tom}>
          há 2 h
        </Texto>
      </RaizFluxo>,
    );
    expect(getComputedStyle(texto).color).toBe(hexParaRgb(escuro));
  });

  it('medio aplica o peso 500', () => {
    render(
      <RaizFluxo>
        <Texto estilo="label-14" medio>
          Execuções
        </Texto>
      </RaizFluxo>,
    );
    expect(getComputedStyle(screen.getByText('Execuções')).fontWeight).toBe('500');
  });

  it('tira a margem padrão de títulos e parágrafos', () => {
    render(
      <RaizFluxo>
        <Texto estilo="heading-16" como="h2">
          Versão em produção
        </Texto>
      </RaizFluxo>,
    );
    expect(getComputedStyle(screen.getByRole('heading', { level: 2 })).marginTop).toBe('0px');
  });
});

describe('classesTexto', () => {
  it('monta as classes fc- para outros elementos', () => {
    expect(classesTexto({ estilo: 'mono-12' })).toBe('fc-mono-12');
    expect(classesTexto({ estilo: 'label-12', tom: 'terciario', medio: true })).toBe(
      'fc-label-12 fc-texto-terciario fc-texto-medio',
    );
  });
});

function hexParaRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
