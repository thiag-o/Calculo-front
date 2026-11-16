/// <reference types="node" />
// Aceite da F5: cores e medidas dos componentes de exibição vêm dos tokens --fc-* e da escala do estilos.md.
import '@testing-library/jest-dom/vitest';
import '../formulario/jsdom.test.apoio';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Botao } from '../formulario';
import { RaizFluxo, type TemaFluxo } from '../raiz';
import { Aviso, Caixa, Carregando, Dialogo, Dica, Menu, Selo, Status, Tabela, type CorSelo, type CorStatus, type TipoAviso } from '.';

const pastaExibicao = dirname(fileURLToPath(import.meta.url));
const pastaDesignSystem = join(pastaExibicao, '..');
const ler = (caminho: string) => readFileSync(caminho, 'utf8');

const folhasDaExibicao = readdirSync(pastaExibicao)
  .filter((arquivo) => arquivo.endsWith('.css'))
  .map((arquivo) => ({ arquivo, css: ler(join(pastaExibicao, arquivo)) }));

const folhasDeTokens = ['tokens/tokens.css', 'tipografia/tipografia.css'].map((arquivo) =>
  ler(join(pastaDesignSystem, arquivo)),
);

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

// Grade de 4px e espaços do estilos.md §4 (2…56); tipografia §3 (11 do selo, 12, 13, 14, 16, 18 e 20 de altura de
// linha); ponto de 10px (§7.3); controles de 20 e 32px; aviso com 10px 12px (tela "D · Guia de design");
// larguras do menu (160–320), da dica (240) e do diálogo (480) e afastamentos dele (64); pílula 9999px.
const medidasPermitidas = new Set([0, 1, 2, 4, 6, 8, 10, 11, 12, 13, 14, 16, 18, 20, 24, 32, 64, 160, 240, 320, 480, 9999]);

describe('CSS dos componentes de exibição', () => {
  it('encontra as folhas', () => {
    expect(folhasDaExibicao.map((folha) => folha.arquivo).sort()).toEqual([
      'aviso.css',
      'caixa.css',
      'carregando.css',
      'dialogo.css',
      'dica.css',
      'estado-vazio.css',
      'marcadores.css',
      'menu.css',
      'tabela.css',
    ]);
  });

  it.each(folhasDaExibicao.map((folha) => [folha.arquivo, folha.css]))('%s: cores só por variáveis --fc-*', (_arquivo, css) => {
    const literais = declaracoesDe(css)
      .filter(({ propriedade }) => !propriedade.startsWith('--fc-'))
      .filter(({ valor }) => corLiteral.test(valor.replace(/--[a-z0-9-]+/gi, '')))
      .map(({ seletor, propriedade, valor }) => `${seletor} { ${propriedade}: ${valor} }`);
    expect(literais).toEqual([]);
  });

  it.each(folhasDaExibicao.map((folha) => [folha.arquivo, folha.css]))('%s: medidas da escala do estilos.md', (_arquivo, css) => {
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
      [...folhasDeTokens, ...folhasDaExibicao.map((folha) => folha.css)]
        .flatMap(declaracoesDe)
        .map(({ propriedade }) => propriedade)
        .filter((propriedade) => propriedade.startsWith('--fc-')),
    );
    const usadas = folhasDaExibicao.flatMap((folha) => Array.from(folha.css.matchAll(/var\((--fc-[a-z0-9-]+)/g), (uso) => uso[1]));
    expect(usadas.length).toBeGreaterThan(0);
    expect(usadas.filter((variavel) => variavel && !declaradas.has(variavel))).toEqual([]);
  });

  it('não redeclara tokens que já existem (a sombra de menus vem do formulario)', () => {
    const jaExistentes = new Set(
      folhasDeTokens
        .flatMap(declaracoesDe)
        .map(({ propriedade }) => propriedade)
        .filter((propriedade) => propriedade.startsWith('--fc-')),
    );
    const novas = folhasDaExibicao
      .flatMap((folha) => declaracoesDe(folha.css))
      .map(({ propriedade }) => propriedade)
      .filter((propriedade) => propriedade.startsWith('--fc-'));
    expect(novas.filter((variavel) => jaExistentes.has(variavel))).toEqual([]);
    const menu = folhasDaExibicao.find((folha) => folha.arquivo === 'menu.css')?.css ?? '';
    expect(menu).toMatch(/\.fc-menu \{[^}]*box-shadow: var\(--fc-shadow-menu\);/);
  });

  it('respeita prefers-reduced-motion em toda folha com animação', () => {
    const semRespeito = folhasDaExibicao
      .filter((folha) => /animation:\s*fc-|transition:/.test(folha.css))
      .filter((folha) => !/@media \(prefers-reduced-motion: reduce\)/.test(folha.css))
      .map((folha) => folha.arquivo);
    expect(semRespeito).toEqual([]);
  });
});

