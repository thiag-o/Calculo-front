import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, EmptyState, Loading, Notice, Skeleton, Status, Text } from '../../design-system';
import { ParameterForm, parameterErrorsFrom, type ParameterValue } from '../../executions';
import { useDraftEditor } from '../draft';
import { parametersChanged, useLastPreview, useRunParameters, type PreviewRecord } from '../preview';
import { useProblemCounts } from '../problems';
import { CalculatorIcon } from './icons';
import { useRememberedValues } from './memory';
import { CONFLICT_REASON, UNIT_RUN_LABEL, isConflict, isRecordNotFound, problemsReason } from './messages';
import { useUnitRun, type UnitRunRequest } from './queries';
import {
  RECORD_NOT_FOUND_MESSAGE,
  hasKeyOf,
  keyFieldType,
  keyFields,
  keyText,
  readRecordKey,
  sameKey,
  typedFromKey,
  type KeyField,
  type KeyReading,
  type RecordKey,
} from './recordKey';
import { RunError } from './RunError';
import { UnitRunResult, recordStatus } from './UnitRunResult';
import { ValueField } from './ValueField';
import type { FieldErrors, TypedValues } from './values';
import './unit-run.css';

/** Whether the browser holds the date field half typed (it reports it as empty: `validity.badInput`). */
function isIncomplete(form: HTMLFormElement | null, id: string): boolean {
  const control = form?.ownerDocument.getElementById(id);
  return control instanceof HTMLInputElement && control.type === 'date' && control.validity.badInput;
}

function typedText(values: TypedValues, name: string): string {
  const value = values[name];
  return typeof value === 'string' ? value : '';
}

/**
 * "Calcular" with a batch source (E5-12, E5-20): "Escolher registro", by a record of the sample of the last preview or by
 * the key typed, and the trace of that real record of the saved draft. As without a batch source, "Calcular" saves what is
 * pending first (`flush`), is disabled with the reason while the draft has problems, and the key stays in memory, per
 * workflow, while the module is open. A key that no record has (`404 record_not_found`) is said at the key field.
 */
