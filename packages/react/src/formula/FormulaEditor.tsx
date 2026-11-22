import { useEffect, useId, useRef, useState } from 'react';
import { Button, Loading, Notice, Skeleton, useFluxoPortal } from '../design-system';
import { AlertIcon } from './icons';
import { markedText, markerRange } from './language';
import { loadMonaco, type Monaco } from './loadMonaco';
import { MonacoField, type FormulaCodeEditor } from './MonacoField';
import { fixLabel, fixText } from './parameters';
import { PlainField } from './PlainField';
import { codePointToUtf16, replaceCodePoints } from './positions';
import {
  useFormulaLanguage,
  type FormulaContext,
  type FormulaSymbol,
  type WorkflowParameter,
  type WorkflowProblem,
} from './queries';
import './formula.css';

export interface FormulaEditorProps {
  /** The formula, as typed (language text, with decimal point). */
  value: string;
  onChange: (value: string) => void;
  /**
   * The problems of this formula (from the API analysis), with `start` and `end` in code points. Those with a position are
   * underlined; all of them show in the note below the field.
   */
  problems?: readonly WorkflowProblem[];
  /**
   * The text the `problems` were computed on (the formula sent to the analysis). While it differs from `value` (the person kept
   * typing and the analysis has not come back), the problems are not underlined and "Trocar por X" is not offered: their
   * positions belong to the other text. Without it, the problems are taken as computed on the `value` of when they arrived, and
   * stop being marked at the first change of the text until a different list arrives.
   */
  analyzedValue?: string;
  /** The variables the autocomplete offers (the `symbols` of the analysis). */
  symbols?: readonly FormulaSymbol[];
  /** The run parameters of the draft (`definition.parameters`): `@` offers them, and `@nome` is highlighted (E6-18). */
  parameters?: readonly WorkflowParameter[];
  /** Where the formula is: the autocomplete offers only the functions allowed there. */
  context: FormulaContext;
  /** Without edit permission: the text can be read and selected, not changed. */
  readOnly?: boolean;
  /** Accessible name of the field (there is no visible `<label>` inside the editor). */
  'aria-label': string;
  className?: string;
}

const NO_PROBLEMS: readonly WorkflowProblem[] = [];
const NO_SYMBOLS: readonly FormulaSymbol[] = [];
const NO_PARAMETERS: readonly WorkflowParameter[] = [];

type MonacoStatus = { status: 'loading' } | { status: 'ready'; monaco: Monaco } | { status: 'failed' };

/**
 * Formula editor (estilos.md §8, "Editor de fórmula"; E4-21): Monaco with the `fluxo-formula` language, loaded only when the
 * field mounts. While it loads, the field skeleton; if Monaco or the language does not load, a plain text field with a notice,
 * and the problems still show below.
 */