// O Vitest não processa CSS: as folhas são aplicadas no jsdom a partir dos arquivos, como nos testes da F3 e da F4.
const folhasAplicadas = [
  ...folhasDeTokens,
  ler(join(pastaDesignSystem, 'raiz/raiz.css')),
  ler(join(pastaDesignSystem, 'formulario/botao.css')),
  ...folhasDaExibicao.map((folha) => folha.css),
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
    ['claro', '#ffffff', '#ebebeb'],
    ['escuro', '#0a0a0a', '#2e2e2e'],
  ] as const)('caixa no tema %s: background-100, borda 1px, raio 12px, sem sombra', (tema, fundo, borda) => {
    render(emTema(tema, <Caixa data-testid="caixa">Versão em produção</Caixa>));
    const estilo = getComputedStyle(screen.getByTestId('caixa'));
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.borderTopColor).toBe(rgb(borda));
    expect(estilo.borderTopWidth).toBe('1px');
    expect(estilo.borderRadius).toBe('12px');
    expect(estilo.padding).toBe('16px');
  });

  it.each([
    ['cinza', 'claro', '#c9c9c9'],
    ['cinza', 'escuro', '#454545'],
    ['ambar', 'claro', '#ffb224'],
    ['verde', 'claro', '#45a557'],
    ['vermelho', 'escuro', '#e5484d'],
    ['decisao', 'claro', '#7c3aed'],
    ['multiplo', 'escuro', '#3fc1b0'],
  ] as [CorStatus, TemaFluxo, string][])('ponto %s no tema %s', (cor, tema, hex) => {
    const { container } = render(emTema(tema, <Status cor={cor}>Entregue</Status>));
    const ponto = container.querySelector('.fc-status-ponto') as HTMLElement;
    const estilo = getComputedStyle(ponto);
    expect(estilo.backgroundColor).toBe(rgb(hex));
    expect(estilo.width).toBe('10px');
    expect(estilo.height).toBe('10px');
    expect(estilo.borderRadius).toBe('50%');
  });

  it.each([
    ['cinza', 'claro', '#ebebeb', '#171717'],
    ['azul', 'claro', '#ebf5ff', '#0059d6'],
    ['azul', 'escuro', '#0a1a33', '#52a8ff'],
    ['verde', 'claro', '#eafbea', '#297a3a'],
    ['ambar', 'escuro', '#271a00', '#f1a10d'],
    ['vermelho', 'claro', '#ffebeb', '#c62a2f'],
  ] as [CorSelo, TemaFluxo, string, string][])('selo %s no tema %s', (cor, tema, fundo, texto) => {
    render(emTema(tema, <Selo cor={cor}>Em revisão</Selo>));
    const estilo = getComputedStyle(screen.getByText('Em revisão'));
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.color).toBe(rgb(texto));
  });

  it.each([
    ['erro', 'claro', '#ffebeb', '#c62a2f'],
    ['erro', 'escuro', '#2a1314', '#ff6166'],
    ['atencao', 'claro', '#fff4d6', '#a35200'],
    ['sucesso', 'escuro', '#0f2614', '#62c073'],
  ] as [TipoAviso, TemaFluxo, string, string][])('aviso %s no tema %s: fundo -100 e texto -900', (tipo, tema, fundo, texto) => {
    const { container } = render(emTema(tema, <Aviso tipo={tipo}>Versão publicada</Aviso>));
    const estilo = getComputedStyle(container.querySelector('.fc-aviso') as HTMLElement);
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.color).toBe(rgb(texto));
    expect(estilo.borderRadius).toBe('6px');
    expect(estilo.borderLeftWidth).toMatch(/^0(px)?$/);
  });

  it.each([
    ['claro', '#171717', '#ffffff'],
    ['escuro', '#ededed', '#0a0a0a'],
  ] as const)('dica no tema %s: gray-1000 com texto background-100, 12px, raio 6px', async (tema, fundo, texto) => {
    render(
      emTema(
        tema,
        <Dica conteudo="Abrir editor">
          <button type="button">alvo</button>
        </Dica>,
      ),
    );
    screen.getByRole('button', { name: 'alvo' }).focus();
    await screen.findByRole('tooltip');
    const estilo = getComputedStyle(document.querySelector('.fc-dica') as HTMLElement);
    expect(estilo.backgroundColor).toBe(rgb(fundo));
    expect(estilo.color).toBe(rgb(texto));
    expect(estilo.fontSize).toBe('12px');
    expect(estilo.borderRadius).toBe('6px');
  });

  it.each([
    ['claro', '#ebebeb', true],
    ['escuro', '#2e2e2e', false],
  ] as const)('diálogo no tema %s: raio 12px; sombra de modal só com a borda no escuro', async (tema, borda, comSombra) => {
    render(
      emTema(
        tema,
        <Dialogo titulo="Ajustar valor" abertoInicial>
          <p>conteúdo</p>
        </Dialogo>,
      ),
    );
    const dialogo = await screen.findByRole('dialog');
    expect(getComputedStyle(dialogo).borderRadius).toBe('12px');
    expect(getComputedStyle(dialogo).backgroundColor).toBe(rgb(tema === 'claro' ? '#ffffff' : '#0a0a0a'));
    const sombra = getComputedStyle(dialogo.closest('.fc-raiz') as HTMLElement).getPropertyValue('--fc-shadow-modal');
    expect(sombra).toContain(`0 0 0 1px ${borda}`);
    expect(sombra.includes('40px')).toBe(comSombra);
  });

  it('o hospedeiro sobrescreve os tokens do diálogo na raiz', async () => {
    const sobrescrita = document.createElement('style');
    sobrescrita.textContent = '.fc-raiz { --fc-overlay: rgba(0, 0, 0, 0.5); }';
    document.head.appendChild(sobrescrita);
    try {
      render(
        emTema(
          'escuro',
          <Dialogo titulo="Ajustar valor" abertoInicial>
            <p>conteúdo</p>
          </Dialogo>,
        ),
      );
      await screen.findByRole('dialog');
      const fundo = document.querySelector('.fc-dialogo-fundo') as HTMLElement;
      expect(getComputedStyle(fundo).backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
    } finally {
      sobrescrita.remove();
    }
  });
});

