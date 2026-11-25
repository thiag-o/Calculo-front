import { useDraftEditor } from '../draft';
import { CommitTextField, PathSelect, problemsAt } from '../properties';
import { ERROR_LIMIT_PATH, PRE_VALIDATION_ALERT_PATH, TRACE_LEVEL_PATH } from './parameterProblems';
import {
  DEFAULT_ERROR_LIMIT_PERCENT,
  DEFAULT_PRE_VALIDATION_ALERT_PERCENT,
  DEFAULT_TRACE_LEVEL,
  ERROR_LIMIT_NOTE,
  PERCENT_RULE_MESSAGE,
  PRE_VALIDATION_ALERT_NOTE,
  TRACE_LEVEL_NOTES,
  TRACE_LEVEL_OPTIONS,
  formatPercent,
  readPercent,
  type TraceLevel,
} from './parameterRules';
import './parameters.css';

const validatePercent = (text: string) => (readPercent(text) === null ? PERCENT_RULE_MESSAGE : null);

type Definition = ReturnType<typeof useDraftEditor>['definition'];
type RunSettings = Pick<Definition['settings'], 'error_limit_percent' | 'trace_level' | 'pre_validation_alert_percent'>;

/** What the definition holds now, or the contract's default when it lacks it: a change writes the three settings, always. */
function currentSettings(definition: Definition): RunSettings {
  // A draft of an older form lacks them, whatever the generated type says.
  const settings: Partial<RunSettings> = definition.settings;
  return {
    error_limit_percent: settings.error_limit_percent ?? DEFAULT_ERROR_LIMIT_PERCENT,
    trace_level: settings.trace_level ?? DEFAULT_TRACE_LEVEL,
    pre_validation_alert_percent: settings.pre_validation_alert_percent ?? DEFAULT_PRE_VALIDATION_ALERT_PERCENT,
  };
}

/**
 * The Execução section of the workflow panel (E6-17, E7-23): the error limit and the alert of empty fields of the
 * pre-validation, each a percent typed in the Brazilian pattern (`2,5`), and the trace level (Mínimo, Padrão or Completo),
 * each with a line that says what it does.
 */
export function ExecutionSection() {
  const { definition, problems, change } = useDraftEditor();
  // A draft of an older form (the real API served it) lacks the settings: the contract's defaults show in their place.
  const settings = currentSettings(definition);

  function set(changed: Partial<RunSettings>, mergeKey?: string) {
    change((current) => ({ ...current, settings: { ...current.settings, ...currentSettings(current), ...changed } }), mergeKey ? { mergeKey } : undefined);
  }

  return (
    <fieldset className="fc-properties-group">
      <legend className="fc-properties-group-title">Execução</legend>
      <CommitTextField
        label="Limite de erro (%)"
        value={formatPercent(settings.error_limit_percent)}
        maxLength={6}
        tooltip={ERROR_LIMIT_NOTE}
        className="fc-parameters-mono"
        path={ERROR_LIMIT_PATH}
        problems={problemsAt(problems, ERROR_LIMIT_PATH)}
        validate={validatePercent}
        onCommit={(text) => set({ error_limit_percent: readPercent(text)! }, ERROR_LIMIT_PATH)}
      />
      <CommitTextField
        label="Alerta de campos vazios (%)"
        value={formatPercent(settings.pre_validation_alert_percent)}
        maxLength={6}
        tooltip={PRE_VALIDATION_ALERT_NOTE}
        className="fc-parameters-mono"
        path={PRE_VALIDATION_ALERT_PATH}
        problems={problemsAt(problems, PRE_VALIDATION_ALERT_PATH)}
        validate={validatePercent}
        onCommit={(text) => set({ pre_validation_alert_percent: readPercent(text)! }, PRE_VALIDATION_ALERT_PATH)}
      />
      <PathSelect
        label="Nível do trace"
        value={settings.trace_level}
        options={TRACE_LEVEL_OPTIONS}
        tooltip={TRACE_LEVEL_NOTES[settings.trace_level]}
        path={TRACE_LEVEL_PATH}
        problems={problemsAt(problems, TRACE_LEVEL_PATH)}
        onChange={(level) => set({ trace_level: level as TraceLevel })}
      />
    </fieldset>
  );
}
