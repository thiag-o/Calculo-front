import { useRef } from 'react';
import { Button, Checkbox, FieldMessage, Text } from '../../design-system';
import { READ_ONLY_REASON, useDraftEditor, type WorkflowDefinition, type WorkflowProblem } from '../draft';
import {
  CommitTextField,
  NAME_PATTERN,
  NAME_RULE_MESSAGE,
  NAME_TOOLTIP,
  PathSelect,
  SegmentedControl,
  parseScale,
  problemText,
  useFieldsState,
  useFocusOnSelection,
} from '../properties';
import { TrashIcon } from './icons';
import { LiteralField } from './LiteralField';
import { LiteralList } from './LiteralList';
import { parameterKey, updateParameter } from './parameterIdentity';
import type { ParameterProblems } from './parameterProblems';
import {
  DESCRIPTION_MAX,
  PARAMETER_NAME_TAKEN_MESSAGE,
  PARAMETER_TYPE_OPTIONS,
  RELATIVE_LABELS,
  defaultKind,
  defaultOfKind,
  relativesFor,
  takesAllowedValues,
  takesFixedDefault,
  takesList,
  withList,
  withParameterType,
  type DefaultKind,
  type ParameterType,
  type ValueType,
  type WorkflowParameter,
} from './parameterRules';

const SCALE_RULE_MESSAGE = 'Use um número inteiro de 0 a 18.';
const validateScale = (text: string) => (parseScale(text) === null ? SCALE_RULE_MESSAGE : null);

const KIND_LABELS: Readonly<Record<DefaultKind, string>> = { none: 'Nenhum', fixed: 'Fixo', relative: 'Relativo' };

export interface ParameterItemProps {
  parameter: WorkflowParameter;
  /** Where the parameter was in the analysed definition (`parameters[1]`), or `null` if it was not analysed yet. */
  at: string | null;
  /** The parameter as it was analysed: the problems of a value of a list only show while that value is still there. */
  analyzed: WorkflowParameter | null;
  /** Its problems, by field (found in the analysed definition). */
  problems: ParameterProblems;
  /** How many times each parameter name is used: a repeated name cannot go to the draft (a shape error). */
  names: ReadonlyMap<string, number>;
  onRemove: () => void;
}

/** The fixed values of a default (a list, or one value as a list of one). */
function fixedList(parameter: WorkflowParameter | null): readonly string[] | null {
  const current = parameter?.default;
  if (current?.kind !== 'fixed') return null;
  return Array.isArray(current.value) ? current.value : null;
}

function problemList(problems: readonly WorkflowProblem[]) {
  if (problems.length === 0) return null;
  return (
    <ul className="fc-properties-problems" aria-label="Problemas">
      {problems.map((problem, index) => (
        <li key={`${problem.code}-${problem.path ?? ''}-${index}`}>
          <FieldMessage type="error">{problem.message}</FieldMessage>
        </li>
      ))}
    </ul>
  );
}

/**
 * One parameter (E6-17): name and type (with the places of a `decimal`), Lista (not in the Período nor in the Booleano),
 * Obrigatório, the Padrão (Nenhum, Fixo or Relativo, only with the relatives that serve the type), the Valores permitidos
 * (only in text, integer and date) and the Descrição. Each problem shows beside its field, by `path`.
 */
