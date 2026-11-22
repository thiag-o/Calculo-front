/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulaEditor, type FormulaEditorProps } from '.';
import { createFakeMonaco, PARAMETERS, parameterProblem, renderWithProviders, SYMBOLS, type FakeMonaco } from './formula.test-support';
import { LANGUAGE_ID } from './language';
import { loadMonaco } from './loadMonaco';

// The run parameters (`@nome`, E6-18) in the formula editor, with Monaco simulated (formula.test-support) and in the plain
// field of reserve; the real Monaco tokenizes them in realMonaco.test.tsx.
vi.mock('./loadMonaco', () => ({ loadMonaco: vi.fn() }));
const load = vi.mocked(loadMonaco);

/** formula.css as text: jsdom does not lay out, so the rules that keep the plain field's highlight aligned are read here. */
const formulaCss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'formula.css'), 'utf8');

let fake: FakeMonaco;

beforeEach(() => {
  fake = createFakeMonaco();
  load.mockReset();
  load.mockResolvedValue(fake.monaco);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Controlled(props: Partial<FormulaEditorProps> & { initial?: string }) {
  const { initial = '', ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <>
      <FormulaEditor context="calculation" aria-label="Fórmula do Cálculo" symbols={SYMBOLS} parameters={PARAMETERS} {...rest} value={value} onChange={setValue} />
      <span data-testid="valor">{value}</span>
    </>
  );
}

async function editorReady() {
  await waitFor(() => expect(fake.state.editors).toHaveLength(1));
  return fake.editor();
}

/** The declarations of the rule with exactly this selector, in formula.css. */
function cssRule(selector: string): string {
  const start = formulaCss.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return formulaCss.slice(start, formulaCss.indexOf('}', start));
}

const labelOf = (item: Record<string, unknown>) => (item.label as { label: string }).label;

describe('parâmetros de execução (@) no Monaco', () => {
  it('o @ e o ponto abrem o autocomplete por serem caracteres de disparo', async () => {
    renderWithProviders(<Controlled />);
    await editorReady();
    expect(fake.state.completionProviders[0]!.triggerCharacters).toEqual(['@', '.']);
  });

  it('@ abre a lista só com os parâmetros, com o tipo, trocando a partir do @', async () => {
    renderWithProviders(<Controlled initial="valor_item >= @" />);
    await editorReady();
    const items = fake.complete('@');
    expect(items.map(labelOf)).toEqual(['@periodo', '@meta_minima', '@categorias', '@lojas']);
    expect(items.find((item) => labelOf(item) === '@meta_minima')).toMatchObject({
      label: { label: '@meta_minima', detail: ' decimal(2)', description: 'Parâmetro' },
      detail: 'decimal(2) · Parâmetro',
      kind: fake.raw.languages.CompletionItemKind.Value,
      insertText: '@meta_minima',
      filterText: '@meta_minima',
      range: { startLineNumber: 1, startColumn: 15, endLineNumber: 1, endColumn: 16 },
    });
    // The period completes with the dot and opens the autocomplete again, with its parts.
    expect(items.find((item) => labelOf(item) === '@periodo')).toMatchObject({
      insertText: '@periodo.',
      detail: 'período · Parâmetro',
      command: { id: 'editor.action.triggerSuggest' },
    });
  });

  it('@periodo. oferece inicio e fim, trocando só a parte', async () => {
    renderWithProviders(<Controlled initial={'1 +\n  @periodo.'} />);
    await editorReady();
    const items = fake.complete('.');
    expect(items.map(labelOf)).toEqual(['inicio', 'fim']);
    expect(items[0]).toMatchObject({
      insertText: 'inicio',
      detail: 'data · Início do período',
      range: { startLineNumber: 2, startColumn: 12, endLineNumber: 2, endColumn: 12 },
    });
  });

  it('um ponto fora de referência não abre nada, e um nome continua com as variáveis e funções', async () => {
    renderWithProviders(<Controlled initial="valor_item * 1." />);
    const editor = await editorReady();
    expect(fake.complete('.')).toEqual([]);
    act(() => editor.model.type('val'));
    const labels = fake.complete().map(labelOf);
    expect(labels).toContain('valor_item');
    expect(labels).not.toContain('@periodo');
  });

  it('usa os parâmetros mais novos do rascunho', async () => {
    function Changing() {
      const [parameters, setParameters] = useState(PARAMETERS.slice(0, 1));
      return (
        <>
          <FormulaEditor value="@" onChange={() => {}} context="calculation" aria-label="Fórmula" parameters={parameters} />
          <button type="button" onClick={() => setParameters(PARAMETERS)}>
            Mais parâmetros
          </button>
        </>
      );
    }
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Changing />);
    await editorReady();
    expect(fake.complete('@').map(labelOf)).toEqual(['@periodo']);
    await user.click(screen.getByRole('button', { name: 'Mais parâmetros' }));
    expect(fake.complete('@')).toHaveLength(PARAMETERS.length);
  });

  it('só leitura: o @ não abre nada', async () => {
    renderWithProviders(<Controlled initial="@" readOnly />);
    await editorReady();
    expect(fake.complete('@')).toEqual([]);
  });

  it('realça o @nome com o texto primário e peso 500, sem cor de categoria', async () => {
    renderWithProviders(<Controlled />);
    await editorReady();
    const monarch = fake.state.monarch.get(LANGUAGE_ID) as { tokenizer: { root: [RegExp, string][] } };
    const rule = monarch.tokenizer.root.find(([, token]) => token === 'parameter');
    expect(rule?.[0].exec('@periodo.inicio + 1')?.[0]).toBe('@periodo.inicio');
    const [, data] = fake.raw.editor.defineTheme.mock.calls[0]!;
    const rules = (data as { rules: { token: string; foreground: string; fontStyle?: string }[] }).rules;
    const text = rules.find((candidate) => candidate.token === '')!.foreground;
    expect(rules.find((candidate) => candidate.token === 'parameter')).toEqual({ token: 'parameter', foreground: text, fontStyle: 'bold' });
  });

  it('sublinha unknown_parameter, period_without_part e list_outside_in na posição do back', async () => {
    const formula = '"preço" + @categoria + @periodo + @lojas';
    const at = (piece: string) => [...formula.slice(0, formula.indexOf(piece))].length;
    const problems = [
      parameterProblem(
        'unknown_parameter',
        '@categoria não existe entre os parâmetros. Você quis dizer @categorias?',
        at('@categoria'),
        at('@categoria') + 10,
        'categorias',
      ),
      parameterProblem('period_without_part', '@periodo é um período: use @periodo.inicio ou @periodo.fim.', at('@periodo'), at('@periodo') + 8),
      parameterProblem('list_outside_in', '@lojas é uma lista: só entra no em.', at('@lojas'), at('@lojas') + 6),
    ];
    renderWithProviders(<Controlled initial={formula} problems={problems} />);
    const editor = await editorReady();
    // Monaco columns are UTF-16 and start at 1: the "ç" before is a single code unit.
    const marked = (code: string, piece: string) =>
      expect.objectContaining({ code, startLineNumber: 1, startColumn: formula.indexOf(piece) + 1, endColumn: formula.indexOf(piece) + 1 + piece.length });
    expect(fake.markers()).toEqual([
      marked('unknown_parameter', '@categoria'),
      marked('period_without_part', '@periodo'),
      marked('list_outside_in', '@lojas'),
    ]);
    expect(editor.input).toHaveAttribute('aria-invalid', 'true');
    expect(editor.input).toHaveAccessibleDescription(/Você quis dizer @categorias\?.*@periodo é um período.*@lojas é uma lista/);
  });

  it('"Trocar por @categorias" mantém o @, no botão da nota e na correção rápida', async () => {
    const user = userEvent.setup({ delay: null });
    const problem = parameterProblem('unknown_parameter', '@categoria não existe entre os parâmetros.', 13, 23, 'categorias');
    renderWithProviders(<Controlled initial="valor_item * @categoria" problems={[problem]} />);
    const editor = await editorReady();
    const markers = fake.markers();
    const { actions } = fake.state.codeActionProviders[0]!.provideCodeActions(editor.model, markers[0]!, { markers });
    const action = actions[0] as { title: string; edit: { edits: { textEdit: { text: string } }[] } };
    expect(action.title).toBe('Trocar por @categorias');
    expect(action.edit.edits[0]!.textEdit.text).toBe('@categorias');

    await user.click(screen.getByRole('button', { name: 'Trocar por @categorias' }));
    expect(editor.model.getValue()).toBe('valor_item * @categorias');
  });
});

describe('parâmetros de execução (@) no campo simples de reserva', () => {
  beforeEach(() => {
    load.mockRejectedValue(new Error('chunk não carregou'));
  });

  const options = () => screen.getAllByRole('option').map((option) => option.textContent);

  it('@ abre a lista dos parâmetros e Enter escolhe; o período abre em seguida inicio e fim', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Controlled initial="valor_item >= " />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    expect(field).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(field);
    await user.keyboard('{End}@');
    const list = screen.getByRole('listbox', { name: 'Parâmetros' });
    expect(options()).toEqual([
      '@periodoperíodo · Parâmetro',
      '@meta_minimadecimal(2) · Parâmetro',
      '@categoriaslista de texto · Parâmetro',
      '@lojaslista de inteiro · Parâmetro',
    ]);
    expect(field).toHaveAttribute('aria-controls', list.id);
    expect(field).toHaveAttribute('aria-activedescendant', within(list).getAllByRole('option')[0]!.id);

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('valor_item >= @periodo.');
    expect(options()).toEqual(['iniciodata · Início do período', 'fimdata · Fim do período']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('valor')).toHaveTextContent('valor_item >= @periodo.fim');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filtra pelo que se digita, fecha com Esc e escolhe com o clique sem tirar o foco', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Controlled />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    await user.click(field);
    await user.keyboard('@ME');
    expect(options()).toEqual(['@meta_minimadecimal(2) · Parâmetro']);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Backspace}');
    await user.click(screen.getByRole('option', { name: /@meta_minima/ }));
    expect(screen.getByTestId('valor')).toHaveTextContent(/^@meta_minima$/);
    expect(field).toHaveFocus();
  });

  it('realça o @nome e as partes do período, fora dos textos', async () => {
    renderWithProviders(<Controlled initial={'@periodo.inicio + "@x" + @lojas'} />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    const highlight = field.parentElement!.querySelector('.fc-formula-plain-highlight')!;
    expect(highlight).toHaveAttribute('aria-hidden', 'true');
    expect([...highlight.querySelectorAll('.fc-formula-parameter')].map((piece) => piece.textContent)).toEqual(['@periodo.inicio', '@lojas']);
    expect(highlight.textContent).toBe('@periodo.inicio + "@x" + @lojas​');
  });

  it('o realce acompanha a rolagem do campo, nas duas direções', async () => {
    renderWithProviders(<Controlled initial={Array.from({ length: 8 }, (_, line) => `@lojas + ${line}`).join('\n')} />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    const highlight = field.parentElement!.querySelector<HTMLElement>('.fc-formula-plain-highlight')!;
    field.scrollTop = 40;
    field.scrollLeft = 3;
    fireEvent.scroll(field);
    expect([highlight.scrollTop, highlight.scrollLeft]).toEqual([40, 3]);
  });

  it('o realce e o campo reservam o mesmo espaço da barra de rolagem, para as quebras de linha coincidirem', () => {
    // jsdom does not lay out: the rule is read from the stylesheet. With the gutter in only one layer, the textarea that gains a
    // vertical scrollbar after 3 lines wraps narrower than its copy, and the bold @nome moves away from the text.
    const highlight = cssRule('.fc-formula-plain-highlight');
    const field = cssRule('.fc-formula-plain');
    expect(highlight).toContain('scrollbar-gutter: stable;');
    expect(field).toContain('scrollbar-gutter: stable;');
    expect(field).toContain('overflow-x: hidden;');
    expect(highlight).toContain('padding: 6px 12px;');
    expect(field).toContain('padding: 6px 12px;');
  });

  it('em cores forçadas, esconde o realce e mostra o texto do próprio campo', () => {
    const forced = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/.exec(formulaCss)?.[1] ?? '';
    expect(forced).toMatch(/\.fc-formula-plain-highlight \{\s*display: none;/);
    expect(forced).toMatch(/\.fc-formula-plain \{\s*color: CanvasText;/);
  });

  it('uma escolha que o pai recusa não deixa o cursor preso para o próximo texto', async () => {
    const user = userEvent.setup({ delay: null });
    // The parent refuses @meta_minima and accepts the rest.
    function Refusing() {
      const [value, setValue] = useState('abcdefghijklmnop @me');
      return (
        <FormulaEditor
          context="calculation"
          aria-label="Fórmula do Cálculo"
          symbols={SYMBOLS}
          parameters={PARAMETERS}
          value={value}
          onChange={(next) => {
            if (!next.includes('@meta_minima')) setValue(next);
          }}
        />
      );
    }
    renderWithProviders(<Refusing />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    await user.click(field);
    await user.keyboard('{End}');
    await user.click(screen.getByRole('option', { name: /@meta_minima/ }));
    expect(field).toHaveValue('abcdefghijklmnop @me');

    await user.keyboard('{Home}xy');
    expect(field).toHaveValue('xyabcdefghijklmnop @me');
  });

  it('sem parâmetros ou só leitura, não abre a lista', async () => {
    const user = userEvent.setup({ delay: null });
    renderWithProviders(<Controlled parameters={[]} />);
    await user.click(await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' }));
    await user.keyboard('@');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    cleanup();

    renderWithProviders(<Controlled initial="@" readOnly />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    await user.click(field);
    await user.keyboard('{End}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field).not.toHaveAttribute('aria-autocomplete');
  });

  it('a correção de um parâmetro desconhecido mantém o @', async () => {
    const user = userEvent.setup({ delay: null });
    const problem = parameterProblem('unknown_parameter', '@categoria não existe entre os parâmetros.', 13, 23, 'categorias');
    renderWithProviders(<Controlled initial="valor_item * @categoria" problems={[problem]} />);
    const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
    await user.click(screen.getByRole('button', { name: 'Trocar por @categorias' }));
    expect(field).toHaveValue('valor_item * @categorias');
  });
});
