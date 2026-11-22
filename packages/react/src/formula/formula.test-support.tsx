// Support for the formula editor tests (not a test and not shipped in the package): the language and the symbols of the
// contract example, its run parameters, a simulated Monaco (only what the editor uses) and the providers the editor needs.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient } from '../api';
import { FluxoRoot } from '../design-system';
import type { Monaco } from './loadMonaco';
import { FORMULA_LANGUAGE_KEY, type FormulaLanguage, type FormulaSymbol, type WorkflowParameter, type WorkflowProblem } from './queries';

export const API = 'https://api.teste';

const ALL: FormulaLanguage['functions'][number]['contexts'] = ['calculation', 'decision_condition', 'decision_result'];

/** The language of the contract example (`FormulaLanguage`), trimmed to the functions the tests use. */
export const LANGUAGE: FormulaLanguage = {
  functions: [
    { name: 'ARRED', aliases: [], internal_name: 'round', signature: 'ARRED(x, casas)', description: 'Arredonda x com as casas (0 a 18), com o meio para longe do zero.', kind: 'scalar', contexts: ALL },
    { name: 'MÍN', aliases: ['MIN'], internal_name: 'min', signature: 'MÍN(a, b, …)', description: 'O menor de dois ou mais números.', kind: 'scalar', contexts: ALL },
    { name: 'MÍN', aliases: ['MIN'], internal_name: 'min', signature: 'MÍN(lista[])', description: 'O menor valor da lista, ignorando os nulos.', kind: 'aggregation', contexts: ALL },
    { name: 'SOMA', aliases: [], internal_name: 'sum', signature: 'SOMA(lista[])', description: 'A soma da lista, ignorando os nulos; lista vazia dá 0.', kind: 'aggregation', contexts: ALL },
    { name: 'MÉDIA', aliases: ['MEDIA'], internal_name: 'avg', signature: 'MÉDIA(lista[])', description: 'A média da lista, ignorando os nulos.', kind: 'aggregation', contexts: ALL },
    { name: 'EXISTE', aliases: [], internal_name: 'exists', signature: 'EXISTE(lista[])', description: 'Verdadeiro se a lista tiver algum valor não nulo.', kind: 'aggregation', contexts: ['decision_condition'] },
  ],
  keywords: ['verdadeiro', 'falso', 'nulo', 'e', 'em', 'entre'],
  operators: ['+', '-', '*', '/', '^'],
};

/** The symbols of the contract example draft: linear inputs, a multiple input with its fields, a Calculation and a Decision Table. */
export const SYMBOLS: FormulaSymbol[] = [
  { name: 'valor_item', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'input', node_id: null, group_id: null },
  { name: 'categoria', type: 'text', scale: null, cardinality: 'linear', list: null, origin: 'input', node_id: null, group_id: null },
  { name: 'pontuacoes', type: null, scale: null, cardinality: 'multiple', list: null, origin: 'input', node_id: null, group_id: null },
  { name: 'valor_compra', type: 'decimal', scale: 2, cardinality: 'multiple', list: 'pontuacoes', origin: 'input', node_id: null, group_id: null },
  { name: 'fator', type: 'decimal', scale: 4, cardinality: 'linear', list: null, origin: 'decision_table', node_id: 'td_elegibilidade', group_id: null },
  { name: 'pontos_historico', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_historico', group_id: null },
];

function parameter(name: string, type: WorkflowParameter['type'], changes: Partial<WorkflowParameter> = {}): WorkflowParameter {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...changes };
}

/** The run parameters of the contract example draft: a period, a decimal and two lists. */
export const PARAMETERS: WorkflowParameter[] = [
  parameter('periodo', 'period', { required: true }),
  parameter('meta_minima', 'decimal', { scale: 2 }),
  parameter('categorias', 'text', { list: true }),
  parameter('lojas', 'integer', { list: true }),
];

/** A problem of a parameter on `[start, end)` (code points), as the API marks it in a formula. */
export function parameterProblem(
  code: 'unknown_parameter' | 'period_without_part' | 'list_outside_in',
  message: string,
  start: number,
  end: number,
  suggestion: string | null = null,
): WorkflowProblem {
  return { code, message, path: 'root.nodes[0].expression', node_id: 'calc_pontos', start, end, suggestion };
}

/** An `unknown_variable` problem on `[start, end)` (code points), with the suggestion of the API. */
export function unknownVariable(name: string, start: number, suggestion: string | null = 'valor_item'): WorkflowProblem {
  return {
    code: 'unknown_variable',
    message: suggestion
      ? `${name} não existe neste ponto do fluxo. Você quis dizer ${suggestion}?`
      : `${name} não existe neste ponto do fluxo.`,
    path: 'root.nodes[0].expression',
    node_id: 'calc_pontos',
    start,
    end: start + [...name].length,
    suggestion,
  };
}

