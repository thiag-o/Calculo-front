// The `fluxo-formula` language in Monaco (E4-21): highlighting, autocomplete and the quick fix. The functions and reserved
// words come from `GET /v1/formula-language`; types and problems come from the API (`symbols`, `problems`). Nothing here
// re-implements the engine rules.
import type * as MonacoApi from 'monaco-editor/editor/editor.api';
import { buildCompletions, type SymbolCategory } from './completions';
import type { Monaco } from './loadMonaco';
import { codePointToUtf16 } from './positions';
import type { FormulaContext, FormulaLanguage, FormulaSymbol, WorkflowProblem } from './queries';

export const LANGUAGE_ID = 'fluxo-formula';

/** Owner of the problem markers on the models. */
export const MARKER_OWNER = 'fluxo-formula';

/** A name: a letter (with or without accent) or `_`, then letters, digits and `_`. Functions are accepted with accent (`MÍN`). */
const NAME = /[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/;

/**
 * Monarch tokenizer (`IMonarchLanguage`). Token classes: `function` (a known function name, or alias, before `(`), `number`,
 * `keyword` (reserved words), `string`, `variable` (other names, with the optional `[]`), `operator` and `delimiter`.
 * Function names and reserved words do not distinguish case, like the language.
 */
export function monarchLanguage(language: FormulaLanguage): MonacoApi.languages.IMonarchLanguage {
  const functions = [...new Set(language.functions.flatMap((fn) => [fn.name, ...fn.aliases]))];
  return {
    ignoreCase: true,
    defaultToken: '',
    functions,
    keywords: language.keywords,
    tokenizer: {
      root: [
        [/\s+/, 'white'],
        [/\d+(\.\d+)?/, 'number'],
        [/"/, { token: 'string.quote', next: '@string' }],
        [new RegExp(`${NAME.source}(?=\\s*\\()`), { cases: { '@functions': 'function', '@keywords': 'keyword', '@default': 'variable' } }],
        [new RegExp(`${NAME.source}(\\[\\])?`), { cases: { '@keywords': 'keyword', '@default': 'variable' } }],
        [/[()]/, '@brackets'],
        [/<>|<=|>=|[-+*/^<>=]/, 'operator'],
        [/,/, 'delimiter'],
      ],
      string: [
        [/[^"]+/, 'string'],
        [/""/, 'string.escape'],
        [/"/, { token: 'string.quote', next: '@pop' }],
      ],
    },
  };
}

/** What each model (one per field) offers to the providers, registered once per language. */
export interface ModelState {
  symbols: readonly FormulaSymbol[];
  context: FormulaContext;
  language: FormulaLanguage;
  problems: readonly WorkflowProblem[];
  readOnly: boolean;
  /** The text the `problems` were marked on: no quick fix once the model has another text. */
  text: string;
}

const models = new Map<string, ModelState>();

/** Gives the providers the state of a field's model; `null` when the field unmounts. */
export function setModelState(uri: string, state: ModelState | null): void {
  if (state) models.set(uri, state);
  else models.delete(uri);
}

/**
 * Completion kind per category. Monaco draws the icon of each kind with a `codicon-symbol-*` class; formula.css turns these four
 * into the 8px square of the category colour (estilos.md §2.4).
 */
export function completionKind(monaco: Monaco, category: SymbolCategory): MonacoApi.languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind;
  return { source: kinds.Variable, multi: kinds.Field, calc: kinds.Constant, decision: kinds.EnumMember }[category];
}

/** The autocomplete items of a model at `range`: symbols (name, type, origin) and the functions of the context. */
export function completionItems(monaco: Monaco, state: ModelState, range: MonacoApi.IRange): MonacoApi.languages.CompletionItem[] {
  return buildCompletions(state.symbols, state.language.functions, state.context).map((item, index) => {
    const sortText = String(index).padStart(4, '0');
    if (item.type === 'symbol') {
      return {
        label: { label: item.label, detail: ` ${item.typeLabel}`, description: item.originLabel },
        kind: completionKind(monaco, item.category),
        detail: `${item.typeLabel} · ${item.originLabel}`,
        insertText: item.insertText,
        range,
        sortText,
      };
    }
    return {
      label: { label: item.label, description: item.signatures.join(' · ') },
      kind: monaco.languages.CompletionItemKind.Function,
      detail: item.signatures.join(' · '),
      documentation: item.documentation,
      // Typing an alias without accent (`min`) also finds the function (`MÍN`).
      filterText: [item.label, ...item.aliases].join(' '),
      insertText: `${item.label}($0)`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      sortText,
    };
  });
}

/** The quick fixes of the markers: "Trocar por X" for each problem with a `suggestion`, replacing the marked text. */
export function quickFixes(
  monaco: Monaco,
  model: MonacoApi.editor.ITextModel,
  state: ModelState,
  markers: readonly MonacoApi.editor.IMarkerData[],
): MonacoApi.languages.CodeAction[] {
  if (state.readOnly || model.getValue() !== state.text) return [];
  const actions: MonacoApi.languages.CodeAction[] = [];
  for (const marker of markers) {
    const problem = state.problems.find(
      (candidate) => candidate.suggestion !== null && candidate.code === marker.code && sameRange(model, candidate, marker),
    );
    if (!problem?.suggestion) continue;
    actions.push({
      title: `Trocar por ${problem.suggestion}`,
      kind: 'quickfix',
      diagnostics: [marker],
      isPreferred: true,
      edit: {
        edits: [
          {
            resource: model.uri,
            versionId: model.getVersionId(),
            textEdit: {
              range: new monaco.Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn),
              text: problem.suggestion,
            },
          },
        ],
      },
    });
  }
  return actions;
}

/** Whether the marker is the one made from `problem` (markers keep only the range, not the problem). */
function sameRange(model: MonacoApi.editor.ITextModel, problem: WorkflowProblem, marker: MonacoApi.editor.IMarkerData): boolean {
  const range = markerRange(model, problem);
  return (
    range !== null &&
    range.startLineNumber === marker.startLineNumber &&
    range.startColumn === marker.startColumn &&
    range.endLineNumber === marker.endLineNumber &&
    range.endColumn === marker.endColumn
  );
}

/** The Monaco range of a problem, from code points (API) to UTF-16 (Monaco); `null` without a position. */
export function markerRange(model: MonacoApi.editor.ITextModel, problem: WorkflowProblem): MonacoApi.IRange | null {
  if (problem.start === null) return null;
  const text = model.getValue();
  const start = model.getPositionAt(codePointToUtf16(text, problem.start));
  const end = model.getPositionAt(codePointToUtf16(text, problem.end ?? problem.start));
  return { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column };
}

/** The markers of the problems that have a position, in red (`editorError.foreground`, `red-700`), with the message on hover. */
export function problemMarkers(monaco: Monaco, model: MonacoApi.editor.ITextModel, problems: readonly WorkflowProblem[]): MonacoApi.editor.IMarkerData[] {
  const markers: MonacoApi.editor.IMarkerData[] = [];
  for (const problem of problems) {
    const range = markerRange(model, problem);
    if (!range) continue;
    markers.push({ ...range, severity: monaco.MarkerSeverity.Error, message: problem.message, code: problem.code });
  }
  return markers;
}

const installed = new WeakSet<object>();
const tokenizers = new WeakMap<object, { language: FormulaLanguage; registration: MonacoApi.IDisposable }>();

/**
 * Registers the language in this Monaco (once) and its tokenizer for `language` (again only when the language changes).
 * The providers read the state of each model, so two fields with different symbols share them.
 */
export function installLanguage(monaco: Monaco, language: FormulaLanguage): void {
  if (!installed.has(monaco.languages)) {
    installed.add(monaco.languages);
    monaco.languages.register({ id: LANGUAGE_ID });
    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
      wordPattern: new RegExp(NAME.source, 'g'),
      brackets: [['(', ')']],
      autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
      ],
      surroundingPairs: [
        { open: '(', close: ')' },
        { open: '"', close: '"' },
      ],
    });
    monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      provideCompletionItems(model, position) {
        const state = models.get(model.uri.toString());
        if (!state || state.readOnly) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        return { suggestions: completionItems(monaco, state, range) };
      },
    });
    monaco.languages.registerCodeActionProvider(
      LANGUAGE_ID,
      {
        provideCodeActions(model, _range, context) {
          const state = models.get(model.uri.toString());
          if (!state) return { actions: [], dispose() {} };
          return { actions: quickFixes(monaco, model, state, context.markers), dispose() {} };
        },
      },
      { providedCodeActionKinds: ['quickfix'] },
    );
  }
  const tokenizer = tokenizers.get(monaco.languages);
  if (tokenizer?.language !== language) {
    // The tokenizer of the previous language is released before the new one takes its place.
    tokenizer?.registration.dispose();
    tokenizers.set(monaco.languages, { language, registration: monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarchLanguage(language)) });
  }
}