export function FormulaEditor({
  value,
  onChange,
  problems = NO_PROBLEMS,
  analyzedValue,
  symbols = NO_SYMBOLS,
  parameters = NO_PARAMETERS,
  context,
  readOnly = false,
  'aria-label': ariaLabel,
  className,
}: FormulaEditorProps) {
  const language = useFormulaLanguage();
  const [monaco, setMonaco] = useState<MonacoStatus>({ status: 'loading' });
  const portal = useFluxoPortal();
  const editorRef = useRef<FormulaCodeEditor | null>(null);
  const plainRef = useRef<HTMLTextAreaElement>(null);
  // Positions are only valid on the text that was analysed (see `analyzedValue`).
  const current = useAnalyzedText(value, problems, analyzedValue) === value;
  const noteId = `fc-formula-note-${useId()}`;
  const describedBy = problems.length > 0 ? noteId : undefined;

  useEffect(() => {
    let active = true;
    loadMonaco().then(
      (loaded) => {
        if (active) setMonaco({ status: 'ready', monaco: loaded });
      },
      () => {
        if (active) setMonaco({ status: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  /** "Trocar por X": in Monaco, an edit (it keeps Monaco's undo); in the plain field, the new text. */
  const fix = (problem: WorkflowProblem) => {
    if (!current || problem.suggestion === null || problem.start === null) return;
    const editor = editorRef.current;
    const model = editor?.getModel();
    const range = model && model.getValue() === value ? markerRange(model, problem) : null;
    if (editor && range && model) {
      editor.executeEdits('fc-formula-fix', [{ range, text: fixText(problem.code, markedText(model, range), problem.suggestion) }]);
      // The button leaves the focus on itself; the person goes on editing the formula.
      editor.focus();
      return;
    }
    const end = problem.end ?? problem.start;
    const marked = value.slice(codePointToUtf16(value, problem.start), codePointToUtf16(value, end));
    onChange(replaceCodePoints(value, problem.start, end, fixText(problem.code, marked, problem.suggestion)));
    plainRef.current?.focus();
  };

  let field;
  // Only a language that never arrived turns the field plain: a failed refetch keeps the cached one (and the editor in use).
  if (monaco.status === 'failed' || (language.isError && !language.data)) {
    field = (
      <div className="fc-formula-plain-block">
        <Notice type="warning">O editor de fórmula não carregou. Edite a fórmula neste campo de texto; os problemas aparecem embaixo.</Notice>
        <PlainField
          fieldRef={plainRef}
          value={value}
          onChange={onChange}
          parameters={parameters}
          readOnly={readOnly}
          ariaLabel={ariaLabel}
          describedBy={describedBy}
          invalid={problems.length > 0}
        />
      </div>
    );
  } else if (monaco.status === 'loading' || !language.data || !portal) {
    field = (
      <Loading label="Carregando o editor de fórmula" className="fc-formula-loading">
        <div className="fc-formula-skeleton">
          <Skeleton width="60%" />
          <Skeleton width="35%" />
        </div>
      </Loading>
    );
  } else {
    field = (
      <MonacoField
        monaco={monaco.monaco}
        language={language.data}
        value={value}
        onChange={onChange}
        problems={current ? problems : NO_PROBLEMS}
        invalid={problems.length > 0}
        symbols={symbols}
        parameters={parameters}
        context={context}
        readOnly={readOnly}
        ariaLabel={ariaLabel}
        describedBy={describedBy}
        widgetsContainer={portal}
        editorRef={editorRef}
      />
    );
  }

  return (
    <div className={['fc-formula', problems.length > 0 ? 'fc-formula-invalid' : null, className].filter(Boolean).join(' ')}>
      {field}
      {problems.length > 0 ? (
        <div id={noteId} className="fc-formula-note">
          <AlertIcon />
          <ul className="fc-formula-note-list">
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${problem.start}-${index}`} className="fc-formula-note-item">
                <span>{problem.message}</span>
                {current && problem.suggestion !== null && problem.start !== null && !readOnly ? (
                  <Button size="small" onClick={() => fix(problem)}>
                    Trocar por {fixLabel(problem.code, problem.suggestion)}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** A key of the problem list by content, so a new array with the same problems is not a new analysis. */
function problemsKey(problems: readonly WorkflowProblem[]): string {
  return JSON.stringify(problems.map((problem) => [problem.code, problem.start, problem.end, problem.suggestion, problem.message]));
}

/**
 * The text the problems belong to: `analyzedValue` when the caller gives it; otherwise the `value` of when the current list
 * arrived (a list with other problems counts as a new analysis).
 */
function useAnalyzedText(value: string, problems: readonly WorkflowProblem[], analyzedValue: string | undefined): string {
  const key = problemsKey(problems);
  const [arrival, setArrival] = useState({ key, value });
  if (arrival.key !== key) {
    // Adjusting state during render (React's pattern for deriving from a prop change), without an extra effect pass.
    setArrival({ key, value });
    return analyzedValue ?? value;
  }
  return analyzedValue ?? arrival.value;
}
