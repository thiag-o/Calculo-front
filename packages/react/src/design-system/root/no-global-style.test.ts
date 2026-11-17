/// <reference types="node" />
// Embedding without iframe (ADR 0002): no package CSS styles the host app.
// Scans every .css of packages/react/src (what Vite gathers into the package styles.css).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcFolder = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const cssFiles = readdirSync(srcFolder, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.css'))
  .map((path) => join(srcFolder, path));

/** Splits a selector list by the top-level commas (outside parentheses and brackets). */
function selectorsOf(list: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of list) {
    if (character === '(' || character === '[') depth++;
    if (character === ')' || character === ']') depth--;
    if (character === ',' && depth === 0) {
      selectors.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  selectors.push(current.trim());
  return selectors;
}

const globalSelector = /(^|[\s>+~(,])(\*|html|body|:root)(?=$|[\s>+~.:#[,)])/i;

/** Isolation problems of a stylesheet: global selector, selector without the fc- prefix or token outside the root. */
function problemsOf(css: string): string[] {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const rules = Array.from(style.sheet?.cssRules ?? []);
  style.remove();

  const problems: string[] = [];
  const visit = (list: CSSRule[]) => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) {
        for (const selector of selectorsOf(rule.selectorText)) {
          if (globalSelector.test(selector)) problems.push(`seletor global: ${selector}`);
          if (!selector.includes('.fc-')) problems.push(`seletor sem a classe fc-: ${selector}`);
          const declaresToken = Array.from(rule.style).some((property) => property.startsWith('--fc-'));
          if (declaresToken && !selector.includes('.fc-root')) problems.push(`token --fc-* fora da raiz: ${selector}`);
        }
      } else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
        visit(Array.from(rule.cssRules));
      } else if (rule instanceof CSSImportRule) {
        problems.push(`@import não é verificável aqui; importe pelo TypeScript: ${rule.href}`);
      } else if (!(rule instanceof CSSFontFaceRule) && !(rule instanceof CSSKeyframesRule)) {
        problems.push(`regra não verificada: ${rule.cssText.slice(0, 60)}`);
      }
    }
  };
  visit(rules);

  // Second check, on the text (without comments), in case the parser drops some rule.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/:root\b/.test(withoutComments)) problems.push('texto contém :root');
  if (/(^|[}\s,])(html|body)\s*[{,.:#[>~+]/m.test(withoutComments)) problems.push('texto contém html ou body como seletor');
  return problems;
}

describe('CSS do pacote sem estilo global', () => {
  it('encontra as folhas do design-system', () => {
    const names = cssFiles.map((file) => relative(srcFolder, file).replaceAll('\\', '/'));
    expect(names).toEqual(
      expect.arrayContaining(['design-system/tokens/tokens.css', 'design-system/typography/typography.css', 'design-system/root/root.css']),
    );
  });

  it.each(cssFiles.map((file) => [relative(srcFolder, file).replaceAll('\\', '/'), file]))(
    '%s só tem seletores com o prefixo fc- e tokens só na raiz',
    (_name, file) => {
      expect(problemsOf(readFileSync(file, 'utf8'))).toEqual([]);
    },
  );

  it('a verificação recusa seletores globais e tokens fora da raiz', () => {
    expect(problemsOf(':root { --fc-text: red; }')).toContain('seletor global: :root');
    expect(problemsOf('html, body { margin: 0; }')).toEqual(expect.arrayContaining(['seletor global: html', 'seletor global: body']));
    expect(problemsOf('* { box-sizing: border-box; }')).toContain('seletor global: *');
    expect(problemsOf('.fc-root * { margin: 0; }')).toContain('seletor global: .fc-root *');
    expect(problemsOf('button { color: red; }')).toContain('seletor sem a classe fc-: button');
    expect(problemsOf('.fc-button { --fc-primary: red; }')).toContain('token --fc-* fora da raiz: .fc-button');
    expect(problemsOf('@media (min-width: 1px) { body { margin: 0; } }')).toContain('seletor global: body');
    expect(problemsOf('.fc-root { color: red; } .fc-text { margin: 0; }')).toEqual([]);
  });
});
