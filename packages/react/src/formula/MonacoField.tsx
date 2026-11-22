import { useEffect, useRef, type MutableRefObject } from 'react';
import type * as MonacoApi from 'monaco-editor/editor/editor.api';
import { installLanguage, LANGUAGE_ID, MARKER_OWNER, problemMarkers, setModelState } from './language';
import type { Monaco } from './loadMonaco';
import type { FormulaContext, FormulaLanguage, FormulaSymbol, WorkflowParameter, WorkflowProblem } from './queries';
import { readColors, themeData, themeName } from './theme';

export type FormulaCodeEditor = MonacoApi.editor.IStandaloneCodeEditor;

interface MonacoFieldProps {
  monaco: Monaco;
  language: FormulaLanguage;
  value: string;
  onChange: (value: string) => void;
  /** The problems to mark: only those computed on the current `value` (FormulaEditor drops the outdated ones). */
  problems: readonly WorkflowProblem[];
  /** Whether the formula has problems (`aria-invalid`), even when their positions are outdated. */
  invalid: boolean;
  symbols: readonly FormulaSymbol[];
  parameters: readonly WorkflowParameter[];
  context: FormulaContext;
  readOnly: boolean;
  ariaLabel: string;
  /** Id of the problem note, for the `aria-describedby` of the editor input. */
  describedBy: string | undefined;
  /** Where Monaco's floating widgets (autocomplete, hover, quick fix) go: inside the module root (ADR 0002 and 0037). */
  widgetsContainer: HTMLElement;
  /** The created editor, for the quick fix of the problem note. */
  editorRef: MutableRefObject<FormulaCodeEditor | null>;
}

/** mono-13 (estilos.md §3): 13px on 20px lines. */
const FONT_SIZE = 13;
const LINE_HEIGHT = 20;
/** The field grows with the formula, from 3 to 10 lines; beyond that, it scrolls. */
const MIN_HEIGHT = 3 * LINE_HEIGHT;
const MAX_HEIGHT = 10 * LINE_HEIGHT;
const FALLBACK_MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";

/** Per Monaco instance: the themes already defined and the one in use. */
const themesOf = new WeakMap<object, { defined: Set<string>; current: string | null }>();

/**
 * Applies the theme made from the tokens of the root around `host`. Monaco has one theme per page, so the editor applies it
 * again when it takes focus (another module root on the page may use the other theme).
 */
function applyTheme(monaco: Monaco, host: HTMLElement): string {
  const colors = readColors(host);
  const name = themeName(colors);
  let themes = themesOf.get(monaco.editor);
  if (!themes) {
    themes = { defined: new Set(), current: null };
    themesOf.set(monaco.editor, themes);
  }
  if (!themes.defined.has(name)) {
    monaco.editor.defineTheme(name, themeData(colors));
    themes.defined.add(name);
  }
  if (themes.current !== name) {
    monaco.editor.setTheme(name);
    themes.current = name;
  }
  return name;
}