export function ParameterItem({ parameter, at, analyzed, problems: sorted, names, onRemove }: ParameterItemProps) {
  const { change } = useDraftEditor();
  const { readOnly, reasonId } = useFieldsState();
  const key = parameterKey(parameter);
  const path = (field: string) => (at === null ? null : `${at}.${field}`);
  const scope = parameter.name;
  const listBox = useRef<HTMLButtonElement>(null);
  const requiredBox = useRef<HTMLButtonElement>(null);
  useFocusOnSelection(path('list'), () => listBox.current);
  useFocusOnSelection(path('required'), () => requiredBox.current);

  function update(apply: (current: WorkflowParameter, definition: WorkflowDefinition) => WorkflowParameter, field?: string) {
    change((current) => updateParameter(current, parameter, apply), field ? { mergeKey: `parameter:${key}.${field}` } : undefined);
  }

  const validateName = (text: string) => {
    if (!NAME_PATTERN.test(text)) return NAME_RULE_MESSAGE;
    return (names.get(text) ?? 0) > (text === parameter.name ? 1 : 0) ? PARAMETER_NAME_TAKEN_MESSAGE : null;
  };

  const relatives = relativesFor(parameter.type, parameter.list);
  const kind = defaultKind(parameter);
  // The Data e hora has no Fixo (D36); a fixed default already in the definition keeps its option, to be changed.
  const kinds: DefaultKind[] = (['none', 'fixed', 'relative'] as const).filter(
    (option) =>
      option === 'none' ||
      option === kind ||
      (option === 'fixed' ? takesFixedDefault(parameter.type) : relatives.length > 0),
  );
  const whole = sorted.defaults.filter(({ spot }) => spot === 'whole').map(({ problem }) => problem);
  const wholePath = whole[0]?.path ?? path('default');
  const valueType: ValueType | null = parameter.type === 'period' ? 'date' : parameter.type === 'datetime' ? null : parameter.type;
  const shownList = fixedList(parameter);
  const analyzedList = fixedList(analyzed);
  // A problem of a value of a list shows only while the same value is at the same place (ADR 0044).
  const listProblems = (index: number, spots: { problem: WorkflowProblem; spot: unknown }[], before: readonly string[] | null, now: readonly string[]) =>
    spots.filter(({ spot }) => spot === index).filter(() => before?.[index] === now[index]).map(({ problem }) => problem);
  const allowed = parameter.allowed_values ?? [];
  const allowedWhole = sorted.allowed.filter(({ spot }) => spot === null).map(({ problem }) => problem);
  const endProblems = (end: 'start' | 'end') => sorted.defaults.filter(({ spot }) => spot === end).map(({ problem }) => problem);
  // The problems of the default as a whole show once: at the Valor relativo of a relative default, at the value of a fixed
  // one; with no default, a list, a period or a Data e hora (no field for the whole value), at the Padrão control.
  const wholeAtControl =
    kind === 'none' || (kind === 'fixed' && (parameter.list || parameter.type === 'period' || valueType === null));

  return (
    <li className="fc-properties-item">
      <div role="group" aria-label={`Parâmetro ${parameter.name}`} className="fc-properties-item-group">
        {problemList(sorted.other)}
        <CommitTextField
          label="Nome"
          scope={scope}
          value={parameter.name}
          mono
          maxLength={63}
          tooltip={NAME_TOOLTIP}
          path={path('name')}
          problems={sorted.name}
          validate={validateName}
          onCommit={(name) => update((current) => ({ ...current, name }), 'name')}
        />
        <div className="fc-properties-row">
          <PathSelect
            label="Tipo"
            scope={scope}
            value={parameter.type}
            options={PARAMETER_TYPE_OPTIONS}
            path={path('type')}
            problems={sorted.type}
            onChange={(type) =>
              update((current, definition) => withParameterType(current, type as ParameterType, definition.settings.rounding.scale))
            }
          />
          {parameter.type === 'decimal' ? (
            <CommitTextField
              label="Casas decimais"
              scope={scope}
              value={String(parameter.scale ?? '')}
              inputMode="numeric"
              maxLength={2}
              path={path('scale')}
              problems={sorted.scale}
              validate={validateScale}
              onCommit={(text) => update((current) => ({ ...current, scale: parseScale(text)! }), 'scale')}
            />
          ) : null}
        </div>
        <div className="fc-parameters-checks">
          {takesList(parameter.type) ? (
            <Checkbox
              ref={listBox}
              label="Lista"
              aria-label={`Lista (${scope})`}
              tooltip="Recebe de 1 a 100 valores do tipo, usados com em"
              checked={parameter.list}
              error={problemText(sorted.list)}
              disabled={readOnly}
              aria-describedby={reasonId}
              onCheckedChange={(checked) => update((current) => withList(current, checked === true))}
            />
          ) : null}
          <Checkbox
            ref={requiredBox}
            label="Obrigatório"
            aria-label={`Obrigatório (${scope})`}
            checked={parameter.required}
            error={problemText(sorted.required)}
            disabled={readOnly}
            aria-describedby={reasonId}
            onCheckedChange={(checked) => update((current) => ({ ...current, required: checked === true }))}
          />
        </div>
        <SegmentedControl
          label="Padrão"
          scope={scope}
          options={kinds.map((value) => ({ value, label: KIND_LABELS[value] }))}
          value={kind}
          path={wholeAtControl ? wholePath : null}
          problems={wholeAtControl ? whole : []}
          onChange={(next) => update((current) => ({ ...current, default: defaultOfKind(current, next) }))}
        />
        {parameter.default?.kind === 'relative' ? (
          <PathSelect
            label="Valor relativo"
            scope={scope}
            value={parameter.default.value}
            options={relatives.map((value) => ({ value, label: RELATIVE_LABELS[value] }))}
            path={wholePath}
            problems={whole}
            onChange={(value) =>
              update((current) => ({ ...current, default: { kind: 'relative', value: value as (typeof relatives)[number] } }))
            }
          />
        ) : null}
        {parameter.default?.kind === 'fixed' && parameter.type === 'period' ? (
          <div className="fc-properties-row">
            {(['start', 'end'] as const).map((end) => {
              const value = parameter.default?.kind === 'fixed' ? parameter.default.value : null;
              const period = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : { start: '', end: '' };
              const own = endProblems(end);
              return (
                <LiteralField
                  key={end}
                  label={end === 'start' ? 'Início' : 'Fim'}
                  scope={scope}
                  type="date"
                  scale={null}
                  literal={period[end]}
                  path={own[0]?.path ?? path(`default.value.${end}`)}
                  problems={own}
                  onCommit={(literal) =>
                    update((current) => {
                      const was = current.default?.kind === 'fixed' ? current.default.value : null;
                      const ends = was !== null && typeof was === 'object' && !Array.isArray(was) ? was : { start: '', end: '' };
                      return { ...current, default: { kind: 'fixed', value: { ...ends, [end]: literal } } };
                    }, `default.${end}`)
                  }
                />
              );
            })}
          </div>
        ) : null}
        {parameter.default?.kind === 'fixed' && valueType === null ? (
          <Text as="p" variant="label-12" emphasis="secondary" className="fc-parameters-note">
            Data e hora não tem padrão fixo. Escolha Nenhum ou Relativo.
          </Text>
        ) : null}
        {parameter.default?.kind === 'fixed' && valueType !== null && parameter.type !== 'period' && !parameter.list ? (
          <LiteralField
            label="Valor padrão"
            scope={scope}
            type={valueType}
            scale={parameter.scale}
            literal={typeof parameter.default.value === 'string' ? parameter.default.value : ''}
            path={wholePath}
            problems={whole}
            onCommit={(literal) => update((current) => ({ ...current, default: { kind: 'fixed', value: literal } }), 'default')}
          />
        ) : null}
        {parameter.default?.kind === 'fixed' && valueType !== null && parameter.list && shownList ? (
          <LiteralList
            legend="Valores padrão"
            itemLabel="Valor padrão"
            addLabel="Incluir valor padrão"
            scope={scope}
            type={valueType}
            scale={parameter.scale}
            literals={shownList}
            minimum={1}
            problemsAt={(index) => listProblems(index, sorted.defaults, analyzedList, shownList)}
            pathAt={(index) => sorted.defaults.find(({ spot }) => spot === index)?.problem.path ?? path(`default.value[${index}]`)}
            onChange={(apply, item) =>
              update(
                (current) => ({ ...current, default: { kind: 'fixed', value: apply(fixedList(current) ?? []) } }),
                item === undefined ? undefined : `default[${item}]`,
              )
            }
          />
        ) : null}
        {takesAllowedValues(parameter.type) && valueType !== null ? (
          <LiteralList
            legend="Valores permitidos"
            itemLabel="Valor permitido"
            addLabel="Incluir valor permitido"
            scope={scope}
            type={valueType}
            scale={parameter.scale}
            literals={allowed}
            minimum={0}
            problems={problemList(allowedWhole)}
            emptyNote={
              <Text as="p" variant="label-12" emphasis="secondary" className="fc-parameters-note">
                Sem restrição: aceita qualquer valor do tipo.
              </Text>
            }
            problemsAt={(index) => listProblems(index, sorted.allowed, analyzed?.allowed_values ?? null, allowed)}
            pathAt={(index) => sorted.allowed.find(({ spot }) => spot === index)?.problem.path ?? path(`allowed_values[${index}]`)}
            onChange={(apply, item) =>
              update(
                (current) => {
                  const literals = apply(current.allowed_values ?? []);
                  return { ...current, allowed_values: literals.length > 0 ? literals : null };
                },
                item === undefined ? undefined : `allowed[${item}]`,
              )
            }
          />
        ) : null}
        <CommitTextField
          label="Descrição"
          scope={scope}
          value={parameter.description ?? ''}
          maxLength={DESCRIPTION_MAX}
          path={path('description')}
          problems={sorted.description}
          onCommit={(text) => update((current) => ({ ...current, description: text === '' ? null : text }), 'description')}
        />
        <div className="fc-properties-item-actions">
          <Button
            iconOnly
            variant="ghost"
            size="small"
            label={`Remover parâmetro (${scope})`}
            icon={<TrashIcon size={14} />}
            disabledReason={readOnly ? READ_ONLY_REASON : undefined}
            onClick={onRemove}
          />
        </div>
      </div>
    </li>
  );
}