export function RecordRunPanel() {
  const editor = useDraftEditor();
  const { workflowId, definition, symbols, readOnly, flush, save, revision, select, reload, reloadState } = editor;
  const counts = useProblemCounts();
  const [values, setValues] = useRememberedValues(workflowId, 'record_key');
  const fields = useMemo(() => keyFields(definition, symbols), [definition, symbols]);
  const parameters = definition.parameters;
  const parameterForm = useRunParameters(workflowId, parameters);
  // The parameters read on "Calcular", kept while the draft saves (the form is locked meanwhile).
  const readParameters = useRef<Record<string, ParameterValue>>({});
  // The sample of the last preview (D25): the records of the root group (`node_id` null), from the "Prévia" tab's memory.
  const lastPreview = useLastPreview(workflowId);
  // A sample from before the key changed cannot be chosen: its keys have other variables.
  const sample = useMemo(
    () => (lastPreview?.preview.groups.find((group) => group.node_id === null)?.records ?? []).filter((record) => hasKeyOf(fields, record.record_key)),
    [lastPreview, fields],
  );

  const prefix = useId();
  const fieldId = useCallback((name: string) => `${prefix}-${name}`, [prefix]);
  const form = useRef<HTMLFormElement>(null);

  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [request, setRequest] = useState<UnitRunRequest | null>(null);
  // The key was edited after the API said no record has it: the message leaves the field.
  const [editedAfterRun, setEditedAfterRun] = useState(false);
  const [focusField, setFocusField] = useState<{ name: string } | null>(null);
  const [incomplete, setIncomplete] = useState<ReadonlySet<string>>(() => new Set());
  const latest = useRef({ definition, values, symbols, fields });
  latest.current = { definition, values, symbols, fields };
  const runs = useRef(0);
  const busy = useRef(false);

  const run = useUnitRun(workflowId, request);
  const running = saving || run.isFetching;
  const conflict = isConflict(run.error) && request !== null && revision === request.revision;
  // A refused parameter is said at its field of the form (E6-22), not in the result area.
  const showError = run.isError && parameterErrorsFrom(run.error) === null && (conflict || !isConflict(run.error));
  const { applyError } = parameterForm;
  useEffect(() => {
    applyError(run.error);
  }, [run.error, applyError]);
  const notFound = isRecordNotFound(run.error) && !editedAfterRun;

  const reading = useMemo(() => readRecordKey(fields, values, incomplete), [fields, values, incomplete]);
  const typing = useMemo<FieldErrors>(() => (reading.ok ? {} : reading.errors), [reading]);
  // The key changed after "Calcular": the result is of another record.
  const otherRecord = request?.recordKey !== undefined && (!reading.ok || !sameKey(reading.key, request.recordKey));
  // The parameters changed after "Calcular" (D42): the result is of the values used.
  const otherParameters = request?.recordKey !== undefined && parametersChanged(parameters, parameterForm.formProps.values, request.parameters);
  const stale = otherRecord || otherParameters;
  const firstField = fields[0]?.name;

  function errorAt(name: string): string | null {
    if (notFound && name === firstField) return RECORD_NOT_FOUND_MESSAGE;
    return submitted || touched.has(name) ? (typing[name] ?? null) : null;
  }

  const checkIncomplete = useCallback(
    (name: string) => {
      const now = isIncomplete(form.current, fieldId(name));
      setIncomplete((current) => {
        if (current.has(name) === now) return current;
        const next = new Set(current);
        if (now) next.add(name);
        else next.delete(name);
        return next;
      });
    },
    [fieldId],
  );

  function change(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setEditedAfterRun(true);
    checkIncomplete(name);
  }

  /** A record of the sample fills the key fields; "Calcular" runs it. */
  function choose(record: PreviewRecord) {
    setValues(() => typedFromKey(latest.current.fields, record.record_key));
    setEditedAfterRun(true);
    setIncomplete(new Set());
    setTouched(new Set());
    setSubmitted(false);
  }

  /** Reads the key as it is on screen now, with the half-typed dates found in the page. */
  function readScreen(): KeyReading {
    const { fields: current, values: typed } = latest.current;
    const found = new Set(current.map((field) => field.name).filter((name) => isIncomplete(form.current, fieldId(name))));
    setIncomplete(found);
    return readRecordKey(current, typed, found);
  }

  function refuse(errors: FieldErrors) {
    setSubmitted(true);
    const first = latest.current.fields.find((field) => errors[field.name]);
    if (first) setFocusField({ name: first.name });
  }

  const [focusAfterSave, setFocusAfterSave] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!focusAfterSave) return;
    if (focusAfterSave.ownerDocument.activeElement === focusAfterSave.ownerDocument.body) focusAfterSave.focus();
    setFocusAfterSave(null);
  }, [focusAfterSave]);

  useEffect(() => {
    if (!focusField) return;
    form.current?.ownerDocument.getElementById(fieldId(focusField.name))?.focus();
    setFocusField(null);
  }, [focusField, fieldId]);

  // No record with the key: the key field takes the focus, with the message.
  useEffect(() => {
    if (isRecordNotFound(run.error) && firstField) setFocusField({ name: firstField });
    // Only when the answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.error]);

  // After the save (or at once when read-only), what is on screen now is read, in the render that has the save in it.
  const [saved, setSaved] = useState<{ revision: number | null; focused: HTMLElement | null } | null>(null);
  useEffect(() => {
    if (!saved) return;
    setSaved(null);
    busy.current = false;
    setSaving(false);
    if (saved.focused?.isConnected) setFocusAfterSave(saved.focused);
    if (saved.revision === null) {
      setSaveFailed(true);
      return;
    }
    const after = readScreen();
    if (!after.ok) {
      refuse(after.errors);
      return;
    }
    runs.current += 1;
    setEditedAfterRun(false);
    setRequest({
      id: runs.current,
      revision: saved.revision,
      recordKey: after.key,
      parameters: readParameters.current,
      definition: latest.current.definition,
      symbols: latest.current.symbols,
    });
    // Only when the save comes back (readScreen reads the latest screen through a ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  let disabledReason: string | undefined;
  if (counts.total > 0) disabledReason = problemsReason(counts.total);
  else if (save.status === 'conflict' || conflict) disabledReason = CONFLICT_REASON;

  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (disabledReason || running || busy.current) return;
    const before = readScreen();
    const parameterReading = parameterForm.read();
    if (!before.ok || !parameterReading.ok) {
      if (!before.ok) refuse(before.errors);
      return;
    }
    readParameters.current = parameterReading.parameters;
    setSubmitted(false);
    setSaveFailed(false);
    if (readOnly) {
      setSaved({ revision, focused: null });
      return;
    }
    const focused = form.current?.ownerDocument.activeElement;
    busy.current = true;
    setSaving(true);
    let revisionSaved: number | null;
    try {
      revisionSaved = await flush();
    } catch (error) {
      busy.current = false;
      setSaving(false);
      throw error;
    }
    setSaved({ revision: revisionSaved, focused: focused instanceof HTMLElement ? focused : null });
  }

  const chosen = reading.ok ? reading.key : null;

  return (
    <form ref={form} className="fc-unit-run" aria-label={UNIT_RUN_LABEL} noValidate onSubmit={(event) => void calculate(event)}>
      <div className="fc-unit-run-form">
        <div className="fc-unit-run-head">
          <h3 className="fc-unit-run-title">Escolher registro</h3>
          <Button type="submit" variant="primary" size="small" loading={running} disabledReason={disabledReason} showReason="beside">
            {UNIT_RUN_LABEL}
          </Button>
        </div>
        <fieldset className="fc-unit-run-picker" disabled={saving}>
          <legend className="fc-visually-hidden">Registro a calcular</legend>
          <SampleList sample={sample} chosen={chosen} onChoose={choose} />
          {fields.length === 0 ? (
            <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
              A fonte do lote ainda não tem chave. Escolha a chave no painel do workflow.
            </Text>
          ) : (
            <div className="fc-unit-run-key" role="group" aria-label="Chave do registro">
              <span className="fc-unit-run-subtitle" aria-hidden="true">
                Chave do registro
              </span>
              <div className="fc-unit-run-inputs">
                {fields.map((field) => (
                  <KeyValueField
                    key={field.name}
                    field={field}
                    id={fieldId(field.name)}
                    value={typedText(values, field.name)}
                    error={errorAt(field.name)}
                    onBlur={() => {
                      setTouched((current) => (current.has(field.name) ? current : new Set(current).add(field.name)));
                      checkIncomplete(field.name);
                    }}
                    onChange={(value) => change(field.name, value)}
                  />
                ))}
              </div>
            </div>
          )}
        </fieldset>
        {parameters.length > 0 ? (
          <div className="fc-unit-run-parameters">
            <span className="fc-unit-run-subtitle" aria-hidden="true">
              Parâmetros
            </span>
            <ParameterForm {...parameterForm.formProps} disabled={running} />
          </div>
        ) : null}
      </div>

      <div className="fc-unit-run-output">
        {saveFailed && !running && save.status !== 'saved' ? (
          <Notice type="error" title="O rascunho não foi salvo">
            Calcular roda o rascunho salvo. Resolva o aviso no topo do editor e calcule de novo.
          </Notice>
        ) : running ? (
          <Loading label="Calculando" className="fc-unit-run-loading">
            <Skeleton width={120} />
            <Skeleton width="60%" />
            <Skeleton width="80%" />
          </Loading>
        ) : request === null || (run.isError && !showError) ? (
          <EmptyState
            className="fc-unit-run-empty"
            icon={<CalculatorIcon />}
            title="Nenhum cálculo ainda"
            description="Escolha um registro da amostra ou digite a chave e clique em Calcular para ver o trace."
          />
        ) : showError ? (
          <RunError error={run.error} reloading={reloadState.reloading} reloadError={reloadState.error !== null} onReload={() => void reload()} />
        ) : run.data ? (
          <>
            {stale ? (
              <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-stale">
                {otherRecord
                  ? 'Resultado de outro registro. Calcule de novo para ver o do registro escolhido.'
                  : 'Resultado de parâmetros anteriores. Calcule de novo para ver o dos parâmetros atuais.'}
              </Text>
            ) : null}
            <UnitRunResult
              run={run.data}
              definition={request.definition}
              symbols={request.symbols}
              currentDefinition={definition}
              onSelectNode={(id) => select({ type: 'node', id })}
            />
          </>
        ) : null}
        <span className="fc-visually-hidden" role="status">
          {run.data && !running ? `Resultado do cálculo: ${recordStatus[run.data.status].word}` : ''}
        </span>
      </div>
    </form>
  );
}

interface SampleListProps {
  sample: readonly PreviewRecord[];
  chosen: RecordKey | null;
  onChoose: (record: PreviewRecord) => void;
}

/** The records of the sample of the last preview, with the status each one had there; choosing one fills the key. */
function SampleList({ sample, chosen, onChoose }: SampleListProps) {
  if (sample.length === 0) {
    return (
      <Text as="p" variant="label-13" emphasis="secondary" className="fc-unit-run-none">
        Rode a prévia para escolher um registro da amostra, ou digite a chave.
      </Text>
    );
  }
  return (
    <div className="fc-unit-run-sample">
      <span className="fc-unit-run-subtitle" aria-hidden="true">
        Amostra da última prévia
      </span>
      <ul className="fc-unit-run-sample-list" aria-label="Amostra da última prévia">
        {sample.map((record) => {
          const text = keyText(record.record_key);
          const status = recordStatus[record.status];
          const pressed = chosen !== null && sameKey(chosen, record.record_key);
          return (
            <li key={text}>
              <button
                type="button"
                className="fc-unit-run-sample-item"
                aria-pressed={pressed}
                aria-label={`Escolher ${text} (${status.word} na prévia)`}
                onClick={() => onChoose(record)}
              >
                <span className="fc-unit-run-name">{text}</span>
                <Status tone={status.tone}>{status.word}</Status>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface KeyValueFieldProps {
  field: KeyField;
  id: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function KeyValueField({ field, id, value, error, onChange, onBlur }: KeyValueFieldProps) {
  const type = keyFieldType(field);
  return (
    <ValueField
      id={id}
      label={field.name}
      type={type}
      scale={type === 'decimal' ? field.scale : undefined}
      value={value}
      error={error}
      onBlur={onBlur}
      onChange={onChange}
    />
  );
}
