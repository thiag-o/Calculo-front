// Monaco theme from the --fc-* tokens (estilos.md §2 and §8). Monaco only accepts hex colours, so the tokens are read from
// the module root where the editor is, and the light or dark values follow the root theme and any override by the host.

/** The tokens the editor uses, as Monaco hex colours. */
export interface FormulaColors {
  background: string;
  text: string;
  textSecondary: string;
  lineNumber: string;
  border: string;
  surface: string;
  hover: string;
  focus: string;
  error: string;
  catSource: string;
  catCalc: string;
  catDecision: string;
}

/** Each colour and its token. The fallback is the light value of tokens.css, for a browser that does not resolve the token. */
const TOKENS: Record<keyof FormulaColors, [token: string, fallback: string]> = {
  background: ['--fc-background-200', '#fafafa'],
  text: ['--fc-text', '#171717'],
  textSecondary: ['--fc-text-secondary', '#4d4d4d'],
  lineNumber: ['--fc-gray-600', '#a8a8a8'],
  border: ['--fc-border', '#ebebeb'],
  surface: ['--fc-background-100', '#ffffff'],
  hover: ['--fc-hover', '#f2f2f2'],
  focus: ['--fc-focus', '#006bff'],
  error: ['--fc-red-700', '#e5484d'],
  catSource: ['--fc-cat-source', '#0072f5'],
  catCalc: ['--fc-cat-calc', '#c26a00'],
  catDecision: ['--fc-cat-decision', '#7c3aed'],
};

/** `rgb(…)`, `rgba(…)` or `#rgb`/`#rrggbb` as `#rrggbb`; anything else is `null`. */
export function toHex(color: string): string | null {
  const value = color.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex) {
    const digits = hex[1]!;
    return digits.length === 3 ? `#${[...digits].map((digit) => digit + digit).join('')}` : `#${digits}`;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
  if (!rgb) return null;
  return `#${rgb
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Reads the tokens inside `host`. Each token goes through a hidden probe's `color`, so the browser resolves `var()` chains
 * and any colour syntax the host used in an override.
 */
export function readColors(host: HTMLElement): FormulaColors {
  const probe = document.createElement('span');
  probe.hidden = true;
  host.appendChild(probe);
  const colors = {} as FormulaColors;
  for (const [key, [token, fallback]] of Object.entries(TOKENS) as [keyof FormulaColors, [string, string]][]) {
    probe.style.color = '';
    probe.style.color = `var(${token})`;
    colors[key] = toHex(getComputedStyle(probe).color) ?? fallback;
  }
  probe.remove();
  return colors;
}

/** Dark when the editor background is dark: Monaco then starts from its dark base. */
export function isDark(colors: FormulaColors): boolean {
  const hex = colors.background.slice(1);
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! < 128;
}

/** Monaco theme data (`IStandaloneThemeData`), without depending on Monaco's types. */
export interface FormulaThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: { token: string; foreground: string }[];
  colors: Record<string, string>;
}

const bare = (hex: string) => hex.slice(1);

/**
 * The theme: functions in `cat-source`, numbers in `cat-calc`, keywords in `cat-decision` (estilos.md §8), the rest in the
 * text colour; `background-200` background, line numbers in `gray-600` and the wavy underline in `red-700`.
 */
export function themeData(colors: FormulaColors): FormulaThemeData {
  return {
    base: isDark(colors) ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: bare(colors.text) },
      { token: 'function', foreground: bare(colors.catSource) },
      { token: 'number', foreground: bare(colors.catCalc) },
      { token: 'keyword', foreground: bare(colors.catDecision) },
      { token: 'variable', foreground: bare(colors.text) },
      { token: 'identifier', foreground: bare(colors.text) },
      { token: 'string', foreground: bare(colors.text) },
      { token: 'operator', foreground: bare(colors.textSecondary) },
      { token: 'delimiter', foreground: bare(colors.textSecondary) },
    ],
    colors: {
      'editor.background': colors.background,
      'editor.foreground': colors.text,
      'editorLineNumber.foreground': colors.lineNumber,
      'editorLineNumber.activeForeground': colors.textSecondary,
      'editorCursor.foreground': colors.text,
      'editor.lineHighlightBackground': colors.background,
      'editor.lineHighlightBorder': colors.background,
      'editorError.foreground': colors.error,
      'focusBorder': colors.focus,
      'editorWidget.background': colors.surface,
      'editorWidget.border': colors.border,
      'editorWidget.foreground': colors.text,
      'editorSuggestWidget.background': colors.surface,
      'editorSuggestWidget.border': colors.border,
      'editorSuggestWidget.foreground': colors.text,
      'editorSuggestWidget.selectedBackground': colors.hover,
      'editorSuggestWidget.selectedForeground': colors.text,
      'editorSuggestWidget.highlightForeground': colors.text,
      'editorHoverWidget.background': colors.surface,
      'editorHoverWidget.border': colors.border,
      'editorHoverWidget.foreground': colors.text,
    },
  };
}

/** One theme name per set of colours: two roots with different themes do not overwrite each other's definition. */
export function themeName(colors: FormulaColors): string {
  return `fc-formula-${Object.values(colors).map(bare).join('')}`;
}