/** The Monaco editor of a formula, already loaded. Controlled by `value` and `onChange`. */
export function MonacoField({
  monaco,
  language,
  value,
  onChange,
  problems,
  invalid,
  symbols,
  parameters,
  context,
  readOnly,
  ariaLabel,
  describedBy,
  widgetsContainer,
  editorRef,
}: MonacoFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<MonacoApi.editor.ITextModel | null>(null);
  const onChangeRef = useRef(onChange);
  // While the editor takes a new `value` from the props, its content change is not a change by the person.
  const applyingValue = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Creates the editor once per Monaco; the props below are applied by their own effects.
  useEffect(() => {
    const host = hostRef.current!;
    installLanguage(monaco, language);
    const model = monaco.editor.createModel(value, LANGUAGE_ID);
    modelRef.current = model;

    const widgets = document.createElement('div');
    // `monaco-editor` gives the widgets Monaco's own styles and colour variables; `fc-formula-widgets` scopes ours.
    widgets.className = 'monaco-editor fc-formula-widgets';
    widgetsContainer.appendChild(widgets);

    const theme = applyTheme(monaco, host);
    const fontFamily = getComputedStyle(host).getPropertyValue('--fc-font-mono').trim() || FALLBACK_MONO;
    const editor = monaco.editor.create(host, {
      model,
      theme,
      ariaLabel,
      readOnly,
      domReadOnly: readOnly,
      // Tab leaves the editor (estilos.md §11): the formula has no use for a tab character.
      tabFocusMode: true,
      // A plain textarea as input: it takes `aria-describedby` and works in every browser.
      editContext: false,
      fontFamily,
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
      fontLigatures: false,
      lineNumbers: 'on',
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 8,
      glyphMargin: false,
      folding: false,
      minimap: { enabled: false },
      overviewRulerLanes: 0,
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      renderLineHighlight: 'none',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      scrollbar: { horizontal: 'hidden', alwaysConsumeMouseWheel: false },
      padding: { top: 6, bottom: 6 },
      contextmenu: false,
      wordBasedSuggestions: 'off',
      quickSuggestions: { other: true, comments: false, strings: false },
      suggest: { showWords: false, showIcons: true },
      renderValidationDecorations: 'on',
      fixedOverflowWidgets: true,
      overflowWidgetsDomNode: widgets,
      automaticLayout: true,
    });
    editorRef.current = editor;

    const resize = () => {
      const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, editor.getContentHeight()));
      host.style.height = `${height}px`;
      editor.layout();
    };
    resize();

    const subscriptions = [
      editor.onDidContentSizeChange(resize),
      model.onDidChangeContent(() => {
        if (!applyingValue.current) onChangeRef.current(model.getValue());
      }),
      editor.onDidFocusEditorText(() => applyTheme(monaco, host)),
    ];

    // The theme follows the module root (data-theme) and, in the "system" theme, the operating system.
    const root = host.closest('.fc-root');
    const observer = new MutationObserver(() => applyTheme(monaco, host));
    if (root) observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    const scheme = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onScheme = () => applyTheme(monaco, host);
    scheme?.addEventListener('change', onScheme);
    // Geist Mono may arrive after the editor measured the characters.
    let disposed = false;
    void document.fonts?.ready.then(() => {
      if (!disposed) monaco.editor.remeasureFonts();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      scheme?.removeEventListener('change', onScheme);
      for (const subscription of subscriptions) subscription.dispose();
      setModelState(model.uri.toString(), null);
      editor.dispose();
      model.dispose();
      widgets.remove();
      editorRef.current = null;
      modelRef.current = null;
    };
    // Created once per Monaco: value, options and problems follow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monaco]);

  // A `value` from outside (undo of the editor screen, reloaded draft) replaces the text, keeping Monaco's own undo.
  useEffect(() => {
    const model = modelRef.current;
    if (!model || model.getValue() === value) return;
    applyingValue.current = true;
    try {
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: value }], () => null);
    } finally {
      applyingValue.current = false;
    }
  }, [value]);

  useEffect(() => {
    installLanguage(monaco, language);
    const model = modelRef.current;
    if (!model) return;
    // `text`: the quick fix is only offered while the model still has the text the problems were marked on.
    setModelState(model.uri.toString(), { symbols, parameters, context, language, problems, readOnly, text: value });
  }, [monaco, language, symbols, parameters, context, problems, readOnly, value]);

  // The problems are marked on the text they came from: with every new list and with every new text.
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;
    monaco.editor.setModelMarkers(model, MARKER_OWNER, problemMarkers(monaco, model, problems));
  }, [monaco, problems, value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ ariaLabel, readOnly, domReadOnly: readOnly });
  }, [ariaLabel, readOnly, editorRef]);

  // After updateOptions (Monaco may redraw its input), so it runs again whenever the options change.
  useEffect(() => {
    const input = editorRef.current?.getDomNode()?.querySelector('textarea');
    if (!input) return;
    if (describedBy) input.setAttribute('aria-describedby', describedBy);
    else input.removeAttribute('aria-describedby');
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }, [describedBy, invalid, ariaLabel, readOnly, editorRef]);

  return <div ref={hostRef} className="fc-formula-monaco" style={{ height: MIN_HEIGHT }} />;
}