describe('medidas do estilos.md', () => {
  it('selo: 20px, pílula, texto 11px/500', () => {
    render(emTema('claro', <Selo>Rascunho</Selo>));
    const estilo = getComputedStyle(screen.getByText('Rascunho'));
    expect(estilo.height).toBe('20px');
    expect(estilo.borderRadius).toBe('9999px');
    expect(estilo.fontSize).toBe('11px');
    expect(estilo.fontWeight).toBe('500');
    expect(estilo.padding).toBe('0px 6px');
  });

  it('esqueleto: barras de 12px com raio 4px', () => {
    const { container } = render(emTema('claro', <Carregando />));
    const estilo = getComputedStyle(container.querySelector('.fc-esqueleto') as HTMLElement);
    expect(estilo.height).toBe('12px');
    expect(estilo.borderRadius).toBe('4px');
  });

  it('tabela: cabeçalho de 32px em label-12 terciário, dentro de uma caixa de raio 12px', () => {
    const { container } = render(
      emTema(
        'claro',
        <Tabela
          legenda="Execuções"
          colunas={[{ chave: 'id', titulo: 'Execução', celula: (linha: { id: string }) => linha.id }]}
          linhas={[{ id: 'r_1114_002' }]}
          chaveLinha={(linha) => linha.id}
          vazio="—"
        />,
      ),
    );
    const cabecalho = getComputedStyle(screen.getByRole('columnheader', { name: 'Execução' }));
    expect(cabecalho.height).toBe('32px');
    expect(cabecalho.fontSize).toBe('12px');
    expect(cabecalho.color).toBe(rgb('#8f8f8f'));
    expect(getComputedStyle(container.querySelector('.fc-tabela') as HTMLElement).borderRadius).toBe('12px');
  });

  it('menu: raio 12px e itens de 32px com raio 6px', async () => {
    render(
      emTema(
        'claro',
        <Menu aberto gatilho={<Botao>Abrir menu</Botao>} itens={[{ rotulo: 'Baixar CSV', aoSelecionar: () => {} }]} />,
      ),
    );
    const menu = await screen.findByRole('menu');
    expect(getComputedStyle(menu).borderRadius).toBe('12px');
    const item = getComputedStyle(screen.getByRole('menuitem', { name: 'Baixar CSV' }));
    expect(item.minHeight).toBe('32px');
    expect(item.borderRadius).toBe('6px');
  });
});
