import { useDraftEditor } from '../draft';
import { CommitTextField, PathSelect, problemsAt } from '../properties';
import { ERROR_LIMIT_PATH, TRACE_LEVEL_PATH } from './parameterProblems';
import {
  DEFAULT_ERROR_LIMIT_PERCENT,
  DEFAULT_TRACE_LEVEL,
  ERROR_LIMIT_NOTE,
  ERROR_LIMIT_RULE_MESSAGE,
  TRACE_LEVEL_NOTES,
  TRACE_LEVEL_OPTIONS,
  formatErrorLimit,
  readErrorLimit,
  type TraceLevel,
} from './parameterRules';
import './parameters.css';

const validateLimit = (text: string) => (readErrorLimit(text) === null ? ERROR_LIMIT_RULE_MESSAGE : null);

type Definition = ReturnType<typeof useDraftEditor>['definition'];
// What the definition holds now, or the contract's default when it lacks it: a change writes both settings, always.
function currentSettings(definition: Definition) {
  // A draft of an older form lacks the two, whatever the generated type says.
  const settings: Partial<Pick<Definition['settings'], 'error_limit_percent' | 'trace_level'>> = definition.settings;
  return { errorLimit: settings.error_limit_percent ?? DEFAULT_ERROR_LIMIT_PERCENT, traceLevel: settings.trace_level ?? DEFAULT_TRACE_LEVEL };
}
const currentErrorLimit = (definition: Definition) => currentSettings(definition).errorLimit;
const currentTraceLevel = (definition: Definition) => currentSettings(definition).traceLevel;

/**
 * The Execução section of the workflow panel (E6-17): the error limit, in percent typed in the Brazilian pattern (`2,5`),
 * and the trace level (Mínimo, Padrão or Completo), each with a line that says what it does.
 */
export function ExecutionSection() {
  const { definition, problems, change } = useDraftEditor();
  // A draft of an older form (the real API served it) lacks the two settings: the contract's defaults show in their place.
  const errorLimit = currentErrorLimit(definition);
  const traceLevel = currentTraceLevel(definition);
  return (
    <fieldset className="fc-properties-group">
      <legend className="fc-properties-group-title">Execução</legend>
      <CommitTextField
        label="Limite de erro (%)"
        value={formatErrorLimit(errorLimit)}
        maxLength={6}
        tooltip={ERROR_LIMIT_NOTE}
        className="fc-parameters-mono"
        path={ERROR_LIMIT_PATH}
        problems={problemsAt(problems, ERROR_LIMIT_PATH)}
        validate={validateLimit}
        onCommit={(text) => {
          const limit = readErrorLimit(text)!;
          change((current) => ({ ...current, settings: { ...current.settings, error_limit_percent: limit, trace_level: currentTraceLevel(current) } }), { mergeKey: ERROR_LIMIT_PATH });
        }}
      />
      <PathSelect
        label="Nível do trace"
        value={traceLevel}
        options={TRACE_LEVEL_OPTIONS}
        tooltip={TRACE_LEVEL_NOTES[traceLevel]}
        path={TRACE_LEVEL_PATH}
        problems={problemsAt(problems, TRACE_LEVEL_PATH)}
        onChange={(level) => change((current) => ({ ...current, settings: { ...current.settings, error_limit_percent: currentErrorLimit(current), trace_level: level as TraceLevel } }))}
      />
    </fieldset>
  );
}
