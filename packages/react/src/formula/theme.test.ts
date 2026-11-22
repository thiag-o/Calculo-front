import { describe, expect, it } from 'vitest';
import { isDark, themeData, themeName, toHex, type FormulaColors } from './theme';

const LIGHT: FormulaColors = {
  background: '#fafafa',
  text: '#171717',
  textSecondary: '#4d4d4d',
  lineNumber: '#a8a8a8',
  border: '#ebebeb',
  surface: '#ffffff',
  hover: '#f2f2f2',
  focus: '#006bff',
  error: '#e5484d',
  catSource: '#0072f5',
  catCalc: '#c26a00',
  catDecision: '#7c3aed',
};

const DARK: FormulaColors = {
  ...LIGHT,
  background: '#000000',
  text: '#ededed',
  lineNumber: '#878787',
  catSource: '#52a8ff',
  catCalc: '#f1a10d',
  catDecision: '#a68cf2',
};

describe('tema do editor pelos tokens', () => {
  it('funções em cat-source, números em cat-calc e palavras-chave em cat-decision', () => {
    expect(themeData(LIGHT).rules).toEqual(
      expect.arrayContaining([
        { token: 'function', foreground: '0072f5' },
        { token: 'number', foreground: 'c26a00' },
        { token: 'keyword', foreground: '7c3aed' },
      ]),
    );
  });

  it('parâmetro (@nome) no texto primário com peso, sem cor de categoria, nos dois temas', () => {
    expect(themeData(LIGHT).rules).toContainEqual({ token: 'parameter', foreground: '171717', fontStyle: 'bold' });
    expect(themeData(DARK).rules).toContainEqual({ token: 'parameter', foreground: 'ededed', fontStyle: 'bold' });
  });

  it('fundo background-200, números de linha gray-600 e sublinhado red-700', () => {
    const colors = themeData(LIGHT).colors;
    expect(colors['editor.background']).toBe('#fafafa');
    expect(colors['editorLineNumber.foreground']).toBe('#a8a8a8');
    expect(colors['editorError.foreground']).toBe('#e5484d');
  });

  it('o escuro parte da base escura do Monaco, com as cores do tema escuro', () => {
    expect(isDark(DARK)).toBe(true);
    expect(isDark(LIGHT)).toBe(false);
    const dark = themeData(DARK);
    expect(dark.base).toBe('vs-dark');
    expect(dark.rules).toContainEqual({ token: 'function', foreground: '52a8ff' });
    expect(themeName(DARK)).not.toBe(themeName(LIGHT));
    expect(themeName(LIGHT)).toMatch(/^fc-formula-[0-9a-f]+$/);
  });

  it('converte as cores calculadas pelo navegador para hexadecimal', () => {
    expect(toHex('rgb(0, 114, 245)')).toBe('#0072f5');
    expect(toHex('rgba(124, 58, 237, 1)')).toBe('#7c3aed');
    expect(toHex('#FFF')).toBe('#ffffff');
    expect(toHex('var(--fc-cat-source)')).toBeNull();
  });
});