/** Renders inside the module root, with the API (cookie mode) and a QueryClient without retries; the language already cached. */
export function renderWithProviders(ui: ReactElement, options: { language?: FormulaLanguage | null } = {}): { queryClient: QueryClient } {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const language = options.language === undefined ? LANGUAGE : options.language;
  if (language) queryClient.setQueryData(FORMULA_LANGUAGE_KEY, language);
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { queryClient };
}

/** fetch answering `GET /v1/formula-language` with `response`; the other routes answer 599. */
export function simulateLanguageRoute(response: () => Response) {
  const simulated = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/v1/formula-language') return response();
    return new Response('rota não simulada', { status: 599 });
  });
  vi.stubGlobal('fetch', simulated);
  return simulated;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Simulated Monaco: models with text and positions, editors with options and a textarea, and the registered providers.
// ---------------------------------------------------------------------------------------------------------------------------

interface Position {
  lineNumber: number;
  column: number;
}

interface RangeLike {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

type Listener = () => void;

function disposable(list: Listener[], listener: Listener) {
  list.push(listener);
  return { dispose: () => list.splice(list.indexOf(listener), 1) };
}

let modelCount = 0;

export class FakeModel {
  readonly uri: { toString(): string };
  private text: string;
  private version = 1;
  private readonly listeners: Listener[] = [];
  disposed = false;

  constructor(value: string) {
    const id = `inmemory://model/${++modelCount}`;
    this.uri = { toString: () => id };
    this.text = value;
  }

  getValue() {
    return this.text;
  }

  getVersionId() {
    return this.version;
  }

  /** Position (1-based, UTF-16 columns) of a UTF-16 offset, like Monaco. */
  getPositionAt(offset: number): Position {
    const clamped = Math.max(0, Math.min(offset, this.text.length));
    const before = this.text.slice(0, clamped).split('\n');
    return { lineNumber: before.length, column: before[before.length - 1]!.length + 1 };
  }

  getOffsetAt(position: Position): number {
    const lines = this.text.split('\n');
    let offset = 0;
    for (let line = 1; line < position.lineNumber; line++) offset += lines[line - 1]!.length + 1;
    return offset + position.column - 1;
  }

  getFullModelRange(): RangeLike {
    const end = this.getPositionAt(this.text.length);
    return { startLineNumber: 1, startColumn: 1, endLineNumber: end.lineNumber, endColumn: end.column };
  }

  getWordUntilPosition(position: Position) {
    const line = this.text.split('\n')[position.lineNumber - 1] ?? '';
    const before = line.slice(0, position.column - 1);
    const word = /[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*$/.exec(before)?.[0] ?? '';
    return { word, startColumn: position.column - word.length, endColumn: position.column };
  }

  onDidChangeContent(listener: Listener) {
    return disposable(this.listeners, listener);
  }

  /** Replaces `range` with `text`, as an edit by Monaco (fires the content listeners). */
  applyEdit(range: RangeLike, text: string) {
    const start = this.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
    const end = this.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
    this.text = this.text.slice(0, start) + text + this.text.slice(end);
    this.version++;
    for (const listener of [...this.listeners]) listener();
  }

  pushEditOperations(_selections: unknown, edits: { range: RangeLike; text: string }[]) {
    for (const edit of edits) this.applyEdit(edit.range, edit.text);
    return null;
  }

  /** What the person types: the whole text becomes `text`. */
  type(text: string) {
    this.applyEdit(this.getFullModelRange(), text);
  }

  dispose() {
    this.disposed = true;
  }
}

export class FakeEditor {
  options: Record<string, unknown>;
  readonly input: HTMLTextAreaElement;
  private readonly focusListeners: Listener[] = [];
  private readonly sizeListeners: Listener[] = [];
  disposed = false;

  constructor(
    readonly host: HTMLElement,
    options: Record<string, unknown>,
  ) {
    this.options = { ...options };
    this.input = document.createElement('textarea');
    this.input.className = 'inputarea';
    this.input.setAttribute('aria-label', String(options.ariaLabel));
    host.appendChild(this.input);
  }

  get model(): FakeModel {
    return this.options.model as FakeModel;
  }

  getModel() {
    return this.model;
  }

  getDomNode() {
    return this.host;
  }

  getContentHeight() {
    return this.model.getValue().split('\n').length * 20 + 12;
  }

  layout() {}

  focus() {
    this.input.focus();
  }

  updateOptions(options: Record<string, unknown>) {
    this.options = { ...this.options, ...options };
    if (typeof options.ariaLabel === 'string') this.input.setAttribute('aria-label', options.ariaLabel);
  }

