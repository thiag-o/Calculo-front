import { useDraftEditor } from '../draft';
import { CommitTextField, ErrorPolicyField, PropertiesFrame, RoundingModeField, parseScale } from './fields';
import { SCALE_RULE_MESSAGE } from './labels';
import { SETTINGS_PATH, otherProblems, problemsAt } from './problemPaths';

const ERROR_POLICY_PATH = `${SETTINGS_PATH}.error_policy`;
const SCALE_PATH = `${SETTINGS_PATH}.rounding.scale`;
const MODE_PATH = `${SETTINGS_PATH}.rounding.mode`;
const SHOWN = new Set([ERROR_POLICY_PATH, SCALE_PATH, MODE_PATH]);

/**
 * The workflow settings, shown when nothing is selected: the error policy and the default rounding (places and mode) that
 * the blocks inherit.
 */
export function WorkflowProperties() {
  const { definition, problems, change } = useDraftEditor();
  const { settings } = definition;

  return (
    <PropertiesFrame title="Workflow" problems={otherProblems(problems, SETTINGS_PATH, SHOWN, true)}>
      <ErrorPolicyField
        value={settings.error_policy}
        path={ERROR_POLICY_PATH}
        problems={problemsAt(problems, ERROR_POLICY_PATH)}
        onChange={(policy) => {
          if (policy === null) return;
          change((current) => ({ ...current, settings: { ...current.settings, error_policy: policy } }));
        }}
      />
      <fieldset className="fc-properties-group">
        <legend className="fc-properties-group-title">Arredondamento padrão</legend>
        <CommitTextField
          label="Casas decimais"
          value={String(settings.rounding.scale)}
          inputMode="numeric"
          maxLength={2}
          tooltip="As casas oferecidas a uma saída decimal nova"
          path={SCALE_PATH}
          problems={problemsAt(problems, SCALE_PATH)}
          validate={(text) => (parseScale(text) === null ? SCALE_RULE_MESSAGE : null)}
          onCommit={(text) => {
            const scale = parseScale(text)!;
            change(
              (current) => ({ ...current, settings: { ...current.settings, rounding: { ...current.settings.rounding, scale } } }),
              { mergeKey: SCALE_PATH },
            );
          }}
        />
        <RoundingModeField
          value={settings.rounding.mode}
          path={MODE_PATH}
          problems={problemsAt(problems, MODE_PATH)}
          onChange={(mode) => {
            if (mode === null) return;
            change((current) => ({ ...current, settings: { ...current.settings, rounding: { ...current.settings.rounding, mode } } }));
          }}
        />
      </fieldset>
    </PropertiesFrame>
  );
}
