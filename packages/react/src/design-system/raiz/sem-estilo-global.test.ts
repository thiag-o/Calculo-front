/// <reference types="node" />
// Incorporação sem iframe (ADR 0002): nenhum CSS do pacote estiliza o hospedeiro.
// Varre todos os .css de packages/react/src (o que o Vite junta no estilos.css do pacote).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pastaSrc = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const arquivosCss = readdirSync(pastaSrc, { recursive: true, encoding: 'utf8' })
  .filter((caminho) => caminho.endsWith('.css'))
  .map((caminho) => join(pastaSrc, caminho));

/** Divide uma lista de seletores pelas vírgulas de nível zero (fora de parênteses e colchetes). */
function seletoresDe(lista: string): string[] {
  const seletores: string[] = [];
  let profundidade = 0;
  let atual = '';
  for (const caractere of lista) {
    if (caractere === '(' || caractere === '[') profundidade++;
    if (caractere === ')' || caractere === ']') profundidade--;
    if (caractere === ',' && profundidade === 0) {
      seletores.push(atual.trim());
      atual = '';
    } else {
      atual += caractere;
    }
  }
  seletores.push(atual.trim());
  return seletores;
}

const seletorGlobal = /(^|[\s>+~(,])(\*|html|body|:root)(?=$|[\s>+~.:#[,)])/i;

/** Problemas de isolamento de uma folha: seletor global, seletor sem prefixo fc- ou token fora da raiz. */
function problemasDa(css: string): string[] {
  const estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.appendChild(estilo);
  const regras = Array.from(estilo.sheet?.cssRules ?? []);
  estilo.remove();

  const problemas: string[] = [];
  const visitar = (lista: CSSRule[]) => {
    for (const regra of lista) {
      if (regra instanceof CSSStyleRule) {
        for (const seletor of seletoresDe(regra.selectorText)) {
          if (seletorGlobal.test(seletor)) problemas.push(`seletor global: ${seletor}`);
          if (!seletor.includes('.fc-')) problemas.push(`seletor sem a classe fc-: ${seletor}`);
          const declaraToken = Array.from(regra.style).some((propriedade) => propriedade.startsWith('--fc-'));
          if (declaraToken && !seletor.includes('.fc-raiz')) problemas.push(`token --fc-* fora da raiz: ${seletor}`);
        }
      } else if (regra instanceof CSSMediaRule || regra instanceof CSSSupportsRule) {
        visitar(Array.from(regra.cssRules));
      } else if (regra instanceof CSSImportRule) {
        problemas.push(`@import não é verificável aqui; importe pelo TypeScript: ${regra.href}`);
      } else if (!(regra instanceof CSSFontFaceRule) && !(regra instanceof CSSKeyframesRule)) {
        problemas.push(`regra não verificada: ${regra.cssText.slice(0, 60)}`);
      }
    }
  };
  visitar(regras);

  // Segunda verificação, pelo texto (sem comentários), caso o parser descarte alguma regra.
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/:root\b/.test(semComentarios)) problemas.push('texto contém :root');
  if (/(^|[}\s,])(html|body)\s*[{,.:#[>~+]/m.test(semComentarios)) problemas.push('texto contém html ou body como seletor');
  return problemas;
}

describe('CSS do pacote sem estilo global', () => {
  it('encontra as folhas do design-system', () => {
    const nomes = arquivosCss.map((arquivo) => relative(pastaSrc, arquivo).replaceAll('\\', '/'));
    expect(nomes).toEqual(
      expect.arrayContaining(['design-system/tokens/tokens.css', 'design-system/tipografia/tipografia.css', 'design-system/raiz/raiz.css']),
    );
  });

  it.each(arquivosCss.map((arquivo) => [relative(pastaSrc, arquivo).replaceAll('\\', '/'), arquivo]))(
    '%s só tem seletores com o prefixo fc- e tokens só na raiz',
    (_nome, arquivo) => {
      expect(problemasDa(readFileSync(arquivo, 'utf8'))).toEqual([]);
    },
  );

  it('a verificação recusa seletores globais e tokens fora da raiz', () => {
    expect(problemasDa(':root { --fc-text: red; }')).toContain('seletor global: :root');
    expect(problemasDa('html, body { margin: 0; }')).toEqual(expect.arrayContaining(['seletor global: html', 'seletor global: body']));
    expect(problemasDa('* { box-sizing: border-box; }')).toContain('seletor global: *');
    expect(problemasDa('.fc-raiz * { margin: 0; }')).toContain('seletor global: .fc-raiz *');
    expect(problemasDa('button { color: red; }')).toContain('seletor sem a classe fc-: button');
    expect(problemasDa('.fc-botao { --fc-primary: red; }')).toContain('token --fc-* fora da raiz: .fc-botao');
    expect(problemasDa('@media (min-width: 1px) { body { margin: 0; } }')).toContain('seletor global: body');
    expect(problemasDa('.fc-raiz { color: red; } .fc-texto { margin: 0; }')).toEqual([]);
  });
});
