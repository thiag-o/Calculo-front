/// <reference types="node" />
// Aceite da F4: todas as cores e medidas dos controles vêm dos tokens e do estilos.md.
import '@testing-library/jest-dom/vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RaizFluxo, type TemaFluxo } from '../raiz';
import { Botao, CaixaSelecao, CampoTexto } from '.';

const pastaFormulario = dirname(fileURLToPath(import.meta.url));
const pastaDesignSystem = join(pastaFormulario, '..');
const ler = (caminho: string) => readFileSync(caminho, 'utf8');

const folhasDoFormulario = readdirSync(pastaFormulario)
  .filter((arquivo) => arquivo.endsWith('.css'))
  .map((arquivo) => ({ arquivo, css: ler(join(pastaFormulario, arquivo)) }));

const folhasDeTokens = ['tokens/tokens.css', 'tipografia/tipografia.css'].map((arquivo) => ler(join(pastaDesignSystem, arquivo)));

interface Declaracao {
  seletor: string;
  propriedade: string;
  valor: string;
}

/** Declarações de uma folha (inclusive dentro de @media), pelo parser do jsdom. */
function declaracoesDe(css: string): Declaracao[] {
  const estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.appendChild(estilo);
  const declaracoes: Declaracao[] = [];
  const visitar = (regras: CSSRuleList) => {
    for (const regra of Array.from(regras)) {
      if (regra instanceof CSSStyleRule) {
        for (const propriedade of Array.from(regra.style)) {
          declaracoes.push({ seletor: regra.selectorText, propriedade, valor: regra.style.getPropertyValue(propriedade) });
        }
      } else if (regra instanceof CSSMediaRule) {
        visitar(regra.cssRules);
      }
    }
  };
  visitar(estilo.sheet?.cssRules ?? ({ length: 0 } as unknown as CSSRuleList));
  estilo.remove();
  return declaracoes;
}

const corLiteral = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(white|black|red|blue|green|gray|grey|silver)\b/i;

// estilos.md §4 (grade de 4px e espaços 2…56), §3 (12, 13, 14, 16, 20), §7.1 e §7.2 (alturas 16, 28, 32 e 40;
// padding 10px do botão) e §15 (240px, largura máxima da dica).
const medidasPermitidas = new Set([0, 1, 2, 4, 6, 8, 10, 12, 13, 14, 16, 20, 24, 28, 32, 40, 240]);

describe('CSS dos controles de formulário', () => {
  it('encontra as folhas', () => {
    expect(folhasDoFormulario.map((folha) => folha.arquivo).sort()).toEqual([
      'botao.css',
      'caixa-selecao.css',
      'campo.css',
      'selecao.css',
      'tokens-formulario.css',
    ]);
  });

  it.each(folhasDoFormulario.map((folha) => [folha.arquivo, folha.css]))('%s: cores só por variáveis --fc-*', (_arquivo, css) => {
    const literais = declaracoesDe(css)
      .filter(({ propriedade }) => !propriedade.startsWith('--fc-'))
      // O nome das variáveis (--fc-red-700) não conta; só o que sobra fora delas.
      .filter(({ valor }) => corLiteral.test(valor.replace(/--[a-z0-9-]+/gi, '')))
      .map(({ seletor, propriedade, valor }) => `${seletor} { ${propriedade}: ${valor} }`);
    expect(literais).toEqual([]);
  });

  it.each(folhasDoFormulario.map((folha) => [folha.arquivo, folha.css]))('%s: medidas da escala do estilos.md', (_arquivo, css) => {
    const foraDaEscala = declaracoesDe(css)
      .filter(({ propriedade }) => !propriedade.startsWith('--fc-'))
      .flatMap(({ seletor, propriedade, valor }) =>
        Array.from(valor.matchAll(/(-?\d*\.?\d+)px/g))
          .map((medida) => Math.abs(Number(medida[1])))
          .filter((numero) => !medidasPermitidas.has(numero))
          .map((numero) => `${seletor} { ${propriedade}: ${numero}px }`),
      );
    expect(foraDaEscala).toEqual([]);
  });

  it('toda variável --fc-* usada existe nos tokens', () => {
    const declaradas = new Set(
      [...folhasDeTokens, ...folhasDoFormulario.map((folha) => folha.css)]
        .flatMap(declaracoesDe)
        .map(({ propriedade }) => propriedade)
        .filter((propriedade) => propriedade.startsWith('--fc-')),
    );
    const usadas = folhasDoFormulario.flatMap((folha) => Array.from(folha.css.matchAll(/var\((--fc-[a-z0-9-]+)/g), (uso) => uso[1]));
    expect(usadas.length).toBeGreaterThan(0);
    expect(usadas.filter((variavel) => variavel && !declaradas.has(variavel))).toEqual([]);
  });
});

// O Vitest não processa CSS: as folhas são aplicadas no jsdom a partir dos arquivos, como nos testes da F3.
const folhasAplicadas = [
  ...folhasDeTokens,
  ler(join(pastaDesignSystem, 'raiz/raiz.css')),
  ...folhasDoFormulario.map((folha) => folha.css),
].map((css) => {
  const estilo = document.createElement('style');
  estilo.textContent = css;
  return estilo;
});

beforeAll(() => folhasAplicadas.forEach((estilo) => document.head.appendChild(estilo)));
afterAll(() => folhasAplicadas.forEach((estilo) => estilo.remove()));
afterEach(cleanup);

function emTema(tema: TemaFluxo, filho: ReactNode) {
  return <RaizFluxo tema={tema}>{filho}</RaizFluxo>;
}

const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
};

