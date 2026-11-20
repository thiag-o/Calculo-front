import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulaEditor, type FormulaEditorProps } from '.';
import {
  createFakeMonaco,
  json,
  LANGUAGE,
  renderWithProviders,
  simulateLanguageRoute,
  SYMBOLS,
  unknownVariable,
  type FakeMonaco,
} from './formula.test-support';
import { LANGUAGE_ID, MARKER_OWNER } from './language';
import { FORMULA_LANGUAGE_KEY, type WorkflowProblem } from './queries';
import { loadMonaco, type Monaco } from './loadMonaco';

// Monaco simulated (formula.test-support): the real one is loaded in realMonaco.test.tsx.
vi.mock('./loadMonaco', () => ({ loadMonaco: vi.fn() }));
const load = vi.mocked(loadMonaco);

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

/** The editor controlled by a state, like the properties panel will use it; `changes` receives every onChange. */
function Controlled(props: Partial<FormulaEditorProps> & { initial?: string; changes?: (value: string) => void }) {
  const { initial = '', changes, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <>
      <FormulaEditor
        context="calculation"
        aria-label="Fórmula do Cálculo"
        symbols={SYMBOLS}
        {...rest}
        value={value}
        onChange={(next) => {
          changes?.(next);
          setValue(next);
        }}
      />
      <span data-testid="valor">{value}</span>
    </>
  );
}

async function editorReady() {
  await waitFor(() => expect(fake.state.editors).toHaveLength(1));
  return fake.editor();
}

