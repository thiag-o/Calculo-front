import { useDraftEditor } from '../draft';
import { CommitTextField, PathSelect, problemsAt } from '../properties';
import { ERROR_LIMIT_PATH, TRACE_LEVEL_PATH } from './parameterProblems';
import {
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

/**
 * The Execução section of the workflow panel (E6-17): the error limit, in percent typed in the Brazilian pattern (`2,5`),
 * and the trace level (Mínimo, Padrão or Completo), each with a line that says what it does.
 */
export function ExecutionSection() {
  const { definition, problems, change } = useDraftEditor();
  const { settings } = definition;
  return (
    <fieldset className="fc-properties-group">
      <legend className="fc-properties-group-title">Execução</legend>
      <CommitTextField
        label="Limite de erro (%)"
        value={formatErrorLimit(settings.error_limit_percent)}
        maxLength={6}
        tooltip={ERROR_LIMIT_NOTE}
        className="fc-parameters-mono"
        path={ERROR_LIMIT_PATH}
        problems={problemsAt(problems, ERROR_LIMIT_PATH)}
        validate={validateLimit}
        onCommit={(text) => {
          const limit = readErrorLimit(text)!;
          change((current) => ({ ...current, settings: { ...current.settings, error_limit_percent: limit } }), { mergeKey: ERROR_LIMIT_PATH });
        }}
      />
      <PathSelect
        label="Nível do trace"
        value={settings.trace_level}
        options={TRACE_LEVEL_OPTIONS}
        tooltip={TRACE_LEVEL_NOTES[settings.trace_level]}
        path={TRACE_LEVEL_PATH}
        problems={problemsAt(problems, TRACE_LEVEL_PATH)}
        onChange={(level) => change((current) => ({ ...current, settings: { ...current.settings, trace_level: level as TraceLevel } }))}
      />
    </fieldset>
  );
}