describe('cores resolvidas pelos tokens nos dois temas', () => {
  it.each([
    // [variante, tema, fundo, texto]
    ['principal', 'claro', '#171717', '#ffffff'],
    ['principal', 'escuro', '#ededed', '#0a0a0a'],
    ['secundario', 'claro', '#ffffff', '#171717'],
    ['secundario', 'escuro', '#0a0a0a', '#ededed'],
    ['perigo', 'claro', '#e5484d', '#ffffff'],
    ['perigo', 'escuro', '#e5484d', '#ffffff'],
  ] as const)('botão %s no tema %s', (variante, tema, fundo, texto) => {
    render(emTema(tema, <Botao variante={variante}>Executar lote</Botao>));
    const estilo = getComputedStyle(screen.getByRole('button'));
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.color).toBe(rgb(texto));
  });

  it.each([
    ['claro', '#f2f2f2', '#8f8f8f'],
    ['escuro', '#1a1a1a', '#8f8f8f'],
  ] as const)('botão desabilitado com motivo no tema %s', (tema, fundo, texto) => {
    render(
      emTema(
        tema,
        <Botao variante="principal" motivoDesabilitado="Resolva 1 problema para enviar">
          Enviar para revisão
        </Botao>,
      ),
    );
    const estilo = getComputedStyle(screen.getByRole('button'));
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.color).toBe(rgb(texto));
  });

  it.each([
    ['claro', '#ffffff', '#171717'],
    ['escuro', '#0a0a0a', '#ededed'],
  ] as const)('campo de texto no tema %s', (tema, fundo, texto) => {
    render(emTema(tema, <CampoTexto rotulo="E-mail" />));
    const estilo = getComputedStyle(screen.getByRole('textbox'));
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.color).toBe(rgb(texto));
  });

  it('o erro do campo usa red-900 (danger-text) em cada tema', () => {
    const { rerender } = render(emTema('claro', <CampoTexto rotulo="E-mail" erro="Informe um e-mail válido" />));
    const mensagem = screen.getByText('Informe um e-mail válido').closest('p') as HTMLElement;
    expect(getComputedStyle(mensagem).color).toBe(rgb('#c62a2f'));
    rerender(emTema('escuro', <CampoTexto rotulo="E-mail" erro="Informe um e-mail válido" />));
    expect(getComputedStyle(mensagem).color).toBe(rgb('#ff6166'));
  });

  it('o hospedeiro sobrescreve um token dos controles na raiz', () => {
    const sobrescrita = document.createElement('style');
    sobrescrita.textContent = '.fc-raiz { --fc-on-danger: #fafafa; }';
    document.head.appendChild(sobrescrita);
    try {
      render(emTema('escuro', <Botao variante="perigo">Excluir conexão</Botao>));
      expect(getComputedStyle(screen.getByRole('button')).color).toBe(rgb('#fafafa'));
    } finally {
      sobrescrita.remove();
    }
  });
});

describe('medidas do estilos.md', () => {
  it.each([
    ['pequeno', '28px', '13px'],
    ['padrao', '32px', '14px'],
    ['grande', '40px', '14px'],
  ] as const)('botão %s: altura %s, texto %s, raio 6px', (tamanho, altura, texto) => {
    render(emTema('claro', <Botao tamanho={tamanho}>Simular</Botao>));
    const estilo = getComputedStyle(screen.getByRole('button'));
    expect(estilo.height).toBe(altura);
    expect(estilo.fontSize).toBe(texto);
    expect(estilo.fontWeight).toBe('500');
    expect(estilo.borderRadius).toBe('6px');
  });

  it('botão só ícone é quadrado', () => {
    render(emTema('claro', <Botao soIcone rotulo="Mais ações" icone={<svg aria-hidden="true" />} />));
    const estilo = getComputedStyle(screen.getByRole('button', { name: 'Mais ações' }));
    expect(estilo.width).toBe('32px');
    expect(estilo.height).toBe('32px');
  });

  it('campo: 32px, raio 6px, texto 14px', () => {
    render(emTema('claro', <CampoTexto rotulo="E-mail" />));
    const estilo = getComputedStyle(screen.getByRole('textbox'));
    expect(estilo.height).toBe('32px');
    expect(estilo.borderRadius).toBe('6px');
    expect(estilo.fontSize).toBe('14px');
  });

  it('caixa de seleção: 16px, raio 4px', () => {
    render(emTema('claro', <CaixaSelecao rotulo="Lembrar este dispositivo" />));
    const estilo = getComputedStyle(screen.getByRole('checkbox'));
    expect(estilo.width).toBe('16px');
    expect(estilo.height).toBe('16px');
    expect(estilo.borderRadius).toBe('4px');
  });
});