describe('FormulaEditor com o Monaco simulado', () => {
  describe('carregamento sob demanda', () => {
    it('o Monaco só é pedido quando o campo aparece', async () => {
      expect(load).not.toHaveBeenCalled();
      renderWithProviders(<Controlled />);
      expect(load).toHaveBeenCalledTimes(1);
      await editorReady();
    });

    it('mostra o esqueleto do campo enquanto o Monaco carrega', async () => {
      let resolve: (monaco: Monaco) => void = () => {};
      load.mockReturnValue(new Promise((done) => (resolve = done)));
      renderWithProviders(<Controlled />);
      expect(screen.getByRole('status')).toHaveTextContent('Carregando o editor de fórmula');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      await act(async () => resolve(fake.monaco));
      await editorReady();
      expect(screen.queryByText('Carregando o editor de fórmula')).not.toBeInTheDocument();
    });

    it('mostra o esqueleto enquanto a linguagem não chega, e pede GET /v1/formula-language uma vez', async () => {
      let answer: () => void = () => {};
      const arrived = new Promise<void>((done) => (answer = done));
      const fetch = simulateLanguageRoute(() => json(LANGUAGE));
      fetch.mockImplementationOnce(async () => {
        await arrived;
        return json(LANGUAGE);
      });
      renderWithProviders(<Controlled />, { language: null });
      expect(screen.getByRole('status')).toHaveTextContent('Carregando o editor de fórmula');
      await act(async () => answer());
      await editorReady();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/v1/formula-language');
    });
  });

  describe('falha ao carregar', () => {
    it('sem o Monaco, vira um campo de texto simples com o aviso', async () => {
      load.mockRejectedValue(new Error('chunk não carregou'));
      const changes = vi.fn();
      renderWithProviders(<Controlled initial="valor_item * 2" changes={changes} />);
      const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
      expect(field).toHaveValue('valor_item * 2');
      expect(screen.getByRole('status')).toHaveTextContent(
        'O editor de fórmula não carregou. Edite a fórmula neste campo de texto; os problemas aparecem embaixo.',
      );
      fireEvent.change(field, { target: { value: 'valor_item * 3' } });
      expect(changes).toHaveBeenLastCalledWith('valor_item * 3');
      expect(fake.state.editors).toHaveLength(0);
    });

    it('se a linguagem já carregada falha ao recarregar, o editor continua', async () => {
      const fetch = simulateLanguageRoute(() => new Response('falhou', { status: 500 }));
      const { queryClient } = renderWithProviders(<Controlled initial="valor_item" />);
      const editor = await editorReady();
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: FORMULA_LANGUAGE_KEY });
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryState(FORMULA_LANGUAGE_KEY)?.status).toBe('error');
      expect(editor.disposed).toBe(false);
      expect(screen.getByRole('textbox', { name: 'Fórmula do Cálculo' })).toBe(editor.input);
      expect(screen.queryByText(/O editor de fórmula não carregou/)).not.toBeInTheDocument();
    });

    it('sem a linguagem, também vira o campo simples', async () => {
      simulateLanguageRoute(() => new Response('falhou', { status: 500 }));
      renderWithProviders(<Controlled initial="1 + 1" />, { language: null });
      expect(await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' })).toHaveValue('1 + 1');
    });

    it('no campo simples, os problemas aparecem embaixo e a correção troca o nome', async () => {
      load.mockRejectedValue(new Error('chunk não carregou'));
      const user = userEvent.setup({ delay: null });
      const text = '"preço" + valor_iten';
      const start = [...'"preço" + '].length;
      renderWithProviders(<Controlled initial={text} problems={[unknownVariable('valor_iten', start)]} />);
      const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
      expect(field).toHaveAccessibleDescription(/valor_iten não existe neste ponto do fluxo. Você quis dizer valor_item\?/);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      await user.click(screen.getByRole('button', { name: 'Trocar por valor_item' }));
      expect(field).toHaveValue('"preço" + valor_item');
      expect(field).toHaveFocus();
    });

    it('no campo simples, depois de mudar o texto, não oferece a correção dos problemas antigos', async () => {
      load.mockRejectedValue(new Error('chunk não carregou'));
      const text = 'valor_iten + 1';
      renderWithProviders(<Controlled initial={text} problems={[unknownVariable('valor_iten', 0)]} />);
      const field = await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' });
      expect(screen.getByRole('button', { name: 'Trocar por valor_item' })).toBeInTheDocument();
      fireEvent.change(field, { target: { value: `xx${text}` } });
      expect(screen.queryByRole('button', { name: /Trocar por/ })).not.toBeInTheDocument();
      // The message stays in the note until the next analysis.
      expect(screen.getByText(/valor_iten não existe neste ponto do fluxo/)).toBeInTheDocument();
      expect(field).toHaveValue(`xx${text}`);
    });

    it('só leitura: o campo simples não muda e não oferece a correção', async () => {
      load.mockRejectedValue(new Error('chunk não carregou'));
      renderWithProviders(<Controlled initial="valor_iten" readOnly problems={[unknownVariable('valor_iten', 0)]} />);
      expect(await screen.findByRole('textbox', { name: 'Fórmula do Cálculo' })).toHaveAttribute('readonly');
      expect(screen.queryByRole('button', { name: /Trocar por/ })).not.toBeInTheDocument();
    });
  });

  describe('editor', () => {
    it('cria o Monaco com a linguagem fluxo-formula, mono-13, o rótulo e o Tab saindo do editor', async () => {
      renderWithProviders(<Controlled initial="valor_item * 2" />);
      const editor = await editorReady();
      expect(editor.model.getValue()).toBe('valor_item * 2');
      expect(fake.raw.editor.createModel).toHaveBeenCalledWith('valor_item * 2', LANGUAGE_ID);
      expect(editor.options).toMatchObject({
        ariaLabel: 'Fórmula do Cálculo',
        tabFocusMode: true,
        readOnly: false,
        fontSize: 13,
        lineHeight: 20,
        lineNumbers: 'on',
        minimap: { enabled: false },
        wordBasedSuggestions: 'off',
        fixedOverflowWidgets: true,
      });
      expect(screen.getByRole('textbox', { name: 'Fórmula do Cálculo' })).toBe(editor.input);
    });

    it('os widgets do Monaco ficam dentro da raiz do módulo', async () => {
      renderWithProviders(<Controlled />);
      const editor = await editorReady();
      const widgets = editor.options.overflowWidgetsDomNode as HTMLElement;
      expect(widgets).toHaveClass('monaco-editor', 'fc-formula-widgets');
      expect(widgets.closest('.fc-root')).not.toBeNull();
    });

    it('registra a linguagem uma vez, com as funções e os sinônimos sem acento no realce', async () => {
      renderWithProviders(
        <>
          <Controlled />
          <Controlled />
        </>,
      );
      await waitFor(() => expect(fake.state.editors).toHaveLength(2));
      expect(fake.raw.languages.register).toHaveBeenCalledTimes(1);
      expect(fake.raw.languages.register).toHaveBeenCalledWith({ id: LANGUAGE_ID });
      expect(fake.raw.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
      const monarch = fake.state.monarch.get(LANGUAGE_ID) as { functions: string[]; keywords: string[]; ignoreCase: boolean };
      expect(monarch.functions).toEqual(['ARRED', 'MÍN', 'MIN', 'SOMA', 'MÉDIA', 'MEDIA', 'EXISTE']);
      expect(monarch.keywords).toEqual(LANGUAGE.keywords);
      expect(monarch.ignoreCase).toBe(true);
    });

    it('define o tema pelos tokens e o aplica', async () => {
      renderWithProviders(<Controlled />);
      await editorReady();
      expect(fake.raw.editor.defineTheme).toHaveBeenCalledTimes(1);
      const [name, data] = fake.raw.editor.defineTheme.mock.calls[0]!;
      expect(fake.raw.editor.setTheme).toHaveBeenCalledWith(name);
      expect(fake.editor().options.theme).toBe(name);
      expect((data as { rules: unknown[] }).rules).toEqual(
        expect.arrayContaining([
          { token: 'function', foreground: expect.any(String) },
          { token: 'number', foreground: expect.any(String) },
          { token: 'keyword', foreground: expect.any(String) },
        ]),
      );
    });

    it('o que se digita vai para o onChange; o valor de fora troca o texto sem chamar o onChange', async () => {
      const changes = vi.fn();
      renderWithProviders(<Controlled initial="1" changes={changes} />);
      const editor = await editorReady();
      act(() => editor.model.type('valor_item * 2'));
      expect(changes).toHaveBeenCalledWith('valor_item * 2');
      expect(screen.getByTestId('valor')).toHaveTextContent('valor_item * 2');
      changes.mockClear();
      cleanup();

      const outside = vi.fn();
      const { rerender } = await renderStandalone('a', outside);
      rerender('b');
      await waitFor(() => expect(fake.editor().model.getValue()).toBe('b'));
      expect(outside).not.toHaveBeenCalled();
    });

    it('só leitura: o Monaco não aceita edição e não oferece autocomplete', async () => {
      renderWithProviders(<Controlled initial="valor_item" readOnly />);
      const editor = await editorReady();
      expect(editor.options).toMatchObject({ readOnly: true, domReadOnly: true });
      expect(fake.complete()).toEqual([]);
    });

    it('com uma linguagem nova, troca o realce e descarta o anterior', async () => {
      const { queryClient } = renderWithProviders(<Controlled />);
      await editorReady();
      const first = fake.raw.languages.setMonarchTokensProvider.mock.results[0]!.value as { dispose: () => void };
      act(() => {
        queryClient.setQueryData(FORMULA_LANGUAGE_KEY, { ...LANGUAGE, keywords: [...LANGUAGE.keywords, 'ou'] });
      });
      await waitFor(() => expect(fake.raw.languages.setMonarchTokensProvider).toHaveBeenCalledTimes(2));
      expect(first.dispose).toHaveBeenCalledTimes(1);
      expect((fake.state.monarch.get(LANGUAGE_ID) as { keywords: string[] }).keywords).toContain('ou');
    });

    it('ao desmontar, descarta o editor, o modelo e os widgets', async () => {
      renderWithProviders(<Controlled />);
      const editor = await editorReady();
      const widgets = editor.options.overflowWidgetsDomNode as HTMLElement;
      cleanup();
      expect(editor.disposed).toBe(true);
      expect(editor.model.disposed).toBe(true);
      expect(widgets.isConnected).toBe(false);
    });
  });

  describe('autocomplete', () => {
    it('oferece os símbolos com nome, tipo, origem e a categoria (pelo tipo de item)', async () => {
      renderWithProviders(<Controlled initial="val" />);
      await editorReady();
      const items = fake.complete();
      const byName = (name: string) => items.find((item) => (item.label as { label: string }).label === name)!;
      const kinds = fake.raw.languages.CompletionItemKind;

      expect(byName('valor_item')).toMatchObject({
        label: { label: 'valor_item', detail: ' decimal(2)', description: 'Entrada' },
        detail: 'decimal(2) · Entrada',
        kind: kinds.Variable,
        insertText: 'valor_item',
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 4 },
      });
      expect(byName('valor_compra')).toMatchObject({ kind: kinds.Field, insertText: 'valor_compra[]', detail: 'decimal(2) · Campo de pontuacoes' });
      expect(byName('pontuacoes')).toMatchObject({ kind: kinds.Field, insertText: 'pontuacoes[]', detail: 'lista · Entrada múltipla' });
      expect(byName('pontos_historico')).toMatchObject({ kind: kinds.Constant, detail: 'decimal(2) · Cálculo' });
      expect(byName('fator')).toMatchObject({ kind: kinds.EnumMember, detail: 'decimal(4) · Tabela de Decisão' });
    });

    it('oferece as funções do contexto com a assinatura e a descrição', async () => {
      renderWithProviders(<Controlled initial="mi" />);
      await editorReady();
      const items = fake.complete();
      const min = items.find((item) => (item.label as { label: string }).label === 'MÍN')!;
      expect(min).toMatchObject({
        kind: fake.raw.languages.CompletionItemKind.Function,
        detail: 'MÍN(a, b, …) · MÍN(lista[])',
        documentation: expect.stringContaining('MÍN(lista[]): O menor valor da lista, ignorando os nulos.'),
        filterText: 'MÍN MIN',
        insertText: 'MÍN($0)',
        insertTextRules: fake.raw.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      });
      const labels = items.map((item) => (item.label as { label: string }).label);
      expect(labels).not.toContain('EXISTE');
    });

    it('numa condição da Tabela de Decisão, oferece o EXISTE', async () => {
      renderWithProviders(<Controlled context="decision_condition" />);
      await editorReady();
      expect(fake.complete().map((item) => (item.label as { label: string }).label)).toContain('EXISTE');
    });

    it('usa os símbolos mais novos que o campo recebeu', async () => {
      function Changing() {
        const [symbols, setSymbols] = useState(SYMBOLS.slice(0, 1));
        return (
          <>
            <FormulaEditor value="" onChange={() => {}} context="calculation" aria-label="Fórmula" symbols={symbols} />
            <button type="button" onClick={() => setSymbols(SYMBOLS)}>
              Mais símbolos
            </button>
          </>
        );
      }
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<Changing />);
      await editorReady();
      expect(fake.complete().filter((item) => item.kind !== fake.raw.languages.CompletionItemKind.Function)).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Mais símbolos' }));
      expect(fake.complete().filter((item) => item.kind !== fake.raw.languages.CompletionItemKind.Function)).toHaveLength(SYMBOLS.length);
    });
  });

  describe('problemas', () => {
    const text = '"preço" + valor_iten';
    const start = [...'"preço" + '].length;

    it('marca o trecho do problema na posição certa, com acento antes, e mostra a mensagem', async () => {
      renderWithProviders(<Controlled initial={text} problems={[unknownVariable('valor_iten', start)]} />);
      await editorReady();
      expect(fake.raw.editor.setModelMarkers).toHaveBeenLastCalledWith(fake.editor().model, MARKER_OWNER, [
        {
          startLineNumber: 1,
          startColumn: 11,
          endLineNumber: 1,
          endColumn: 21,
          severity: fake.raw.MarkerSeverity.Error,
          message: 'valor_iten não existe neste ponto do fluxo. Você quis dizer valor_item?',
          code: 'unknown_variable',
        },
      ]);
      expect(text.slice(10, 20)).toBe('valor_iten');
    });

    it('converte de pontos de código para o Monaco quando há caractere de dois code units antes', async () => {
      const astral = '"\u{1D465}" +\n  valor_iten';
      const astralStart = [...'"\u{1D465}" +\n  '].length;
      renderWithProviders(<Controlled initial={astral} problems={[unknownVariable('valor_iten', astralStart)]} />);
      await editorReady();
      expect(fake.markers()).toEqual([expect.objectContaining({ startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 13 })]);
    });

    it('a nota vermelha descreve o campo e lista também os problemas sem posição', async () => {
      const withoutPosition = { ...unknownVariable('x', 0, null), code: 'formula_empty' as const, message: 'A fórmula está vazia.', start: null, end: null };
      renderWithProviders(<Controlled initial={text} problems={[unknownVariable('valor_iten', start), withoutPosition]} />);
      const editor = await editorReady();
      expect(fake.markers()).toHaveLength(1);
      const field = screen.getByRole('textbox', { name: 'Fórmula do Cálculo' });
      expect(field).toBe(editor.input);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(/Você quis dizer valor_item\?.*A fórmula está vazia\./);
    });

    it('sem problemas, sem nota e sem descrição', async () => {
      renderWithProviders(<Controlled initial="valor_item" problems={[]} />);
      const editor = await editorReady();
      expect(editor.input).not.toHaveAttribute('aria-describedby');
      expect(fake.markers()).toEqual([]);
    });

    it('a correção rápida do Monaco é "Trocar por X" e troca o nome', async () => {
      renderWithProviders(<Controlled initial={text} problems={[unknownVariable('valor_iten', start)]} />);
      const editor = await editorReady();
      const markers = fake.markers();
      const { actions } = fake.state.codeActionProviders[0]!.provideCodeActions(editor.model, markers[0]!, { markers });
      expect(actions).toHaveLength(1);
      const action = actions[0] as { title: string; kind: string; edit: { edits: { textEdit: { range: object; text: string } }[] } };
      expect(action.title).toBe('Trocar por valor_item');
      expect(action.kind).toBe('quickfix');
      const edit = action.edit.edits[0]!.textEdit;
      expect(edit.text).toBe('valor_item');
      act(() => editor.model.applyEdit(edit.range as never, edit.text));
      expect(screen.getByTestId('valor')).toHaveTextContent('"preço" + valor_item');
    });

    it('o botão da nota troca o nome no editor', async () => {
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<Controlled initial={text} problems={[unknownVariable('valor_iten', start)]} />);
      const editor = await editorReady();
      await user.click(screen.getByRole('button', { name: 'Trocar por valor_item' }));
      expect(editor.model.getValue()).toBe('"preço" + valor_item');
      expect(screen.getByTestId('valor')).toHaveTextContent('"preço" + valor_item');
      expect(editor.input).toHaveFocus();
    });

    it('depois de digitar, não marca nem corrige com as posições do texto antigo', async () => {
      const user = userEvent.setup({ delay: null });
      renderWithProviders(<Analysed initial={text} problems={[unknownVariable('valor_iten', start)]} />);
      const editor = await editorReady();
      expect(fake.markers()).toHaveLength(1);
      const [oldMarker] = fake.markers();

      // The person types before the problem: the analysis of the new text has not come back.
      act(() => editor.model.type(`1 + ${text}`));
      expect(fake.markers()).toEqual([]);
      expect(screen.queryByRole('button', { name: /Trocar por/ })).not.toBeInTheDocument();
      expect(fake.state.codeActionProviders[0]!.provideCodeActions(editor.model, oldMarker!, { markers: [oldMarker] }).actions).toEqual([]);
      // The message stays in the note, and the field stays invalid.
      expect(screen.getByText(/valor_iten não existe neste ponto do fluxo/)).toBeInTheDocument();
      expect(editor.input).toHaveAttribute('aria-invalid', 'true');

      // The analysis of the new text arrives, with the new positions.
      await user.click(screen.getByRole('button', { name: 'Nova análise' }));
      expect(fake.markers()).toEqual([expect.objectContaining({ startColumn: 15, endColumn: 25 })]);
      await user.click(screen.getByRole('button', { name: 'Trocar por valor_item' }));
      expect(editor.model.getValue()).toBe('1 + "preço" + valor_item');
    });

    it('com o texto analisado diferente do atual, não marca nem oferece a correção', async () => {
      function WithAnalyzed({ analyzedValue }: { analyzedValue: string }) {
        const [value, setValue] = useState(`1 + ${text}`);
        return (
          <FormulaEditor
            value={value}
            onChange={setValue}
            analyzedValue={analyzedValue}
            problems={[unknownVariable('valor_iten', start)]}
            context="calculation"
            aria-label="Fórmula"
          />
        );
      }
      renderWithProviders(<WithAnalyzed analyzedValue={text} />);
      const editor = await editorReady();
      expect(fake.markers()).toEqual([]);
      expect(screen.queryByRole('button', { name: /Trocar por/ })).not.toBeInTheDocument();
      expect(editor.model.getValue()).toBe(`1 + ${text}`);
      cleanup();

      renderWithProviders(<WithAnalyzed analyzedValue={`1 + ${text}`} />);
      await waitFor(() => expect(fake.state.editors.filter((candidate) => !candidate.disposed)).toHaveLength(1));
      // The same problem, given as computed on the current text: marked where it says.
      expect(fake.markers()).toEqual([expect.objectContaining({ startColumn: 11, endColumn: 21 })]);
    });

    it('sem sugestão, sem correção', async () => {
      renderWithProviders(<Controlled initial="xyz" problems={[unknownVariable('xyz', 0, null)]} />);
      const editor = await editorReady();
      const markers = fake.markers();
      expect(fake.state.codeActionProviders[0]!.provideCodeActions(editor.model, markers[0]!, { markers }).actions).toEqual([]);
      expect(screen.queryByRole('button', { name: /Trocar por/ })).not.toBeInTheDocument();
    });

    it('só leitura: marca o problema, sem correção', async () => {
      renderWithProviders(<Controlled initial={text} readOnly problems={[unknownVariable('valor_iten', start)]} />);
      const editor = await editorReady();
      const markers = fake.markers();
      expect(markers).toHaveLength(1);
      expect(fake.state.codeActionProviders[0]!.provideCodeActions(editor.model, markers[0]!, { markers }).actions).toEqual([]);
      expect(screen.queryByRole('button', { name: /Trocar por/ })).not.toBeInTheDocument();
    });
  });
});

/** The editor with `value` coming only from the test (to check that an outside value does not call onChange). */
async function renderStandalone(initial: string, onChange: (value: string) => void) {
  let setValue: (value: string) => void = () => {};
  function Outside() {
    const [value, set] = useState(initial);
    setValue = set;
    return <FormulaEditor value={value} onChange={onChange} context="calculation" aria-label="Fórmula" />;
  }
  renderWithProviders(<Outside />);
  await waitFor(() => expect(fake.state.editors.some((editor) => !editor.disposed)).toBe(true));
  return { rerender: (value: string) => act(() => setValue(value)) };
}

/** The editor with problems that come from an "analysis" of the current text when the test asks (the "Nova análise" button). */
function Analysed({ initial, problems }: { initial: string; problems: WorkflowProblem[] }) {
  const [value, setValue] = useState(initial);
  const [current, setCurrent] = useState(problems);
  return (
    <>
      <FormulaEditor value={value} onChange={setValue} problems={current} context="calculation" aria-label="Fórmula do Cálculo" />
      <button type="button" onClick={() => setCurrent([unknownVariable('valor_iten', [...value].indexOf('v'))])}>
        Nova análise
      </button>
    </>
  );
}
