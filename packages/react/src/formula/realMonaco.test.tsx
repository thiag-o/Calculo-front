import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FormulaEditor } from '.';
import { LANGUAGE, renderWithProviders, SYMBOLS, unknownVariable } from './formula.test-support';
import { LANGUAGE_ID, MARKER_OWNER } from './language';
import { loadMonaco, type Monaco } from './loadMonaco';

// The real Monaco (the `monaco` chunk of the package), in jsdom. Loading it takes seconds, hence the longer limits.
// jsdom lacks matchMedia (Monaco asks it for the high-contrast and colour scheme preferences), ResizeObserver (automaticLayout)
// and a canvas (Monaco only draws the minimap and the overview ruler there, both turned off in the formula field).
const LOAD_TIMEOUT = 120_000;

let monaco: Monaco;
const originalMatchMedia = window.matchMedia;
const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(async () => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  // Without a canvas, jsdom logs "Not implemented" for each getContext; Monaco works without it.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  monaco = await loadMonaco();
}, LOAD_TIMEOUT);

afterEach(() => cleanup());

afterAll(() => {
  window.matchMedia = originalMatchMedia;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

function Field({ initial, problems = [] }: { initial: string; problems?: Parameters<typeof FormulaEditor>[0]['problems'] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <FormulaEditor value={value} onChange={setValue} problems={problems} symbols={SYMBOLS} context="calculation" aria-label="Fórmula do Cálculo" />
      <button type="button">Depois do editor</button>
      <span data-testid="valor">{value}</span>
    </>
  );
}

/** The token classes of a one-line text, as `[text, class]`, without the spaces. */
function tokens(text: string): [string, string][] {
  const [line] = monaco.editor.tokenize(text, LANGUAGE_ID);
  return line!
    .map((token, index) => [text.slice(token.offset, line![index + 1]?.offset ?? text.length), token.type.replace(`.${LANGUAGE_ID}`, '')] as [string, string])
    .filter(([piece]) => piece.trim() !== '');
}

describe('FormulaEditor com o Monaco de verdade', () => {
  it(
    'carrega o Monaco, cria o editor no campo e registra a linguagem',
    async () => {
      renderWithProviders(<Field initial="valor_item * 2" />);
      const input = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' }, { timeout: 30_000 });
      expect(input.closest('.monaco-editor')).not.toBeNull();
      expect(monaco.languages.getLanguages().map((language) => language.id)).toContain(LANGUAGE_ID);
      expect(monaco.editor.getModels().map((model) => model.getValue())).toContain('valor_item * 2');
      },
    LOAD_TIMEOUT,
  );

  it('realça cada classe de símbolo: funções (com e sem acento), números, palavras-chave, textos e variáveis', async () => {
    renderWithProviders(<Field initial="" />);
    await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' }, { timeout: 30_000 });
    expect(tokens('MÍN(valor_item, 1000.50) e min(soma(valor_compra[]), 2)')).toEqual([
      ['MÍN', 'function'],
      ['(', 'delimiter.parenthesis'],
      ['valor_item', 'variable'],
      [',', 'delimiter'],
      ['1000.50', 'number'],
      [')', 'delimiter.parenthesis'],
      ['e', 'keyword'],
      ['min', 'function'],
      ['(', 'delimiter.parenthesis'],
      ['soma', 'function'],
      ['(', 'delimiter.parenthesis'],
      ['valor_compra[]', 'variable'],
      [')', 'delimiter.parenthesis'],
      [',', 'delimiter'],
      ['2', 'number'],
      [')', 'delimiter.parenthesis'],
    ]);
    expect(tokens('VERDADEIRO e "diz ""oi"""')).toEqual([
      ['VERDADEIRO', 'keyword'],
      ['e', 'keyword'],
      ['"', 'string.quote'],
      ['diz ', 'string'],
      ['""', 'string.escape'],
      ['oi', 'string'],
      ['""', 'string.escape'],
      ['"', 'string.quote'],
    ]);
    // A name that is not a function, before "(", stays a variable (the API answers unknown_function).
    expect(tokens('MEDIA(x) + desconhecida(x)')).toEqual(
      expect.arrayContaining([
        ['MEDIA', 'function'],
        ['desconhecida', 'variable'],
      ]),
    );
    // The tokenizer reads the functions and the reserved words of the API.
    expect(LANGUAGE.keywords).toContain('e');
  }, LOAD_TIMEOUT);

  it('realça o @nome e a parte do período como parâmetro, e não dentro de texto', async () => {
    renderWithProviders(<Field initial="" />);
    await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' }, { timeout: 30_000 });
    expect(tokens('data >= @periodo.inicio e loja em @lojas')).toEqual([
      ['data', 'variable'],
      ['>=', 'operator'],
      ['@periodo.inicio', 'parameter'],
      ['e', 'keyword'],
      ['loja', 'variable'],
      ['em', 'keyword'],
      ['@lojas', 'parameter'],
    ]);
    // A name glued to the `@` is not a reference, as in the autocomplete and the plain field.
    expect(tokens('email@lojas')).toEqual([['email@lojas', 'variable']]);
    expect(tokens('"@x"')).toEqual([
      ['"', 'string.quote'],
      ['@x', 'string'],
      ['"', 'string.quote'],
    ]);
  }, LOAD_TIMEOUT);

  it('marca o problema na posição certa com acento antes do trecho', async () => {
    const text = '"preço" + valor_iten';
    const start = [...'"preço" + '].length;
    renderWithProviders(<Field initial={text} problems={[unknownVariable('valor_iten', start)]} />);
    await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' }, { timeout: 30_000 });
    const model = await waitFor(() => monaco.editor.getModels().find((candidate) => candidate.getValue() === text)!);
    const markers = monaco.editor.getModelMarkers({ owner: MARKER_OWNER, resource: model.uri });
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ startLineNumber: 1, startColumn: 11, endColumn: 21, severity: monaco.MarkerSeverity.Error });
    expect(model.getValueInRange(markers[0]!)).toBe('valor_iten');
  }, LOAD_TIMEOUT);

  it('Tab sai do editor sem escrever tabulação', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Field initial="valor_item" />);
    const input = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' }, { timeout: 30_000 });
    await user.click(input);
    expect(input).toHaveFocus();

    // Monaco receives the Tab key (with keyCode, as the browser sends it) and leaves it to the browser: it does not prevent the
    // default (moving the focus) nor writes anything. Without the Tab focus mode, it would indent and prevent the default.
    const tab = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true, cancelable: true });
    act(() => {
      input.dispatchEvent(tab);
    });
    expect(tab.defaultPrevented).toBe(false);
    expect(monaco.editor.getEditors()[0]!.getValue()).toBe('valor_item');

    // The browser default: the focus goes to the next control.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Depois do editor' })).toHaveFocus();
    expect(screen.getByTestId('valor')).toHaveTextContent(/^valor_item$/);
  }, LOAD_TIMEOUT);
});