  executeEdits(_source: string, edits: { range: RangeLike; text: string }[]) {
    for (const edit of edits) this.model.applyEdit(edit.range, edit.text);
    return true;
  }

  onDidContentSizeChange(listener: Listener) {
    return disposable(this.sizeListeners, listener);
  }

  onDidFocusEditorText(listener: Listener) {
    return disposable(this.focusListeners, listener);
  }

  dispose() {
    this.disposed = true;
    this.input.remove();
  }
}

class FakeRange implements RangeLike {
  constructor(
    readonly startLineNumber: number,
    readonly startColumn: number,
    readonly endLineNumber: number,
    readonly endColumn: number,
  ) {}
}

/** Monaco's numbers for the kinds the editor uses (`languages.CompletionItemKind`). */
const COMPLETION_KIND = { Function: 1, Field: 3, Variable: 4, Value: 13, Constant: 14, EnumMember: 16 };

export interface CompletionProvider {
  triggerCharacters?: string[];
  provideCompletionItems(
    model: FakeModel,
    position: Position,
    context?: { triggerKind: number; triggerCharacter?: string },
  ): { suggestions: Record<string, unknown>[] };
}

export interface CodeActionProvider {
  provideCodeActions(model: FakeModel, range: RangeLike, context: { markers: unknown[] }): { actions: Record<string, unknown>[] };
}

/** A new simulated Monaco, with everything it received. */
export function createFakeMonaco() {
  const state = {
    languages: [] as { id: string }[],
    monarch: new Map<string, unknown>(),
    configurations: new Map<string, unknown>(),
    completionProviders: [] as CompletionProvider[],
    codeActionProviders: [] as CodeActionProvider[],
    models: [] as FakeModel[],
    editors: [] as FakeEditor[],
    markers: new Map<FakeModel, { owner: string; markers: RangeLike[] }>(),
    themes: new Map<string, unknown>(),
    theme: null as string | null,
  };

  const monaco = {
    Range: FakeRange,
    MarkerSeverity: { Hint: 1, Info: 2, Warning: 4, Error: 8 },
    languages: {
      CompletionItemKind: COMPLETION_KIND,
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      register: vi.fn((language: { id: string }) => state.languages.push(language)),
      setLanguageConfiguration: vi.fn((id: string, configuration: unknown) => state.configurations.set(id, configuration)),
      setMonarchTokensProvider: vi.fn((id: string, definition: unknown) => {
        state.monarch.set(id, definition);
        return { dispose: vi.fn(() => state.monarch.get(id) === definition && state.monarch.delete(id)) };
      }),
      registerCompletionItemProvider: vi.fn((_id: string, provider: CompletionProvider) => state.completionProviders.push(provider)),
      registerCodeActionProvider: vi.fn((_id: string, provider: CodeActionProvider) => state.codeActionProviders.push(provider)),
    },
    editor: {
      createModel: vi.fn((value: string) => {
        const model = new FakeModel(value);
        state.models.push(model);
        return model;
      }),
      create: vi.fn((host: HTMLElement, options: Record<string, unknown>) => {
        const editor = new FakeEditor(host, options);
        state.editors.push(editor);
        return editor;
      }),
      setModelMarkers: vi.fn((model: FakeModel, owner: string, markers: RangeLike[]) => state.markers.set(model, { owner, markers })),
      defineTheme: vi.fn((name: string, data: unknown) => state.themes.set(name, data)),
      setTheme: vi.fn((name: string) => {
        state.theme = name;
      }),
      remeasureFonts: vi.fn(() => {}),
    },
  };

  return {
    monaco: monaco as unknown as Monaco,
    raw: monaco,
    state,
    /** The last editor created. */
    editor(): FakeEditor {
      const editor = state.editors[state.editors.length - 1];
      if (!editor) throw new Error('nenhum editor foi criado');
      return editor;
    },
    /**
     * The autocomplete of the last editor, with the cursor at the end of the text; `triggerCharacter` when a typed
     * character opened it (`@`, `.`), as Monaco says in the context.
     */
    complete(triggerCharacter?: string): Record<string, unknown>[] {
      const editor = this.editor();
      const end = editor.model.getPositionAt(editor.model.getValue().length);
      const context = triggerCharacter ? { triggerKind: 1, triggerCharacter } : { triggerKind: 0 };
      return state.completionProviders[0]!.provideCompletionItems(editor.model, end, context).suggestions;
    },
    /** The markers of the last editor's model. */
    markers() {
      return state.markers.get(this.editor().model)?.markers ?? [];
    },
  };
}

export type FakeMonaco = ReturnType<typeof createFakeMonaco>;
